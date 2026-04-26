// api/summarize.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支持 POST 请求' });
  }

  const { messages, existingMemory } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: '请提供 messages 数组' });
  }

  const conversation = messages.filter(m => m.role === 'user' || m.role === 'assistant');
  if (conversation.length === 0) {
    return res.status(200).json({ summary: '', memory_items: [] });
  }

  const memoryContext = existingMemory && existingMemory.length > 0 
    ? `以下是之前的记忆点，请参考并更新：\n${existingMemory.map((item, index) => `${index + 1}. ${item}`).join('\n')}\n\n`
    : '';

  const summaryPrompt = [
    {
      role: 'system',
      content: `你是一个对话记忆管理助手。对话中包含了"用户"和"助手"的交流。
你的任务是从对话中提取两类信息：

1.  **长期记忆 (Long-Term Memory, LTM)**：识别并记录关于用户的任何重要事实、偏好、计划、决定、过往经历、项目或需求。这些信息应该尽量详尽，以便在未来的对话中能随时回忆起与用户相关的一切。

2.  **对话摘要 (Summary)**：用50字以内的短句，概括本次对话新增的关键话题和结论。（摘要中不要重复长期记忆点已经包含的内容）。

请按以下JSON格式输出，不要带markdown代码块，只输出JSON本身：
{
  "memory_items": ["记忆点1（例如：用户计划去日本旅行，时间在下个月，需要定制行程）", "记忆点2（例如：用户正在开发一个AI聊天应用，项目名为ChatX）"],
  "summary": "本次对话的摘要内容"
}`
    },
    {
      role: 'user',
      content: `${memoryContext}对话历史：\n${conversation.map(m => `${m.role}: ${m.content}`).join('\n')}`
    }
  ];

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: summaryPrompt,
        thinking: { type: 'disabled' },
        stream: false,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      return res.status(500).json({ error: '总结请求失败' });
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    try {
      const parsedResponse = JSON.parse(content);
      return res.status(200).json(parsedResponse);
    } catch (e) {
      return res.status(200).json({ summary: content, memory_items: [] });
    }
  } catch (error) {
    return res.status(500).json({ error: '服务器错误', detail: error.message });
  }
}