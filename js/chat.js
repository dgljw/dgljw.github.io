// AI 聊天逻辑

const Chat = {
    isProcessing: false,
    webSearchEnabled: true,
    chatHistory: [],
    pendingMessage: null,

    /** 初始化 */
    init() {
        this.webSearchEnabled = Storage.getSettings().webSearch;
        this.chatHistory = Storage.getChatHistory();
        this.renderHistory();
        this.bindEvents();
        document.addEventListener('viewChanged', (e) => {
            if (e.detail.view === 'chat') this.scrollToBottom();
        });
    },

    /** 渲染历史消息 */
    renderHistory() {
        const container = document.getElementById('messagesContainer');
        if (!container) return;
        const welcome = container.querySelector('.welcome-message');
        if (welcome) welcome.remove();
        if (this.chatHistory.length === 0) {
            container.innerHTML = `<div class="welcome-message">${UI.createWelcomeMessage()}</div>`;
            return;
        }
        container.innerHTML = '';
        let lastDate = '';
        this.chatHistory.forEach(msg => {
            const date = getDateString(new Date(msg.timestamp));
            if (date !== lastDate) {
                container.appendChild(UI.createDateDivider(date));
                lastDate = date;
            }
            container.appendChild(UI.createMessageBubble(msg));
        });
        this.scrollToBottom();
        highlightCode();
    },

    /** 添加消息到界面 */
    appendMessage(msg) {
        const container = document.getElementById('messagesContainer');
        if (!container) return;
        const welcome = container.querySelector('.welcome-message');
        if (welcome) welcome.remove();
        container.appendChild(UI.createMessageBubble(msg));
        this.scrollToBottom();
        if (msg.role === 'assistant') highlightCode();
    },

    /** 发送消息 */
    async sendMessage(content, isAuto = false) {
        if (this.isProcessing) return;
        if (!content?.trim()) return;

        this.isProcessing = true;
        const userMsg = { role: 'user', content: content.trim(), timestamp: Date.now() };

        // 表情包检测
        const emojiMatch = content.match(/^\/表情\s+(.+)/);
        if (emojiMatch) {
            this.appendMessage(userMsg);
            Storage.addChatMessage(userMsg);
            this.chatHistory = Storage.getChatHistory();
            await this.searchEmoji(emojiMatch[1]);
            this.isProcessing = false;
            return;
        }

        this.appendMessage(userMsg);
        Storage.addChatMessage(userMsg);
        this.chatHistory = Storage.getChatHistory();
        UI.showTyping(true);
        UI.disableInput(true);

        try {
            const response = await this.callChatAPI(content);
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${response.status}`);
            }
            const data = await response.json();
            const aiContent = data.content || data.message || '抱歉，AI 没有返回有效回复。';
            const aiMsg = { role: 'assistant', content: aiContent, timestamp: Date.now() };
            this.appendMessage(aiMsg);
            Storage.addChatMessage(aiMsg);
            this.chatHistory = Storage.getChatHistory();

            if (data.summary) Memory.addMemory(data.summary);

            // 自动压缩检查
            if (Memory.shouldCompress()) {
                setTimeout(() => Memory.compressMemories(), 500);
            }
        } catch (err) {
            const errMsg = { role: 'assistant', content: `请求失败: ${err.message}`, timestamp: Date.now() };
            this.appendMessage(errMsg);
        } finally {
            UI.showTyping(false);
            UI.disableInput(false);
            if (!isAuto) document.getElementById('messageInput')?.focus();
            this.isProcessing = false;
        }
    },

    /** 调用聊天 API */
    async callChatAPI(userContent) {
        const context = Memory.buildContext();
        const recentMessages = Memory.getChatContext();

        return fetch(CONFIG.CHAT_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [context, ...recentMessages, { role: 'user', content: userContent }],
                model: CONFIG.MODEL,
                temperature: CONFIG.TEMPERATURE,
                max_tokens: CONFIG.MAX_TOKENS,
                web_search: this.webSearchEnabled
            })
        });
    },

    /** 表情搜索 */
    async searchEmoji(keyword) {
        try {
            const res = await fetch(`${CONFIG.EMOJI_API}?keyword=${encodeURIComponent(keyword)}&count=8`);
            const data = await res.json();
            if (data.images?.length) {
                const html = '<div class="emoji-grid">' +
                    data.images.map(url => `<img src="${url}" alt="表情" loading="lazy" onclick="window.open('${url}')">`).join('') +
                    '</div>';
                const aiMsg = { role: 'assistant', content: `搜索"${keyword}"的表情：\n${html}`, timestamp: Date.now() };
                this.appendMessage(aiMsg);
                Storage.addChatMessage(aiMsg);
                this.chatHistory = Storage.getChatHistory();
            } else {
                const aiMsg = { role: 'assistant', content: `未找到"${keyword}"的表情包`, timestamp: Date.now() };
                this.appendMessage(aiMsg);
                Storage.addChatMessage(aiMsg);
                this.chatHistory = Storage.getChatHistory();
            }
        } catch {
            const aiMsg = { role: 'assistant', content: '表情搜索失败，请稍后重试', timestamp: Date.now() };
            this.appendMessage(aiMsg);
            Storage.addChatMessage(aiMsg);
            this.chatHistory = Storage.getChatHistory();
        }
    },

    /** 发送图片 */
    async sendImage(file) {
        if (this.isProcessing) return;
        this.isProcessing = true;
        try {
            const base64 = await compressImage(file, 800, 0.8);
            const userMsg = { role: 'user', content: `[图片]`, image: base64, timestamp: Date.now() };
            this.appendMessage(userMsg);
            Storage.addChatMessage(userMsg);
            this.chatHistory = Storage.getChatHistory();
            UI.showTyping(true);
            UI.disableInput(true);

            const res = await fetch(CONFIG.CHAT_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [
                        Memory.buildContext(),
                        ...Memory.getChatContext().slice(-5),
                        { role: 'user', content: '请描述这张图片的内容', image: base64 }
                    ],
                    model: CONFIG.MODEL,
                    temperature: CONFIG.TEMPERATURE,
                    max_tokens: CONFIG.MAX_TOKENS,
                    web_search: false
                })
            });
            const data = await res.json();
            const aiMsg = { role: 'assistant', content: data.content || '抱歉，无法分析该图片', timestamp: Date.now() };
            this.appendMessage(aiMsg);
            Storage.addChatMessage(aiMsg);
            this.chatHistory = Storage.getChatHistory();
        } catch (err) {
            const errMsg = { role: 'assistant', content: `图片处理失败: ${err.message}`, timestamp: Date.now() };
            this.appendMessage(errMsg);
        } finally {
            UI.showTyping(false);
            UI.disableInput(false);
            this.isProcessing = false;
        }
    },

    /** 清空聊天 */
    clearChat() {
        if (confirm('确定清空所有聊天记录吗？此操作不可撤销。')) {
            Storage.clearChatHistory();
            this.chatHistory = [];
            this.renderHistory();
            showToast('聊天记录已清空', 'success');
        }
    },

    /** 导出聊天 */
    exportChat() {
        const text = Storage.exportChatToText();
        const blob = new Blob([text], { type: 'text/plain;charset=UTF-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `chat_${new Date().toISOString().slice(0, 10)}.txt`;
        a.click(); URL.revokeObjectURL(a.href);
        showToast('聊天记录已导出', 'success');
    },

    /** 滚动到底部 */
    scrollToBottom() {
        const container = document.getElementById('messagesContainer');
        if (container) {
            requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
        }
    },

    /** 绑定事件 */
    bindEvents() {
        const input = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');

        sendBtn?.addEventListener('click', () => {
            this.sendMessage(input.value);
            input.value = '';
            input.style.height = 'auto';
        });

        input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendBtn.click();
            }
        });

        input?.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
            const counter = document.getElementById('tokenCounter');
            if (counter) counter.textContent = `Tokens: ${estimateTokens(input.value)}`;
        });

        document.getElementById('imageUploadBtn')?.addEventListener('click', () => {
            document.getElementById('imageUpload')?.click();
        });

        document.getElementById('imageUpload')?.addEventListener('change', (e) => {
            if (e.target.files[0]) this.sendImage(e.target.files[0]);
        });

        document.getElementById('webSearchToggle')?.addEventListener('click', function () {
            Chat.webSearchEnabled = !Chat.webSearchEnabled;
            this.classList.toggle('active', Chat.webSearchEnabled);
            showToast(Chat.webSearchEnabled ? '联网搜索已开启' : '联网搜索已关闭', 'info');
            Storage.updateSetting('webSearch', Chat.webSearchEnabled);
        });

        document.getElementById('addMemoryBtn')?.addEventListener('click', () => Memory.memorizeContext());

        document.getElementById('exportBtn')?.addEventListener('click', () => this.exportChat());

        document.getElementById('memoryBtn')?.addEventListener('click', () => {
            Memory.renderPanel();
            document.getElementById('memoryPanel')?.classList.add('open');
        });

        document.getElementById('closeMemory')?.addEventListener('click', () => {
            document.getElementById('memoryPanel')?.classList.remove('open');
        });

        document.querySelector('.memory-overlay')?.addEventListener('click', () => {
            document.getElementById('memoryPanel')?.classList.remove('open');
        });
    }
};