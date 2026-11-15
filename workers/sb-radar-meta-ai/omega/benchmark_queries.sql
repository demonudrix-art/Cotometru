-- OMEGA Professional Betting Intelligence reproducibility guide.
-- NEVER use a post-signal feature; baseline no-vig P(X)=(1/px)/(1/p1+1/px+1/p2).
-- Run on D1 beast-xray-history (read-only historical tables).

-- A. Minimum score-state and valid-price benchmark, independent row per event-minute.
WITH sample AS (
 SELECT l.event_id,l.minute,l.captured_utc,l.p1,l.px,l.p2,
 ROW_NUMBER() OVER(PARTITION BY l.event_id,l.minute ORDER BY l.captured_utc ASC,l.id ASC) rn
 FROM live_snapshots l
 WHERE l.minute IN (40,50,55,57,60,65,70)
 AND l.home_score=0 AND l.away_score=0
 AND l.p1>1.001 AND l.px>1.001 AND l.p2>1.001
 AND l.captured_utc>='2026-11-02'
), matches AS (
 SELECT s.minute,s.event_id,s.px,s.p1,s.p2,r.winner_1x2,
 (1.0/s.px)/(1.0/s.p1+1.0/s.px+1.0/s.p2) p_market
 FROM sample s JOIN match_results r ON r.event_id=s.event_id
 WHERE s.rn=1 AND r.verified=1 AND r.event_status='FINISHED'
 AND r.winner_1x2 IN ('1','2','X')
)
SELECT minute,COUNT(*) n,SUM(winner_1x2='X') wins,
 ROUND(AVG(p_market),4) market_x,
 ROUND(AVG(CASE WHEN winner_1x2='X' THEN px-1 ELSE -1 END),4) return_per_unit
FROM matches GROUP BY minute ORDER BY minute;

-- B. Frozen market+empirical prior benchmark evaluated OUT OF TIME.
WITH src AS (
 SELECT l.event_id,l.minute,l.captured_utc,l.p1,l.px,l.p2,r.winner_1x2,
 ROW_NUMBER() OVER(PARTITION BY l.event_id,l.minute ORDER BY l.captured_utc,l.id) rn
 FROM live_snapshots l JOIN match_results r ON r.event_id=l.event_id
 WHERE l.minute IN (40,50,55,57,60,65,70)
 AND l.home_score=0 AND l.away_score=0
 AND l.p1>1 AND l.px>1 AND l.p2>1
 AND r.verified=1 AND r.event_status='FINISHED'
 AND r.winner_1x2 IN ('1','2','X')
 AND l.captured_utc>='2026-11-02'
), train AS (
 SELECT minute,COUNT(*) n,SUM(winner_1x2='X') w FROM src
 WHERE rn=1 AND captured_utc<'2026-11-11' GROUP BY minute
), test AS (
 SELECT s.minute,s.px,s.winner_1x2,
 (1.0/s.px)/(1.0/s.p1+1.0/s.px+1.0/s.p2) p_market,
 (t.w+4.0)/(t.n+10.0) p_prior FROM src s
 JOIN train t USING(minute) WHERE s.rn=1 AND s.captured_utc>='2026-11-11'
), eval AS (
 SELECT *,CASE WHEN winner_1x2='X' THEN 1 ELSE 0 END y,
 .75*p_market+.25*p_prior p_mix FROM test
)
SELECT minute,COUNT(*) test_n,
 ROUND(AVG((p_market-y)*(p_market-y)),6) brier_market,
 ROUND(AVG((p_mix-y)*(p_mix-y)),6) brier_mix,
 SUM(p_mix*px>1.05) edge5_events
FROM eval GROUP BY minute ORDER BY minute;

-- C. Daily prospective cohorts from 2026-11-15T13:06:20.277Z.
-- Only captured_utc after frozen_utc; report PENDING separately.
-- Implementation: SELECT earliest valid minute 50/65 per event, join verified
-- FINISHED results; compare the same time-stamped price to no-vig bookmaker.
-- Do NOT update the three frozen entries in sb_radar_profit_engine_candidates_v1.
