/**
 * 牌局环境守护 Service Worker
 * 具备缓存管理、后台同步、推送通知能力
 */

const CACHE_NAME = 'pjhh-v12';
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/icon-180.png',
];

// ── 安装：预缓存静态资源 ──────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ── 激活：清理旧缓存 ──────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// ── 拦截请求：网络优先，失败时回退缓存 ────────────────────
self.addEventListener('fetch', (event) => {
  // 只处理 GET 请求
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // JS/CSS等资源：缓存优先
  if (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.webmanifest')
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML 页面：网络优先，离线时返回缓存
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/'))
    );
  }
});

// ── 后台同步 ──────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // 后台同步逻辑（可扩展）
  console.log('[SW] 后台同步执行');
}

// ── 推送通知 ──────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = { title: '牌局环境守护', body: '您有新的消息', icon: '/assets/icon-192.png' };
  try {
    data = { ...data, ...event.data.json() };
  } catch (_) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/assets/icon-192.png',
      badge: '/assets/icon-192.png',
      vibrate: [200, 100, 200],
    })
  );
});

// ── 通知点击 ──────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.openWindow('/')
  );
});
