/**
 * 长期记忆管理
 * 负责记忆压缩、合并、去重、历史重建
 */

const MemoryManager = {
  /**
   * 获取当前完整状态
   * @returns {{ history: Array, memoryItems: Array }}
   */
  getState() {
    return Storage.getMemory();
  },

  /**
   * 保存完整状态
   * @param {{ history: Array, memoryItems: Array }} state
   */
  saveState(state) {
    Storage.saveMemory(state);
  },

  /**
   * 添加新消息到历史
   * @param {object} msg - { role: 'user'|'assistant', content: string }
   */
  addMessage(msg) {
    const state = this.getState();
    state.history.push(msg);
    this.saveState(state);
  },

  /**
   * 获取用于发送给 API 的消息上下文
   * 包含：人设 + 长期记忆 + 对话摘要 + 近期对话
   * @returns {Array<{role: string, content: string}>}
   */
  buildContext() {
    const settings = Storage.getSettings();
    const state = this.getState();
    const messages = [];

    // 1. 人设 system 消息
    if (settings.persona) {
      messages.push({ role: 'system', content: settings.persona });
    }

    // 2. 长期记忆注入
    if (state.memoryItems && state.memoryItems.length > 0) {
      const memoryText = '你对用户的长期记忆：\n' + state.memoryItems.map((item, i) => `${i + 1}. ${item}`).join('\n');
      messages.push({ role: 'system', content: memoryText });
    }

    // 3. 自动表情指令（如果开启）
    if (settings.enableAutoEmoji) {
      messages.push({
        role: 'system',
        content: '你可以在回复中适当使用表情贴图来表达情绪。格式：[贴图:关键词]。例如：今天真开心[贴图:开心]。用户看到时会自动显示为表情图片。只在情绪合适时使用，不要滥用。'
      });
    }

    // 4. 近期对话历史
    const recentHistory = state.history.slice(-CONFIG.KEEP_RECENT_ROUNDS * 2);
    messages.push(...recentHistory);

    return messages;
  },

  /**
   * 检查是否需要压缩记忆
   * @returns {boolean}
   */
  shouldCompress() {
    const state = this.getState();
    const tokens = estimateMessagesTokens(state.history);
    return tokens > CONFIG.MAX_HISTORY_TOKENS;
  },

  /**
   * 异步压缩记忆（后台执行，不阻塞 UI）
   * @returns {Promise<void>}
   */
  async compressMemory() {
    const state = this.getState();
    const settings = Storage.getSettings();

    try {
      const response = await fetch(CONFIG.API_SUMMARIZE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: state.history.map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : '[图片消息]'
          })),
          existingMemory: state.memoryItems || []
        })
      });

      const result = await response.json();
      const newItems = result.memory_items || [];

      // 合并记忆（去重）
      const combined = [...(state.memoryItems || [])];
      for (const item of newItems) {
        // 简易去重：检查是否已有高度相似的项
        const exists = combined.some(existing => {
          const similarity = this._similarity(existing, item);
          return similarity > 0.8;
        });
        if (!exists) {
          combined.push(item);
        }
      }

      // 保留最近对话
      const recentHistory = state.history.slice(-CONFIG.KEEP_RECENT_ROUNDS * 2);

      // 注入摘要作为系统消息（如果有摘要）
      if (result.summary) {
        recentHistory.unshift({
          role: 'system',
          content: `[对话历史摘要] ${result.summary}`
        });
      }

      // 保存新状态
      this.saveState({
        history: recentHistory,
        memoryItems: combined
      });

      // 触发 Toast 提示
      if (typeof showToast === 'function') {
        showToast('🧠 记忆已自动整合', 2500);
      }
    } catch (error) {
      console.error('记忆压缩失败:', error);
      // 静默失败，不影响主流程
    }
  },

  /**
   * 计算两个字符串的简单相似度（Jaccard 基于字符集）
   * @param {string} a
   * @param {string} b
   * @returns {number} 0-1
   */
  _similarity(a, b) {
    const setA = new Set(a);
    const setB = new Set(b);
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
  },

  /**
   * 导出记忆项（不含对话历史）
   * @returns {string}
   */
  exportMemory() {
    const state = this.getState();
    const settings = Storage.getSettings();
    const lines = [];
    lines.push('=== AI 名字 ===');
    lines.push(settings.aiName);
    lines.push('');
    lines.push('=== AI 人设 ===');
    lines.push(settings.persona);
    lines.push('');
    lines.push('=== 长期记忆 ===');
    (state.memoryItems || []).forEach((item, i) => {
      lines.push(`${i + 1}. ${item}`);
    });
    return lines.join('\n');
  },

  /**
   * 导入记忆项
   * @param {string} content - 文件文本内容
   */
  importMemory(content) {
    const lines = content.split('\n');
    let section = '';
    const imported = { aiName: '', persona: '', memoryItems: [] };

    for (const line of lines) {
      if (line === '=== AI 名字 ===') { section = 'name'; continue; }
      if (line === '=== AI 人设 ===') { section = 'persona'; continue; }
      if (line === '=== 长期记忆 ===') { section = 'memory'; continue; }
      if (line === '') continue;

      switch (section) {
        case 'name':
          if (!imported.aiName) imported.aiName = line.trim();
          break;
        case 'persona':
          imported.persona += (imported.persona ? '\n' : '') + line.trim();
          break;
        case 'memory':
          // 去掉前面的序号 "1. xxx" -> "xxx"
          const cleaned = line.replace(/^\d+\.\s*/, '').trim();
          if (cleaned) imported.memoryItems.push(cleaned);
          break;
      }
    }

    // 应用导入
    Storage.saveSettings({
      aiName: imported.aiName || CONFIG.DEFAULT_SETTINGS.aiName,
      persona: imported.persona || CONFIG.DEFAULT_SETTINGS.persona
    });

    // 清空历史，重置记忆
    this.saveState({
      history: [],
      memoryItems: imported.memoryItems
    });

    return imported;
  },

  /**
   * 清空所有记忆和历史
   */
  clearAll() {
    this.saveState({ history: [], memoryItems: [] });
  }
};