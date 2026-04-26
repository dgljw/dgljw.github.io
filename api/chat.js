// api/chat.js
export const maxDuration = 30; // 秒，告诉 Vercel 这个函数最多可运行 30 秒（Pro 计划可用，免费版无效但无害）

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支持 POST 请求' });
  }

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: '请提供 messages 数组' });
  }

  const cleanedMessages = messages.map(msg => {
    const { reasoning_content, ...rest } = msg;
    return rest;
  });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 28000); // 28秒后中断，给 Vercel 留 2 秒兜底

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
        stream: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({ error: 'API 请求失败', detail: errorText });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // 禁用 nginx 缓冲，确保立即推送
    });

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
            // 部分数据可能不完整，忽略并继续
          }
        }
      }
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      // 超时了，告诉前端生成中断
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      return res.status(500).json({ error: '服务器内部错误', detail: error.message });
    }
  }
}