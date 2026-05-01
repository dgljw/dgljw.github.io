/**
 * 图片理解模块
 * 处理图片上传、预览、调用后端视觉 API
 */

const VisionManager = {
  /**
   * 当前是否正在处理中
   */
  isLoading: false,

  /**
   * 打开图片选择器并处理
   * @returns {Promise<{success: boolean, text?: string, error?: string}>}
   */
  async processImage() {
    if (this.isLoading) {
      showToast('正在处理图片，请稍候...');
      return { success: false, error: 'processing' };
    }

    // 创建文件选择器
    const file = await this._selectFile();
    if (!file) return { success: false, error: 'cancelled' };

    // 校验类型
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件');
      return { success: false, error: 'invalid type' };
    }

    // 校验大小（限制 5MB）
    if (file.size > 5 * 1024 * 1024) {
      showToast('图片大小不能超过 5MB');
      return { success: false, error: 'too large' };
    }

    this.isLoading = true;
    showToast('🔍 正在分析图片...', 0); // 0 表示不自动消失

    try {
      // 压缩并转 Base64
      const base64 = await compressImage(file, 512); // 视觉分析用 512px
      
      // 调用后端视觉 API
      const response = await fetch(CONFIG.API_VISION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          prompt: '请描述这张图片的内容'
        })
      });

      const data = await response.json();
      const result = data.result || '图片识别失败，请稍后重试。';
      
      // 隐藏加载提示
      hideToast();
      this.isLoading = false;
      
      return { success: true, text: result };
    } catch (error) {
      hideToast();
      this.isLoading = false;
      showToast('图片分析失败: ' + error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * 创建文件选择器并返回选中的文件
   * @returns {Promise<File|null>}
   */
  _selectFile() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      document.body.appendChild(input);

      input.onchange = () => {
        const file = input.files[0] || null;
        document.body.removeChild(input);
        resolve(file);
      };

      input.oncancel = () => {
        document.body.removeChild(input);
        resolve(null);
      };

      // 移动端兼容：某些浏览器需要延迟触发
      setTimeout(() => input.click(), 100);
    });
  }
};