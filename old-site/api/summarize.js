// 记忆总结 API - Vercel Serverless
const DEEPSEEK_BASE = 'https://api.deepseek.com/v1/chat/completions';

function jaccardSimilarity(a, b) {
    const setA = new Set(a.replace(/\s+/g, '').split(''));
    const setB = new Set(b.replace(/\s+/g, '').split(''));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
}

module.exports = async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    try {
        const { messages, existingMemories, mode } = await req.json();
        const messagesText = messages.map(m => m.content).join('\n\n');

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
                    content: mode === 'compact'
                        ? '将以下对话内容提炼为一条关键记忆事实，一句话概括核心信息（不超过 60 字）。只返回纯文本。'
                        : `你是一个记忆管理助手。请根据以下对话生成 1-3 条有价值的记忆摘要。

规则：
1. 每条记忆简洁明了，20-60 字
2. 忽略闲聊和无意义信息
3. 用 JSON 数组格式返回：{"summary": "主要记忆", "newItems": ["记忆1", "记忆2"]}
4. 不要返回与现有记忆重复的内容。

现有记忆：
${(existingMemories || []).join('\n') || '（无）'}`
                }, {
                    role: 'user',
                    content: `对话内容：\n${messagesText}`
                }],
                temperature: 0.3,
                max_tokens: mode === 'compact' ? 100 : 500,
                response_format: mode === 'compact' ? undefined : { type: 'json_object' }
            })
        });

        if (!resp.ok) {
            return new Response(JSON.stringify({
                error: resp.statusText,
                summary: '记忆总结 API 暂时不可用'
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

        const data = await resp.json();
        const result = data.choices?.[0]?.message?.content?.trim() || '';

        if (mode === 'compact') {
            return new Response(JSON.stringify({ summary: result }), {
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

        // 解析 JSON 结果并去重
        try {
            const parsed = JSON.parse(result);
            const oldMemories = existingMemories || [];
            const mergedMemories = [...oldMemories];

            if (parsed.newItems && Array.isArray(parsed.newItems)) {
                for (const item of parsed.newItems) {
                    const isDuplicate = mergedMemories.some(m => jaccardSimilarity(m, item) > 0.4);
                    if (!isDuplicate) mergedMemories.push(item);
                }
            }

            // 限制记忆数量
            const maxMemories = 30;
            const trimmedMemories = mergedMemories.length > maxMemories
                ? mergedMemories.slice(mergedMemories.length - maxMemories)
                : mergedMemories;

            return new Response(JSON.stringify({
                summary: parsed.summary || result,
                mergedMemories: trimmedMemories
            }), {
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });

        } catch {
            return new Response(JSON.stringify({ summary: result }), {
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

    } catch (err) {
        return new Response(JSON.stringify({
            error: err.message,
            summary: ''
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
};