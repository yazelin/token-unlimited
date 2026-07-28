/* token 無限 閱讀器 — service worker
   ────────────────────────────────────────────────────────────────────────
   兩層快取（2026-07-28 改；做法來自 gewu-jianghu-web 的實測筆記）：

     SHELL —— 殼：index/home/manifest/小 icon。**每次部署都 bump。**
              install 只等這一層（約 40KB），所以新版幾秒就接管。
     ASSET —— 章節 HTML、背景圖、音檔。**只有同名檔換內容才 bump。**
              背景暖快取，照「閱讀順序」一項一項抓。

   為什麼要分層：舊版是單一 CACHE，改一個字就 bump → activate 把整包
   資產刪掉重抓，而且 install 要等全部下載完才 activate。
   gewu 實測同一情境：分層前實抓 28.86MB，分層後 0.84MB。

   為什麼順序重要（比總量更重要）：暖快取是背景下載，排錯不會有任何錯誤
   訊息，但「下載到一半就斷線」的人能讀到第幾章完全由它決定。
   原則：**每一章先拿 HTML 再拿它的圖；音檔排最後**（缺圖讀不了，缺音只是沒聲音）。

   同名檔換內容（非 hashed 檔名）不會自動更新 —— 要 bump ASSET 版本號。
   2026-07-28 第一章四張圖重壓（7.5MB→0.9MB）就是靠 bump 生效的。
   ──────────────────────────────────────────────────────────────────────── */

const SHELL = 'tu-shell-v30';
const ASSET = 'tu-asset-v4';

/* install 會等這一層。只放「畫得出目錄頁」的最小集。 */
const SHELL_FILES = [
  './', './index.html', './home.html', './manifest.json',
  './icon-v6-180.png', './icon-v6-192.png',
  './favicon.ico', './favicon-v6-32.png'
];

/* 背景暖快取，順序就是閱讀順序。前面的先抓。 */
const WARM = [
  // 序章：HTML 175KB + 圖 150KB → 讀得完序章
  './序章-閱讀版.html', './序章-素材/far-meadow.webp',
  // 第一章
  './第一章-閱讀版.html',
  './第一章-素材/1-森林.webp', './第一章-素材/2-空地.webp',
  './第一章-素材/3-密林.webp', './第一章-素材/4-燒林.webp',
  // 第二章
  './第二章-閱讀版.html',
  './第二章-素材/1-城門.webp', './第二章-素材/2-訓練場.webp', './第二章-素材/3-餐廳.webp',
  './第二章-素材/4-公會.webp', './第二章-素材/5-通鋪.webp', './第二章-素材/6-街.webp',
  // 第三章
  './第三章-閱讀版.html',
  './第三章-素材/1-山路.webp', './第三章-素材/2-削掉的坡.webp', './第三章-素材/3-夜營地.webp',
  // 第四章
  './第四章-閱讀版.html',
  './第四章-素材/1-空村.webp', './第四章-素材/2-龍.webp', './第四章-素材/3-雪.webp',
  // 第五章
  './第五章-閱讀版.html',
  './第五章-素材/1-房間.webp', './第五章-素材/2-天沒亮.webp',
  './第五章-素材/3-城門送別.webp', './第五章-素材/4-大堂.webp',
  // 第六章
  './第六章-閱讀版.html',
  './第六章-素材/3-旅館大堂.webp', './第六章-素材/5-路.webp',
  './第六章-素材/4-市集.webp', './第六章-素材/1-午後.webp', './第六章-素材/2-夜燈.webp',
  // 第七章（沿用六章的旅館與市集，不重複列）
  './第七章-閱讀版.html',
  './第七章-素材/1-井.webp', './第七章-素材/2-樹下.webp',
  './第七章-素材/4-夜.webp', './第七章-素材/3-坡.webp', './第七章-素材/5-窗.webp',
  // 附加：音檔與只在分享時用得到的東西排最後
  './序章-素材/ambient.mp3',
  './icon-v6-512.png', './og-cover.jpg'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  // 只等殼。資產交給 activate 之後背景慢慢抓。
  e.waitUntil(caches.open(SHELL).then(c =>
    Promise.allSettled(SHELL_FILES.map(f => c.add(f)))));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    // 只刪「不是現行兩層」的舊快取。ASSET 沒 bump 就整層留著，不用重抓。
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== SHELL && k !== ASSET).map(k => caches.delete(k)));
    await self.clients.claim();
    warm();   // 不 await：暖快取不該擋住接管
  })());
});

/* 照順序一項一項抓。已經在快取裡的直接跳過（換 ASSET 版本時才會全部重抓）。 */
async function warm() {
  const c = await caches.open(ASSET);
  for (const url of WARM) {
    try {
      if (await c.match(url, { ignoreSearch: true, ignoreVary: true })) continue;
      const r = await fetch(url, { cache: 'reload' });
      if (r.ok) await c.put(url, r);
    } catch (_) { /* 斷線就停在這裡，下次啟動再從斷點接著抓 */ }
  }
}

/* 頁面可以問「這個檔在快取裡嗎」。
   問的時候要用 registration.active，不要用 navigator.serviceWorker.controller——
   硬重整那一次頁面完全不受 SW 控制，controller 是 null，但 registration 還在。 */
self.addEventListener('message', e => {
  if (!e.data || e.data.type !== 'have') return;
  e.waitUntil((async () => {
    const c = await caches.open(ASSET);
    const hits = await Promise.all((e.data.urls || []).map(u =>
      c.match(u, { ignoreSearch: true, ignoreVary: true }).then(Boolean)));
    e.source && e.source.postMessage({ type: 'have', result: hits });
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return;   // 只管同源

  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // network-first：線上永遠拿最新部署，離線吃快取。
    e.respondWith((async () => {
      try {
        const r = await fetch(req);
        const cp = r.clone();
        // 章節頁存進 ASSET，殼存進 SHELL——這樣殼 bump 時不會連章節一起丟掉。
        const name = /-閱讀版\.html/.test(new URL(req.url).pathname) ? ASSET : SHELL;
        caches.open(name).then(c => c.put(req, cp)).catch(() => {});
        return r;
      } catch (_) {
        // ignoreVary 一定要加：Pages 對每個檔都回 Vary: Accept-Encoding，
        // 不加會因為 Vary 比對失敗而 miss（gewu 2026-07-25 實測）。
        const m = await caches.match(req, { ignoreSearch: true, ignoreVary: true });
        return m || await caches.match('./home.html', { ignoreVary: true })
                 || await caches.match('./index.html', { ignoreVary: true })
                 || Response.error();
      }
    })());
  } else {
    // cache-first
    e.respondWith((async () => {
      const m = await caches.match(req, { ignoreSearch: true, ignoreVary: true });
      if (m) return m;
      const r = await fetch(req);
      const cp = r.clone();
      caches.open(ASSET).then(c => c.put(req, cp)).catch(() => {});
      return r;
    })());
  }
});
