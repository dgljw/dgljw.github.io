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
        
        const contacts = Storage.getContacts();
        
        // 清空现有内容（保留添加按钮）
        const addCard = contactsGrid.querySelector('.add-contact');
        contactsGrid.innerHTML = '';
        
        contacts.forEach(contact => {
            const card = this.createContactCard(contact);
            contactsGrid.appendChild(card);
        });
        
        // 添加按钮
        const newAddCard = this.createAddCard();
        contactsGrid.appendChild(newAddCard);
    },
    
    /**
     * 创建联系卡片
     */
    createContactCard(contact) {
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
        
        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('contact-action')) return;
            if (contact.action === 'copy') {
                copyToClipboard(contact.value).then(success => {
                    showToast(success ? '已复制到剪贴板' : '复制失败', success ? 'success' : 'error');
                });
            } else {
                openLink(contact.value);
            }
        });
        
        card.querySelector('.contact-action').addEventListener('click', (e) => {
            e.stopPropagation();
            if (contact.action === 'copy') {
                copyToClipboard(contact.value).then(success => {
                    showToast(success ? '已复制到剪贴板' : '复制失败', success ? 'success' : 'error');
                });
            } else {
                openLink(contact.value);
            }
        });
        
        return card;
    },
    
    /**
     * 创建添加按钮
     */
    createAddCard() {
        const card = document.createElement('div');
        card.className = 'contact-card add-contact';
        card.innerHTML = `
            <div class="contact-icon">+</div>
            <div class="contact-info">
                <h3>添加联系方式</h3>
                <p>点击配置</p>
            </div>
        `;
        
        card.addEventListener('click', () => this.showAddContactDialog());
        
        return card;
    },
    
    /**
     * 显示添加联系方式对话框
     */
    showAddContactDialog() {
        const type = prompt('输入类型标识（如 email, github, twitter）：');
        if (!type) return;
        
        const label = prompt('输入显示名称：');
        if (!label) return;
        
        const value = prompt('输入链接或值：');
        if (!value) return;
        
        const icon = prompt('输入图标 Emoji：', '🔗');
        if (!icon) return;
        
        const action = confirm('是链接吗？（确定=打开链接，取消=复制）') ? 'open' : 'copy';
        
        const contacts = Storage.getContacts();
        contacts.push({ type, icon, label, value, action });
        Storage.setContacts(contacts);
        
        this.loadContacts();
        showToast('联系方式已添加', 'success');
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