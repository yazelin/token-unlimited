#!/usr/bin/env bash
# 把 client.js 注入全部章節頁。**上線那一步才跑。**
#
# 上線順序：
#   1. wrangler d1 create tu-reads              → 把 database_id 貼進 wrangler.toml
#   2. wrangler d1 execute tu-reads --remote --file schema.sql
#   3. wrangler deploy                          → 記下 workers.dev 網址
#   4. 網址跟 client.js 裡的 EP 對不上就改 client.js
#   5. bash 安裝.sh                             → 注入
#   6. 改 sw.js 的 ASSET 版號（章節頁在 ASSET 快取，不是 SHELL），commit、push
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f telemetry/client.js ] || { echo "找不到 client.js" >&2; exit 1; }
n=0
for f in 序章-閱讀版.html 第*章-閱讀版.html; do
  [ -f "$f" ] || continue
  if grep -q 'tu-reads' "$f"; then echo "  已有，跳過：$f"; continue; fi
  python3 - "$f" telemetry/client.js <<'PY'
import pathlib, sys
p, c = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]).read_text(encoding='utf-8')
t = p.read_text(encoding='utf-8')
assert t.count('</body>') == 1, f'{p}: </body> 不是剛好一個'
p.write_text(t.replace('</body>', '<script>\n' + c + '</script>\n</body>'), encoding='utf-8')
PY
  echo "  注入：$f"; n=$((n+1))
done
echo "── 注入 $n 個檔。記得改 sw.js 的 ASSET 版號 ──"
