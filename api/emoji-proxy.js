// 表情搜索代理 API - Vercel Serverless
// 三源竞速：百度图片 > 优享云 > 兔二

async function fetchWithTimeout(url, opts = {}, timeout = 4000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
        const res = await fetch(url, { ...opts, signal: ctrl.signal });
        clearTimeout(timer);
        return res;
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
}

export async function OPTIONS() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

export async function GET(request) {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    const count = parseInt(url.searchParams.get('count') || '1');

    if (!keyword) {
        return new Response(JSON.stringify({ images: [] }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

    // 方案1: 百度图片搜索 JSON 接口（免 Key，直接调百度）
    try {
        const resp = await fetchWithTimeout(
            `https://image.baidu.com/search/acjson?tn=resultjson_com&word=${encodeURIComponent(keyword)}&pn=0&rn=${count}`,
            { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://image.baidu.com/' } }
        );
        if (resp.ok) {
            const data = await resp.json();
            if (data.data?.length) {
                const images = data.data
                    .filter(d => d.thumbURL || d.middleURL)
                    .map(d => d.middleURL || d.thumbURL)
                    .slice(0, count);
                if (images.length > 0) return new Response(JSON.stringify({ images }), { headers });
            }
        }
    } catch {}

    // 方案2: 百度(apihz.cn) - 降级备用
    try {
        const resp = await fetchWithTimeout(
            `https://cn.apihz.cn/api/img/apihzbqbbaidu.php?id=88888888&key=88888888&words=${encodeURIComponent(keyword)}&limit=${count}`
        );
        if (resp.ok) {
            const data = await resp.json();
            if (data.code === 200 && data.res?.length) {
                return new Response(JSON.stringify({ images: data.res.slice(0, count) }), { headers });
            }
        }
    } catch {}

    // 方案3: 优享云
    try {
        const resp = await fetchWithTimeout(`https://api.yxapi.cn/api/douyin/emoji?keyword=${encodeURIComponent(keyword)}&num=${count}`);
        if (resp.ok) {
            const data = await resp.json();
            if (data.code === 200 && data.data?.length) {
                const images = data.data.slice(0, count).map(item => item.url || item.img);
                return new Response(JSON.stringify({ images }), { headers });
            }
        }
    } catch {}

    // 方案4: 兔二
    if (process.env.TOER2_APPID && process.env.TOER2_KEY) {
        try {
            const resp = await fetchWithTimeout('https://api.toer2.com/api/emoji/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appid: process.env.TOER2_APPID, key: process.env.TOER2_KEY, keyword, num: count })
            });
            if (resp.ok) {
                const data = await resp.json();
                if (data.code === 1 && data.data?.length) {
                    const images = data.data.slice(0, count).map(item => item.url || item.img);
                    return new Response(JSON.stringify({ images }), { headers });
                }
            }
        } catch {}
    }

    return new Response(JSON.stringify({ images: [] }), { headers });
};