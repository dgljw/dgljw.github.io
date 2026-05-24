// 聊天 API - Vercel Serverless
const DEEPSEEK_BASE = 'https://api.deepseek.com/v1/chat/completions';
const BING_SEARCH_URL = 'https://api.bing.microsoft.com/v7.0/search';

async function searchBing(query) {
    if (!process.env.BING_SEARCH_API_KEY) return null;
    try {
        const res = await fetch(`${BING_SEARCH_URL}?q=${encodeURIComponent(query)}&count=5&mkt=zh-CN`, {
            headers: {
                'Ocp-Apim-Subscription-Key': process.env.BING_SEARCH_API_KEY,
                'Accept': 'application/json'
            }
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.webPages?.value?.length) return null;
        return data.webPages.value.map(r =>
            `[${r.name}](${r.url})\n${r.snippet}`
        ).join('\n\n');
    } catch { return null; }
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
        const { messages, model, temperature, max_tokens, web_search, stream } = await req.json();
        let systemContent = '';
        let userContent = '';
        const apiMessages = [];

        for (const msg of messages) {
            const text = typeof msg.content === 'string' ? msg.content.trim() : '';
            if (msg.role === 'system') {
                systemContent = text;
            } else if (msg.role === 'user') {
                // 最后一条用户消息用于联网搜索
                if (!userContent) userContent = text;
                apiMessages.push({ role: 'user', content: text });
            } else if (msg.role === 'assistant') {
                apiMessages.push({ role: 'assistant', content: text });
            }
        }

        // 联网搜索注入
        let searchResult = null;
        if (web_search && userContent) {
            searchResult = await searchBing(userContent);
        }

        let finalSystemPrompt = systemContent;
        if (searchResult) {
            finalSystemPrompt += `\n\n--- 联网搜索结果 ---\n以下是最新的搜索结果，请基于这些信息回答问题：\n${searchResult}\n---`;
        }

        const finalMessages = [
            { role: 'system', content: finalSystemPrompt },
            ...apiMessages.slice(-20)
        ];

        const resp = await fetch(DEEPSEEK_BASE, {
            signal: AbortSignal.timeout(8000),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: model || 'deepseek-chat',
                messages: finalMessages,
                temperature: temperature ?? 0.7,
                max_tokens: max_tokens ?? 2048,
                stream: stream ?? false
            })
        });

        if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            return new Response(JSON.stringify({
                error: resp.statusText,
                content: `DeepSeek API 错误 (${resp.status}): ${errData.error?.message || '未知错误'}`
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

        const data = await resp.json();
        let content = data.choices?.[0]?.message?.content || '抱歉，没有获取到回复';

        return new Response(JSON.stringify({
            content,
            model: data.model,
            usage: data.usage
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        });

    } catch (err) {
        const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
        return new Response(JSON.stringify({
            error: err.message,
            content: isTimeout ? '请求超时，请检查 DEEPSEEK_API_KEY 是否已配置' : `服务异常: ${err.message}`
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
};