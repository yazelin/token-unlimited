// 讀者讀到第幾段。沒有 cookie、沒有 ID、沒有 localStorage，一次載入只送一發。
// 注入位置：章節頁 </body> 之前（用 telemetry/安裝.sh）
(function () {
  var EP = 'https://tu-reads.yazelinj303.workers.dev/';
  var CH = document.title.match(/第[一二三四五六七八九十]+章|序章/);
  var ps = document.querySelectorAll('main p');
  if (!CH || !ps.length || !navigator.sendBeacon) return;

  var deepest = 0, froze = 0, sent = false;

  var io = new IntersectionObserver(function (es) {
    for (var i = 0; i < es.length; i++) {
      if (es[i].isIntersecting && es[i].target._i > deepest) deepest = es[i].target._i;
    }
  });
  for (var i = 0; i < ps.length; i++) { ps[i]._i = i + 1; io.observe(ps[i]); }

  // 時停有沒有真的觸發 = 這個人是不是用滾輪／觸控讀的（時停腳本會加這個 class）
  new MutationObserver(function () {
    if (document.documentElement.classList.contains('mfx-frozen')) froze = 1;
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  // ponytail: 一次載入只送一發，所以中途切走再回來繼續讀的部分收不到（手機偏多，
  // 會低估讀取深度）。要修就得給每次載入一個隨機碼讓後端取最大值 —— 那是識別碼，
  // 這本書刻意不要。先看曲線，真的需要再說。
  function send() {
    if (sent) return; sent = true;
    navigator.sendBeacon(EP, JSON.stringify({
      c: CH[0], p: deepest, t: ps.length, f: froze,
      m: matchMedia('(max-width:700px)').matches ? 1 : 0
    }));
  }
  addEventListener('pagehide', send);
  addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') send();
  });
})();
