// api/chat.js
export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支持 POST 请求' });
  }

  const { messages, enable_search } = req.body; // ★ 接收是否开启搜索的标志
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: '请提供 messages 数组' });
  }

  // 清理 reasoning_content 避免 API 报错
  const cleanedMessages = messages.map(msg => {
    const { reasoning_content, ...rest } = msg;
    return rest;
  });

  try {
    const body = {
      model: 'deepseek/deepseek-v4-flash',
      messages: cleanedMessages,
      max_tokens: 1024,
      stream: false
    };

    // ★ 如果前端要求启用搜索，则添加搜索插件
    if (enable_search) {
      body.plugins = [
        {
          name: 'parallel-web-search',
          config: {
            num_results: 5,
            search_type: 'general'
          }
        }
      ];
    }

    // Vercel AI Gateway 地址
    const aiGatewayUrl = 'https://api.vercel.ai/v1/chat/completions';

    const response = await fetch(aiGatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway 错误:', response.status, errorText);
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