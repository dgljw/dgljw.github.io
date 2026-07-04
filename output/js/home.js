// 主页逻辑

const Home = {
    /**
     * 初始化主页
     */
    init() {
        this.loadAvatar();
        this.loadMotto();
        this.loadContacts();
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
            
            if (contact.action === 'open') {
                // GitHub：整个卡片是可点击的链接
                const fullUrl = (contact.value.startsWith('http://') || contact.value.startsWith('https://')) 
                    ? contact.value : `https://${contact.value}`;
                card.innerHTML = `
                    <a href="${fullUrl}" target="_blank" rel="noopener noreferrer" class="contact-link">
                        <div class="contact-icon">${contact.icon}</div>
                        <div class="contact-info">
                            <h3>${contact.label}</h3>
                            <p class="contact-value">${contact.value}</p>
                        </div>
                        <span class="contact-action">打开</span>
                    </a>
                `;
            } else {
                // 微信：点击复制微信号
                card.innerHTML = `
                    <div class="contact-icon">${contact.icon}</div>
                    <div class="contact-info">
                        <h3>${contact.label}</h3>
                        <p class="contact-value">${contact.value}</p>
                    </div>
                    <button class="contact-action copy-btn">复制</button>
                `;
                
                const btn = card.querySelector('.copy-btn');
                btn.onclick = (e) => {
                    e.stopPropagation();
                    copyToClipboard(contact.value).then(success => {
                        btn.textContent = success ? '已复制' : '失败';
                        btn.style.color = success ? '#10b981' : '#ef4444';
                        setTimeout(() => {
                            btn.textContent = '复制';
                            btn.style.color = '';
                        }, 2000);
                    });
                };
            }
            
            contactsGrid.appendChild(card);
        });
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