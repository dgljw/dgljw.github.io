// DOM 渲染与 UI 交互

const UI = {
    /** 创建欢迎消息 */
    createWelcomeMessage() {
        return `
            <div class="welcome-icon">🤖</div>
            <h3>${Storage.getAiName()}</h3>
            <p>我是你的 AI 记忆管家，可以帮你解答问题、记录要点</p>
            <div class="welcome-tips">
                <span>💡 输入 <code>/表情 关键词</code> 搜索表情包</span>
                <span>🔍 开启联网搜索获取实时信息</span>
            </div>`;
    },

    /** 创建日期分隔线 */
    createDateDivider(date) {
        const div = document.createElement('div');
        div.className = 'date-divider';
        div.innerHTML = `<span>${date}</span>`;
        return div;
    },

    /** 创建消息气泡 */
    createMessageBubble(msg) {
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${msg.role}`;

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';

        // 图片消息
        if (msg.image) {
            const img = document.createElement('img');
            img.src = msg.image;
            img.className = 'message-image';
            img.loading = 'lazy';
            bubble.appendChild(img);
        }

        // 文本内容
        if (msg.content) {
            const contentDiv = document.createElement('div');
            const settings = Storage.getSettings();
            contentDiv.className = `message-content ${settings.codeHighlight ? 'with-code' : ''}`;
            if (msg.role === 'assistant' && settings.markdownRender) {
                contentDiv.innerHTML = renderMarkdown(msg.content);
            } else {
                contentDiv.innerHTML = escapeHtml(msg.content).replace(/\n/g, '<br>');
            }
            bubble.appendChild(contentDiv);
        }

        // 时间
        const time = document.createElement('div');
        time.className = 'message-time';
        time.textContent = new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        bubble.appendChild(time);

        wrapper.appendChild(bubble);
        return wrapper;
    },

    /** 显示/隐藏打字指示器 */
    showTyping(show) {
        const indicator = document.getElementById('typingIndicator');
        if (!indicator) return;
        if (show) {
            indicator.style.display = 'flex';
            this.scrollTypingIntoView();
        } else {
            indicator.style.display = 'none';
        }
    },

    /** 延迟后自动显示主动记忆弹窗 */
    maybeSuggestMemory() {
        const settings = Storage.getSettings();
        if (!settings.autoSummarize) return;
        const lastSuggest = parseInt(localStorage.getItem('lastMemorySuggest') || '0');
        const now = Date.now();
        if (now - lastSuggest < 3600000) return;
        const history = Storage.getChatHistory();
        if (history.length < 8) return;

        localStorage.setItem('lastMemorySuggest', now.toString());
        setTimeout(() => {
            const panel = document.getElementById('suggestMemory');
            if (panel) {
                panel.classList.add('show');
                setTimeout(() => panel.classList.remove('show'), 8000);
            }
        }, 3000);
    },

    /** 滚动打字指示器到可见区域 */
    scrollTypingIntoView() {
        const indicator = document.getElementById('typingIndicator');
        const container = document.getElementById('messagesContainer');
        if (indicator && container) {
            requestAnimationFrame(() => {
                container.scrollTop = container.scrollHeight;
            });
        }
    },

    /** 禁用/启用输入 */
    disableInput(disabled) {
        const input = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        if (input) input.disabled = disabled;
        if (sendBtn) sendBtn.disabled = disabled;
    },

    /** 微信环境检测弹窗 */
    checkWeChatEnv() {
        if (!isWeChat()) return;
        const overlay = document.getElementById('wechatOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
            document.getElementById('closeWechatOverlay')?.addEventListener('click', () => {
                overlay.style.display = 'none';
            });
        }
    },

    /** 通知弹窗 */
    createNotification(title, message, duration = 5000) {
        const container = document.getElementById('notificationContainer') || (() => {
            const c = document.createElement('div');
            c.id = 'notificationContainer';
            c.className = 'notification-container';
            document.body.appendChild(c);
            return c;
        })();

        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.innerHTML = `
            <div class="notification-title">${title}</div>
            <div class="notification-body">${message}</div>
        `;
        container.appendChild(notification);
        requestAnimationFrame(() => notification.classList.add('show'));

        const settings = Storage.getSettings();
        if (settings.notifications !== false) {
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, duration);
        }

        notification.addEventListener('click', () => notification.classList.remove('show'));
        return notification;
    },

    /** 建议记忆弹窗 */
    renderSuggestMemory() {
        const div = document.createElement('div');
        div.id = 'suggestMemory';
        div.className = 'suggest-memory';
        div.innerHTML = `
            <div class="suggest-memory-content">
                <p>🎯 对话内容较多，需要我记住当前上下文吗？</p>
                <div class="suggest-memory-actions">
                    <button class="btn-primary" id="suggestYes">立即记忆</button>
                    <button class="btn-secondary" id="suggestNo">暂不需要</button>
                </div>
            </div>
        `;
        document.body.appendChild(div);
        document.getElementById('suggestYes')?.addEventListener('click', () => {
            Memory.memorizeContext();
            div.classList.remove('show');
        });
        document.getElementById('suggestNo')?.addEventListener('click', () => {
            div.classList.remove('show');
        });
    }
};