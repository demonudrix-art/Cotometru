# SB Radar Profit Engine — first execution (2026-11-15 12:48 UTC)

Production: SB Radar only GOLDEN CLASSIC / ML LOGREG V1. The new module `shadow/sb-profit-engine-shadow.js` is hourly **shadow-only**, deployed via the existing production Worker cron. It cannot place real bets, send notifications, change stake size, or alter live model thresholds. D1 tables: `sb_radar_profit_engine_candidates_v1`, `sb_radar_profit_engine_observations_v1`, `sb_radar_profit_engine_runs_v1`. Immutable freeze 2026-11-15T12:48:34.203Z. Three candidates: ML score>=0.60, ML score>=0.60 with score minus normalized 1X2 market X probability >=0.15, GOLDEN CLASSIC odds X in [1.85,2.15]. New eligible events after freeze are snapshotted before their outcome; verdicts arrive separately from verified FINISHED results. No retrospective row is to be counted as prospective evidence.

## Historical diagnosis (not validation for these rules)

Earlier 2026-11-15 META AI audit: 306 comparable verified ML decisions after restore, 45W/57L on 102 accepted, model Brier 0.250909 vs no-vig market Brier 0.227593, -11.12% virtual ROI. The 15-Nov later snapshot (331 verified restored decisions) gives Brier ML 0.250402 vs market 0.228091; 25% ML / 75% market blended Brier 0.230046, still worse than market. Older 31-Oct through 2-Nov records (n=189): ML Brier 0.244235 vs market 0.258925. Regime instability means there is no robust selection advantage.

Historical backtest on accepted ML decisions, split as pre-restore, restored 12–13 Nov, 14–15 Nov: for the strict ML score>=.60 plus edge>=.15 challenger, n=18/7/27, W=13/5/11, virtual units +8.94/+2.72/-5.56, respectively. For GOLDEN price-only band [1.85,2.15] split similarly: n=22/0/4, W=14/0/4, virtual units +6.70/0/+3.82. These are small, overlapping, partly post-hoc cohorts, not grounds to promote a candidate.

## Promotion controls

Minimum 100 settled selections and 7 independent days for each ML candidate; 80 settled selections and 14 independent days for Golden. Additionally compare baseline using same events and captured prices, track no-signal hours, cluster by match/day, check drawdown, Brier, log-loss and execution latency. Review multiple testing, bookmaker acceptance, and independent operator-confirmed P&L. Until verified, all stay SHADOW; no auto-promotion or increase in risk. Existing hourly defensive stake policy remains ML 10 lei and Golden 25 lei in SB Radar internal Slip, not confirmed Superbet wagers.
