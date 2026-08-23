/** Vercel Serverless - Tavily 搜索代理 */
export async function OPTIONS() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

export async function POST(request) {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'TAVILY_API_KEY 未配置' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: '无效的 JSON 请求体' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    const { query } = body || {};
    if (!query || !query.trim()) {
        return new Response(JSON.stringify({ error: '缺少 query 参数' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

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
            return new Response(JSON.stringify({ error: data.message || 'Tavily 请求失败' }), {
                status: tavilyRes.status,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }
        return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message || '搜索失败' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
}