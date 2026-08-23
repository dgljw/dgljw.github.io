// 预设词提取 API - Vercel Serverless (fetch-style API)
const DEEPSEEK_BASE = 'https://api.deepseek.com/v1/chat/completions';

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
    try {
        const { text, count } = await request.json();
        if (!text || text.trim().length < 10) {
            return new Response(JSON.stringify({
                items: ['文本太短，请提供更多内容']
            }), {
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

        const targetCount = count || 5;

        const resp = await fetch(DEEPSEEK_BASE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [{
                    role: 'system',
                    content: `你是一个内容分析助手。从以下文本中提取 ${targetCount} 个最有价值的问题或关键短语，每个不超过 20 个字。

要求：
1. 问题应该基于文本的核心内容，可直接用于 AI 对话
2. 关键短语应精准概括文本要点
3. 以 JSON 数组返回，格式：{"items": ["问题1", "问题2", ...]}
4. 避免重复和过于宽泛的提问`
                }, {
                    role: 'user',
                    content: text
                }],
                temperature: 0.5,
                max_tokens: 500,
                response_format: { type: 'json_object' }
            })
        });

        if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            return new Response(JSON.stringify({
                error: resp.statusText,
                items: []
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content?.trim() || '';

        try {
            const parsed = JSON.parse(content);
            return new Response(JSON.stringify({
                items: parsed.items || parsed.results || []
            }), {
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        } catch {
            const lines = content.split('\n').filter(l => l.trim());
            const items = lines.map(l => l.replace(/^\d+[\.\、\s]+/, '').replace(/^["\[\]]+|["\[\]]+$/g, '').trim());
            return new Response(JSON.stringify({ items: items.slice(0, targetCount) }), {
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

    } catch (err) {
        return new Response(JSON.stringify({
            error: err.message,
            items: []
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
}