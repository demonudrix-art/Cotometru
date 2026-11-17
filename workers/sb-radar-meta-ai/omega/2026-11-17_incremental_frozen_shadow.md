# SB Radar META AI / OMEGA — incremental 2026-11-17 08:11 UTC

Read-only D1 beast-xray-history, frozen register 2026-11-15T13:06:20.277Z. This report updates the **same frozen candidates**, not new optimized thresholds. Earliest valid 0-0 snapshot per event/minute, valid 1X2 >1.001, join verified FINISHED outcomes, pending excluded from metrics. Date counts use UTC+2 (Europe/Bucharest in November).

| Frozen minute | Observed | Settled | Pending | Dates | W/L | Actual X | No-vig market X | ROI virtual 1u | Market Brier | Market log-loss |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| M50 | 117 | 115 | 2 | 3 | 50/65 | 43.48% | 37.06% | +3.08% | 0.241326 | 0.674504 |
| M65 | 80 | 78 | 2 | 2 | 37/41 | 47.44% | 46.24% | -12.67% | 0.230161 | 0.652128 |

Previous audit 2026-11-16 08:13 UTC: M50 96 settled, 42W/54L, +4.43%; M65 64 settled, 31W/33L, -9.91%. New net outcomes M50 +19 (8W/11L), M65 +14 (6W/8L); both virtual ROIs deteriorated. Across minute cohorts: 197 event-minute rows but only 124 distinct events (73 overlapping). Do not combine as independent bets. Frozen gates of >=150 settled unique events per minute and >=10 independent days NOT met. Minute-only candidates have no fitted model probability: Brier/log-loss above are market-only. No statistically reliable net advantage after slippage/costs, and no executable price or comparable CLV ledger. NO BET.

## ML restored cohort (separate from abandoned filters)
ML LOGREG V1 decisions since 2026-11-12T04:19:47Z, verified FINISHED, 1X2 valid and 0<pML<1: 511 decisions, 191 accepted (37.38%), 89W/102L, ROI virtual -6.01%. Model Brier 0.253215 vs market no-vig 0.239037; log-loss 0.699592 vs market 0.670714. Mean pML 52.40%, market 39.12%, realized X 42.07%: overconfidence. Previous audit 479 decisions, 178 accepted, 84W/94L, -4.51%; deterioration persists. The experimental evening >=0.60 view: 14 Nov 6W/9L -24.73%, 15 Nov 5W/4L +8%, 16 Nov 1W/0L +90% (n=1); no validation.

## LIVE alert cohort (different denominators from ML decision audit)
16 Nov GOLDEN CLASSIC 1W/1L ROI +5% (n2). 16 Nov ML LOGREG V1 4W/6L ROI -22.8% (n10 settled, 2 pending). These are actual alert records but ROI is virtual, not actual betting profit.

## Guardrails and next steps
No new family or threshold was trained/tuned. OMEGA_HAZARD_TEAM_POISSON_V1 remains BLOCKED_DATA pending reliable team identifiers and longer calendar history. No new owner-only insight: M50's already-unvalidated positive ROI is shrinking and no actionable robust pattern emerged. Continue frozen M50/M65 monitoring to >=150 settled per minute and >=10 independent dates, then evaluate uncertainty, chronology/embargo, multiple-testing correction, no-vig benchmark, slippage and net return. Momentum FIRST_SEEN must predate signals; no new model inference from backfill. No prematch motivation data read or collected. No changes to D1, live workers, APK, FCM, stakes, Slip, or filters.
