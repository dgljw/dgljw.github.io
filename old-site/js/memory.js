// 记忆管理

const Memory = {
    /**
     * 构建系统消息上下文
     */
    buildContext() {
        const systemPrompt = Storage.getSystemPrompt();
        const memories = Storage.getMemories();
        let content = systemPrompt;
        if (memories.length > 0) {
            content += '\n\n--- 长期记忆 ---\n';
            memories.forEach((m, i) => { content += `${i + 1}. ${m.text}\n`; });
            content += '---\n请参考长期记忆辅助回答。';
        }
        return { role: 'system', content };
    },

    /**
     * 获取最近聊天上下文
     */
    getChatContext(maxTokens = CONFIG.MEMORY_THRESHOLD) {
        const history = Storage.getChatHistory();
        const messages = [];
        let totalTokens = 0;
        for (let i = history.length - 1; i >= 0; i--) {
            const tokens = estimateTokens(history[i].content);
            if (totalTokens + tokens > maxTokens && messages.length > 2) break;
            messages.unshift({ role: history[i].role, content: history[i].content });
            totalTokens += tokens;
        }
        return messages;
    },

    /**
     * 检查是否需要压缩
     */
    shouldCompress() {
        const history = Storage.getChatHistory();
        let totalTokens = 0;
        history.forEach(m => { totalTokens += estimateTokens(m.content); });
        return totalTokens > CONFIG.MEMORY_THRESHOLD;
    },

    /**
     * 调用后端压缩记忆
     */
    async compressMemories() {
        const history = Storage.getChatHistory();
        if (history.length < 4) return;
        try {
            const res = await fetch(CONFIG.SUMMARIZE_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: history.slice(-10).map(m => ({ role: m.role, content: m.content })),
                    existingMemories: Storage.getMemories().map(m => m.text)
                })
            });
            if (!res.ok) throw new Error('Summarize failed');
            const data = await res.json();
            if (data.summary) this.addMemory(data.summary);
            if (data.mergedMemories) {
                Storage.setMemories(data.mergedMemories.map(t => ({ id: generateId(), text: t, timestamp: Date.now() })));
            }
        } catch (e) { console.error('compress error:', e); }
    },

    /**
     * 添加记忆
     */
    addMemory(text) {
        if (!text || text.trim().length < 5) return;
        const memories = Storage.getMemories();
        if (memories.some(m => calculateSimilarity(m.text, text) > CONFIG.SIMILARITY_THRESHOLD)) return;
        if (memories.length >= CONFIG.MAX_MEMORIES) memories.shift();
        memories.push({ id: generateId(), text: text.trim(), timestamp: Date.now() });
        Storage.setMemories(memories);
    },

    /**
     * 记忆当前上下文
     */
    async memorizeContext() {
        const history = Storage.getChatHistory();
        if (history.length < 2) { showToast('对话太少，无法记忆', 'info'); return; }
        try {
            const res = await fetch(CONFIG.SUMMARIZE_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: history.slice(-6).map(m => ({ role: m.role, content: m.content })),
                    existingMemories: Storage.getMemories().map(m => m.text),
                    mode: 'compact'
                })
            });
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();
            if (data.summary) { this.addMemory(data.summary); showToast('上下文已记忆', 'success'); }
        } catch {
            const ctx = history.slice(-4).map(m => m.content).join(' | ');
            this.addMemory(ctx.substring(0, 200));
            showToast('已记忆（简化模式）', 'success');
        }
    },

    /** 导出记忆文件 */
    exportMemories() {
        const memories = Storage.getMemories();
        if (memories.length === 0) { showToast('没有可导出的记忆', 'info'); return; }
        let text = '\uFEFF';
        memories.forEach((m, i) => { text += `${i + 1}. ${m.text}\n`; });
        const blob = new Blob([text], { type: 'text/plain;charset=UTF-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `memories_${new Date().toISOString().slice(0, 10)}.txt`;
        a.click(); URL.revokeObjectURL(a.href);
        showToast('记忆已导出', 'success');
    },

    /** 导入记忆文件 */
    importMemories(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            let count = 0;
            e.target.result.split('\n').forEach(line => {
                const m = line.match(/^\d+\.\s*(.+)$/);
                if (m) { this.addMemory(m[1]); count++; }
            });
            showToast(`已导入 ${count} 条记忆`, 'success');
            this.renderPanel();
        };
        reader.readAsText(file, 'UTF-8');
    },

    /** 渲染记忆面板 */
    renderPanel() {
        const body = document.querySelector('.memory-body');
        if (!body) return;
        const memories = Storage.getMemories();
        body.innerHTML = `
            <div class="memory-actions">
                <button class="btn-primary" id="addManualMemory">手动添加记忆</button>
                <button class="btn-secondary" id="memorizeContextBtn">记忆当前对话</button>
                <button class="btn-secondary" id="exportMemoriesBtn">导出记忆</button>
                <label class="btn-secondary" id="importMemoriesLabel" style="cursor:pointer">
                    导入记忆
                    <input type="file" id="importMemoriesInput" accept=".txt" style="display:none">
                </label>
            </div>
            <div class="memory-list">
                ${memories.length === 0
                    ? '<div class="memory-empty"><p>暂无记忆</p><p style="font-size:0.8rem;opacity:0.6">对话中 AI 会自动总结重要信息</p></div>'
                    : memories.map(m => `
                        <div class="memory-item">
                            <div class="memory-text">${escapeHtml(m.text)}</div>
                            <button class="memory-delete" data-id="${m.id}">🗑️</button>
                        </div>`).join('')
                }
            </div>`;

        document.getElementById('addManualMemory')?.addEventListener('click', () => {
            const text = prompt('输入记忆内容：');
            if (text?.trim()) { this.addMemory(text.trim()); this.renderPanel(); showToast('记忆已添加', 'success'); }
        });
        document.getElementById('memorizeContextBtn')?.addEventListener('click', () => this.memorizeContext());
        document.getElementById('exportMemoriesBtn')?.addEventListener('click', () => this.exportMemories());
        document.getElementById('importMemoriesInput')?.addEventListener('change', (e) => {
            if (e.target.files[0]) this.importMemories(e.target.files[0]);
        });
        body.querySelectorAll('.memory-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                Storage.removeMemory(btn.dataset.id);
                this.renderPanel();
                showToast('记忆已删除', 'success');
            });
        });
    }
};