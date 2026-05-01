// 图片理解代理（内测）：目前用通用Chat API模拟，待视觉模型开放后替换
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { imageBase64, prompt } = req.body;
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key missing' });

    // 临时方案：因为没有视觉接口，我们直接告诉模型用户上传了一张图片，让它根据常识猜测（实用价值低）
    // 正式上线需替换为视觉模型的请求格式
    const description = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: '用户上传了一张图片，但暂时无法识别具体内容。请礼貌告知用户该功能正在内测，并建议用文字描述图片。' },
          { role: 'user', content: prompt || '请描述这张图片' }
        ],
        max_tokens: 300,
        stream: false
      })
    }).then(r => r.json());

    const text = description.choices?.[0]?.message?.content || '图片识别暂时不可用。';
    res.status(200).json({ result: text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}