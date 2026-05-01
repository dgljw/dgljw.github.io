// 记忆总结：每10k token触发，提取长期记忆项和对话摘要
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { history, existingMemory } = req.body;
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key missing' });

    const systemPrompt = `你是一个记忆管家。请分析以下对话历史，提取：
1. 关于用户的所有**个人事实**（姓名、喜好、计划、重要事件等），每条用一句话记录。
2. 对话的**简短摘要**（不超过200字）。
输出JSON格式：{"memory_items": ["事实1", "事实2"], "summary": "摘要"}
只输出JSON，不要其他文字。`;

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(history) }
        ],
        max_tokens: 600,
        stream: false,
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const result = JSON.parse(content);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}