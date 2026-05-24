// 预设词提取

const Extractor = {
    isProcessing: false,

    /** 初始化 */
    init() {
        const textarea = document.getElementById('extractTextarea');
        const extractBtn = document.getElementById('extractBtn');
        const clearBtn = document.getElementById('clearTextBtn');
        const charCount = document.getElementById('charCount');

        textarea?.addEventListener('input', () => {
            if (charCount) charCount.textContent = `${textarea.value.length} 字符`;
            extractBtn.disabled = textarea.value.trim().length === 0;
        });

        extractBtn?.addEventListener('click', () => this.extract());
        clearBtn?.addEventListener('click', () => {
            textarea.value = '';
            if (charCount) charCount.textContent = '0 字符';
            extractBtn.disabled = true;
        });
    },

    /** 执行提取 */
    async extract() {
        const textarea = document.getElementById('extractTextarea');
        const extractBtn = document.getElementById('extractBtn');
        const text = textarea?.value?.trim();
        if (!text || this.isProcessing) return;

        this.isProcessing = true;
        extractBtn.classList.add('loading');
        extractBtn.disabled = true;

        try {
            const res = await fetch(CONFIG.EXTRACT_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, count: 5 })
            });

            if (!res.ok) throw new Error(`Extract API 错误: ${res.status}`);
            const data = await res.json();
            this.renderResults(data.items || data.results || []);

        } catch (err) {
            showToast(`提取失败: ${err.message}`, 'error');
            this.renderResults([]);
        } finally {
            extractBtn.classList.remove('loading');
            extractBtn.disabled = false;
            this.isProcessing = false;
        }
    },

    /** 渲染结果 */
    renderResults(items) {
        const grid = document.getElementById('resultsGrid');
        const countEl = document.getElementById('resultsCount');
        if (!grid) return;

        if (!items || items.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">✨</div>
                    <p>提取结果将显示在这里</p>
                    <p class="empty-hint">每个结果可以发送到 AI 聊天</p>
                </div>`;
            countEl.textContent = '0 个结果';
            return;
        }

        countEl.textContent = `${items.length} 个结果`;
        grid.innerHTML = items.map((item, i) => {
            const text = typeof item === 'string' ? item : (item.question || item.phrase || item.keyword || '');
            return `
                <div class="result-item" style="animation-delay:${i * 0.1}s">
                    <span class="result-text">${escapeHtml(text)}</span>
                    <button class="result-send" data-text="${escapeHtml(text)}">发送到聊天</button>
                </div>`;
        }).join('');

        grid.querySelectorAll('.result-send').forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.dataset.text;
                Router.navigate('chat');
                setTimeout(() => {
                    document.getElementById('messageInput').value = text;
                    document.getElementById('sendBtn')?.click();
                }, 300);
            });
        });
    }
};