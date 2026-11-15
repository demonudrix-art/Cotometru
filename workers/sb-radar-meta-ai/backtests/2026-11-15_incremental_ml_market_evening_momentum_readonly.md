# META AI — audit incremental 2026-11-15, 07:41 UTC

Scope: Cloudflare D1 `beast-xray-history` (b760fd71-b051-4c55-a734-108f494e7b7d), `demonudrix-art/Cotometru/workers/sb-radar-meta-ai`. Read-only evaluation; only two LIVE filters since 2026-11-12T04:19:47Z: GOLDEN CLASSIC `SB_GOLDEN_CLASSIC_00_M57_1PP_V1` and ML LOGREG V1 `SB_RADAR_ML_LOGREG_V1`. Historical models are not mixed in. No worker, filter, stake, APK or betting changes.

## Incremental new outcomes and a reversal of the apparent ML advantage

ML decisions `sb_radar_ml_decisions` (unique `event_id`, `evaluated_utc>=2026-11-12T04:19:47Z`, model_version exact) joined to `match_results` (verified=1, event_status='FINISHED', winner_1x2 in X/1/2) and restricted to valid decision-time 1X2 odds (p1,px,p2>1) and 0<ml_score<1:

- 317 decision records, **306 valid verified and comparable**, 11 excluded/pending/invalid; 102 accepted among comparable (**33.33%**), **45 WIN / 57 LOSS**, **-11.12% virtual ROI** on accepted decision-time odds, unit stakes. This is a decision-table subset, not necessarily identical to actually emitted BET_NOW alerts.
- Overall 306: **Brier ML 0.250909 vs no-vig market 0.227593**, **log-loss ML 0.695119 vs market 0.647168**. ML mean probability 52.43%, no-vig market 39.15%, realized X 37.25%. This is negative predictive evidence for ML and substantial overestimation; it reverses the *partial* 14-Nov 07:20 UTC positive comparison.
- Daily splits (Europe/Bucharest, UTC+02 for November), on verified valid decisions:
  - Nov 12: n=33, accepted 10, 7W/3L, ROI +41.50%; Brier ML .222426 / market .218658; log-loss .636717 / .628311.
  - Nov 13: n=63, accepted 18, 11W/7L, ROI +25.39%; Brier .241414 / .261138; log-loss .676076 / .716345.
  - Nov 14: n=186, accepted 69, 25W/44L, ROI **-27.80%**; Brier **.258013 vs .215788**, log-loss **.709610 vs .622826**.
  - Nov 15 partial: n=24, accepted 5, 2W/3L, ROI -17.60%; Brier .259942 vs .243309, log-loss .713102 vs .680161.
- Aggregation: one row per event_id (primary key); model score and p1/px/p2 from `evaluated_utc` only; no final-state inputs in features. Market no-vig p(X)=(1/px)/(1/p1+1/px+1/p2). Brier mean((p-y)^2), log-loss mean(-y log p-(1-y)log(1-p)). No retraining, feature tuning or threshold selection. Day 15 incomplete. This is prospective observational scoring of a fixed model, not a new walk-forward training experiment with independently verified embargo. Cluster uncertainty, multiple-testing and incomplete data preclude a definitive claim that *no* profitable future model can exist. The current model does not show robust advantage.

## Second methodological test: evening ML>=0.60 shadow

View `sb_radar_ml_evening_ge060_shadow_v1` marks PROSPECTIVE only for triggered_utc >= 2026-11-13T18:40:47Z; local 18:00-23:59, DST-aware. **15 unique prospective events**, all verified: **6W/9L, -24.73% virtual ROI** at captured odds. No-vig 1X2 expected **6.918 X** over these 15, vs 6 actual; ML mean score **62.89%**. All 15 model decision timestamps precede signals. This is one new prospective local day (Nov 14) and an unpromising outcome, **not** sufficient to statistically reject every future version. Historical/retrospective rows are not counted as evidence for this prospectively frozen rule. No activation.

## LIVE alert stream (different from decision table)

From `sb_radar_competition_daily_live_v1` (BET_NOW alerts), local Nov 14: GOLDEN CLASSIC 13 settled = 5W/8L, weighted virtual ROI -28.08%; ML 62 observed, 58 settled = 20W/38L, 4 pending, weighted virtual ROI -30.26%. Nov 15 partial: Golden 2 observed, 1 settled LOSS, 1 pending; ML 5 settled = 2W/3L, -17.60%. Earlier Nov 12-13 remained positive but samples were small. The `sb_radar_competition_daily_baseline_v1` archive is NOT live: Nov 14 LEAGUE 107 settled, 37W/70L, no-vig expected 43.65 W, ROI -23.4%; CUP 20 settled, 7W/13L, expected 7.50 W, ROI -19%. League and cup were both negative; no format-based filter promoted.

## Momentum audit (new capture data; no model promotion)

`sb_radar_momentum_polls_v1`: 18,297 rows, latest 2026-11-15T07:24:48.859Z; `sb_radar_momentum_points_v1`: 33,211 rows, latest 07:20:48.779Z; `sb_radar_momentum_event_stats_v1`: 3,846 rows, latest 07:20:49.509Z. Distinct live post-restoration alerts with pre-signal points from minutes 45–56 and FIRST_SEEN<=triggered_utc: GOLDEN 8/18, ML 44/92. Pre-signal LIVE event-stat coverage GOLDEN 8/18, ML 45/92. Therefore no statistically credible new Momentum discrimination/Brier/ROI estimate; backfilled points and stale `sb_radar_momentum_active_filter_research_v1` (old MOV/ROSU) excluded. Do not extrapolate or join backfill as predictors.

## Validation and next actions

1. Flag the adverse ML calibration and Nov 14 virtual ROI drawdown as WARNING in owner-only research insights. Continue chronological daily evaluation, group by match ID and date/competition; estimate cluster bootstrap intervals after enough independent prospective days. Do not alter LIVE ML automatically.
2. Flag evening shadow as REJECTED for promotion at current evidence, not a universal rejection of the hypothesis; keep accumulating genuinely future matches, no threshold retuning.
3. Continue FIRST_SEEN-only Momentum coverage collection and reject features first captured after the signal. No parallel pre-match motivation investigation.
4. No two new model families were trained. The two methodological tests are ML decision-time vs market and pre-registered evening threshold; Momentum is data-integrity monitoring only.
5. Negative evidence retained; no claim of validated profitable model, no alerts or bets placed by this audit.
