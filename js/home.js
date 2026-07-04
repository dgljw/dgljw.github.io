// 主页逻辑

const Home = {
    /**
     * 初始化主页
     */
    init() {
        this.loadAvatar();
        this.loadMotto();
        this.loadContacts();
        this.loadAnnouncement();
        this.bindEvents();
    },
    
    /**
     * 加载头像
     */
    loadAvatar() {
        const avatar = document.getElementById('userAvatar');
        if (!avatar) return;
        
        const savedAvatar = Storage.getUserAvatar();
        if (savedAvatar) {
            avatar.innerHTML = `<img src="${savedAvatar}" alt="头像">`;
        }
    },
    
    /**
     * 加载座右铭
     */
    loadMotto() {
        const motto = document.getElementById('userMotto');
        if (!motto) return;
        
        motto.textContent = Storage.getMotto();
        
        // 保存座右铭
        motto.addEventListener('blur', () => {
            const newMotto = motto.textContent.trim();
            if (newMotto) {
                Storage.setMotto(newMotto);
                showToast('座右铭已保存', 'success');
            }
        });
        
        // Enter 键保存
        motto.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                motto.blur();
            }
        });
    },
    
    /**
     * 加载联系方式
     */
    loadContacts() {
        const contactsGrid = document.querySelector('.contacts-grid');
        if (!contactsGrid) return;
        
        // 从配置或存储中获取联系方式
        const stored = Storage.getContacts();
        const contacts = stored.length > 0 ? stored : CONFIG.DEFAULT_CONTACTS;
        
        contactsGrid.innerHTML = '';
        contacts.forEach(contact => {
            const card = document.createElement('div');
            card.className = 'contact-card';
            card.dataset.type = contact.type;
            
            card.innerHTML = `
                <div class="contact-icon">${contact.icon}</div>
                <div class="contact-info">
                    <h3>${contact.label}</h3>
                    <p class="contact-value">${contact.value}</p>
                </div>
                <button class="contact-action" data-action="${contact.action}">
                    ${contact.action === 'copy' ? '复制' : '打开'}
                </button>
            `;
            
            const actionBtn = card.querySelector('.contact-action');
            actionBtn.onclick = (e) => {
                e.stopPropagation();
                if (contact.action === 'copy') {
                    copyToClipboard(contact.value).then(success => {
                        showToast(success ? '已复制到剪贴板' : '复制失败', success ? 'success' : 'error');
                    });
                } else {
                    openLink(contact.value);
                }
            };
            
            contactsGrid.appendChild(card);
        });
    },
    
    /**
     * 加载公告栏
     * 支持从 TXT 文件解析公告，格式:
     *   标题:XXX
     *   内容:XXX
     *   图片:XX/XXX.jpg  (可选)
     */
    loadAnnouncement() {
        const card = document.getElementById('announcementCard');
        if (!card) return;
        
        // 优先读取上传的 TXT
        const txtData = Storage.getAnnouncement();
        let announcement = null;
        
        if (txtData) {
            announcement = this.parseAnnouncement(txtData);
        }
        
        if (!announcement) {
            // 默认公告
            announcement = {
                title: 'testing',
                content: '网站正在建设',
                image: null
            };
        }
        
        card.innerHTML = '';
        
        if (announcement.image) {
            const img = document.createElement('img');
            img.className = 'announcement-image';
            img.src = announcement.image;
            img.alt = announcement.title;
            img.loading = 'lazy';
            card.appendChild(img);
        }
        
        const header = document.createElement('div');
        header.className = 'announcement-header';
        header.innerHTML = `
            <span class="announcement-pin">📌</span>
            <span class="announcement-title">${escapeHtml(announcement.title)}</span>
        `;
        card.appendChild(header);
        
        const content = document.createElement('div');
        content.className = 'announcement-content';
        content.textContent = announcement.content;
        card.appendChild(content);
    },
    
    /**
     * 解析公告 TXT 格式
     */
    parseAnnouncement(text) {
        const result = { title: '', content: '', image: null };
        const lines = text.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('标题:')) {
                result.title = trimmed.slice(3).trim();
            } else if (trimmed.startsWith('内容:')) {
                result.content = trimmed.slice(3).trim();
            } else if (trimmed.startsWith('图片:')) {
                const imgPath = trimmed.slice(3).trim();
                if (imgPath) result.image = imgPath;
            }
        }
        
        return result.title || result.content ? result : null;
    },
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 头像上传
        const avatar = document.getElementById('userAvatar');
        const upload = document.getElementById('avatarUpload');
        const editBtn = document.getElementById('editAvatar');
        
        if (avatar && upload) {
            avatar.addEventListener('click', () => upload.click());
            
            upload.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                try {
                    const base64 = await compressImage(file);
                    Storage.setUserAvatar(base64);
                    avatar.innerHTML = `<img src="${base64}" alt="头像">`;
                    showToast('头像已更新', 'success');
                } catch (err) {
                    showToast('头像上传失败', 'error');
                }
            });
        }
        
        if (editBtn && upload) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                upload.click();
            });
        }
    }
};