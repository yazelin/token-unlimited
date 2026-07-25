/* token 無限 閱讀器 — service worker
   全量 precache（app 殼＋所有章節與資產）→ 首訪即可離線。
   HTML＝network-first（線上拿最新、離線吃快取）；其他資源＝cache-first。
   改內容要更新：bump 下面的 CACHE 版本號。 */
const CACHE = 'tu-v15';
const ASSETS = [
  './', './index.html', './home.html',
  './序章-閱讀版.html', './第一章-閱讀版.html',
  './第二章-閱讀版.html', './第三章-閱讀版.html', './第四章-閱讀版.html',
  './og-cover.jpg', './manifest.json',
  './icon-180.png', './icon-192.png', './icon-512.png',
  './序章-素材/ambient.mp3', './序章-素材/far-meadow.webp',
  './第一章-素材/1-森林.webp', './第一章-素材/2-空地.webp',
  './第一章-素材/3-密林.webp', './第一章-素材/4-燒林.webp',
  './第二章-素材/1-城門.webp', './第二章-素材/2-訓練場.webp', './第二章-素材/3-餐廳.webp',
  './第三章-素材/1-山路.webp', './第三章-素材/2-削掉的坡.webp', './第三章-素材/3-夜營地.webp',
  './第四章-素材/1-空村.webp', './第四章-素材/2-龍.webp', './第四章-素材/3-雪.webp'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(
    ASSETS.map(a => c.add(a).catch(() => {}))   // 單檔失敗不拖垮整體
  )));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return;   // 只管同源
  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    e.respondWith(
      fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return r; })
        .catch(() => caches.match(req, { ignoreSearch: true })
          .then(m => m || caches.match('./home.html') || caches.match('./index.html')))
    );
  } else {
    e.respondWith(
      caches.match(req, { ignoreSearch: true }).then(m => m ||
        fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return r; }))
    );
  }
});
