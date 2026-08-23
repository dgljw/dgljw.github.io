// 聊天 API - Vercel Serverless (fetch-style API)
const DEEPSEEK_BASE = 'https://api.deepseek.com/v1/chat/completions';

async function searchWeb(query) {
    const isNewsQuery = /新闻|最新|今日|热搜|头条|事件|报道|爆料|发生了什么|出什么事|现在|目前|当前/.test(query);

    // 方案1: Bing 搜索 API (使用图片搜索接口，更稳定)
    try {
        const timeFilter = isNewsQuery ? '&tbs=qdr:d' : '&tbs=qdr:w';
        const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=zh-cn${timeFilter}`;
        const res = await fetch(searchUrl, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
            },
            signal: AbortSignal.timeout(8000)
        });
        if (!res.ok) throw new Error('Bing unreachable');
        const html = await res.text();
        const results = [];
        
        const blockRe = /<li[^>]*class="b_algo[^>]*">([\s\S]*?)<\/li>/gi;
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
    } catch (e) {
        console.log('Bing search failed:', e.message);
    }

    // 方案2: DuckDuckGo 搜索
    try {
        const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html'
            },
            signal: AbortSignal.timeout(8000)
        });
        if (!res.ok) throw new Error('DuckDuckGo unreachable');
        const html = await res.text();
        const results = [];
        const resultRe = /<div class="result__body">([\s\S]*?)<\/div>/gi;
        let match;
        while ((match = resultRe.exec(html)) && results.length < 5) {
            const body = match[1];
            const linkMatch = body.match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
            const snippetMatch = body.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
            if (linkMatch && snippetMatch) {
                const title = linkMatch[2].replace(/<\/?[^>]+>/g, '').trim();
                const snippet = snippetMatch[1].replace(/<\/?[^>]+>/g, '').trim();
                if (title && snippet.length > 10) {
                    results.push(`[${title}](${linkMatch[1]})\n${snippet}`);
                }
            }
        }
        if (results.length > 0) return results.join('\n\n');
    } catch (e) {
        console.log('DuckDuckGo search failed:', e.message);
    }

    // 方案3: Wikipedia 兜底
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
        } catch (e) {
            console.log('Wikipedia search failed:', e.message);
        }
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
                if (msg.image) {
                    apiMessages.push({ 
                        role: 'user', 
                        content: [
                            { type: 'text', text: text || '请描述这张图片的内容' },
                            { type: 'image_url', image_url: { url: msg.image } }
                        ]
                    });
                } else {
                    apiMessages.push({ role: 'user', content: text });
                }
            } else if (msg.role === 'assistant') {
                apiMessages.push({ role: 'assistant', content: text });
            }
        }

        let searchResult = null;
        if (web_search && userContent) {
            console.log('Web search enabled for:', userContent);
            searchResult = await searchWeb(userContent);
            console.log('Web search result:', searchResult ? 'found ' + searchResult.length + ' chars' : 'none');
        } else {
            console.log('Web search disabled or no user content');
        }

        let finalSystemPrompt = systemContent || '你是一个AI助手。';
        if (searchResult) {
            const today = new Date().toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric', weekday:'long' });
            finalSystemPrompt += `\n\n--- 联网搜索结果（${today}）---\n以下是通过搜索引擎获取的最新信息，请严格基于这些信息回答用户的问题。如果搜索结果与你的训练数据冲突，以搜索结果为准。\n\n${searchResult}\n\n---`;
            console.log('Search result injected into prompt');
        }

        const finalMessages = [
            { role: 'system', content: finalSystemPrompt },
            ...apiMessages.slice(-20)
        ];

        const hasImage = apiMessages.some(msg => msg.content && Array.isArray(msg.content));
        const useModel = hasImage ? 'deepseek-vision' : (model || 'deepseek-chat');

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
                    model: useModel,
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
            return new Response(JSON.stringify({ error: errData.error || `API request failed: ${resp.status}` }), {
                status: resp.status,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

        const data = await resp.json();
        return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });

    } catch (err) {
        console.error('Chat API error:', err);
        return new Response(JSON.stringify({ error: err.message || 'Server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
}