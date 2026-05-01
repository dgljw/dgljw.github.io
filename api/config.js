/**
 * 全局配置常量
 * 所有可调参数集中管理，便于后期修改
 */

// DeepSeek 模型配置
const CONFIG = {
  // 模型名称（注意：视觉模型内测中，未来可能变为 deepseek-vl2 等）
  MODEL: 'deepseek-v4-flash',
  
  // API 端点
  API_CHAT: '/api/chat',
  API_SUMMARIZE: '/api/summarize',
  API_EMOJI_SEARCH: '/api/emoji-proxy',
  API_VISION: '/api/vision',
  
  // 请求参数
  MAX_TOKENS: 1024,
  THINKING_DISABLED: true,
  
  // 记忆压缩阈值（token 估算值）
  MAX_HISTORY_TOKENS: 10000,
  
  // 压缩后保留最近对话轮次（一问一答为1轮）
  KEEP_RECENT_ROUNDS: 50,
  
  // localStorage 键名
  STORAGE_KEYS: {
    SETTINGS: 'deepseek_settings_v4',
    MEMORY: 'deepseek_chat_memory_v5',
    THEME: 'deepseek_theme',
    BACKGROUND: 'deepseek_bg'
  },
  
  // 默认设置
  DEFAULT_SETTINGS: {
    aiName: '小金鱼',
    persona: '你是一只可爱的金鱼记忆管家，说话温柔、简洁，记住用户的每件小事。',
    enableSearch: false,
    enableAutoEmoji: false, // 自动表情开关（用户需主动开启）
    userAvatar: '👤',
    aiAvatar: '🐟',
    themeMode: 'auto', // 'auto' | 'light' | 'dark'
    background: {
      type: 'none', // 'none' | 'gradient1' | 'gradient2' | 'custom'
      value: ''
    }
  },
  
  // 预设背景列表
  PRESET_BACKGROUNDS: [
    { type: 'none', label: '无背景' },
    { type: 'gradient1', label: '海洋渐变', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    { type: 'gradient2', label: '落日暖阳', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
    { type: 'texture1', label: '纸纹', value: 'url(data:image/svg+xml,...)' } // 稍后提供 base64 纹理
  ],
  
  // 表情搜索每页数量
  EMOJI_SEARCH_LIMIT: 8,
  
  // 微信环境检测关键词
  WECHAT_UA_KEYWORDS: ['MicroMessenger', 'wechat']
};

// 冻结对象防止意外修改
Object.freeze(CONFIG);
Object.freeze(CONFIG.DEFAULT_SETTINGS);