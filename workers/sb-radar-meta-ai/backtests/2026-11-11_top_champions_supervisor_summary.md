# META AI TOP — 11 noiembrie 2026 (offline, read-only)

## Important
This is not a live predictor or betting system. **Do not promote any model to production.**
The full reproducible scripts + private predictions were delivered to the user as the conversation artifact `SB_Radar_META_AI_TOP_Modele_14_zile_2026-11-11.zip`. Private CSV/D1 rows are NOT committed to the repository.

## Data and training
Source: own SB Radar local historical 57-minute archive, October 29–November 10, 2026. 1,595 verified distinct events after integrity checks.
Features: X odds pregame and minute 57, generosity H/A pregame, minutes 47 and 57, changes and 57 score. Separate binary 1/X/2 outcomes derived from final match scores.
Models actually fitted: XGBoost, LightGBM, CatBoost, ExtraTrees, HistGradientBoost and Logistic L2, with score+X-price logistic control.
Train 29 Oct–5 Nov: 871; embargo 6 Nov:124; DEV 7 Nov:277; separate holdout 8–10 Nov:323.
META selected CatBoost + ExtraTrees + XGBoost by DEV Brier X only. Rule: 2/3 advise EV>=5%, model spread <=0.10, blended p=60% 3-model mean + 40% control, EV>=8%, X odds 1.85–3.50.
**Holdout META X: 45 picks, 16 WIN / 29 LOSS, ROI -21.73%, Brier X 0.240826**, vs control X Brier 0.238010.

## Chronological rolling assessment
Fixed top three XGBoost + LightGBM + CatBoost, 1 full calendar-day embargo, retrain each test day 2–10 Nov; 962 event predictions.
Brier X: XGBoost 0.244364, LightGBM 0.247648, CatBoost 0.239692, price+score control 0.238387, META 0.239146.
Virtual X ROI: XGBoost -8.00% (148/211), LightGBM -7.20% (159/226), CatBoost -10.57% (129/196), META **-15.90% (58 WIN / 95 LOSS, 153 selections)**.
No estimated profitable X algorithm survived.

## Away win (2), strictly limited evidence
Cloudflare D1 first-57 odds joined by event ID and 60s capture tolerance for Nov8–10: 40 candidate odds, 38 verified unique matching cases at 1–1. Rule baseline: 17 WIN/21 LOSS, +15.63% simulated ROI at historical 2 odds.
Individual model replay: XGB 4/6 -8.30%, LGBM 7/7 +29.79%, CatBoost 5/4 +33.00%, ExtraTrees 7/5 +45.17%, Logistic L2 8/7 +22.13%.
META selected on DEV Away Brier (Logistic+ExtraTrees+CatBoost): 1 WIN/0 LOSS, 1 selection; rolling fixed 3 (XGB+LGBM+CatBoost): 0 WIN/1 LOSS, 1 selection. Both n=1 have zero evidential value for future ROI. Single-snapshot price execution and quote availability were not verified. These historical samples were previously explored.

## Decision / next steps
**HOLD / NO SIGNAL**. Require time-aligned full 1/X/2 odds throughout historical train, DEV, and future prospective shadow mode. Do NOT retrofit future outcomes to live signals. Compare calibration and Brier to complete 1/X/2 no-vig market on identical events, report no-signal counts, uncertainty, day/league drift and execution slippage. Retest on fresh data unknown when parameters were set. Preserve all negative historical results.

No Cloudflare Worker, D1, APK, Radio Mov/Roșu, KLOPP or Away57 production behavior was changed by this experiment.
