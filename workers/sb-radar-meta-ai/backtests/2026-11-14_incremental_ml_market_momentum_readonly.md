# META AI — incremental read-only audit, 2026-11-14 07:20 UTC

Scope: Cloudflare D1 beast-xray-history; live models ONLY SB_GOLDEN_CLASSIC_00_M57_1PP_V1 and SB_RADAR_ML_LOGREG_V1. Post-restoration cutoff 2026-11-12T04:19:47Z. No worker/filter/betting changes.

## New data and ML versus market
The last ML decision was 2026-11-14T07:17:01.881Z. 117 unique ML decision event_ids since the restoration, 112 verified finals, 5 pending; 33 accepted settled = 20 WIN / 13 LOSS, +7.72 units retrospective ROI +23.39% on the accepted decisions, with 33/112 = 29.46% selection rate among settled. Results from 13 Nov after the prior audit cutoff 07:45:57Z: 74 decisions, 69 settled, 20 accepted settled (11 WIN / 9 LOSS, +2.43 units). Golden Classic live alerts: 6 distinct events, 4 WIN / 1 LOSS / 1 pending, +2.80 units, not a statistically established edge.

All 112 settled ML decisions: Brier ML 0.235265 vs no-vig 1X2 market 0.243420; log-loss ML 0.663027 vs market 0.679471. Mean ML p(X) 0.50700, mean market p(X) 0.38146, realized X frequency 51/112 = 45.54%. The ML score is still overconfident in the aggregate despite improved aggregate Brier/log-loss. Daily split:
- Nov 12: 33 settled, Brier 0.222426 ML vs 0.218658 market, log-loss 0.636717 vs 0.628311; ML worse.
- Nov 13: 63 settled, Brier 0.241414 vs 0.261138, log-loss 0.676076 vs 0.716345; ML better.
- Nov 14 partial: 16 settled of 21 decisions, Brier 0.237530 vs 0.224730, log-loss 0.665906 vs 0.639797; ML worse.

The comparison uses ML decision-time odds p1/px/p2 normalized to sum to 1, grouped by unique event_id via the primary-key ML decision table, and verified match_results. No retraining, hyperparameter tuning, feature selection or optimization was done on the new holdout. This is a sequential observational comparison, NOT a fresh independent walk-forward model fitting experiment or proof of stable ROI. Pending excluded from scored metrics, and outcomes are potentially correlated by competition/date. More distinct prospective days, explicit time embargo and bootstrap uncertainty by match day/competition are required before any live change.

## Evening shadow (18–24 local, ML>=0.60)
Prospective start is 2026-11-13T18:40:47Z. The view has ZERO prospective selections. Historical/retrospective rows are 10 on Oct 31, 1 on Nov 12, 1 on Nov 13. Prospective WIN/LOSS and ROI are undefined, NOT 0% ROI. Do not activate or infer advantage.

## Competition-format replay
Baseline archived 0-0 at minute 57 (not live signals): CUP Nov 10: 0W/5L vs market 1.87 expected; Nov 11: 1W/9L vs 3.82 expected; Nov 12: 2W/2L vs 1.41 expected; Nov 13: 4W/3L vs 2.64 expected. The preexisting Nov 10-11 CUP anomaly did not persist in the next two days. LEAGUE Nov 12: 4W/15L vs 7.54 expected, Nov 13: 10W/14L vs 9.44 expected, Nov 14 partial 2W/5L vs 2.77 expected. Classification and match-phase quality remain limitations. No post-hoc promoted model. These baseline counts must not be confused with LIVE or ML replay.

## Momentum feature-shadow integrity
13,045 polls (latest 2026-11-14T07:19:49.667Z), 26,633 points (latest 07:19:49.667Z), 2,839 event-stat rows (latest 07:19:50.874Z). For the live post-restoration alerts, only 3/6 Golden and 15/31 ML distinct alerts had a point from minute 45–56 with first_seen_utc <= signal_utc; backfilled minute 45–56 points exist for 1 Golden and 7 ML events and MUST be excluded from predictive features. Event stats captured LIVE before signal cover 3/6 Golden and 15/31 ML. The view sb_radar_momentum_active_filter_research_v1 is STALE: it explicitly filters old SB_GOLDEN_ACTIVE_3_TIERS_M57_V2 and classifies MOV_STRONG_SILVER/ROSU_STRONG. Its 20 rows run Nov 5–9, so it is NOT valid evidence for the restored active filters. Do not change this view in this research task; build a read-only query of live alert model_version and timestamped FIRST_SEEN features before attempting discrimination/Brier/ROI.

## Validation / decisions
No new ML family trained or promoted. Two methodological audits only: (1) incremental decision-time ML-vs-market daily monitoring; (2) timestamp-safe momentum coverage. No extra betting notifications, no production modifications. No advantage validated.
