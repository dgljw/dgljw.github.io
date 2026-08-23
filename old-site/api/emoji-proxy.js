// 表情搜索代理 API - Vercel Serverless
// 多源竞速：优享云 > Bing图片 > 内置图库

async function fetchWithTimeout(url, opts = {}, timeout = 5000) {
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
    const keyword = (url.searchParams.get('keyword') || '').trim();
    const count = parseInt(url.searchParams.get('count') || '5');

    if (!keyword) {
        return new Response(JSON.stringify({ images: [] }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

    // 方案1: 优享云 API
    try {
        const resp = await fetchWithTimeout(
            `https://api.yxapi.cn/api/douyin/emoji?keyword=${encodeURIComponent(keyword)}&num=${count}`
        );
        if (resp.ok) {
            const data = await resp.json();
            if (data.code === 200 && data.data?.length) {
                const images = data.data.slice(0, count).map(item => item.url || item.img || item.image).filter(Boolean);
                if (images.length > 0) return new Response(JSON.stringify({ images }), { headers });
            }
        }
    } catch {}

    // 方案2: Bing 图片搜索 (async API)
    try {
        const resp = await fetchWithTimeout(
            `https://www.bing.com/images/async?q=${encodeURIComponent(keyword + ' 表情包')}&first=1&count=${count}&mmasync=1`,
            { headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.bing.com/images/'
            }}
        );
        if (resp.ok) {
            const html = await resp.text();
            const imageUrls = [];
            const urlRe = /murl":"([^"]+)"/g;
            let match;
            while ((match = urlRe.exec(html)) && imageUrls.length < count) {
                const imgUrl = decodeURIComponent(match[1]);
                if (imgUrl && (imgUrl.endsWith('.jpg') || imgUrl.endsWith('.png') || imgUrl.endsWith('.gif'))) {
                    imageUrls.push(imgUrl);
                }
            }
            if (imageUrls.length > 0) return new Response(JSON.stringify({ images: imageUrls }), { headers });
        }
    } catch {}

    // 方案3: 内置表情包图库（fallback）- 使用稳定的CDN图片
    const fallbackImages = {
        '笑': ['https://www.soogif.com/gif/10006137.gif', 'https://www.soogif.com/gif/10006136.gif', 'https://www.soogif.com/gif/10006135.gif'],
        '哭': ['https://www.soogif.com/gif/10006142.gif', 'https://www.soogif.com/gif/10006141.gif', 'https://www.soogif.com/gif/10006140.gif'],
        '生气': ['https://www.soogif.com/gif/10006151.gif', 'https://www.soogif.com/gif/10006150.gif', 'https://www.soogif.com/gif/10006149.gif'],
        '可爱': ['https://www.soogif.com/gif/10006162.gif', 'https://www.soogif.com/gif/10006161.gif', 'https://www.soogif.com/gif/10006160.gif'],
        '开心': ['https://www.soogif.com/gif/10006137.gif', 'https://www.soogif.com/gif/10006136.gif', 'https://www.soogif.com/gif/10006135.gif'],
        '加油': ['https://www.soogif.com/gif/10006171.gif', 'https://www.soogif.com/gif/10006170.gif', 'https://www.soogif.com/gif/10006169.gif'],
        '赞': ['https://www.soogif.com/gif/10006180.gif', 'https://www.soogif.com/gif/10006179.gif', 'https://www.soogif.com/gif/10006178.gif'],
        '爱': ['https://www.soogif.com/gif/10006189.gif', 'https://www.soogif.com/gif/10006188.gif', 'https://www.soogif.com/gif/10006187.gif'],
        '惊讶': ['https://www.soogif.com/gif/10006198.gif', 'https://www.soogif.com/gif/10006197.gif', 'https://www.soogif.com/gif/10006196.gif'],
        '谢谢': ['https://www.soogif.com/gif/10006207.gif', 'https://www.soogif.com/gif/10006206.gif', 'https://www.soogif.com/gif/10006205.gif'],
        '尴尬': ['https://www.soogif.com/gif/10006216.gif', 'https://www.soogif.com/gif/10006215.gif', 'https://www.soogif.com/gif/10006214.gif'],
        '无语': ['https://www.soogif.com/gif/10006225.gif', 'https://www.soogif.com/gif/10006224.gif', 'https://www.soogif.com/gif/10006223.gif']
    };

    let images = [];
    for (const [key, urls] of Object.entries(fallbackImages)) {
        if (keyword.includes(key)) {
            images = urls;
            break;
        }
    }
    if (images.length === 0) {
        images = fallbackImages['开心'];
    }

    return new Response(JSON.stringify({ images: images.slice(0, count) }), { headers });
}