# SB Radar META AI — audit incremental read-only, 13 noiembrie 2026, 07:45 UTC

## Cohort and provenance
Only post-restore `captured_utc >= 2026-11-12T04:19:47Z` observations, Cloudflare D1 `beast-xray-history`, view `sb_radar_df57_primary_v2`, plus **production-recorded** `sb_radar_ml_decisions` for model_version `SB_RADAR_ML_LOGREG_V1`. Unique `event_id` (160 archive rows and 43 ML decisions, no duplicates in these cohorts). This is an *incremental observational holdout*, not a new model training or independently proven walk-forward advantage. Predictions and odds were captured before outcomes, but final-result verification, completeness and actual alerts require separate audit. Never join older inactive filters to this cohort.

## New archive evidence
- Archive: **160 unique events**, **156 settled** (30 WIN / 126 LOSS for draw-X), **4 PENDING**, last capture 2026-11-13T07:32:03.426Z. Only **36** had score 0–0 at capture, so generic archive outcome totals must **not** be interpreted as 0–0-at-57 strategy results.
- Observable GOLDEN CLASSIC criteria `priced_zero_57=1 AND paired_zero_history=1 AND generosity_both_low=1 AND generosity_both_drop=1 AND red_before_57=0`: **2 candidates**, **2 WIN / 0 LOSS**, virtual net **+1.95 units** at archived X odds 2.00 and 1.95; ROI **+97.5%** (two matches only, extreme sampling uncertainty). IDs 15673296, 15756350. This is archive-derived eligibility, **not** proof of actual production alert delivery.
- Prior 2026-11-12 audit had only 6 post-restore rows, 5 settled and zero Golden matches. This run therefore has materially new independent outcomes.

## LIVE ML LOGREG V1 decision ledger
- **43** distinct recorded decisions, **13 accepted** and **30 rejected**. Of those, **39 settled** (15 WIN, 24 LOSS), **4 pending**. All 13 accepted settled: **9 WIN / 4 LOSS**, virtual **+5.29 units** at **decision-recorded** X odds, ROI **+40.69%** on accepted selections, **33.33% selection rate among settled** (13/39), **30.23% among all decisions** (13/43). No bets implied.
- Market baseline: normalized `(1/px)/(1/p1+1/px+1/p2)`. On **all 39 settled decisions**, ML Brier **0.217748**, log-loss **0.626633**; market Brier **0.214738**, log-loss **0.619267**. Thus **market is better** by Brier 0.003010 and log-loss 0.007366. Do not claim general ML improvement.
- Calibration-in-the-large on same 39: ML mean predicted **49.65%**, realized **38.46%**, market mean **37.86%**. ML overpredicts draw probability by **11.19 percentage points** in this short cohort; market mean within 0.60 pp of observed.
- Accepted-only 13: model mean predicted **58.12%**, normalized market **43.75%**, realized **69.23%**. Rejected-only 26: 6 WIN / 20 LOSS; model mean **45.42%**, market **34.92%**, realized **23.08%**. Rejected-only hypothetical net if indiscriminately backing them: **−11.06 units**, not actual signals.
- Observational daily ML decisions: Nov 12: 36 decisions (11 accepted, 34 settled); Nov 13: 7 decisions (2 accepted, 5 settled). **Only ~1 day of live evidence**, insufficient for embargoed multiple-day out-of-sample inference or a robust profit claim.

## Methodological comparison (maximum 2 approaches)
1. **Fixed pre-existing ML LOGREG V1** versus normalized contemporaneous 1X2 market probability on all 39 settled decision records: market wins Brier and log-loss, despite accepted-only positive virtual ROI.
2. **Fixed pre-existing GOLDEN CLASSIC** rule as an independent archive-derived eligible subset: 2 settled selections, both WIN; statistically too few for predictive metrics with meaning or stability. Its overlap with ML accepted selections means do not sum them as independent outcomes.

No threshold fitting, reweighting, new model training, hyperparameter search, cherry-picked splits or retrospective selection. Event ID deduplication verified; a chronological multi-window/embargo walk-forward **cannot be established from a single post-restore day**. Negative scores retained; no calibrated profit claim.

## Decision
Real new data and a positive **very preliminary** accepted-only virtual result, but **no robust demonstrated edge**. Continue prospective accumulation and compare pre-registered models without changing production. No D1/Worker/APK/filter edits, notifications of bets, or bets placed.
