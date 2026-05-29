// AI 聊天逻辑

/** 客户端联网搜索 - 浏览器端执行，绕过服务器 IP 限制 */
async function searchWebClient(query) {
    // 检测是否为新闻类查询
    const isNews = /新闻|最新|今日|热搜|头条|事件|报道|爆料|发生了什么|出什么事|现在|目前|当前/.test(query);
    
    // 方案1: 通过 codetabs CORS 代理访问 Bing（最稳定）
    try {
        const baseUrl = isNews ? 'https://www.bing.com/news/search' : 'https://www.bing.com/search';
        const params = new URLSearchParams({
            q: query,
            setlang: 'zh-cn',
            cc: 'cn'
        });
        if (isNews) {
            params.set('qft', 'interval="7"'); // 最近7天
        } else {
            params.set('qft', 'filterui:age-lt1440'); // 最近24小时
        }
        
        const targetUrl = `${baseUrl}?${params.toString()}`;
        const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`;
        
        const res = await fetch(proxyUrl, { 
            signal: AbortSignal.timeout(10000),
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (!res.ok) throw new Error(`Proxy failed: ${res.status}`);
        
        const html = await res.text();
        const results = [];
        
        if (isNews) {
            // 解析 Bing 新闻结果
            const titleRegex = /<a[^>]*class="title"[^>]*href="(https?:\/\/[^"]+)"[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/gi;
            const snippetRegex = /<div[^>]*class="snippet"[^>]*>([\s\S]*?)<\/div>/gi;
            
            const titles = [...html.matchAll(titleRegex)];
            const snippets = [...html.matchAll(snippetRegex)];
            
            for (let i = 0; i < Math.min(titles.length, snippets.length, 5); i++) {
                const title = titles[i][2].replace(/<\/?[^>]+>/g, '').trim();
                const url = titles[i][1];
                const snippet = snippets[i][1].replace(/<\/?[^>]+>/g, '').trim();
                if (title && url && snippet) {
                    results.push(`[${title}](${url})\n${snippet}`);
                }
            }
        } else {
            // 解析普通 Bing 搜索结果
            const blockRegex = /<li class="b_algo"[^>]*>([\s\S]*?)<\/li>/gi;
            let block;
            while ((block = blockRegex.exec(html)) && results.length < 5) {
                const b = block[1];
                const linkMatch = b.match(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
                const snippetMatch = b.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
                if (linkMatch && snippetMatch) {
                    const title = linkMatch[2].replace(/<\/?[^>]+>/g, '').trim();
                    const snippet = snippetMatch[1].replace(/<\/?[^>]+>/g, '').trim();
                    if (title && snippet.length > 10) {
                        results.push(`[${title}](${linkMatch[1]})\n${snippet}`);
                    }
                }
            }
        }
        
        if (results.length > 0) return results.join('\n\n');
    } catch (e) {
        console.log('Bing via codetabs failed:', e.message);
    }
    
    // 方案2: DuckDuckGo HTML 备用
    try {
        const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=cn-zh`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(6000)
        });
        if (!res.ok) throw new Error('DDG failed');
        const html = await res.text();
        const results = [];
        const linkRe = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
        const snippetRe = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
        const links = [...html.matchAll(linkRe)];
        const snippets = [...html.matchAll(snippetRe)];
        for (let i = 0; i < Math.min(links.length, snippets.length, 5); i++) {
            const title = links[i][2].replace(/<\/?[^>]+>/g, '').trim();
            const url = links[i][1].replace(/\/\/duckduckgo\.com\/l\/\?uddg=/, '').replace(/&rut=.*$/, '');
            const finalUrl = url.startsWith('http') ? url : decodeURIComponent(url);
            const snippet = snippets[i][1].replace(/<\/?[^>]+>/g, '').trim();
            if (title && snippet) {
                results.push(`[${title}](${finalUrl})\n${snippet}`);
            }
        }
        if (results.length > 0) return results.join('\n\n');
    } catch (e) {
        console.log('DDG search failed:', e.message);
    }

    return null;
}

const Chat = {
    isProcessing: false,
    webSearchEnabled: true,
    chatHistory: [],
    pendingMessage: null,
    // trigger vercel deploy

    /** 初始化 */
    init() {
        this.webSearchEnabled = Storage.getSettings().webSearch;
        this.emojiAutoEnabled = Storage.getSettings().emojiAuto || false;
        this.chatHistory = Storage.getChatHistory();
        this.loadAiAvatar();
        this.renderHistory();
        this.bindEvents();
        document.addEventListener('viewChanged', (e) => {
            if (e.detail.view === 'chat') this.scrollToBottom();
        });
    },

    /** 加载 AI 头像 */
    loadAiAvatar() {
        const aiAvatarId = Storage.getAiAvatar();
        if (aiAvatarId === 'custom') {
            const customBase64 = Storage.getCustomAvatar();
            if (customBase64) {
                this.updateCustomAvatar(customBase64);
                return;
            }
        }
        const avatar = (typeof AVATARS !== 'undefined' && AVATARS[aiAvatarId]) || { emoji: '🤖', name: 'AI 助手' };
        this.updateAiAvatar(avatar);
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
        if (this.isProcessing) {
            this.pendingMessage = content;
            return;
        }
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

            // 表情自动匹配
            if (this.emojiAutoEnabled) {
                setTimeout(() => this.searchEmoji(aiContent, true), 1000);
            }
        } catch (err) {
            const errMsg = { role: 'assistant', content: `请求失败: ${err.message}`, timestamp: Date.now() };
            this.appendMessage(errMsg);
        } finally {
            UI.showTyping(false);
            UI.disableInput(false);
            this.isProcessing = false;
            if (!isAuto) document.getElementById('messageInput')?.focus();
            // 处理积压消息
            if (this.pendingMessage) {
                const pending = this.pendingMessage;
                this.pendingMessage = null;
                setTimeout(() => this.sendMessage(pending), 100);
            }
        }
    },

    /** 调用聊天 API */
    async callChatAPI(userContent) {
        const context = Memory.buildContext();
        const recentMessages = Memory.getChatContext();
        const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
        const timeContext = { role: 'system', content: `当前时间：${now}。请牢记这个时间信息。` };

        // 客户端联网搜索
        let searchContext = null;
        if (this.webSearchEnabled) {
            try {
                searchContext = await searchWebClient(userContent);
            } catch {}
        }

        const messages = [timeContext];
        if (searchContext) {
            const today = new Date().toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric', weekday:'long' });
            messages.push({ role: 'system', content: `联网搜索结果（当前日期：${today}）：\n${searchContext}\n\n请严格基于以上搜索结果回答。如果搜索结果与你的训练数据冲突，以搜索结果为准。` });
        }
        messages.push(context, ...recentMessages, { role: 'user', content: userContent });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            return await fetch(CONFIG.CHAT_API, {
                signal: controller.signal,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages,
                    model: CONFIG.MODEL,
                    temperature: CONFIG.TEMPERATURE,
                    max_tokens: CONFIG.MAX_TOKENS
                })
            });
        } finally {
            clearTimeout(timeoutId);
        }
    },

    /** 表情搜索 */
    async searchEmoji(keyword) {
        try {
            const res = await fetch(`${CONFIG.EMOJI_API}?keyword=${encodeURIComponent(keyword)}&count=1`);
            const data = await res.json();
            if (data.images?.length) {
                const aiMsg = { role: 'assistant', content: `搜索"${keyword}"的表情`, image: data.images[0], timestamp: Date.now() };
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

        // 确保按钮存在
        if (!sendBtn || !input) {
            console.error('聊天页面元素未找到');
            return;
        }

        // 发送按钮
        sendBtn.onclick = () => {
            const content = input.value.trim();
            if (content) {
                this.sendMessage(content);
                input.value = '';
                input.style.height = 'auto';
            }
        };

        // Enter 键发送
        input.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendBtn.click();
            }
        };

        // 输入框自适应高度
        input.oninput = () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
            const counter = document.getElementById('tokenCounter');
            if (counter) counter.textContent = `Tokens: ${estimateTokens(input.value)}`;
        };

        // AI 头像点击更换
        const aiAvatar = document.getElementById('aiAvatar');
        if (aiAvatar) {
            aiAvatar.onclick = () => this.showAvatarPicker();
        }

        // 图片上传
        const imageUploadBtn = document.getElementById('imageUploadBtn');
        const imageUpload = document.getElementById('imageUpload');
        if (imageUploadBtn && imageUpload) {
            imageUploadBtn.onclick = () => imageUpload.click();
            imageUpload.onchange = (e) => {
                if (e.target.files[0]) this.sendImage(e.target.files[0]);
            };
        }

        // 联网搜索开关
        const webSearchToggle = document.getElementById('webSearchToggle');
        if (webSearchToggle) {
            webSearchToggle.classList.toggle('active', this.webSearchEnabled);
            webSearchToggle.onclick = () => {
                this.webSearchEnabled = !this.webSearchEnabled;
                webSearchToggle.classList.toggle('active', this.webSearchEnabled);
                showToast(this.webSearchEnabled ? '联网搜索已开启' : '联网搜索已关闭', 'info');
                Storage.updateSetting('webSearch', this.webSearchEnabled);
            };
        }

        // 表情包自动匹配开关
        const emojiToggle = document.getElementById('emojiToggle');
        if (emojiToggle) {
            emojiToggle.classList.toggle('active', this.emojiAutoEnabled);
            emojiToggle.onclick = () => {
                this.emojiAutoEnabled = !this.emojiAutoEnabled;
                emojiToggle.classList.toggle('active', this.emojiAutoEnabled);
                showToast(this.emojiAutoEnabled ? '表情包自动匹配已开启' : '表情包自动匹配已关闭', 'info');
                Storage.updateSetting('emojiAuto', this.emojiAutoEnabled);
            };
        }

        // 添加记忆
        const addMemoryBtn = document.getElementById('addMemoryBtn');
        if (addMemoryBtn) {
            addMemoryBtn.onclick = () => Memory.memorizeContext();
        }

        // 导出聊天
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.onclick = () => this.exportChat();
        }

        // 记忆管理
        const memoryBtn = document.getElementById('memoryBtn');
        const closeMemory = document.getElementById('closeMemory');
        const memoryOverlay = document.querySelector('.memory-overlay');
        if (memoryBtn) {
            memoryBtn.onclick = () => {
                Memory.renderPanel();
                document.getElementById('memoryPanel')?.classList.add('open');
            };
        }
        if (closeMemory) {
            closeMemory.onclick = () => {
                document.getElementById('memoryPanel')?.classList.remove('open');
            };
        }
        if (memoryOverlay) {
            memoryOverlay.onclick = () => {
                document.getElementById('memoryPanel')?.classList.remove('open');
            };
        }
    },

    /** 显示头像选择器 */
    showAvatarPicker() {
        const picker = document.createElement('div');
        picker.className = 'avatar-picker';
        picker.innerHTML = `
            <div class="picker-header">
                <h3>选择 AI 头像</h3>
                <button class="picker-close">×</button>
            </div>
            <div class="picker-grid">
                ${Object.entries(AVATARS).map(([id, avatar]) => `
                    <div class="avatar-option ${id === Storage.getAiAvatar() ? 'selected' : ''}" data-id="${id}">
                        <div class="option-emoji" style="background: ${avatar.color}">${avatar.emoji}</div>
                        <div class="option-name">${avatar.name}</div>
                    </div>
                `).join('')}
                <!-- 自定义上传选项 -->
                <div class="avatar-option custom-upload" id="customAvatarUploadBtn">
                    <div class="option-emoji" style="background: #9b59b6">📁</div>
                    <div class="option-name">上传图片</div>
                    <input type="file" id="customAvatarInput" accept="image/*" style="display: none">
                </div>
            </div>
        `;

        document.body.appendChild(picker);
        setTimeout(() => picker.classList.add('show'), 10);

        // 关闭按钮
        picker.querySelector('.picker-close').addEventListener('click', () => {
            picker.classList.remove('show');
            setTimeout(() => picker.remove(), 300);
        });

        // 点击外部关闭
        picker.addEventListener('click', (e) => {
            if (e.target === picker) {
                picker.classList.remove('show');
                setTimeout(() => picker.remove(), 300);
            }
        });

        // 选择头像
        picker.querySelectorAll('.avatar-option:not(.custom-upload)').forEach(option => {
            option.addEventListener('click', () => {
                const avatarId = option.dataset.id;
                const avatar = AVATARS[avatarId];
                if (avatar) {
                    Storage.setAiAvatar(avatarId);
                    this.updateAiAvatar(avatar);
                    picker.classList.remove('show');
                    setTimeout(() => picker.remove(), 300);
                    showToast(`已更换为 ${avatar.name}`, 'success');
                }
            });
        });

        // 自定义上传
        const customUploadBtn = picker.querySelector('#customAvatarUploadBtn');
        const customAvatarInput = picker.querySelector('#customAvatarInput');
        
        if (customUploadBtn && customAvatarInput) {
            customUploadBtn.addEventListener('click', () => {
                customAvatarInput.click();
            });

            customAvatarInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                try {
                    const base64 = await compressImage(file);
                    Storage.setAiAvatar('custom');
                    Storage.setCustomAvatar(base64);
                    this.updateCustomAvatar(base64);
                    picker.classList.remove('show');
                    setTimeout(() => picker.remove(), 300);
                    showToast('自定义头像已设置', 'success');
                } catch (err) {
                    showToast('头像上传失败', 'error');
                }
            });
        }
    },

    /** 更新自定义头像 */
    updateCustomAvatar(base64) {
        const aiAvatar = document.getElementById('aiAvatar');
        const aiName = document.getElementById('aiName');
        if (aiAvatar) {
            aiAvatar.innerHTML = `<img src="${base64}" alt="自定义头像" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            aiAvatar.style.setProperty('--avatar-color', '#9b59b6');
        }
        if (aiName) {
            aiName.textContent = '自定义头像 记忆管家';
        }
    },

    /** 更新 AI 头像显示 */
    updateAiAvatar(avatar) {
        const aiAvatar = document.getElementById('aiAvatar');
        const aiName = document.getElementById('aiName');
        if (aiAvatar) {
            aiAvatar.querySelector('.avatar-emoji').textContent = avatar.emoji;
            aiAvatar.style.setProperty('--avatar-color', avatar.color);
        }
        if (aiName) {
            aiName.textContent = `${avatar.name} 记忆管家`;
        }
    },

    /** 表情搜索 - 增强版，支持自动匹配 */
    async searchEmoji(keyword, auto = false) {
        try {
            // 如果是自动匹配，先获取关键词
            let searchKeyword = keyword;
            if (auto && typeof suggestEmojiKeywords === 'function') {
                const suggestions = suggestEmojiKeywords(keyword);
                if (suggestions.length > 0) {
                    searchKeyword = suggestions[0];
                }
            }

            const res = await fetch(`${CONFIG.EMOJI_API}?keyword=${encodeURIComponent(searchKeyword)}&count=1`);
            const data = await res.json();
            if (data.images?.length) {
                const aiMsg = { 
                    role: 'assistant', 
                    content: auto ? '' : `搜索 "${searchKeyword}" 的表情`, 
                    image: data.images[0],
                    timestamp: Date.now() 
                };
                this.appendMessage(aiMsg);
                Storage.addChatMessage(aiMsg);
                this.chatHistory = Storage.getChatHistory();
            } else {
                if (!auto) {
                    const aiMsg = { role: 'assistant', content: `未找到"${searchKeyword}"的表情包`, timestamp: Date.now() };
                    this.appendMessage(aiMsg);
                    Storage.addChatMessage(aiMsg);
                    this.chatHistory = Storage.getChatHistory();
                }
            }
        } catch {
            if (!auto) {
                const aiMsg = { role: 'assistant', content: '表情搜索失败，请稍后重试', timestamp: Date.now() };
                this.appendMessage(aiMsg);
                Storage.addChatMessage(aiMsg);
                this.chatHistory = Storage.getChatHistory();
            }
        }
    }
};