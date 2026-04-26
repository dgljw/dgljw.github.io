export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支持 POST 请求' });
  }

  const { messages } = req.body;  // 现在前端会传完整的 messages 数组过来

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: '请提供 messages 数组' });
  }

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messages,  // 直接使用前端传来的完整历史
        temperature: 0.7,
        stream: false
      })
    });

    const data = await response.json();
    if (data.choices && data.choices[0]) {
      return res.status(200).json({ reply: data.choices[0].message.content });
    } else {
      return res.status(500).json({ error: 'API 返回格式异常', detail: data });
    }
  } catch (error) {
    return res.status(500).json({ error: '服务器内部错误', detail: error.message });
  }
}