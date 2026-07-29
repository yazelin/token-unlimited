-- 用法：wrangler d1 execute tu-reads --remote --command "<把下面某一段貼進來>"
-- 或   wrangler d1 execute tu-reads --remote --file queries.sql   （會全部跑一遍）

-- ① 每章有多少人開、讀到哪（中位數用 p/total 排序取中間那一列）
SELECT ch,
       COUNT(*)                                  AS 開啟,
       ROUND(AVG(p * 100.0 / total), 1)          AS 平均讀到百分比,
       SUM(p >= total - 2) * 100 / COUNT(*)      AS 完讀率,
       SUM(p <= 5)         * 100 / COUNT(*)      AS 前五段就走,
       SUM(mob)            * 100 / COUNT(*)      AS 手機比例,
       -- froze 只有「那一章真的有時停」才有意義。序章／五／六／八沒有 data-freeze，
       -- 那幾章永遠是 0，混進來平均就假了。所以這一欄只在有時停的章才給數字。
       CASE WHEN ch IN ('第一章','第二章','第三章','第四章','第七章')
            THEN SUM(froze) * 100 / COUNT(*) END  AS 滾輪觸控比例
FROM reads GROUP BY ch ORDER BY ch;

-- ①之二 滾輪／觸控比例（只算有時停的章，不然分母混進不可能觸發的章）
SELECT SUM(froze) * 100 / COUNT(*) AS 滾輪觸控比例, COUNT(*) AS 樣本
FROM reads WHERE ch IN ('第一章','第二章','第三章','第四章','第七章');

-- ② 流失曲線：每一章每 20 段一桶，看人數怎麼掉
--    （挑一章跑，把 '第七章' 換掉）
SELECT (p / 20) * 20 AS 段, COUNT(*) AS 停在這一段區間的人
FROM reads WHERE ch = '第七章' GROUP BY p / 20 ORDER BY 段;

-- ③ 哪一段流失最兇（連續兩桶掉最多的位置）——真正要看的那一題
--    第一桶排除：那是「點進來就走」，②的第一列已經看得到，不算流失點
WITH b AS (SELECT (p/20)*20 AS 段, COUNT(*) n FROM reads WHERE ch='第七章' GROUP BY p/20),
     d AS (SELECT 段, n, n - LAG(n) OVER (ORDER BY 段) AS 差 FROM b)
SELECT 段, n, 差 AS 比前一桶多少 FROM d WHERE 差 IS NOT NULL AND 段 > 0
ORDER BY 差 ASC LIMIT 5;

-- ④ 滾輪讀者跟鍵盤讀者讀得一樣深嗎（時停到底有沒有趕走人）
--    （同上：只有有時停的章能比，別的章 froze 恆為 0）
SELECT ch, froze, COUNT(*) 人數, ROUND(AVG(p*100.0/total),1) 平均百分比
FROM reads WHERE ch IN ('第一章','第二章','第三章','第四章','第七章')
GROUP BY ch, froze ORDER BY ch, froze;

-- ⑤ 手機讀者是不是更早走
SELECT ch, mob, COUNT(*) 人數, ROUND(AVG(p*100.0/total),1) 平均百分比
FROM reads GROUP BY ch, mob ORDER BY ch, mob;

-- ⑥ 最近七天每天多少人開始讀
SELECT date(ts/1000, 'unixepoch', '+8 hours') AS 日, COUNT(*) AS 開啟
FROM reads GROUP BY 1 ORDER BY 1 DESC LIMIT 7;
