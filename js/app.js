// 入口文件 - 初始化应用

(function () {
    'use strict';

    const App = {
        /** 应用初始化 */
        async init() {
            // 初始化存储默认值
            Storage.initDefaults();

            // 应用主题
            const settings = Storage.getSettings();
            applyTheme(settings.theme);
            this.applyFontSize(settings.fontSize);
            this.applyChatBackground(settings.chatBackground);

            // 初始化路由
            Router.init();
            Router.navigate(location.hash.slice(1) || 'home');

            // 初始化各模块
            Home.init();
            Chat.init();
            Extractor.init();
            Settings.init();
            UI.checkWeChatEnv();

            // 全局事件
            this.bindGlobalEvents();

            // 通知系统就绪
            if (settings.notifications !== false) {
                UI.createNotification('DeepSeek 记忆管家', '应用已就绪，开始对话吧', 3000);
            }
        },

        /** 应用字体大小 */
        applyFontSize(sizeId) {
            const size = CONFIG.FONT_SIZES.find(fs => fs.id === sizeId)?.value;
            if (size) document.documentElement.style.setProperty('--font-size', size);
        },

        /** 应用聊天背景 */
        applyChatBackground(bgId) {
            const bg = CONFIG.CHAT_BACKGROUNDS.find(b => b.id === bgId);
            const container = document.querySelector('.chat-container');
            if (bg && container) {
                if (bg.id === 'custom') {
                    container.style.background = '';
                } else {
                    container.style.background = bg.value;
                }
            }
        },

        /** 切换主题 */
        toggleTheme() {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            const icon = document.querySelector('.theme-icon');
            if (icon) icon.textContent = next === 'dark' ? '☀️' : '🌙';
            Storage.updateSetting('theme', next);
            showToast(next === 'dark' ? '已切换到深色模式' : '已切换到浅色模式', 'info');
            // 强制刷新设置面板的 select
            const themeSelect = document.getElementById('themeSelect');
            if (themeSelect) themeSelect.value = next;
        },

        /** 全局事件 */
        bindGlobalEvents() {
            // 主题切换 - 使用 onclick 属性 + 事件委托确保必定触发
            const themeToggle = document.getElementById('themeToggle');
            if (themeToggle) {
                themeToggle.onclick = (e) => {
                    e.preventDefault();
                    App.toggleTheme();
                };
            }

            // 键盘快捷键
            document.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                    e.preventDefault();
                    document.getElementById('messageInput')?.focus();
                }
                if (e.key === 'Escape') {
                    document.getElementById('settingsPanel')?.classList.remove('open');
                    document.getElementById('memoryPanel')?.classList.remove('open');
                }
            });

            // 窗口焦点变化
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && Chat.chatHistory.length > 0) {
                    Chat.scrollToBottom();
                }
            });

            // 网络状态
            window.addEventListener('offline', () => showToast('网络已断开', 'error'));
            window.addEventListener('online', () => showToast('网络已恢复', 'success'));
        }
    };

    // DOM 加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => App.init());
    } else {
        App.init();
    }
})();