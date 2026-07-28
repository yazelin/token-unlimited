# 讀者讀到哪 —— telemetry

**還沒上線。** 部署那一步要動 yazelin 的 Cloudflare 帳號。本機已經整條測過（下面有結果）。

## 它量什麼

**第幾段，不是百分比。**「一半的人停在第五章 ¶120」可以行動，「停在 62%」不行。

順帶收兩個對這本書特別有用的：

| 欄位 | 意思 |
|---|---|
| `froze` | 時停有沒有真的觸發 ＝ **這個讀者是不是用滾輪／觸控讀的**（鍵盤與捲軸不觸發） |
| `mob` | 視窗寬度 ≤700px ＝ 手機版面 |

## 它不量什麼

**沒有任何識別碼。** 沒有 cookie、沒有 localStorage、沒有 ID，
Worker **不寫 IP、不寫 User-Agent**（Cloudflare 邊緣本來就看得到 IP，我們就是不留）。
一次頁面載入只送一發 beacon。

**所以你看得到流失曲線，追不到任何一個人。** 那不是為了合規好看——你要的本來就只有那條曲線。

### 已知偏差（寫在這裡免得之後被數字騙）

一次載入只送一發，送出的時機是**第一次切走或關頁**。
所以「切去別的 app、回來繼續讀」那一段收不到，**手機會系統性低估讀取深度**。

要修就得給每次載入一個隨機碼讓後端取最大值——那是識別碼，這本書刻意不要。
`mob=0` 那一群（桌機，中途切走的少）可以當比較乾淨的對照。

## 檔案

```
wrangler.toml     Worker ＋ D1 綁定（database_id 要先 d1 create）
src/index.js      Worker：驗證 → 寫一列 → 204
schema.sql        一張表
queries.sql       ①每章總覽 ②流失曲線 ③掉最兇的位置 ④滾輪vs非滾輪 ⑤手機vs桌機 ⑥每日開啟
client.js         要注入章節頁的那段（獨立檔，方便看 diff）
安裝.sh           把 client 注入全部章節頁（**上線才跑**）
```

## 上線步驟（yazelin 執行）

```bash
cd ~/token-unlimited/telemetry
wrangler d1 create tu-reads                          # 把回傳的 database_id 貼進 wrangler.toml
wrangler d1 execute tu-reads --remote --file schema.sql
wrangler deploy                                      # 記下 workers.dev 網址
#   網址跟 client.js 第 4 行的 EP 對不上就改 client.js
bash 安裝.sh                                          # 注入全部章節頁
#   改 sw.js 的 SHELL 版號 → commit → push
```

看數字：

```bash
wrangler d1 execute tu-reads --remote --file queries.sql
```

## 本機驗過的（2026-07-28）

**Worker 邊界 16 條**（`wrangler dev --local` ＋ curl）：

| 該收 | 該擋 |
|---|---|
| 正常一發 ／ 讀到最後一段 ／ 只讀第一段 → **204** | 沒有 origin、別的網站 → **403** |
| | 章名不在白名單、`p > total`、`p` 負數、`p` 是字串、`f` 不是 0/1、`total=0`、拿 SQL injection 當章名、不是 JSON、空 body → **400** |
| | GET → **405** ／ OPTIONS 預檢 → **204** |

三發該收的進了資料庫，十二發該擋的一列都沒進。

**client 端到端兩發**（真的把 `client.js` 注入 `第七章-閱讀版.html`，Chrome 實際讀）：

| 情境 | 收到 |
|---|---|
| 桌機、滾輪觸發時停、捲到 ¶332 | `第七章 ／ p=332 ／ total=501 ／ froze=1 ／ mob=0` |
| 手機視窗 390×844、沒碰時停、捲到 ¶44 | `第七章 ／ p=44 ／ total=501 ／ froze=0 ／ mob=1` |

**六條查詢**都對三百多列造出來的假資料跑過（含 `LAG()` 視窗函數）。

## 順手驗到的一件事（跟 telemetry 無關）

測 `froze` 旗標的時候在瀏覽器裡確認：**第七章兩次時停（1100 ／ 2600）都真的會觸發**，
凍住、到時解凍都正確。

但第七章的 HTML 裡**有兩份時停腳本**——新的 `querySelectorAll` 版（支援多次），
加上從第六章模板帶下來的舊 `querySelector` 版（只抓第一個）。
兩份同時跑，行為一樣所以沒壞，但舊那份是死碼，註解還寫著「全書第一次時停」。
第五、六章也各帶著一份舊腳本，那兩章根本沒有 `data-freeze` 元素，開頭就 return。

**沒有動已上線的頁**——那是三個檔重新部署，不在這次的範圍。第八章建的時候只帶新的那一份。
