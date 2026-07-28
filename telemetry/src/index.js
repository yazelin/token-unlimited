// 收一列「有人讀到第幾段」。
//
// 不存 IP、不存 User-Agent、不發 cookie、不回任何可以再認出這個人的東西。
// Cloudflare 邊緣本來就看得到 IP —— 我們就是不寫進 D1，也不記 log。

const CHAPTERS = new Set([
  '序章', '第一章', '第二章', '第三章', '第四章',
  '第五章', '第六章', '第七章', '第八章',
]);

const MAX_P = 2000; // 目前最長的第七章 501 段；留寬，但要有上界

const cors = (origin) => ({
  'access-control-allow-origin': origin,
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
});

const int = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : null);

export default {
  async fetch(req, env) {
    const origin = env.ALLOWED_ORIGIN || 'https://yazelin.github.io';
    const h = cors(origin);

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (req.method !== 'POST') return new Response(null, { status: 405, headers: h });
    if (req.headers.get('origin') !== origin) return new Response(null, { status: 403, headers: h });

    let b;
    try { b = await req.json(); } catch { return new Response(null, { status: 400, headers: h }); }
    if (!b || typeof b !== 'object') return new Response(null, { status: 400, headers: h });

    const ch = CHAPTERS.has(b.c) ? b.c : null;
    const total = int(b.t, MAX_P);
    const p = int(b.p, MAX_P);
    const froze = int(b.f, 1);
    const mob = int(b.m, 1);
    // p > total 表示前端算錯或有人亂送，兩者都不要進資料
    if (ch === null || !total || p === null || p > total || froze === null || mob === null) {
      return new Response(null, { status: 400, headers: h });
    }

    await env.DB
      .prepare('INSERT INTO reads (ts,ch,p,total,froze,mob) VALUES (?,?,?,?,?,?)')
      .bind(Date.now(), ch, p, total, froze, mob)
      .run();

    return new Response(null, { status: 204, headers: h });
  },
};
