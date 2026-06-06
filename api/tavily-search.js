/** Vercel Serverless - Tavily 搜索代理 */
export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: '仅支持 POST' });

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'TAVILY_API_KEY 未配置' });

    const { query } = req.body || {};
    if (!query || !query.trim()) return res.status(400).json({ error: '缺少 query 参数' });

    try {
        const tavilyRes = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: apiKey,
                query: query.trim(),
                search_depth: 'basic',
                include_answer: true,
                include_raw_content: false,
                max_results: 5
            })
        });

        const data = await tavilyRes.json();
        if (!tavilyRes.ok) {
            return res.status(tavilyRes.status).json({ error: data.message || 'Tavily 请求失败' });
        }
        return res.status(200).json(data);
    } catch (e) {
        return res.status(500).json({ error: e.message || '搜索失败' });
    }
}