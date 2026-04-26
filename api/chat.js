// api/chat.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支持 POST 请求' });
  }

  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: '请提供 messages 数组' });
  }

  // ★ 在发送给API前，清理掉历史消息中的 reasoning_content (思考链)
  // 在多轮对话中，这能让过程更清晰，避免模型困惑
  const cleanedMessages = messages.map(msg => {
    const { reasoning_content, ...rest } = msg;
    return rest;
  });

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-v4-pro', // ★ 已切换至 V4 Pro
        messages: cleanedMessages,
        reasoning_effort: 'high',  // ★ 思考强度设为高，可选 max
        extra_body: {              // ★ 开启思考模式
          thinking: { type: 'enabled' }
        },
        stream: false
        // 注意：思考模式下，temperature 和 top_p 参数是无效的，可不传
      })
    });

    const data = await response.json();

    if (data.choices && data.choices[0]) {
      const message = data.choices[0].message;
      return res.status(200).json({
        reply: message.content,                 // 最终回答
        reasoning_content: message.reasoning_content // ★ 思维链内容
      });
    } else {
      return res.status(500).json({ error: 'API 返回格式异常', detail: data });
    }
  } catch (error) {
    return res.status(500).json({ error: '服务器内部错误', detail: error.message });
  }
}