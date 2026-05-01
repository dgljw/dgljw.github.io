// 聊天代理：转发请求到 DeepSeek，支持联网搜索注入
export default async function handler(req, res) {
  // 设置 CORS 头（允许前端跨域调用）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { messages, enableSearch } = req.body;
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    // 如果启用联网搜索，先获取搜索结果并注入到系统消息
    let finalMessages = messages;
    if (enableSearch) {
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      if (lastUserMsg) {
        const query = lastUserMsg.content;
        const searchResult = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`)
          .then(r => r.json())
          .then(data => {
            const snippet = data.AbstractText;
            if (snippet) return `[联网搜索结果] ${snippet}`;
            return '';
          })
          .catch(() => '');
        
        if (searchResult) {
          finalMessages = [
            { role: 'system', content: `以下是与用户提问相关的实时信息，请参考：\n${searchResult}` },
            ...messages
          ];
        }
      }
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: finalMessages,
        max_tokens: 1024,
        stream: false,
        thinking: { type: 'disabled' }
      })
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}