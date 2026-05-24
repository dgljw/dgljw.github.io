// 表情搜索代理 API - Vercel Serverless
// 优享云 + 兔二备用双源

const YOUXIANG_URL = 'https://api.yxapi.cn/api/douyin/emoji';
const TOER2_URL = 'https://api.toer2.com/api/emoji/search';

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

    // 优先优享云
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

    // 备用：兔二
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
        } catch { /* 继续降级 */ }
    }

    // 都失败返回空
    return new Response(JSON.stringify({ images: [] }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
};