// api/chat.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支持 POST 请求' });
  }

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: '请提供 messages 数组' });
  }

  // 清理历史消息，避免上下文混乱
  const cleanedMessages = messages.map(msg => {
    const { reasoning_content, ...rest } = msg;
    return rest;
  });

  try {
    // 向 DeepSeek API 发起流式请求
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
        stream: true // ★ 关键：开启流式传输
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(500).json({ error: 'API 请求失败', detail: error });
    }

    // 设置响应头，告知浏览器这是一个 SSE 流
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // 将 DeepSeek API 返回的数据流逐步转发给前端
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        res.write('data: [DONE]\n\n');
        res.end();
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices[0]?.delta;
            if (delta) {
              res.write(`data: ${JSON.stringify(delta)}\n\n`);
            }
          } catch (e) {
            res.write(`data: ${JSON.stringify({ token: data })}\n\n`);
          }
        }
      }
    }
  } catch (error) {
    return res.status(500).json({ error: '服务器内部错误', detail: error.message });
  }
}