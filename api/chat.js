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

  // 清理 reasoning_content
  let cleanedMessages = messages.map(msg => {
    const { reasoning_content, ...rest } = msg;
    return rest;
  });

  try {
    // 如果开启了搜索，先获取搜索结果并注入到上下文
    if (enable_search) {
      const lastUserMsg = cleanedMessages.filter(m => m.role === 'user').pop();
      if (lastUserMsg) {
        const searchQuery = lastUserMsg.content.trim();
        const searchResults = await performWebSearch(searchQuery);
        if (searchResults) {
          // 在用户消息前插入一条系统消息，携带搜索结果
          cleanedMessages.splice(cleanedMessages.length - 1, 0, {
            role: 'system',
            content: `[最新网络搜索结果]\n${searchResults}\n\n请根据以上最新信息回答用户的问题。`
          });
        }
      }
    }

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
      console.error('DeepSeek API 错误:', response.status, errorText);
      return res.status(response.status).json({ error: '模型请求失败', detail: errorText });
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;
    if (message) {
      return res.status(200).json({ reply: message.content });
    } else {
      return res.status(500).json({ error: 'AI 返回内容为空' });
    }
  } catch (error) {
    console.error('Serverless 函数错误:', error);
    return res.status(500).json({ error: '服务器内部错误', detail: error.message });
  }
}

// 使用 DuckDuckGo 搜索
async function performWebSearch(query) {
  try {
    const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`);
    if (!res.ok) return null;
    const data = await res.json();
    const results = [];
    if (data.AbstractText) results.push(data.AbstractText);
    if (data.RelatedTopics && data.RelatedTopics.length) {
      data.RelatedTopics.slice(0, 4).forEach(topic => {
        if (topic.Text) results.push(topic.Text);
      });
    }
    return results.length ? results.join('\n\n') : null;
  } catch (e) {
    console.error('搜索失败:', e);
    return null;
  }
}