/**
 * 应用主入口
 * 初始化所有模块，绑定全局事件，启动应用
 */

(function() {
  'use strict';

  // ========== 初始化检查 ==========
  
  // 如果是在微信中，显示引导弹窗并禁用发送
  if (isWeChat()) {
    document.addEventListener('DOMContentLoaded', () => {
      showWechatGuide();
      const sendBtn = document.getElementById('send-btn');
      const input = document.getElementById('message-input');
      if (sendBtn) sendBtn.disabled = true;
      if (input) {
        input.disabled = true;
        input.placeholder = '请在外置浏览器中打开';
      }
    });
    return; // 微信环境不执行后续初始化
  }

  // ========== 主题初始化 ==========
  
  const themeMode = Storage.getThemeMode();
  applyTheme(themeMode);

  // ========== 背景初始化 ==========
  
  const bg = Storage.getBackground();
  applyBackground(bg);

  // ========== DOM 加载完成后初始化 ==========
  
  document.addEventListener('DOMContentLoaded', () => {
    // 设置面板初始化
    Settings.init();

    // 加号菜单初始化
    initPlusMenu();

    // 发送按钮事件
    const sendBtn = document.getElementById('send-btn');
    const input = document.getElementById('message-input');

    function sendMessage() {
      const text = input.value.trim();
      if (!text || Chat.isBusy) return;
      input.value = '';
      Chat.sendMessage(text);
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', sendMessage);
    }
    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
    }

    // 确保聊天标题显示当前 AI 名字
    const settings = Storage.getSettings();
    const title = document.getElementById('chat-title');
    if (title) title.textContent = settings.aiName;

    // 渲染已有的历史消息
    renderAllMessages();

    // 如果没有任何历史，显示欢迎消息
    const state = MemoryManager.getState();
    if (!state.history || state.history.length === 0) {
      const welcomeMsg = '你好，我是你的记忆管家，有什么想和我分享的吗？';
      const aiMsg = { role: 'assistant', content: welcomeMsg };
      MemoryManager.addMessage(aiMsg);
      renderAIMessage(aiMsg);
    }
  });

})();