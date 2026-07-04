// 角色扮演提示词生成 API - Vercel Serverless
const DEEPSEEK_BASE = 'https://api.deepseek.com/v1/chat/completions';

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
    let body;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: '无效的 JSON 请求体' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    const { text } = body || {};
    if (!text || text.trim().length < 2) {
        return new Response(JSON.stringify({
            error: '请提供作品和角色信息'
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    try {
        const resp = await fetch(DEEPSEEK_BASE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [{
                    role: 'system',
                    content: `你是一个角色扮演提示词专家。根据用户输入的作品和角色，生成适合 AI 角色扮演的系统提示词。

输出一个 JSON 对象：
{
    "role_name": "角色名（你扮演的角色名）",
    "system_prompt": "完整的系统提示词（200-400字），要包含以下内容：\\n1. 角色的身份背景（来自哪部作品、什么身份）\\n2. 性格特点与说话风格（语气、口头禅、表达习惯）\\n3. 知识范围（角色知道什么、不知道什么）\\n4. 行为准则（角色会怎么做、不会怎么做）\\n5. 与用户互动的注意事项\\n格式要求：提示词整体用第一人称，口语化但专业。"
                }, {
                    role: 'user',
                    content: text
                }],
                temperature: 0.7,
                max_tokens: 1200,
                response_format: { type: 'json_object' }
            })
        });

        if (!resp.ok) {
            return new Response(JSON.stringify({
                error: `API 错误: ${resp.status}`,
                role_name: '',
                system_prompt: ''
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content?.trim() || '';

        try {
            const parsed = JSON.parse(content);
            return new Response(JSON.stringify({
                role_name: parsed.role_name || '角色',
                system_prompt: parsed.system_prompt || ''
            }), {
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        } catch {
            return new Response(JSON.stringify({
                role_name: '角色',
                system_prompt: content
            }), {
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

    } catch (err) {
        return new Response(JSON.stringify({
            error: err.message,
            role_name: '',
            system_prompt: ''
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
}