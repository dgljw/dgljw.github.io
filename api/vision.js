// 图片理解 API - Vercel Serverless（预留）
// DeepSeek Vision 模型，待 API 正式开放后启用

const DEEPSEEK_BASE = 'https://api.deepseek.com/v1/chat/completions';

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
        const { image, prompt } = await req.json();

        const resp = await fetch(DEEPSEEK_BASE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-vision',
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt || '请描述这张图片的内容' },
                        { type: 'image_url', image_url: { url: image } }
                    ]
                }],
                temperature: 0.7,
                max_tokens: 1024
            })
        });

        if (!resp.ok) {
            return new Response(JSON.stringify({
                error: `Vision API 不可用 (${resp.status})`,
                content: '图片理解功能暂不可用，请等待 API 正式开放'
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content || '无法分析图片';
        return new Response(JSON.stringify({ content }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });

    } catch (err) {
        return new Response(JSON.stringify({
            error: err.message,
            content: `图片分析失败: ${err.message}`
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
};