// 聊天 API - Vercel Serverless (fetch-style API)
import { search } from 'duck-duck-scrape';
const DEEPSEEK_BASE = 'https://api.deepseek.com/v1/chat/completions';

async function searchDuckDuckGo(query) {
    try {
        const results = await search(query);
        if (!results.results?.length) return null;
        return results.results.slice(0, 5).map(r =>
            `[${r.title}](${r.url})\n${r.description}`
        ).join('\n\n');
    } catch { return null; }
}

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
        const { messages, model, temperature, max_tokens, web_search, stream } = await request.json();
        let systemContent = '';
        let userContent = '';
        const apiMessages = [];

        for (const msg of messages) {
            const text = typeof msg.content === 'string' ? msg.content.trim() : '';
            if (msg.role === 'system') {
                systemContent = text;
            } else if (msg.role === 'user') {
                if (!userContent) userContent = text;
                apiMessages.push({ role: 'user', content: text });
            } else if (msg.role === 'assistant') {
                apiMessages.push({ role: 'assistant', content: text });
            }
        }

        let searchResult = null;
        if (web_search && userContent) {
            searchResult = await searchDuckDuckGo(userContent);
            console.log('Web search enabled, result:', searchResult ? 'found' : 'none');
        } else {
            console.log('Web search disabled or no user content');
        }

        let finalSystemPrompt = systemContent;
        if (searchResult) {
            finalSystemPrompt += `\n\n--- 联网搜索结果 ---\n以下是最新的搜索结果，请基于这些信息回答问题：\n${searchResult}\n---`;
        }

        const finalMessages = [
            { role: 'system', content: finalSystemPrompt },
            ...apiMessages.slice(-20)
        ];

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        let resp;
        try {
            resp = await fetch(DEEPSEEK_BASE, {
                signal: controller.signal,
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
        } finally {
            clearTimeout(timeoutId);
        }

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
}