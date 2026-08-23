// localStorage 读写封装

const Storage = {
    /**
     * 初始化默认值
     */
    initDefaults() {
        // 确保默认值已写入 localStorage（各 get 方法已有 fallback，此处预留后续扩展）
    },

    /**
     * 获取值
     */
    get(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);
            if (value === null) return defaultValue;
            return JSON.parse(value);
        } catch (e) {
            console.error('Storage get error:', e);
            return defaultValue;
        }
    },

    /**
     * 设置值
     */
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage set error:', e);
            showToast('存储空间不足', 'error');
            return false;
        }
    },

    /**
     * 删除值
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('Storage remove error:', e);
            return false;
        }
    },

    /**
     * 获取聊天历史
     */
    getChatHistory() {
        return this.get(CONFIG.STORAGE_KEYS.CHAT_HISTORY, []);
    },

    /**
     * 保存聊天历史
     */
    setChatHistory(history) {
        return this.set(CONFIG.STORAGE_KEYS.CHAT_HISTORY, history);
    },

    /**
     * 添加聊天消息
     */
    addChatMessage(message) {
        const history = this.getChatHistory();
        history.push({
            ...message,
            id: generateId(),
            timestamp: Date.now()
        });
        return this.setChatHistory(history);
    },

    /**
     * 清空聊天历史
     */
    clearChatHistory() {
        return this.remove(CONFIG.STORAGE_KEYS.CHAT_HISTORY);
    },

    /**
     * 获取记忆列表
     */
    getMemories() {
        return this.get(CONFIG.STORAGE_KEYS.MEMORIES, []);
    },

    /**
     * 保存记忆列表
     */
    setMemories(memories) {
        return this.set(CONFIG.STORAGE_KEYS.MEMORIES, memories);
    },

    /**
     * 添加记忆
     */
    addMemory(text) {
        const memories = this.getMemories();
        memories.push({
            id: generateId(),
            text,
            timestamp: Date.now()
        });
        return this.setMemories(memories);
    },

    /**
     * 删除记忆
     */
    removeMemory(id) {
        const memories = this.getMemories().filter(m => m.id !== id);
        return this.setMemories(memories);
    },

    /**
     * 清空记忆
     */
    clearMemories() {
        return this.remove(CONFIG.STORAGE_KEYS.MEMORIES);
    },

    /**
     * 获取设置
     */
    getSettings() {
        return this.get(CONFIG.STORAGE_KEYS.SETTINGS, CONFIG.DEFAULT_SETTINGS);
    },

    /**
     * 保存设置
     */
    setSettings(settings) {
        return this.set(CONFIG.STORAGE_KEYS.SETTINGS, settings);
    },

    /**
     * 更新单个设置
     */
    updateSetting(key, value) {
        const settings = this.getSettings();
        settings[key] = value;
        return this.setSettings(settings);
    },

    /**
     * 获取用户头像
     */
    getUserAvatar() {
        return this.get(CONFIG.STORAGE_KEYS.USER_AVATAR, '');
    },

    /**
     * 设置用户头像
     */
    setUserAvatar(avatar) {
        return this.set(CONFIG.STORAGE_KEYS.USER_AVATAR, avatar);
    },

    /**
     * 获取 AI 头像
     */
    getAiAvatar() {
        return this.get(CONFIG.STORAGE_KEYS.AI_AVATAR, '');
    },

    /**
     * 设置 AI 头像
     */
    setAiAvatar(avatar) {
        return this.set(CONFIG.STORAGE_KEYS.AI_AVATAR, avatar);
    },

    /**
     * 获取自定义头像
     */
    getCustomAvatar() {
        return this.get(CONFIG.STORAGE_KEYS.CUSTOM_AVATAR, '');
    },

    /**
     * 设置自定义头像
     */
    setCustomAvatar(base64) {
        return this.set(CONFIG.STORAGE_KEYS.CUSTOM_AVATAR, base64);
    },

    /**
     * 获取用户名
     */
    getUserName() {
        return this.get(CONFIG.STORAGE_KEYS.USER_NAME, '我');
    },

    /**
     * 设置用户名
     */
    setUserName(name) {
        return this.set(CONFIG.STORAGE_KEYS.USER_NAME, name);
    },

    /**
     * 获取 AI 名称
     */
    getAiName() {
        return this.get(CONFIG.STORAGE_KEYS.AI_NAME, 'DeepSeek');
    },

    /**
     * 设置 AI 名称
     */
    setAiName(name) {
        return this.set(CONFIG.STORAGE_KEYS.AI_NAME, name);
    },

    /**
     * 获取系统提示
     */
    getSystemPrompt() {
        return this.get(CONFIG.STORAGE_KEYS.SYSTEM_PROMPT, CONFIG.DEFAULT_SYSTEM_PROMPT);
    },

    /**
     * 设置系统提示
     */
    setSystemPrompt(prompt) {
        return this.set(CONFIG.STORAGE_KEYS.SYSTEM_PROMPT, prompt);
    },

    /**
     * 获取联系方式
     */
    getContacts() {
        return this.get(CONFIG.STORAGE_KEYS.CONTACTS, CONFIG.DEFAULT_CONTACTS);
    },

    /**
     * 设置联系方式
     */
    setContacts(contacts) {
        return this.set(CONFIG.STORAGE_KEYS.CONTACTS, contacts);
    },

    /**
     * 获取座右铭
     */
    getMotto() {
        return this.get(CONFIG.STORAGE_KEYS.MOTTO, '探索未知，创造可能');
    },

    /**
     * 设置座右铭
     */
    setMotto(motto) {
        return this.set(CONFIG.STORAGE_KEYS.MOTTO, motto);
    },

    /**
     * 获取公告数据（TXT 原文）
     */
    getAnnouncement() {
        return this.get(CONFIG.STORAGE_KEYS.ANNOUNCEMENT, '');
    },

    /**
     * 设置公告数据（TXT 原文）
     */
    setAnnouncement(text) {
        return this.set(CONFIG.STORAGE_KEYS.ANNOUNCEMENT, text);
    },

    /**
     * 导出数据（用于备份）
     */
    exportData() {
        const data = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            chatHistory: this.getChatHistory(),
            memories: this.getMemories(),
            settings: this.getSettings(),
            systemPrompt: this.getSystemPrompt(),
            contacts: this.getContacts(),
            motto: this.getMotto(),
            announcement: this.getAnnouncement()
        };
        return JSON.stringify(data, null, 2);
    },

    /**
     * 导入数据（从备份）
     */
    importData(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            if (data.version && data.chatHistory) {
                this.setChatHistory(data.chatHistory);
                data.memories && this.setMemories(data.memories);
                data.settings && this.setSettings(data.settings);
                data.systemPrompt && this.setSystemPrompt(data.systemPrompt);
                data.contacts && this.setContacts(data.contacts);
                data.motto && this.setMotto(data.motto);
                return true;
            }
            return false;
        } catch (e) {
            console.error('Import error:', e);
            return false;
        }
    },

    /**
     * 导出聊天历史为文本文件（UTF-8 BOM）
     */
    exportChatToText() {
        const history = this.getChatHistory();
        const prompt = this.getSystemPrompt();
        let text = '\uFEFF'; // UTF-8 BOM
        text += '系统提示：\n' + prompt + '\n\n';
        text += '='.repeat(50) + '\n\n';
        
        history.forEach(msg => {
            const role = msg.role === 'user' ? this.getUserName() : this.getAiName();
            const time = getTimeString(new Date(msg.timestamp));
            text += `[${time}] ${role}：\n${msg.content}\n\n`;
        });
        
        return text;
    },

    /**
     * 导入聊天历史从文本文件
     */
    importChatFromText(text) {
        const lines = text.split('\n');
        const messages = [];
        let currentRole = '';
        let currentContent = '';
        
        for (const line of lines) {
            const match = line.match(/^\[(\d{2}:\d{2})\]\s*(.+?)：$/);
            if (match) {
                if (currentRole && currentContent) {
                    messages.push({
                        role: currentRole === this.getUserName() ? 'user' : 'assistant',
                        content: currentContent.trim(),
                        timestamp: Date.now()
                    });
                }
                currentRole = match[2];
                currentContent = '';
            } else if (currentRole && line.trim() !== '') {
                currentContent += line + '\n';
            }
        }
        
        if (currentRole && currentContent) {
            messages.push({
                role: currentRole === this.getUserName() ? 'user' : 'assistant',
                content: currentContent.trim(),
                timestamp: Date.now()
            });
        }
        
        if (messages.length > 0) {
            const history = this.getChatHistory();
            history.push(...messages);
            this.setChatHistory(history);
            return messages.length;
        }
        return 0;
    },

    /**
     * 清除所有本地缓存（包括 localStorage 和 Service Worker 缓存）
     */
    async clearAllCache() {
        try {
            localStorage.clear();
            
            if ('caches' in window) {
                const cacheKeys = await caches.keys();
                await Promise.all(cacheKeys.map(key => caches.delete(key)));
            }
            
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const reg of registrations) {
                    await reg.unregister();
                }
            }
            
            sessionStorage.clear();
            return true;
        } catch (e) {
            console.error('Clear cache error:', e);
            return false;
        }
    }
};