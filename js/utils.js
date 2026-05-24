// 工具函数

/**
 * 估算文本 token 数（中文约 1.5 字符/token，英文约 4 字符/token）
 */
function estimateTokens(text) {
    if (!text) return 0;
    let tokens = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (/[\u4e00-\u9fff]/i.test(char)) {
            tokens += 2 / 3;
        } else if (/[a-zA-Z0-9]/i.test(char)) {
            tokens += 0.25;
        } else {
            tokens += 0.3;
        }
    }
    return Math.ceil(tokens);
}

/**
 * 计算 Jaccard 相似度
 */
function calculateSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/[\s,，。！？、]+/).filter(w => w.length > 1));
    const words2 = new Set(text2.toLowerCase().split(/[\s,，。！？、]+/).filter(w => w.length > 1));
    
    if (words1.size === 0 || words2.size === 0) return 0;
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
}

/**
 * 压缩图片为 Base64
 */
function compressImage(file, maxWidth = 200, quality = 0.7) {
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
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * 检测微信环境
 */
function isWechat() {
    return /MicroMessenger/i.test(navigator.userAgent);
}

/**
 * 检测移动设备
 */
function isMobile() {
    return /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);
}

/**
 * 获取当前时间字符串
 */
function getTimeString(date = new Date()) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

/**
 * 获取日期字符串（用于消息分区）
 */
function getDateString(date = new Date()) {
    const now = new Date();
    const diff = now - date;
    const oneDay = 24 * 60 * 60 * 1000;
    
    if (diff < oneDay) {
        return '今天';
    } else if (diff < 2 * oneDay) {
        return '昨天';
    } else if (diff < 7 * oneDay) {
        return '本周';
    } else {
        return `${date.getMonth() + 1}/${date.getDate()}`;
    }
}

/**
 * 防抖函数
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 节流函数
 */
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * 生成唯一 ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * 复制文本到剪贴板
 */
async function copyToClipboard(text) {
    // 优先使用 textarea 方案，移动端兼容性最好
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.left = '-9999px';
    textarea.setAttribute('readonly', '');
    document.body.appendChild(textarea);
    // iOS 兼容
    textarea.contentEditable = 'true';
    textarea.readOnly = true;
    const range = document.createRange();
    range.selectNodeContents(textarea);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    textarea.setSelectionRange(0, 999999);
    try {
        document.execCommand('copy');
        return true;
    } catch {
        // 降级到 Clipboard API
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            return false;
        }
    } finally {
        document.body.removeChild(textarea);
    }
}

/**
 * 打开链接（移动端兼容）
 */
function openLink(url) {
    const fullUrl = (url.startsWith('http://') || url.startsWith('https://')) ? url : `https://${url}`;
    const win = window.open(fullUrl, '_blank', 'noopener,noreferrer');
    // 移动端弹窗被拦截时降级为当前页跳转
    if (!win) {
        window.location.href = fullUrl;
    }
}

/**
 * 检测是否为中文
 */
function isChinese(text) {
    return /[\u4e00-\u9fff]/.test(text);
}

/**
 * 解析 Markdown（使用 marked.js）
 */
function renderMarkdown(text) {
    if (!text) return '';
    try {
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                breaks: true,
                gfm: true,
                headerIds: false,
                mangle: false
            });
            return marked.parse(text);
        }
    } catch (e) {
        console.error('Markdown 渲染失败:', e);
    }
    return text.replace(/\n/g, '<br>');
}

/**
 * 高亮代码块
 */
function highlightCode() {
    if (typeof Prism !== 'undefined') {
        document.querySelectorAll('pre code').forEach((block) => {
            Prism.highlightElement(block);
        });
    }
}

/**
 * 切换主题
 */
function applyTheme(theme) {
    if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
        document.documentElement.setAttribute('data-theme', theme);
    }
    // 强制应用主题到 html 元素，确保背景色立即更新
    document.documentElement.style.backgroundColor = '';
    
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
        const current = document.documentElement.getAttribute('data-theme');
        themeIcon.textContent = current === 'dark' ? '☀️' : '🌙';
    }
}

/**
 * 创建 Toast 通知
 */
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('out');
        toast.addEventListener('animationend', () => {
            container.removeChild(toast);
        });
    }, duration);
}

/**
 * 转义 HTML
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        estimateTokens,
        calculateSimilarity,
        compressImage,
        isWechat,
        isMobile,
        getTimeString,
        getDateString,
        debounce,
        throttle,
        generateId,
        copyToClipboard,
        openLink,
        isChinese,
        renderMarkdown,
        highlightCode,
        applyTheme,
        showToast,
        escapeHtml,
        formatFileSize
    };
}