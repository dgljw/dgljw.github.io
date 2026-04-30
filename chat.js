// api/chat.js
export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支持 POST 请求' });
  }

  const { messages, enable_search } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: '请提供 messages 数组' });
  }

  let cleanedMessages = messages.map(msg => {
    const { reasoning_content, ...rest } = msg;
    return rest;
  });

  try {
    if (enable_search) {
      const lastUserMsg = cleanedMessages.filter(m => m.role === 'user').pop();
      if (lastUserMsg) {
        const searchQuery = lastUserMsg.content.trim();
        console.log('🔍 开始联网搜索:', searchQuery);
        const searchResults = await performWebSearch(searchQuery);
        console.log('📡 搜索完成，结果长度:', searchResults?.length || 0);
        if (searchResults) {
          cleanedMessages.splice(cleanedMessages.length - 1, 0, {
            role: 'system',
            content: `[最新网络搜索结果]\n${searchResults}\n\n请根据以上最新信息回答用户的问题。如果信息不足以回答，请如实告知。`
          });
        } else {
          console.warn('⚠️ 搜索无结果，将直接回答');
        }
      }
    }

    console.log('🚀 准备调用 DeepSeek API, 消息数:', cleanedMessages.length);
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: cleanedMessages,
        max_tokens: 1024,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ DeepSeek API 错误:', response.status, errorText);
      return res.status(response.status).json({ error: '模型请求失败', detail: errorText });
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;
    if (message) {
      return res.status(200).json({ reply: message.content });
    } else {
      console.error('❌ AI 返回格式异常:', JSON.stringify(data));
      return res.status(500).json({ error: 'AI 返回内容为空' });
    }
  } catch (error) {
    console.error('💥 Serverless 函数崩溃:', error);
    return res.status(500).json({ error: '服务器内部错误', detail: error.message });
  }
}

// 使用 Bing 搜索（免费、稳定、无需 API Key）
async function performWebSearch(query) {
  try {
    console.log('🔎 正在请求 Bing 搜索...');
    const res = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(query)}&format=rss`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DeepSeekBot/1.0)' }
    });
    if (!res.ok) {
      console.error('❌ Bing 搜索请求失败:', res.status);
      return null;
    }
    const text = await res.text();
    // 提取 RSS 摘要里的描述内容
    const snippets = text.match(/<description>(.*?)<\/description>/g) || [];
    const results = snippets.slice(0, 5).map(s => s.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
    return results.length ? results.join('\n\n') : null;
  } catch (e) {
    console.error('❌ 搜索失败:', e);
    return null;
  }
}