// 头像选择器配置
const AVATARS = {
    // 默认头像
    default: {
        name: '默认机器人',
        emoji: '🤖',
        color: '#667eea',
        description: '标准 AI 助手头像'
    },
    // 坚果头像（用户）
    nut: {
        name: '坚果',
        emoji: '🌰',
        color: '#d2691e',
        description: '用户坚果头像'
    },
    // 可选 AI 头像
    cat: {
        name: '猫咪',
        emoji: '🐱',
        color: '#ff6b6b',
        description: '可爱猫咪头像'
    },
    robot: {
        name: '机器人',
        emoji: '🤖',
        color: '#4ecdc4',
        description: '科技感机器人'
    },
    wizard: {
        name: '魔法师',
        emoji: '🧙',
        color: '#9b59b6',
        description: '神秘魔法师'
    },
    alien: {
        name: '外星人',
        emoji: '👽',
        color: '#1abc9c',
        description: '外星访客'
    },
    panda: {
        name: '熊猫',
        emoji: '🐼',
        color: '#000000',
        description: '可爱熊猫'
    },
    fox: {
        name: '狐狸',
        emoji: '🦊',
        color: '#e67e22',
        description: '聪明狐狸'
    },
    owl: {
        name: '猫头鹰',
        emoji: '🦉',
        color: '#8e44ad',
        description: '智慧猫头鹰'
    },
    dragon: {
        name: '龙',
        emoji: '🐉',
        color: '#e74c3c',
        description: '东方神龙'
    }
};

// 免费 API 配置
const FREE_APIS = {
    // 表情包 API - apihz.cn 百度版
    emoji: {
        name: '百度表情包',
        url: 'https://cn.apihz.cn/api/img/apihzbqbbaidu.php',
        method: 'GET',
        params: {
            id: '88888888', // 公共 ID
            key: '88888888', // 公共 KEY
            words: '{keyword}',
            limit: 8,
            page: 1
        },
        description: '免费百度表情包搜索，每分钟有限制'
    },
    // 备用表情包 API - oiapi.net
    emoji_backup: {
        name: 'OIAPI 表情包',
        url: 'https://oiapi.net/api/EmoticonPack',
        method: 'GET',
        params: {
            keyword: '{keyword}',
            limit: 8
        },
        description: '免费表情包搜索，支持随机热门'
    },
    // 搜索 API - OpenSERP
    search: {
        name: 'OpenSERP',
        url: 'https://openserp.org/api/v1/search',
        method: 'GET',
        params: {
            q: '{query}',
            engine: 'google',
            format: 'json'
        },
        description: '免费开源 SERP API，支持 Google/Bing/Yandex'
    },
    // AI 聊天 API - 七牛云 DeepSeek
    chat_qiniu: {
        name: '七牛云 DeepSeek',
        url: 'https://ai.qiniuapi.com/v1/chat/completions',
        method: 'POST',
        headers: {
            'Authorization': 'Bearer {api_key}',
            'Content-Type': 'application/json'
        },
        description: '七牛云提供的 DeepSeek API，有免费额度'
    },
    // 备用 AI API - SophNet
    chat_sophnet: {
        name: 'SophNet DeepSeek',
        url: 'https://api.sophnet.com/v1/chat/completions',
        method: 'POST',
        headers: {
            'Authorization': 'Bearer {api_key}',
            'Content-Type': 'application/json'
        },
        description: 'SophNet 云算力平台，速度快'
    }
};

// 表情包关键词匹配器
const EMOJI_MATCHER = {
    // 情绪关键词
    happy: ['开心', '高兴', '快乐', '哈哈', '笑', '喜悦', '兴奋', '欢乐'],
    sad: ['伤心', '难过', '悲伤', '哭', '泪', '失落', '失望', '忧郁'],
    angry: ['生气', '愤怒', '恼火', '发火', '暴躁', '不爽', '气愤'],
    love: ['爱', '喜欢', '爱心', '恋爱', '甜蜜', '浪漫', '心动'],
    surprise: ['惊讶', '惊喜', '震惊', '意外', '哇', '天啊', '不可思议'],
    confused: ['困惑', '迷茫', '不懂', '疑问', '为什么', '怎么', '如何'],
    // 动作关键词
    hello: ['你好', '嗨', '哈喽', '打招呼', '问候', '早上好', '晚上好'],
    bye: ['再见', '拜拜', '告辞', '下次见', '晚安', '睡觉'],
    thank: ['谢谢', '感谢', '多谢', '感恩', '感激'],
    sorry: ['对不起', '抱歉', '不好意思', '道歉', '原谅'],
    // 网络用语
    doge: ['狗头', 'doge', '柴犬', '表情包'],
    facepalm: ['捂脸', '无语', '无奈', '汗', '尴尬'],
    laugh: ['笑哭', '笑死', '哈哈哈', '233', 'hhh'],
    // 通用
    default: ['表情', '表情包', '图', '图片', '动图']
};

// 根据聊天内容推荐表情关键词
function suggestEmojiKeywords(text) {
    const keywords = [];
    const lowerText = text.toLowerCase();
    
    // 检查情绪关键词
    for (const [emotion, words] of Object.entries(EMOJI_MATCHER)) {
        if (words.some(word => lowerText.includes(word))) {
            keywords.push(words[0]); // 使用第一个关键词
        }
    }
    
    // 如果没有匹配到，使用默认
    if (keywords.length === 0) {
        // 提取文本中的名词或动词作为关键词
        const words = text.split(/[\s,，。！？!?]+/).filter(w => w.length > 1);
        if (words.length > 0) {
            keywords.push(words[0]);
        } else {
            keywords.push('表情');
        }
    }
    
    return keywords.slice(0, 3); // 最多返回3个关键词
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AVATARS, FREE_APIS, EMOJI_MATCHER, suggestEmojiKeywords };
}