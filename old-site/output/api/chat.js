// 聊天 API - Vercel Serverless (fetch-style API)
const DEEPSEEK_BASE = 'https://api.deepseek.com/v1/chat/completions';

async function searchWeb(query) {
    const isNewsQuery = /新闻|最新|今日|热搜|头条|事件|报道|爆料|发生了什么|出什么事|现在|目前|当前/.test(query);

    // Bing 搜索，新闻类加时间过滤（近7天），通用类近一周
    try {
        const timeFilter = isNewsQuery ? '&tbs=qdr:d' : '&tbs=qdr:w';
        const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=zh-cn${timeFilter}`;
        const res = await fetch(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal: AbortSignal.timeout(6000)
        });
        if (!res.ok) throw new Error('Bing unreachable');
        const html = await res.text();
        const results = [];
        const blockRe = /<li class="b_algo">([\s\S]*?)<\/li>/gi;
        let block;
        while ((block = blockRe.exec(html)) && results.length < 5) {
            const b = block[1];
            const linkMatch = b.match(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
            const snippetMatch = b.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
            if (linkMatch && snippetMatch) {
                const title = linkMatch[2].replace(/<\/?[^>]+>/g, '').trim();
                const snippet = snippetMatch[1].replace(/<\/?[^>]+>/g, '').trim();
                if (title && snippet.length > 10) {
                    results.push(`[${title}](${linkMatch[1]})\n${snippet}`);
                }
            }
        }
        if (results.length > 0) return results.join('\n\n');
    } catch {}

    // Wikipedia 兜底（新闻类不查维基）
    if (!isNewsQuery) {
        try {
            const res = await fetch(`https://zh.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5`, {
                signal: AbortSignal.timeout(5000)
            });
            if (res.ok) {
                const data = await res.json();
                const results = (data.query?.search || []).map(r => {
                    return `[${r.title}](https://zh.wikipedia.org/wiki/${encodeURIComponent(r.title)})\n${r.snippet.replace(/<\/?[^>]+>/g, '')}`;
                });
                if (results.length > 0) return results.join('\n\n');
            }
        } catch {}
    }

    return null;
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
            searchResult = await searchWeb(userContent);
            console.log('Web search enabled, result:', searchResult ? 'found' : 'none');
        } else {
            console.log('Web search disabled or no user content');
        }

        let finalSystemPrompt = systemContent;
        if (searchResult) {
            const today = new Date().toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric', weekday:'long' });
            finalSystemPrompt += `\n\n--- 联网搜索结果（当前日期：${today}）---\n以下是通过搜索引擎获取的实时信息，请严格基于这些信息回答。如果搜索结果与你的训练数据冲突，以搜索结果为准：\n${searchResult}\n---`;
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