// 设置面板

const Settings = {
    /** 初始化 */
    init() {
        document.getElementById('settingsBtn')?.addEventListener('click', () => this.open());
        document.getElementById('closeSettings')?.addEventListener('click', () => this.close());
        document.querySelector('.settings-overlay')?.addEventListener('click', () => this.close());
    },

    /** 打开设置面板 */
    open() {
        this.render();
        document.getElementById('settingsPanel')?.classList.add('open');
    },

    /** 关闭设置面板 */
    close() {
        document.getElementById('settingsPanel')?.classList.remove('open');
    },

    /** 渲染设置内容 */
    render() {
        const body = document.querySelector('.settings-body');
        if (!body) return;
        const settings = Storage.getSettings();
        body.innerHTML = `
            <div class="setting-group">
                <label>主题</label>
                <select id="themeSelect">
                    <option value="auto" ${settings.theme === 'auto' ? 'selected' : ''}>跟随系统</option>
                    <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>浅色</option>
                    <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>深色</option>
                </select>
            </div>
            <div class="setting-group">
                <label>聊天背景</label>
                <select id="bgSelect">
                    ${CONFIG.CHAT_BACKGROUNDS.map(bg => `
                        <option value="${bg.id}" ${settings.chatBackground === bg.id ? 'selected' : ''}>
                            ${bg.name}
                        </option>`).join('')}
                </select>
            </div>
            <div class="setting-group">
                <label>字体大小</label>
                <select id="fontSizeSelect">
                    ${CONFIG.FONT_SIZES.map(fs => `
                        <option value="${fs.id}" ${settings.fontSize === fs.id ? 'selected' : ''}>
                            ${fs.name}
                        </option>`).join('')}
                </select>
            </div>
            <div class="toggle-group">
                <span>联网搜索</span>
                <div class="toggle ${settings.webSearch ? 'active' : ''}" id="webSearchToggle"></div>
            </div>
            <div class="toggle-group">
                <span>自动记忆压缩</span>
                <div class="toggle ${settings.autoSummarize ? 'active' : ''}" id="autoSummarizeToggle"></div>
            </div>
            <div class="toggle-group">
                <span>打字指示器</span>
                <div class="toggle ${settings.typingIndicator ? 'active' : ''}" id="typingToggle"></div>
            </div>
            <div class="toggle-group">
                <span>Markdown 渲染</span>
                <div class="toggle ${settings.markdownRender ? 'active' : ''}" id="markdownToggle"></div>
            </div>
            <div class="toggle-group">
                <span>代码高亮</span>
                <div class="toggle ${settings.codeHighlight ? 'active' : ''}" id="codeToggle"></div>
            </div>
            <div class="setting-group">
                <label>用户名称</label>
                <input type="text" id="userNameInput" value="${Storage.getUserName()}" placeholder="用户名称">
            </div>
            <div class="setting-group">
                <label>AI 名称</label>
                <input type="text" id="aiNameInput" value="${Storage.getAiName()}" placeholder="AI 名称">
            </div>
            <div class="setting-group">
                <label>系统提示</label>
                <textarea id="systemPromptInput" rows="6" placeholder="系统提示词">${escapeHtml(Storage.getSystemPrompt())}</textarea>
            </div>
            <div class="setting-actions">
                <button class="btn-primary" id="saveSettings">保存设置</button>
                <button class="btn-secondary" id="resetSettings">恢复默认</button>
                <button class="btn-secondary" id="clearAllData">清空所有数据</button>
            </div>`;

        this.bindEvents();
    },

    /** 绑定设置事件 */
    bindEvents() {
        // 主题切换
        document.getElementById('themeSelect')?.addEventListener('change', function () {
            const next = this.value;
            document.documentElement.setAttribute('data-theme', next);
            const icon = document.querySelector('.theme-icon');
            if (icon) icon.textContent = next === 'dark' ? '☀️' : '🌙';
            Storage.updateSetting('theme', next);
            showToast(next === 'dark' ? '已切换到深色模式' : '已切换到浅色模式', 'info');
        });

        // 背景切换
        document.getElementById('bgSelect')?.addEventListener('change', function () {
            const bg = CONFIG.CHAT_BACKGROUNDS.find(b => b.id === this.value);
            if (bg) {
                const chatContainer = document.querySelector('.chat-container');
                if (chatContainer) {
                    if (bg.id === 'custom') {
                        const custom = prompt('输入自定义背景 CSS（如颜色或渐变）：', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
                        if (custom) chatContainer.style.background = custom;
                    } else {
                        chatContainer.style.background = bg.value;
                    }
                }
                Storage.updateSetting('chatBackground', this.value);
            }
        });

        // 字体大小
        document.getElementById('fontSizeSelect')?.addEventListener('change', function () {
            const size = CONFIG.FONT_SIZES.find(fs => fs.id === this.value)?.value;
            if (size) {
                document.documentElement.style.setProperty('--font-size', size);
                Storage.updateSetting('fontSize', this.value);
            }
        });

        // 开关切换
        ['webSearchToggle', 'autoSummarizeToggle', 'typingToggle', 'markdownToggle', 'codeToggle'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('click', function () {
                this.classList.toggle('active');
                const key = id.replace('Toggle', '');
                Storage.updateSetting(key, this.classList.contains('active'));
            });
        });

        // 保存设置
        document.getElementById('saveSettings')?.addEventListener('click', () => {
            const userName = document.getElementById('userNameInput')?.value?.trim() || '我';
            const aiName = document.getElementById('aiNameInput')?.value?.trim() || 'DeepSeek';
            const systemPrompt = document.getElementById('systemPromptInput')?.value?.trim() || CONFIG.DEFAULT_SYSTEM_PROMPT;
            Storage.setUserName(userName);
            Storage.setAiName(aiName);
            Storage.setSystemPrompt(systemPrompt);
            showToast('设置已保存', 'success');
            this.close();
        });

        // 恢复默认
        document.getElementById('resetSettings')?.addEventListener('click', () => {
            if (confirm('确定恢复所有默认设置吗？')) {
                Storage.setSettings(CONFIG.DEFAULT_SETTINGS);
                Storage.setSystemPrompt(CONFIG.DEFAULT_SYSTEM_PROMPT);
                Storage.setUserName('我');
                Storage.setAiName('DeepSeek');
                applyTheme('auto');
                showToast('已恢复默认设置', 'success');
                this.render();
            }
        });

        // 清空所有数据
        document.getElementById('clearAllData')?.addEventListener('click', async () => {
            if (confirm('⚠️ 确定清空所有数据吗？包括聊天记录、记忆、设置、缓存等，此操作不可撤销！')) {
                await Storage.clearAllCache();
                location.reload();
            }
        });
    }
};