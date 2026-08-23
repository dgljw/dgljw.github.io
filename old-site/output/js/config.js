// 配置文件
const CONFIG = {
    // API 配置（使用相对路径，跟随当前域名）
    API_BASE: '/api',
    CHAT_API: '/api/chat',
    SUMMARIZE_API: '/api/summarize',
    EXTRACT_API: '/api/extract',
    EMOJI_API: '/api/emoji-proxy',
    VISION_API: '/api/vision',
    
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
        CUSTOM_AVATAR: 'custom_avatar',
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
        { type: 'github', icon: '💻', label: 'GitHub', value: 'https://github.com/dgljw', action: 'open' }
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
    
    // 提取提示词 - 角色扮演
    EXTRACT_PROMPT: `你是一个角色扮演提示词专家。根据用户输入的作品和角色，生成适合 AI 角色扮演的系统提示词。

输出一个 JSON 对象：
{
    "role_name": "角色名（你扮演的角色名）",
    "system_prompt": "完整的系统提示词（200-400字），要包含以下内容：\\n1. 角色的身份背景（来自哪部作品、什么身份）\\n2. 性格特点与说话风格（语气、口头禅、表达习惯）\\n3. 知识范围（角色知道什么、不知道什么）\\n4. 行为准则（角色会怎么做、不会怎么做）\\n5. 与用户互动的注意事项\\n格式要求：提示词整体用第一人称，口语化但专业。"
}`,
    // 表情自动匹配开关
    EMOJI_AUTO_ENABLED: false,

    // 表情关键词推荐 API
    EMOJI_KEYWORD_API: null // 使用前端匹配器
};

// 导出配置
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
// deploy trigger 1779614594.3891084
