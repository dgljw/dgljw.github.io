// 表情搜索代理 API - Vercel Serverless
// 三源竞速：百度(apihz.cn) > 优享云 > 兔二

const YOUXIANG_URL = 'https://api.yxapi.cn/api/douyin/emoji';
const TOER2_URL = 'https://api.toer2.com/api/emoji/search';
const BAIXIAO_URL = 'https://cn.apihz.cn/api/img/apihzbqbbaidu.php';

export async function OPTIONS() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

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

export async function GET(request) {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    const count = parseInt(url.searchParams.get('count') || '8');

    if (!keyword) {
        return new Response(JSON.stringify({ images: [] }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

    // 并行竞速：三个源同时请求，谁先返回有效结果用谁
    const promises = [
        // 1. 百度(apihz.cn) - 已验证可用
        (async () => {
            try {
                const resp = await fetchWithTimeout(`${BAIXIAO_URL}?id=88888888&key=88888888&words=${encodeURIComponent(keyword)}&limit=${count}`);
                if (resp.ok) {
                    const data = await resp.json();
                    if (data.code === 200 && data.res?.length) {
                        return data.res.slice(0, count);
                    }
                }
            } catch {}
            return null;
        })(),
        // 2. 优享云
        (async () => {
            try {
                const resp = await fetchWithTimeout(`${YOUXIANG_URL}?keyword=${encodeURIComponent(keyword)}&num=${count}`);
                if (resp.ok) {
                    const data = await resp.json();
                    if (data.code === 200 && data.data?.length) {
                        return data.data.slice(0, count).map(item => item.url || item.img);
                    }
                }
            } catch {}
            return null;
        })(),
        // 3. 兔二
        (async () => {
            if (!process.env.TOER2_APPID || !process.env.TOER2_KEY) return null;
            try {
                const resp = await fetchWithTimeout(TOER2_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ appid: process.env.TOER2_APPID, key: process.env.TOER2_KEY, keyword, num: count })
                });
                if (resp.ok) {
                    const data = await resp.json();
                    if (data.code === 1 && data.data?.length) {
                        return data.data.slice(0, count).map(item => item.url || item.img);
                    }
                }
            } catch {}
            return null;
        })()
    ];

    const images = await Promise.any(promises).catch(() => null);
    return new Response(JSON.stringify({ images: images || [] }), { headers });
};