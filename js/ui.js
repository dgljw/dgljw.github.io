/**
 * 界面渲染模块
 * 负责动态生成消息、打字指示器、Toast、弹窗等 UI 元素
 * 所有 DOM 操作集中在此，与逻辑分离
 */

// ==================== 消息渲染 ====================

/**
 * 渲染用户消息到聊天区域
 * @param {object} msg - { role: 'user', content: string, type?: string }
 */
function renderUserMessage(msg) {
  const chatArea = document.getElementById('chat-messages');
  if (!chatArea) return;

  const settings = Storage.getSettings();
  const avatar = settings.userAvatar || '👤';
  const isEmoji = avatar.startsWith('data:') ? `<img src="${avatar}" class="avatar-img">` : avatar;

  const bubble = document.createElement('div');
  bubble.className = 'message user-message';
  bubble.innerHTML = `
    <div class="message-avatar user-avatar">${isEmoji}</div>
    <div class="message-bubble user-bubble">${escapeHtml(msg.content)}</div>
  `;
  chatArea.appendChild(bubble);
}

/**
 * 渲染 AI 消息（异步，因为可能需要解析贴图标签）
 * @param {object} msg - { role: 'assistant', content: string }
 */
async function renderAIMessage(msg) {
  const chatArea = document.getElementById('chat-messages');
  if (!chatArea) return;

  const settings = Storage.getSettings();
  const avatar = settings.aiAvatar || '🐟';
  let avatarHtml;
  if (avatar.startsWith('data:')) {
    avatarHtml = `<img src="${avatar}" class="avatar-img">`;
  } else if (avatar.match(/^[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{2300}-\u{23FF}]/u)) {
    avatarHtml = avatar; // emoji
  } else {
    avatarHtml = avatar.charAt(0); // 首字母
  }

  // 解析贴图标签（如果开启自动表情）
  let contentHtml;
  if (settings.enableAutoEmoji && typeof EmojiAuto !== 'undefined') {
    contentHtml = await EmojiAuto.parseEmojiTags(msg.content);
  } else {
    contentHtml = escapeHtml(msg.content);
  }

  // Markdown 渲染（如果 marked 可用）
  if (typeof marked !== 'undefined') {
    contentHtml = marked.parse(contentHtml);
  }

  const bubble = document.createElement('div');
  bubble.className = 'message ai-message';
  bubble.innerHTML = `
    <div class="message-avatar ai-avatar">${avatarHtml}</div>
    <div class="message-bubble ai-bubble">${contentHtml}</div>
  `;
  chatArea.appendChild(bubble);
}

/**
 * 重新渲染所有消息（用于切换头像、名字等）
 */
function renderAllMessages() {
  const chatArea = document.getElementById('chat-messages');
  if (!chatArea) return;
  chatArea.innerHTML = '';

  const state = MemoryManager.getState();
  const history = state.history || [];

  // 逐个重新渲染
  (async () => {
    for (const msg of history) {
      if (msg.role === 'user') {
        renderUserMessage(msg);
      } else if (msg.role === 'assistant') {
        await renderAIMessage(msg);
      }
    }
  })();
}

// ==================== 打字指示器 ====================

let typingElement = null;

function showTypingIndicator() {
  const chatArea = document.getElementById('chat-messages');
  if (!chatArea) return;

  typingElement = document.createElement('div');
  typingElement.className = 'message ai-message typing';
  typingElement.innerHTML = `
    <div class="message-avatar ai-avatar">${getAIAvatarHtml()}</div>
    <div class="message-bubble ai-bubble typing-bubble">
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
    </div>
  `;
  chatArea.appendChild(typingElement);
  scrollToBottom();
}

function hideTypingIndicator() {
  if (typingElement) {
    typingElement.remove();
    typingElement = null;
  }
}

function getAIAvatarHtml() {
  const settings = Storage.getSettings();
  const avatar = settings.aiAvatar || '🐟';
  if (avatar.startsWith('data:')) {
    return `<img src="${avatar}" class="avatar-img">`;
  } else if (avatar.match(/^[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{2300}-\u{23FF}]/u)) {
    return avatar;
  }
  return avatar.charAt(0);
}

// ==================== Toast 提示 ====================

let toastTimer = null;

/**
 * 显示顶部 Toast 提示
 * @param {string} message
 * @param {number} duration - 持续时间(ms)，0 表示不自动消失
 */
function showToast(message, duration = 2500) {
  // 如果已有 toast，先清除
  hideToast();
  const toast = document.getElementById('toast') || createToastElement();
  toast.textContent = message;
  toast.classList.add('show');
  if (duration > 0) {
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }
}

function hideToast() {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.classList.remove('show');
  }
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
}

function createToastElement() {
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = 'toast';
  document.body.appendChild(toast);
  return toast;
}

// ==================== 导出弹窗 ====================

let exportModal = null;

function showExportModal() {
  if (!exportModal) {
    exportModal = document.createElement('div');
    exportModal.id = 'export-modal';
    exportModal.className = 'modal';
    exportModal.innerHTML = `
      <div class="modal-content export-modal-content">
        <h3>导出记忆</h3>
        <p>选择要导出的内容：</p>
        <label><input type="checkbox" id="export-name" checked> AI 名字</label>
        <label><input type="checkbox" id="export-persona" checked> AI 人设</label>
        <label><input type="checkbox" id="export-memory" checked> 长期记忆</label>
        <div id="export-preview" class="export-preview"></div>
        <div class="export-actions">
          <button id="export-cancel" class="btn-secondary">取消</button>
          <button id="export-confirm" class="btn-primary">导出</button>
        </div>
      </div>
    `;
    document.body.appendChild(exportModal);
  }

  // 填充预览
  updateExportPreview();
  exportModal.style.display = 'flex';
  setTimeout(() => exportModal.classList.add('show'), 10);

  // 事件绑定（每次打开重新绑定以避免重复）
  const cancelBtn = document.getElementById('export-cancel');
  const confirmBtn = document.getElementById('export-confirm');
  const checkboxes = ['export-name', 'export-persona', 'export-memory'];
  
  checkboxes.forEach(id => {
    document.getElementById(id).addEventListener('change', updateExportPreview);
  });

  cancelBtn.onclick = () => {
    exportModal.classList.remove('show');
    setTimeout(() => exportModal.style.display = 'none', 300);
  };

  confirmBtn.onclick = async () => {
    const includeName = document.getElementById('export-name').checked;
    const includePersona = document.getElementById('export-persona').checked;
    const includeMemory = document.getElementById('export-memory').checked;
    const content = buildExportContent(includeName, includePersona, includeMemory);
    const filename = `小金鱼记忆_${new Date().toISOString().slice(0,10)}.txt`;

    if (isWeChat()) {
      // 微信环境尝试复制
      const success = await copyToClipboard(content);
      if (success) {
        showToast('内容已复制到剪贴板，请粘贴保存');
      } else {
        showToast('导出失败，请长按复制下方内容');
      }
    } else {
      downloadFile(content, filename);
      showToast('记忆导出成功');
    }
    exportModal.classList.remove('show');
    setTimeout(() => exportModal.style.display = 'none', 300);
  };
}

function updateExportPreview() {
  const preview = document.getElementById('export-preview');
  if (!preview) return;
  const includeName = document.getElementById('export-name').checked;
  const includePersona = document.getElementById('export-persona').checked;
  const includeMemory = document.getElementById('export-memory').checked;
  preview.textContent = buildExportContent(includeName, includePersona, includeMemory);
}

function buildExportContent(includeName, includePersona, includeMemory) {
  const state = MemoryManager.getState();
  const settings = Storage.getSettings();
  const lines = [];
  if (includeName) {
    lines.push('=== AI 名字 ===');
    lines.push(settings.aiName);
    lines.push('');
  }
  if (includePersona) {
    lines.push('=== AI 人设 ===');
    lines.push(settings.persona);
    lines.push('');
  }
  if (includeMemory) {
    lines.push('=== 长期记忆 ===');
    (state.memoryItems || []).forEach((item, i) => lines.push(`${i + 1}. ${item}`));
  }
  return lines.join('\n');
}

// ==================== 微信引导弹窗 ====================

let wechatModal = null;

function showWechatGuide() {
  if (!wechatModal) {
    wechatModal = document.createElement('div');
    wechatModal.id = 'wechat-modal';
    wechatModal.className = 'modal';
    wechatModal.innerHTML = `
      <div class="modal-content wechat-modal-content">
        <h3>🌐 请在外置浏览器中打开</h3>
        <p>微信内暂不支持完整功能，请点击右上角 <strong>···</strong> 选择 <strong>在浏览器中打开</strong></p>
        <button id="wechat-copy-link" class="btn-primary">复制链接</button>
      </div>
    `;
    document.body.appendChild(wechatModal);

    document.getElementById('wechat-copy-link').addEventListener('click', async () => {
      const success = await copyToClipboard('https://jianguo18.top');
      if (success) showToast('链接已复制，请粘贴到浏览器打开');
    });
  }
  wechatModal.style.display = 'flex';
  setTimeout(() => wechatModal.classList.add('show'), 10);
}

// ==================== 加号菜单 ====================

let plusMenu = null;

function initPlusMenu() {
  const plusBtn = document.getElementById('plus-btn');
  if (!plusBtn) return;

  plusBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!plusMenu) {
      plusMenu = document.createElement('div');
      plusMenu.id = 'plus-menu';
      plusMenu.className = 'plus-menu';
      plusMenu.innerHTML = `
        <button class="plus-menu-item" data-action="image-understand">🖼️ 图片理解</button>
        <button class="plus-menu-item" data-action="emoji-search">😄 表情包</button>
      `;
      document.body.appendChild(plusMenu);

      // 处理点击选项
      plusMenu.addEventListener('click', async (event) => {
        const action = event.target.closest('.plus-menu-item')?.dataset.action;
        if (action === 'image-understand') {
          hidePlusMenu();
          const result = await VisionManager.processImage();
          if (result.success && result.text) {
            Chat.sendImageMessage(result.text);
          }
        } else if (action === 'emoji-search') {
          hidePlusMenu();
          showEmojiSearchPanel();
        }
      });
    }

    // 切换显示
    if (plusMenu.style.display === 'block') {
      hidePlusMenu();
    } else {
      // 定位到加号按钮上方
      const rect = plusBtn.getBoundingClientRect();
      plusMenu.style.bottom = (window.innerHeight - rect.top) + 'px';
      plusMenu.style.left = rect.left + 'px';
      plusMenu.style.display = 'block';
    }
  });

  // 点击其他地方隐藏
  document.addEventListener('click', (e) => {
    if (plusMenu && !plusMenu.contains(e.target) && e.target !== plusBtn) {
      hidePlusMenu();
    }
  });
}

function hidePlusMenu() {
  if (plusMenu) plusMenu.style.display = 'none';
}

// ==================== 表情搜索面板 ====================

let emojiPanel = null;

function showEmojiSearchPanel() {
  if (!emojiPanel) {
    emojiPanel = document.createElement('div');
    emojiPanel.id = 'emoji-search-panel';
    emojiPanel.className = 'modal';
    emojiPanel.innerHTML = `
      <div class="modal-content emoji-panel-content">
        <h3>搜索表情包</h3>
        <div class="emoji-search-input-area">
          <input type="text" id="emoji-search-input" placeholder="输入关键词...">
          <button id="emoji-search-btn" class="btn-small">搜索</button>
        </div>
        <div id="emoji-results" class="emoji-results-grid"></div>
        <button id="emoji-close-btn" class="btn-secondary" style="margin-top:10px;width:100%">关闭</button>
      </div>
    `;
    document.body.appendChild(emojiPanel);

    document.getElementById('emoji-close-btn').addEventListener('click', () => {
      emojiPanel.style.display = 'none';
    });

    document.getElementById('emoji-search-btn').addEventListener('click', performEmojiSearch);
    document.getElementById('emoji-search-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') performEmojiSearch();
    });
  }

  emojiPanel.style.display = 'flex';
  setTimeout(() => emojiPanel.classList.add('show'), 10);
  document.getElementById('emoji-search-input').focus();
}

async function performEmojiSearch() {
  const input = document.getElementById('emoji-search-input');
  const resultsGrid = document.getElementById('emoji-results');
  const keyword = input.value.trim();
  if (!keyword) return;

  resultsGrid.innerHTML = '搜索中...';

  try {
    const response = await fetch(`${CONFIG.API_EMOJI_SEARCH}?keyword=${encodeURIComponent(keyword)}`);
    const data = await response.json();
    const images = data.images || [];

    if (images.length === 0) {
      resultsGrid.innerHTML = '未找到相关表情包';
      return;
    }

    resultsGrid.innerHTML = '';
    images.forEach(img => {
      const item = document.createElement('div');
      item.className = 'emoji-result-item';
      item.innerHTML = `<img src="${img.url}" alt="${keyword}" loading="lazy">`;
      item.addEventListener('click', () => {
        // 插入图片消息
        const imageMsg = { role: 'user', content: img.url, type: 'image' };
        renderUserMessage({ ...imageMsg, content: '📷 表情' });
        MemoryManager.addMessage(imageMsg);

        // 关闭面板
        emojiPanel.style.display = 'none';

        // 触发 AI 回复（让 AI 也看到用户发了图片）
        // 简化：发送一条文本描述
        Chat.sendMessage(`[用户发送了一张表情：${keyword}]`);
      });
      resultsGrid.appendChild(item);
    });
  } catch (error) {
    resultsGrid.innerHTML = '搜索失败，请重试';
  }
}

// ==================== 辅助函数 ====================

function scrollToBottom() {
  const chatArea = document.getElementById('chat-messages');
  if (chatArea) {
    chatArea.scrollTop = chatArea.scrollHeight;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function refreshAvatarPreviews() {
  // 更新聊天消息中的头像
  renderAllMessages();
  // 更新设置面板中的头像预览（如果有）
  const userPreview = document.getElementById('user-avatar-preview');
  const aiPreview = document.getElementById('ai-avatar-preview');
  if (userPreview) {
    const avatar = Storage.getSettings().userAvatar;
    userPreview.innerHTML = avatar.startsWith('data:') ? `<img src="${avatar}" width="40">` : avatar;
  }
  if (aiPreview) {
    const avatar = Storage.getSettings().aiAvatar;
    aiPreview.innerHTML = avatar.startsWith('data:') ? `<img src="${avatar}" width="40">` : avatar;
  }
}