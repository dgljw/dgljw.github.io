// 配置文件
const CONFIG = {
    // API 配置
    API_BASE: 'https://dgljw-github-io.vercel.app/api',
    CHAT_API: 'https://dgljw-github-io.vercel.app/api/chat',
    SUMMARIZE_API: 'https://dgljw-github-io.vercel.app/api/summarize',
    EXTRACT_API: 'https://dgljw-github-io.vercel.app/api/extract',
    EMOJI_API: 'https://dgljw-github-io.vercel.app/api/emoji-proxy',
    VISION_API: 'https://dgljw-github-io.vercel.app/api/vision',
    
    // DeepSeek 模型配置
    MODEL: 'deepseek-chat',
    VISION_MODEL: 'deepseek-vision',
    MAX_TOKENS: 4096,
    TEMPERATURE: 0.7,
    
    // 记忆配置
    MEMORY_THRESHOLD: 2000, // 触发压缩的 token 阈值
    MAX_MEMORIES: 50, // 最大记忆数量
    SIMILARITY_THRESHOLD: 0.7, // Jaccard 相似度阈值
    
    // 搜索配置
    BING_SEARCH_ENABLED: true,
    SEARCH_RESULTS: 5,
    
    // 表情配置
    EMOJI_PROVIDERS: ['youxiangyun', 'tuer'],
    
    // 存储键
    STORAGE_KEYS: {
        CHAT_HISTORY: 'deepseek_chat_history',
        MEMORIES: 'deepseek_memories',
        SETTINGS: 'deepseek_settings',
        USER_AVATAR: 'user_avatar',
        AI_AVATAR: 'ai_avatar',
        USER_NAME: 'user_name',
        AI_NAME: 'ai_name',
        SYSTEM_PROMPT: 'system_prompt',
        CONTACTS: 'user_contacts',
        MOTTO: 'user_motto'
    },
    
    // 默认设置
    DEFAULT_SETTINGS: {
        theme: 'auto',
        webSearch: true,
        autoSummarize: true,
        typingIndicator: true,
        markdownRender: true,
        codeHighlight: true,
        chatBackground: 'gradient-1',
        fontSize: 'medium',
        language: 'zh-CN'
    },
    
    // 默认系统提示
    DEFAULT_SYSTEM_PROMPT: `你是一个 AI 助手，具备以下能力：
1. 长期记忆：可以记住我们之前的对话内容
2. 联网搜索：可以获取最新信息（需要用户开启）
3. 图片理解：可以分析上传的图片内容
4. 代码能力：可以编写和解释代码
5. 文件处理：可以读取和处理文本文件

请以友好、专业的态度与用户交流，提供准确、有用的帮助。`,
    
    // 默认联系方式
    DEFAULT_CONTACTS: [
        { type: 'wechat', icon: '💚', label: '微信', value: '-225588006991', action: 'copy' },
        { type: 'github', icon: '💻', label: 'GitHub', value: 'github.com/dgljw', action: 'open' },
        { type: 'telegram', icon: '✈️', label: 'Telegram', value: 't.me/username', action: 'open' }
    ],
    
    // 预设聊天背景
    CHAT_BACKGROUNDS: [
        { id: 'gradient-1', name: '渐变蓝紫', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
        { id: 'gradient-2', name: '渐变绿蓝', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
        { id: 'gradient-3', name: '渐变橙红', value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
        { id: 'gradient-4', name: '渐变紫粉', value: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' },
        { id: 'custom', name: '自定义', value: '' }
    ],
    
    // 字体大小选项
    FONT_SIZES: [
        { id: 'small', name: '小', value: '0.85rem' },
        { id: 'medium', name: '中', value: '0.9rem' },
        { id: 'large', name: '大', value: '1rem' }
    ],
    
    // 语言选项
    LANGUAGES: [
        { id: 'zh-CN', name: '简体中文' },
        { id: 'en', name: 'English' }
    ],
    
    // 提取提示词
    EXTRACT_PROMPT: `从以下文本中提取 3-5 个最有价值的问题或关键短语，每个不超过 20 个字，以 JSON 数组返回。格式：["问题1", "问题2", "问题3"]。文本：`
};

// 导出配置
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}