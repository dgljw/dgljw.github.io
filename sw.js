// Service Worker - PWA 离线缓存
const CACHE_NAME = 'deepseek-blog-v2';
const RUNTIME_CACHE = 'deepseek-runtime-v2';

const PRE_CACHE = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/config.js',
    '/js/utils.js',
    '/js/storage.js',
    '/js/router.js',
    '/js/home.js',
    '/js/chat.js',
    '/js/memory.js',
    '/js/extract.js',
    '/js/settings.js',
    '/js/ui.js',
    '/js/app.js',
    '/manifest.json'
];

// 安装：预缓存核心静态文件
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRE_CACHE))
            .then(() => self.skipWaiting())
    );
});

// 激活：清理旧缓存
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME && key !== RUNTIME_CACHE)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// 请求拦截：缓存优先 + 网络回退
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // 跳过 API 请求（不缓存动态数据）
    if (url.pathname.startsWith('/api/')) return;

    // 跳过 Chrome 扩展
    if (request.url.startsWith('chrome-extension://')) return;

    // 静态资源：缓存优先
    if (PRE_CACHE.some(p => url.pathname.endsWith(p.replace(/^\/?/, '/')))) {
        event.respondWith(
            caches.match(request).then(cached => cached || fetchAndCache(request))
        );
        return;
    }

    // 其他资源：网络优先，失败时回退缓存
    event.respondWith(
        fetch(request)
            .then(response => {
                if (response.ok) {
                    const cloned = response.clone();
                    caches.open(RUNTIME_CACHE).then(cache => cache.put(request, cloned));
                }
                return response;
            })
            .catch(() => caches.match(request))
    );
});

/** 网络请求并缓存 */
function fetchAndCache(request) {
    return fetch(request).then(response => {
        if (!response.ok) return response;
        const cloned = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, cloned));
        return response;
    });
}

// 推送通知（预留）
self.addEventListener('push', event => {
    if (!event.data) return;
    const data = event.data.json();
    const options = {
        body: data.body || '',
        icon: '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/icon-72x72.png',
        vibrate: [200, 100, 200],
        data: data.url || '/'
    };
    event.waitUntil(
        self.registration.showNotification(data.title || 'DeepSeek 记忆管家', options)
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientList => {
            if (clientList.length > 0) {
                clientList[0].focus();
            } else {
                clients.openWindow(event.notification.data || '/');
            }
        })
    );
});