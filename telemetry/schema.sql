-- 一列 = 一個 session 讀一章。沒有識別碼，沒有 IP，沒有 UA。
CREATE TABLE IF NOT EXISTS reads (
  ts    INTEGER NOT NULL,  -- 伺服器收到的時間（毫秒）
  ch    TEXT    NOT NULL,  -- 章名，白名單驗過
  p     INTEGER NOT NULL,  -- 讀到第幾段（最深的那一段）
  total INTEGER NOT NULL,  -- 那一章總段數（章會改，所以每列自帶）
  froze INTEGER NOT NULL,  -- 時停有沒有觸發：1 = 用滾輪／觸控讀的
  mob   INTEGER NOT NULL   -- 1 = 視窗 ≤700px
);
CREATE INDEX IF NOT EXISTS reads_ch_ts ON reads (ch, ts);
