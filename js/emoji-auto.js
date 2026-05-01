/**
 * 自动表情解析模块
 * 解析 AI 回复中的 [贴图:关键词] 标记，并替换为真实表情图片
 */

const EmojiAuto = {
  /**
   * 缓存已搜索过的关键词结果，避免重复请求
   */
  _cache: {},

  /**
   * 解析消息中的 [贴图:xxx] 标记
   * @param {string} text - AI 回复的原始文本
   * @returns {Promise<string>} 处理后的 HTML 字符串
   */
  async parseEmojiTags(text) {
    // 匹配 [贴图:xxx] 格式
    const regex = /\[贴图:([^\]]+)\]/g;
    const matches = text.matchAll(regex);
    
    if (!matches) return this._escapeHtml(text);

    // 收集所有需要替换的占位符
    const replacements = [];
    for (const match of text.matchAll(regex)) {
      replacements.push({
        full: match[0],
        keyword: match[1].trim(),
        position: match.index
      });
    }

    if (replacements.length === 0) return this._escapeHtml(text);

    // 并行搜索所有关键词（去重）
    const uniqueKeywords = [...new Set(replacements.map(r => r.keyword))];
    const searchResults = await Promise.all(
      uniqueKeywords.map(async (kw) => {
        const url = await this._searchEmoji(kw);
        return { keyword: kw, url };
      })
    );

    // 构建映射
    const urlMap = {};
    searchResults.forEach(r => { urlMap[r.keyword] = r.url; });

    // 替换文本
    let result = this._escapeHtml(text);
    replacements.forEach(({ full, keyword }) => {
      const url = urlMap[keyword];
      if (url) {
        const imgTag = `<img src="${url}" class="emoji-inline" alt="${keyword}" title="${keyword}" loading="lazy">`;
        result = result.replace(this._escapeHtml(full), imgTag);
      } else {
        // 搜索失败，保留原文
        result = result.replace(this._escapeHtml(full), `[${keyword}]`);
      }
    });

    return result;
  },

  /**
   * 搜索表情包，返回第一张图的 URL
   * @param {string} keyword
   * @returns {Promise<string|null>}
   */
  async _searchEmoji(keyword) {
    // 检查缓存
    if (this._cache[keyword]) return this._cache[keyword];

    try {
      const response = await fetch(`${CONFIG.API_EMOJI_SEARCH}?keyword=${encodeURIComponent(keyword)}`);
      const data = await response.json();
      const images = data.images || [];
      
      if (images.length > 0) {
        // 随机取一张，增加趣味性
        const randomIndex = Math.floor(Math.random() * Math.min(images.length, 5));
        const url = images[randomIndex].url;
        this._cache[keyword] = url;
        return url;
      }
      
      this._cache[keyword] = null;
      return null;
    } catch {
      this._cache[keyword] = null;
      return null;
    }
  },

  /**
   * HTML 转义
   * @param {string} text
   * @returns {string}
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};