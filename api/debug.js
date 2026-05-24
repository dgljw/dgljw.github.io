// 诊断接口 - 检查环境变量是否配置正确
export async function GET() {
    const hasKey = !!process.env.DEEPSEEK_API_KEY;
    const keyLen = (process.env.DEEPSEEK_API_KEY || '').length;
    const keyPrefix = keyLen > 6 ? process.env.DEEPSEEK_API_KEY.slice(0, 6) + '...' : '(empty)';

    return new Response(JSON.stringify({
        deepseek_key_configured: hasKey,
        deepseek_key_length: keyLen,
        deepseek_key_prefix: keyPrefix,
        node_version: process.version,
        all_env_keys: Object.keys(process.env).filter(k =>
            !k.startsWith('VERCEL') &&
            !k.startsWith('NODE') &&
            !k.startsWith('HOME') &&
            !k.startsWith('PATH') &&
            !k.startsWith('_') &&
            !['PWD', 'SHLVL', 'LOGNAME', 'USER', 'SHELL', 'LANG', 'LC_ALL', 'TZ'].includes(k)
        )
    }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
}