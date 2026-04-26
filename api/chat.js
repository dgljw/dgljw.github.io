// api/chat.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支持 POST 请求' });
  }

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: '请提供 messages 数组' });
  }

  // 清理历史中的 reasoning_content，避免 API 报错
  const cleanedMessages = messages.map(msg => {
    const { reasoning_content, ...rest } = msg;
    return rest;
  });

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-v4-pro',
        messages: cleanedMessages,
        reasoning_effort: 'high',
        extra_body: { thinking: { type: 'enabled' } },
        stream: false, // ★ 非流式，一次性返回
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({ error: 'API 请求失败', detail: errorText });
    }

    const data = await response.json();
    const message = data.choices[0]?.message;

    if (message) {
      return res.status(200).json({
        reply: message.content,
        reasoning_content: message.reasoning_content || null
      });
    } else {
      return res.status(500).json({ error: 'API 返回格式异常', detail: data });
    }
  } catch (error) {
    return res.status(500).json({ error: '服务器内部错误', detail: error.message });
  }
}