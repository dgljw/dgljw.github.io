/**
 * 设置面板管理
 * 负责主题切换、背景选择、头像上传、导入导出等交互
 */

const Settings = {
  /**
   * 初始化设置面板的事件绑定
   */
  init() {
    // 设置按钮
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.openPanel());
    }

    // 关闭按钮
    const closeBtn = document.getElementById('settings-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closePanel());
    }

    // 保存设置
    const saveBtn = document.getElementById('settings-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveSettings());
    }

    // AI 名字修改实时预览
    const aiNameInput = document.getElementById('ai-name-input');
    if (aiNameInput) {
      aiNameInput.addEventListener('input', () => {
        document.getElementById('chat-title').textContent = aiNameInput.value || '小金鱼';
        refreshAvatarPreviews();
      });
    }

    // 头像上传
    const userAvatarUpload = document.getElementById('user-avatar-upload');
    if (userAvatarUpload) {
      userAvatarUpload.addEventListener('change', (e) => this.handleAvatarUpload(e, 'user'));
    }
    const aiAvatarUpload = document.getElementById('ai-avatar-upload');
    if (aiAvatarUpload) {
      aiAvatarUpload.addEventListener('change', (e) => this.handleAvatarUpload(e, 'ai'));
    }

    // 主题切换
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
      themeSelect.value = Storage.getThemeMode();
      themeSelect.addEventListener('change', (e) => {
        Storage.setThemeMode(e.target.value);
        refreshAvatarPreviews(); // 可能需要刷新头像样式
      });
    }

    // 背景选择
    const bgSelect = document.getElementById('bg-select');
    const bgUpload = document.getElementById('bg-upload');
    if (bgSelect) {
      bgSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'custom') {
          // 触发上传
          if (bgUpload) bgUpload.click();
        } else {
          const preset = CONFIG.PRESET_BACKGROUNDS.find(b => b.type === val);
          if (preset) {
            Storage.saveBackground({ type: preset.type, value: preset.value || '' });
          } else {
            Storage.saveBackground(CONFIG.DEFAULT_SETTINGS.background);
          }
          this.refreshBackgroundPreview();
        }
      });
    }
    if (bgUpload) {
      bgUpload.addEventListener('change', (e) => this.handleBackgroundUpload(e));
    }

    // 自动表情开关
    const autoEmojiCheck = document.getElementById('auto-emoji-check');
    if (autoEmojiCheck) {
      autoEmojiCheck.checked = Storage.getSettings().enableAutoEmoji;
      autoEmojiCheck.addEventListener('change', (e) => {
        const settings = Storage.getSettings();
        settings.enableAutoEmoji = e.target.checked;
        Storage.saveSettings(settings);
      });
    }

    // 导出记忆
    const exportBtn = document.getElementById('export-memory-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportMemory());
    }

    // 导入记忆
    const importBtn = document.getElementById('import-memory-btn');
    const importFile = document.getElementById('import-file-input');
    if (importBtn && importFile) {
      importBtn.addEventListener('click', () => importFile.click());
      importFile.addEventListener('change', (e) => this.handleImport(e));
    }

    // 清空对话
    const clearBtn = document.getElementById('clear-chat-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('确定清空所有对话和记忆吗？')) {
          Chat.clearChat();
          this.closePanel();
        }
      });
    }

    // 主动记忆：手动输入
    const manualMemBtn = document.getElementById('manual-memory-btn');
    if (manualMemBtn) {
      manualMemBtn.addEventListener('click', () => {
        this.closePanel();
        showManualMemoryModal();
      });
    }

    // 主动记忆：记忆当前上下文
    const snapshotMemBtn = document.getElementById('snapshot-memory-btn');
    if (snapshotMemBtn) {
      snapshotMemBtn.addEventListener('click', () => {
        this.closePanel();
        snapshotCurrentContext();
      });
    }
  },

  /**
   * 打开设置面板并填充当前值
   */
  openPanel() {
    const panel = document.getElementById('settings-panel');
    if (!panel) return;
    const settings = Storage.getSettings();
    document.getElementById('ai-name-input').value = settings.aiName;
    document.getElementById('ai-persona-input').value = settings.persona;
    document.getElementById('enable-search-check').checked = settings.enableSearch;
    document.getElementById('auto-emoji-check').checked = settings.enableAutoEmoji;
    this.refreshBackgroundPreview();
    panel.style.display = 'flex';
    setTimeout(() => panel.classList.add('show'), 10);
  },

  /**
   * 关闭设置面板
   */
  closePanel() {
    const panel = document.getElementById('settings-panel');
    if (panel) {
      panel.classList.remove('show');
      setTimeout(() => panel.style.display = 'none', 300);
    }
  },

  /**
   * 保存设置并关闭
   */
  saveSettings() {
    const aiName = document.getElementById('ai-name-input').value.trim() || CONFIG.DEFAULT_SETTINGS.aiName;
    const persona = document.getElementById('ai-persona-input').value.trim() || CONFIG.DEFAULT_SETTINGS.persona;
    const enableSearch = document.getElementById('enable-search-check').checked;
    const enableAutoEmoji = document.getElementById('auto-emoji-check').checked;

    const settings = Storage.saveSettings({ aiName, persona, enableSearch, enableAutoEmoji });
    document.getElementById('chat-title').textContent = settings.aiName;
    refreshAvatarPreviews();
    this.closePanel();
    showToast('设置已保存');
  },

  /**
   * 处理头像上传
   * @param {Event} e
   * @param {'user'|'ai'} type
   */
  async handleAvatarUpload(e, type) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const base64 = await compressImage(file, 128);
      const settings = Storage.getSettings();
      if (type === 'user') {
        settings.userAvatar = base64;
      } else {
        settings.aiAvatar = base64;
      }
      Storage.saveSettings(settings);
      refreshAvatarPreviews();
      renderAllMessages();
    } catch (err) {
      showToast('头像上传失败');
    }
  },

  /**
   * 处理背景上传
   * @param {Event} e
   */
  async handleBackgroundUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const base64 = await compressImage(file, 200); // 背景压缩宽200px
      Storage.saveBackground({ type: 'custom', value: base64 });
      this.refreshBackgroundPreview();
    } catch (err) {
      showToast('背景上传失败');
    }
  },

  /**
   * 刷新背景预览（设置面板内的小预览区）
   */
  refreshBackgroundPreview() {
    const preview = document.getElementById('bg-preview');
    if (!preview) return;
    const bg = Storage.getBackground();
    if (bg.type === 'none' || !bg) {
      preview.style.background = '';
    } else if (bg.type === 'custom') {
      preview.style.background = `url(${bg.value}) center/cover`;
    } else {
      preview.style.background = bg.value;
    }
  },

  /**
   * 导出记忆
   */
  async exportMemory() {
    // 弹出选择分类
    showExportModal();
  },

  /**
   * 处理导入文件
   * @param {Event} e
   */
  handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target.result;
      const imported = MemoryManager.importMemory(content);
      // 更新界面
      document.getElementById('chat-title').textContent = imported.aiName;
      document.getElementById('ai-name-input').value = imported.aiName;
      document.getElementById('ai-persona-input').value = imported.persona || '';
      Storage.saveSettings({ aiName: imported.aiName, persona: imported.persona });
      renderAllMessages();
      showToast('记忆导入成功');
    };
    reader.readAsText(file);
  },

  /**
   * 切换联网搜索（快捷方式，也可在设置内）
   */
  toggleSearch() {
    const settings = Storage.getSettings();
    settings.enableSearch = !settings.enableSearch;
    Storage.saveSettings(settings);
    const toggle = document.getElementById('enable-search-check');
    if (toggle) toggle.checked = settings.enableSearch;
    showToast(settings.enableSearch ? '联网搜索已开启' : '联网搜索已关闭');
  }
};