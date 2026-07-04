const Drive = {
    currentFolder: '/',
    files: [],
    folders: [],
    initialized: false,

    async init() {
        if (this.initialized) {
            await this.refresh();
            return;
        }
        this.initialized = true;
        localStorage.removeItem(CONFIG.STORAGE_KEYS.FILES);
        await this.refresh();
    },

    async refresh() {
        this.renderLoading();
        await this.loadFiles();
        this.render();
    },

    async loadFiles() {
        try {
            const res = await fetch(`${CONFIG.STORAGE_API}?folder=${encodeURIComponent(this.currentFolder)}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '加载失败');
            this.files = data.files || [];
            this.folders = data.folders || [];
        } catch (err) {
            this.files = [];
            this.folders = [];
            showToast(`网盘加载失败：${err.message}`, 'error');
        }
    },

    renderLoading() {
        const container = document.getElementById('driveContainer');
        if (!container) return;
        container.innerHTML = `
            <div class="drive-loading">
                <div class="spinner-dot"></div>
                <span>正在读取云端网盘...</span>
            </div>
        `;
    },

    bindEvents() {
        document.getElementById('driveUploadBtn')?.addEventListener('click', () => {
            document.getElementById('driveUploadInput')?.click();
        });

        document.getElementById('driveUploadInput')?.addEventListener('change', (e) => {
            this.uploadFiles(Array.from(e.target.files || []));
            e.target.value = '';
        });

        document.getElementById('newFolderBtn')?.addEventListener('click', () => this.createFolder());

        const fileDrop = document.getElementById('fileDropZone');
        if (fileDrop) {
            fileDrop.addEventListener('dragover', (e) => {
                e.preventDefault();
                fileDrop.classList.add('dragover');
            });
            fileDrop.addEventListener('dragleave', (e) => {
                e.preventDefault();
                fileDrop.classList.remove('dragover');
            });
            fileDrop.addEventListener('drop', (e) => {
                e.preventDefault();
                fileDrop.classList.remove('dragover');
                this.uploadFiles(Array.from(e.dataTransfer.files || []));
            });
        }

        document.querySelectorAll('[data-drive-folder]').forEach(el => {
            el.addEventListener('click', () => this.navigateTo(el.dataset.driveFolder));
        });

        document.querySelectorAll('[data-drive-download]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const file = this.files.find(item => item.path === el.dataset.driveDownload);
                if (file) this.downloadFile(file);
            });
        });

        document.querySelectorAll('[data-drive-delete]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteItem(el.dataset.driveDelete, el.dataset.driveType, el.dataset.driveSha || '');
            });
        });

        document.querySelectorAll('[data-drive-path]').forEach(el => {
            el.addEventListener('click', () => {
                this.currentFolder = el.dataset.drivePath || '/';
                this.refresh();
            });
        });
    },

    async uploadFiles(files) {
        if (!files.length) return;
        showToast(`正在上传 ${files.length} 个文件到云端...`, 'info');

        for (const file of files) {
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('folder', this.currentFolder);

                const res = await fetch(CONFIG.STORAGE_API, {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || '上传失败');
                showToast(`✅ ${file.name} 已上传到云端`, 'success');
            } catch (err) {
                showToast(`❌ ${file.name} 上传失败：${err.message}`, 'error');
            }
        }

        await this.refresh();
    },

    async createFolder() {
        const name = prompt('输入文件夹名称：');
        if (!name || !name.trim()) return;

        try {
            const formData = new FormData();
            formData.append('action', 'folder');
            formData.append('name', name.trim());
            formData.append('folder', this.currentFolder);

            const res = await fetch(CONFIG.STORAGE_API, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '创建失败');
            showToast('云端文件夹已创建', 'success');
            await this.refresh();
        } catch (err) {
            showToast(`文件夹创建失败：${err.message}`, 'error');
        }
    },

    async deleteItem(path, type, sha = '') {
        if (!confirm('确定删除这个云端文件/文件夹吗？此操作会同步删除云端内容。')) return;

        try {
            const query = new URLSearchParams({ path, type });
            if (sha) query.set('sha', sha);
            const res = await fetch(`${CONFIG.STORAGE_API}?${query.toString()}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '删除失败');
            showToast('云端内容已删除', 'success');
            await this.refresh();
        } catch (err) {
            showToast(`删除失败：${err.message}`, 'error');
        }
    },

    downloadFile(file) {
        if (!file.url) {
            showToast('这个文件暂无下载链接', 'error');
            return;
        }
        window.open(file.url, '_blank', 'noopener,noreferrer');
    },

    navigateTo(folderPath) {
        if (folderPath === '..') {
            const parts = this.currentFolder.split('/').filter(Boolean);
            parts.pop();
            this.currentFolder = parts.length ? `/${parts.join('/')}` : '/';
        } else {
            this.currentFolder = folderPath || '/';
        }
        this.refresh();
    },

    getBreadcrumb() {
        if (this.currentFolder === '/') return [{ name: '根目录', path: '/' }];

        const parts = this.currentFolder.split('/').filter(Boolean);
        const breadcrumb = [{ name: '根目录', path: '/' }];
        let path = '';
        parts.forEach(part => {
            path += `/${part}`;
            breadcrumb.push({ name: part, path });
        });
        return breadcrumb;
    },

    getFileIcon(file) {
        if (file.type === 'folder') return '📁';
        const ext = file.name.split('.').pop().toLowerCase();
        const icons = {
            pdf: '📕',
            doc: '📘',
            docx: '📘',
            xls: '📗',
            xlsx: '📗',
            ppt: '📙',
            pptx: '📙',
            txt: '📄',
            md: '📝',
            jpg: '🖼️',
            jpeg: '🖼️',
            png: '🖼️',
            gif: '🖼️',
            webp: '🖼️',
            svg: '🖼️',
            mp3: '🎵',
            wav: '🎵',
            mp4: '🎬',
            mov: '🎬',
            zip: '📦',
            rar: '📦',
            '7z': '📦',
            json: '📋',
            js: '💻',
            html: '💻',
            css: '💻',
            py: '💻'
        };
        return icons[ext] || '📄';
    },

    formatSize(bytes = 0) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    },

    render() {
        const container = document.getElementById('driveContainer');
        if (!container) return;

        const folders = [...this.folders].sort((a, b) => a.name.localeCompare(b.name));
        const files = [...this.files].sort((a, b) => a.name.localeCompare(b.name));
        const breadcrumb = this.getBreadcrumb();
        const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);

        container.innerHTML = `
            <div class="drive-header">
                <div class="drive-breadcrumb">
                    ${breadcrumb.map((item, index) => `
                        <span class="breadcrumb-item" data-drive-path="${escapeHtml(item.path)}">${escapeHtml(item.name)}</span>
                        ${index < breadcrumb.length - 1 ? '<span class="breadcrumb-sep">/</span>' : ''}
                    `).join('')}
                </div>
                <div class="drive-actions">
                    <button class="btn-primary" id="newFolderBtn">
                        <span>📁</span>
                        <span>新建文件夹</span>
                    </button>
                    <button class="btn-secondary" id="driveUploadBtn">
                        <span>⬆️</span>
                        <span>上传文件</span>
                    </button>
                    <input type="file" id="driveUploadInput" accept="*" multiple style="display: none;">
                </div>
            </div>

            <div class="drive-stats">
                <div class="stat-item">
                    <span class="stat-value">${files.length}</span>
                    <span class="stat-label">当前文件</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${folders.length}</span>
                    <span class="stat-label">当前文件夹</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${this.formatSize(totalSize)}</span>
                    <span class="stat-label">当前大小</span>
                </div>
            </div>

            <div class="drive-content">
                ${this.currentFolder !== '/' ? `
                    <div class="file-card folder-card" data-drive-folder="..">
                        <div class="file-icon">📂</div>
                        <div class="file-info">
                            <div class="file-name">返回上级</div>
                            <div class="file-meta">..</div>
                        </div>
                    </div>
                ` : ''}

                ${folders.map(folder => `
                    <div class="file-card folder-card" data-drive-folder="${escapeHtml(folder.path)}">
                        <div class="file-icon">${this.getFileIcon(folder)}</div>
                        <div class="file-info">
                            <div class="file-name">${escapeHtml(folder.name)}</div>
                            <div class="file-meta">云端文件夹</div>
                        </div>
                        <div class="file-actions">
                            <button class="file-action-btn">📂</button>
                            <button class="file-action-btn delete-btn" data-drive-delete="${escapeHtml(folder.path)}" data-drive-type="folder">🗑️</button>
                        </div>
                    </div>
                `).join('')}

                ${files.map(file => `
                    <div class="file-card" data-drive-download="${escapeHtml(file.path)}">
                        <div class="file-icon">${this.getFileIcon(file)}</div>
                        <div class="file-info">
                            <div class="file-name">${escapeHtml(file.name)}</div>
                            <div class="file-meta">${this.formatSize(file.size)} · 云端文件</div>
                        </div>
                        <div class="file-actions">
                            <button class="file-action-btn" data-drive-download="${escapeHtml(file.path)}">📥</button>
                            <button class="file-action-btn delete-btn" data-drive-delete="${escapeHtml(file.path)}" data-drive-type="file" data-drive-sha="${escapeHtml(file.sha || '')}">🗑️</button>
                        </div>
                    </div>
                `).join('')}

                ${folders.length === 0 && files.length === 0 ? `
                    <div class="empty-state">
                        <div class="empty-icon">☁️</div>
                        <p>云端目录为空</p>
                        <p class="empty-hint">上传文件后会真实保存到云端仓库</p>
                    </div>
                ` : ''}
            </div>

            <div class="file-drop-zone" id="fileDropZone">
                <div class="drop-icon">☁️</div>
                <p>拖拽文件到此处上传到云端</p>
            </div>
        `;

        this.bindEvents();
    }
};
