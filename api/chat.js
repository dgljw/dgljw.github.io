// 聊天 API - Vercel Serverless (fetch-style API)
const DEEPSEEK_BASE = 'https://api.deepseek.com/v1/chat/completions';

async function searchWeb(query) {
    // 方案1: Google 搜索 HTML 解析（Vercel 美国 IP 通常可达）
    try {
        const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
        const res = await fetch(`https://www.google.com/search?q=${encodeURIComponent(query)}&hl=zh-CN&num=10`, {
            headers: { 'User-Agent': ua, 'Accept-Language': 'zh-CN,zh;q=0.9' },
            signal: AbortSignal.timeout(6000)
        });
        if (!res.ok) throw new Error('Google unreachable');
        const html = await res.text();
        
        // Google 搜索结果格式: <h3>标题</h3> ... <a href="URL"> ... 摘要片段
        const results = [];
        const blockRe = /<div[^>]*class="[^"]*g[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi;
        const titleRe = /<h3[^>]*>([\s\S]*?)<\/h3>/i;
        const linkRe = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>/gi;
        const snippetRe = /<span[^>]*class="[^"]*st[^"]*"[^>]*>([\s\S]*?)<\/span>/i;

        // 更简单的方式：直接匹配所有搜索结果的标题和链接
        const re = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>\s*(?:<[^>]+>)*([^<]{5,100})(?:<[^>]+>)*\s*<\/a>\s*(?:<[^>]+>)*\s*<[^>]*>\s*([^<]{20,300})/gi;
        let m;
        while ((m = re.exec(html)) && results.length < 5) {
            const url = m[1];
            const title = m[2].replace(/<\/?[^>]+>/g, '').trim();
            const snippet = m[3].replace(/<\/?[^>]+>/g, '').trim();
            if (!url.includes('google.com') && title && snippet && !results.find(r => r.includes(url))) {
                results.push(`[${title}](${url})\n${snippet}`);
            }
        }

        if (results.length > 0) return results.join('\n\n');
    } catch {}

    // 方案2: DuckDuckGo Instant Answer API（免费 JSON）
    try {
        const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`, {
            signal: AbortSignal.timeout(5000)
        });
        if (res.ok) {
            const data = await res.json();
            const results = [];
            if (data.AbstractText?.length > 10) {
                results.push(`[${data.Heading || '摘要'}](${data.AbstractURL || ''})\n${data.AbstractText}`);
            }
            (data.RelatedTopics || []).forEach(t => {
                if (t.Text && t.FirstURL && !results.find(r => r.includes(t.FirstURL)))
                    results.push(`[${t.Text.split(' - ')[0]}](${t.FirstURL})\n${t.Text}`);
            });
            if (results.length > 0) return results.slice(0, 5).join('\n\n');
        }
    } catch {}

    // 方案3: Wikipedia 搜索 API（最稳兜底）
    try {
        const res = await fetch(`https://zh.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5`, {
            signal: AbortSignal.timeout(5000)
        });
        if (res.ok) {
            const data = await res.json();
            const results = (data.query?.search || []).map(r => {
                const title = r.title.replace(/<\/?[^>]+>/g, '');
                const snippet = r.snippet.replace(/<\/?[^>]+>/g, '');
                return `[${title}](https://zh.wikipedia.org/wiki/${encodeURIComponent(r.title)})\n${snippet}`;
            });
            if (results.length > 0) return results.join('\n\n');
        }
    } catch {}

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