// 角色扮演提示词生成

const Extractor = {
    isProcessing: false,

    /** 初始化 */
    init() {
        const workInput = document.getElementById('extractWork');
        const charInput = document.getElementById('extractChar');
        const extractBtn = document.getElementById('extractBtn');
        const clearBtn = document.getElementById('clearTextBtn');

        const updateBtnState = () => {
            const work = workInput?.value?.trim() || '';
            const character = charInput?.value?.trim() || '';
            if (extractBtn) extractBtn.disabled = !(work && character);
        };

        workInput?.addEventListener('input', updateBtnState);
        charInput?.addEventListener('input', updateBtnState);

        if (extractBtn) {
            extractBtn.onclick = () => this.generate();
        }

        if (clearBtn) {
            clearBtn.onclick = () => {
                if (workInput) workInput.value = '';
                if (charInput) charInput.value = '';
                if (extractBtn) extractBtn.disabled = true;
            };
        }

        // Enter 键快速生成
        [workInput, charInput].forEach(el => {
            el?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') extractBtn?.click();
            });
        });
    },

    /** 生成角色扮演提示词 */
    async generate() {
        const workInput = document.getElementById('extractWork');
        const charInput = document.getElementById('extractChar');
        const extractBtn = document.getElementById('extractBtn');

        const work = workInput?.value?.trim() || '';
        const character = charInput?.value?.trim() || '';

        if (!work || !character) {
            showToast('请同时输入作品和角色', 'warning');
            return;
        }

        if (this.isProcessing) return;
        this.isProcessing = true;
        extractBtn.classList.add('loading');
        extractBtn.disabled = true;

        const query = `请为以下角色生成角色扮演系统提示词：\n作品：《${work}》\n角色：${character}`;

        try {
            const res = await fetch(CONFIG.CHAT_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [
                        { role: 'system', content: '你是一个角色扮演提示词生成专家。根据用户提供的作品和角色，生成适合角色扮演的完整系统提示词（system prompt），包括角色性格、说话风格、行为习惯等。直接返回角色扮演提示词，不要添加解释或前缀。用文本格式输出。' },
                        { role: 'user', content: query }
                    ],
                    model: CONFIG.MODEL,
                    temperature: CONFIG.TEMPERATURE,
                    max_tokens: CONFIG.MAX_TOKENS,
                    web_search: false
                })
            });

            if (!res.ok) throw new Error(`API 错误: ${res.status}`);
            const data = await res.json();
            this.renderResult(data, work, character);

        } catch (err) {
            showToast(`生成失败: ${err.message}`, 'error');
            this.renderResult(null);
        } finally {
            extractBtn.classList.remove('loading');
            extractBtn.disabled = false;
            this.isProcessing = false;
        }
    },

    /** 渲染结果 */
    renderResult(data, work, character) {
        const grid = document.getElementById('resultsGrid');
        const countEl = document.getElementById('resultsCount');
        if (!grid) return;

        const prompt = data?.content || '';

        if (!prompt) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎬</div>
                    <p>生成失败，请重试</p>
                </div>`;
            if (countEl) countEl.textContent = '0 个角色';
            return;
        }

        const roleName = data.role_name || character;
        if (countEl) countEl.textContent = '1 个角色';

        grid.innerHTML = `
            <div class="role-play-card">
                <div class="role-header">
                    <span class="role-icon">🎭</span>
                    <div>
                        <h3 class="role-name">${escapeHtml(roleName)}</h3>
                        <span class="role-source">${escapeHtml(work || '')}</span>
                    </div>
                </div>
                <div class="role-prompt">
                    <pre>${escapeHtml(prompt)}</pre>
                </div>
                <div class="role-actions">
                    <button class="btn-primary copy-btn">📋 复制提示词</button>
                    <button class="btn-secondary chat-btn">💬 发送到 AI 聊天</button>
                </div>
            </div>`;

        const promptText = prompt;
        const fullPrompt = promptText;

        // 复制按钮
        grid.querySelector('.copy-btn').onclick = async () => {
            try {
                await navigator.clipboard.writeText(fullPrompt);
                showToast('提示词已复制到剪贴板', 'success');
            } catch {
                showToast('复制失败', 'error');
            }
        };

        // 发送到聊天
        grid.querySelector('.chat-btn').onclick = () => {
            Router.navigate('chat');
            setTimeout(() => {
                const input = document.getElementById('messageInput');
                if (input) {
                    input.value = fullPrompt;
                    document.getElementById('sendBtn')?.click();
                }
            }, 300);
        };
    }
};