// 简单路由管理

const Router = {
    currentView: 'home',
    views: ['home', 'chat', 'extract'],
    
    /**
     * 初始化路由
     */
    init() {
        // 监听 hash 变化
        window.addEventListener('hashchange', () => this.handleRoute());
        
        // 初始路由
        this.handleRoute();
        
        // 导航按钮点击
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const view = item.dataset.view;
                this.navigate(view);
            });
        });
        
        // 移动端菜单切换
        const menuToggle = document.getElementById('menuToggle');
        const navMenu = document.querySelector('.nav-menu');
        if (menuToggle && navMenu) {
            menuToggle.addEventListener('click', () => {
                menuToggle.classList.toggle('open');
                navMenu.classList.toggle('open');
            });
        }
    },
    
    /**
     * 处理路由
     */
    handleRoute() {
        const hash = window.location.hash.replace('#', '') || 'home';
        this.switchView(hash);
    },
    
    /**
     * 导航到指定视图
     */
    navigate(view) {
        if (!this.views.includes(view)) return;
        
        window.location.hash = view;
        this.switchView(view);
        
        // 移动端关闭菜单
        const menu = document.querySelector('.nav-menu');
        const toggle = document.getElementById('menuToggle');
        if (menu && menu.classList.contains('open')) {
            menu.classList.remove('open');
            toggle?.classList.remove('open');
        }
    },
    
    /**
     * 切换视图
     */
    switchView(view) {
        if (this.currentView === view) return;
        
        // 隐藏所有视图
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        
        // 显示目标视图
        const targetView = document.getElementById(`${view}View`);
        if (targetView) {
            targetView.classList.add('active');
        }
        
        // 更新导航状态
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === view);
        });
        
        this.currentView = view;
        
        // 触发视图切换事件
        document.dispatchEvent(new CustomEvent('viewChanged', { detail: { view } }));
    },
    
    /**
     * 获取当前视图
     */
    getCurrentView() {
        return this.currentView;
    }
};
