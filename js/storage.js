/**
 * 本地存储管理
 * 集中处理 JSON 序列化/反序列化，错误处理
 */

const Storage = {
  /**
   * 获取完整设置（合并默认值）
   * @returns {object}
   */
  getSettings() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.SETTINGS);
      if (!raw) return { ...CONFIG.DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw);
      // 深度合并，确保新增字段有默认值
      return deepMerge({ ...CONFIG.DEFAULT_SETTINGS }, parsed);
    } catch {
      return { ...CONFIG.DEFAULT_SETTINGS };
    }
  },

  /**
   * 保存设置（部分更新或全量）
   * @param {object} newSettings - 要更新的字段
   */
  saveSettings(newSettings) {
    const current = this.getSettings();
    const merged = { ...current, ...newSettings };
    localStorage.setItem(CONFIG.STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
    return merged;
  },

  /**
   * 获取聊天记忆（对话历史 + 长期记忆项）
   * @returns {{ history: Array, memoryItems: Array }}
   */
  getMemory() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.MEMORY);
      if (!raw) return { history: [], memoryItems: [] };
      return JSON.parse(raw);
    } catch {
      return { history: [], memoryItems: [] };
    }
  },

  /**
   * 保存聊天记忆
   * @param {{ history: Array, memoryItems: Array }} data
   */
  saveMemory(data) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.MEMORY, JSON.stringify(data));
  },

  /**
   * 获取主题模式
   * @returns {'auto' | 'light' | 'dark'}
   */
  getThemeMode() {
    return localStorage.getItem(CONFIG.STORAGE_KEYS.THEME) || 'auto';
  },

  /**
   * 保存主题模式
   * @param {'auto' | 'light' | 'dark'} mode
   */
  setThemeMode(mode) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.THEME, mode);
    applyTheme(mode);
  },

  /**
   * 获取背景配置
   * @returns {{ type: string, value: string }}
   */
  getBackground() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.BACKGROUND);
      if (!raw) return CONFIG.DEFAULT_SETTINGS.background;
      return JSON.parse(raw);
    } catch {
      return CONFIG.DEFAULT_SETTINGS.background;
    }
  },

  /**
   * 保存背景配置
   * @param {{ type: string, value: string }} bg
   */
  saveBackground(bg) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.BACKGROUND, JSON.stringify(bg));
    // 直接应用到界面
    applyBackground(bg);
  },

  /**
   * 清空所有数据（重置）
   */
  clearAll() {
    Object.values(CONFIG.STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  }
};

/**
 * 深度合并对象，用于设置合并
 * @param {object} target - 默认值对象
 * @param {object} source - 用户保存的对象
 * @returns {object}
 */
function deepMerge(target, source) {
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] !== undefined) {
      output[key] = source[key];
    }
  }
  return output;
}

/**
 * 应用背景样式到聊天容器（.app-container）
 * @param {{ type: string, value: string }} bg
 */
function applyBackground(bg) {
  const container = document.querySelector('.app-container');
  if (!container) return;
  if (!bg || bg.type === 'none') {
    container.style.background = '';
    container.style.backgroundSize = '';
    return;
  }
  if (bg.type === 'custom') {
    container.style.background = `url(${bg.value}) center/cover no-repeat`;
    container.style.backgroundSize = 'cover';
  } else {
    container.style.background = bg.value;
    container.style.backgroundSize = 'cover';
  }
}