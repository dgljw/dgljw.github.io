/**
 * 通用工具函数
 * 无依赖，可在任何模块中使用
 */

// ==================== Token 估算 ====================

/**
 * 估算字符串的 token 数量
 * 中文约 1.5 字符/Token，英文/标点约 2 字符/Token
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
  let tokens = 0;
  for (const char of text) {
    // 中文字符或其他 Unicode 范围（粗略）
    if (/[\u4e00-\u9fff]/.test(char)) {
      tokens += 1 / 1.5;
    } else {
      tokens += 1 / 2;
    }
  }
  return Math.ceil(tokens);
}

/**
 * 估算消息数组的总 token 数
 * @param {Array<{role:string, content:string}>} messages
 * @returns {number}
 */
function estimateMessagesTokens(messages) {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
}

// ==================== 图片处理 ====================

/**
 * 将图片文件压缩为指定宽度的 Base64
 * @param {File} file - 图片文件
 * @param {number} maxWidth - 最大宽度（像素），默认 128
 * @returns {Promise<string>} Base64 字符串
 */
function compressImage(file, maxWidth = 128) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ==================== 微信环境检测 ====================

/**
 * 判断当前是否在微信内置浏览器中
 * @returns {boolean}
 */
function isWeChat() {
  const ua = navigator.userAgent || '';
  return CONFIG.WECHAT_UA_KEYWORDS.some(keyword => ua.includes(keyword));
}

// ==================== 主题 ====================

/**
 * 获取系统当前主题偏好
 * @returns {'light' | 'dark'}
 */
function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * 应用主题到 HTML 根元素
 * @param {'auto' | 'light' | 'dark'} mode
 */
function applyTheme(mode) {
  const root = document.documentElement;
  let resolved;
  if (mode === 'auto') {
    resolved = getSystemTheme();
    // 监听系统变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      if (localStorage.getItem(CONFIG.STORAGE_KEYS.THEME) === 'auto') {
        root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      }
    };
    mediaQuery.removeEventListener('change', handler);
    mediaQuery.addEventListener('change', handler);
  } else {
    resolved = mode;
    // 移除监听（手动模式下不再跟随系统）
  }
  root.setAttribute('data-theme', resolved);
}

// ==================== 文件导出辅助 ====================

/**
 * 触发文件下载（带 UTF-8 BOM 头，防止 Windows 乱码）
 * @param {string} content - 文件文本内容
 * @param {string} filename - 文件名
 */
function downloadFile(content, filename) {
  const bom = '\uFEFF';
  const blob = new Blob([bom + content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 复制文本到剪贴板（兼容移动端）
 * @param {string} text
 * @returns {Promise<boolean>}
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 降级方案
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  }
}

// ==================== 其他 ====================

/**
 * 防抖函数
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
function debounce(fn, delay = 300) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * 生成唯一 ID（简单版）
 * @returns {string}
 */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}