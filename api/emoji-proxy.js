// 表情搜索代理 API - Vercel Serverless
// 优享云 + 兔二备用 + 百度(apihz.cn)三源

const YOUXIANG_URL = 'https://api.yxapi.cn/api/douyin/emoji';
const TOER2_URL = 'https://api.toer2.com/api/emoji/search';
const BAIXIAO_URL = 'https://cn.apihz.cn/api/img/apihzbqbbaidu.php';

module.exports = async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        });
    }

    const url = new URL(req.url);
    const keyword = url.searchParams.get('keyword') || '';
    const count = parseInt(url.searchParams.get('count') || '8');

    if (!keyword) {
        return new Response(JSON.stringify({ images: [] }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    // 1. 优享云
    try {
        const resp = await fetch(`${YOUXIANG_URL}?keyword=${encodeURIComponent(keyword)}&num=${count}`);
        if (resp.ok) {
            const data = await resp.json();
            if (data.code === 200 && data.data?.length) {
                const images = data.data.slice(0, count).map(item => item.url || item.img);
                return new Response(JSON.stringify({ images }), {
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                });
            }
        }
    } catch { /* 降级到备用 */ }

    // 2. 百度(apihz.cn)
    try {
        const baiduResp = await fetch(`${BAIXIAO_URL}?id=88888888&key=88888888&words=${encodeURIComponent(keyword)}&limit=${count}`);
        if (baiduResp.ok) {
            const data = await baiduResp.json();
            if (data.code === 200 && data.res?.length) {
                const images = data.res.slice(0, count);
                return new Response(JSON.stringify({ images }), {
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                });
            }
        }
    } catch { /* 继续降级 */ }

    // 3. 兔二
    if (process.env.TOER2_APPID && process.env.TOER2_KEY) {
        try {
            const resp = await fetch(TOER2_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    appid: process.env.TOER2_APPID,
                    key: process.env.TOER2_KEY,
                    keyword,
                    num: count
                })
            });
            if (resp.ok) {
                const data = await resp.json();
                if (data.code === 1 && data.data?.length) {
                    const images = data.data.slice(0, count).map(item => item.url || item.img);
                    return new Response(JSON.stringify({ images }), {
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                    });
                }
            }
        } catch { /* 都失败 */ }
    }

    return new Response(JSON.stringify({ images: [] }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
};