/**
 * 聊天核心逻辑
 * 处理消息发送、API 调用、流式/非流式、上下文构建、记忆压缩触发
 */

const Chat = {
  /**
   * 当前是否正在等待 AI 回复
   */
  isBusy: false,

  /**
   * 发送用户消息的主入口
   * @param {string} text - 用户输入的文本
   * @param {string} [type='text'] - 消息类型 'text' | 'image'
   */
  async sendMessage(text, type = 'text') {
    if (this.isBusy) {
      showToast('请等待当前回复完成');
      return;
    }
    if (!text.trim() && type === 'text') return;

    this.isBusy = true;
    const settings = Storage.getSettings();

    // 添加用户消息到界面
    const userMsg = { role: 'user', content: text, type };
    renderUserMessage(userMsg);
    MemoryManager.addMessage(userMsg);

    // 显示打字指示器
    showTypingIndicator();

    // 检查是否需要压缩记忆（异步后台）
    if (MemoryManager.shouldCompress()) {
      MemoryManager.compressMemory(); // 不等待
    }

    try {
      // 构建上下文
      const messages = MemoryManager.buildContext();

      // 调用后端 API
      const response = await fetch(CONFIG.API_CHAT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          enableSearch: settings.enableSearch
        })
      });

      if (!response.ok) {
        throw new Error(`API 返回错误: ${response.status}`);
      }

      const data = await response.json();
      const replyContent = data.choices?.[0]?.message?.content || '（AI 未返回内容）';

      // 添加 AI 消息到历史
      const aiMsg = { role: 'assistant', content: replyContent };
      MemoryManager.addMessage(aiMsg);

      // 渲染 AI 回复（可能包含贴图标签）
      hideTypingIndicator();
      await renderAIMessage(aiMsg);

    } catch (error) {
      hideTypingIndicator();
      console.error('发送失败:', error);
      showToast('发送失败，请检查网络或稍后重试');
      // 失败时移除用户消息？
    } finally {
      this.isBusy = false;
      // 滚动到底部
      scrollToBottom();
    }
  },

  /**
   * 发送图片理解消息
   * @param {string} imageDescription - 图片识别结果文本
   */
  async sendImageMessage(imageDescription) {
    if (this.isBusy) {
      showToast('请等待当前回复完成');
      return;
    }

    this.isBusy = true;
    const settings = Storage.getSettings();

    // 构建一条特殊的用户消息
    const text = `[用户上传了一张图片，识别结果：${imageDescription}]`;
    const userMsg = { role: 'user', content: text, type: 'image' };
    renderUserMessage({ ...userMsg, content: '📷 图片理解：' + imageDescription.substring(0, 50) + '...' });
    MemoryManager.addMessage(userMsg);

    showTypingIndicator();

    if (MemoryManager.shouldCompress()) {
      MemoryManager.compressMemory();
    }

    try {
      const messages = MemoryManager.buildContext();
      const response = await fetch(CONFIG.API_CHAT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          enableSearch: settings.enableSearch
        })
      });

      const data = await response.json();
      const replyContent = data.choices?.[0]?.message?.content || '（未识别到内容）';
      const aiMsg = { role: 'assistant', content: replyContent };
      MemoryManager.addMessage(aiMsg);

      hideTypingIndicator();
      await renderAIMessage(aiMsg);
    } catch (error) {
      hideTypingIndicator();
      showToast('图片处理失败');
    } finally {
      this.isBusy = false;
      scrollToBottom();
    }
  },

  /**
   * 清空当前对话并重置状态
   */
  clearChat() {
    MemoryManager.clearAll();
    renderAllMessages();
    showToast('对话已清空');
  }
};