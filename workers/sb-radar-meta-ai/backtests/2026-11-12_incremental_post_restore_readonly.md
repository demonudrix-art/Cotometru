# SB Radar META AI — read-only incremental check, 2026-11-12 10:00 Europe/Bucharest

## Cohort boundary
Production restoration timestamp: **2026-11-12 04:19:47 UTC**. LIVE sources from this point: GOLDEN CLASSIC `SB_RADAR_GOLDEN_V2` / `SB_GOLDEN_CLASSIC_00_M57_1PP_V1`; ML LOGREG V1 `SB_RADAR_ML_LOGREG_V1`. Previous Radio, Klopp, Away57, etc. **excluded**. This report does not imply those older families are active.

## Fresh D1 observations
Read-only queries to `beast-xray-history`, `sb_radar_df57_primary_v2` and `match_results`:
- **6 distinct post-deployment 57-minute archive captures** (2026-11-12 04:22:40–07:30:03 UTC).
- **5 settled / verified archive matches, 0 WIN and 5 LOSS** for unconditional draw-X; **1 PENDING**.
- **10 independently verified final-result records** checked since deployment, of which **5 join** these post-deploy 57-minute captures.
- Archive total currently 5,423 distinct events, of which 1,214 WIN and 4,184 LOSS; these are historical totals and **must not** be mixed into the restored-live cohort.
- **0 Golden Classic candidates** among the six new captures when evaluating observable criteria `home_score=away_score=0`, `gh<0.30`, `ga<0.30`, both prior-current drops at least 0.01, `red_before_57=0`. Therefore **0 Golden Classic selections / 0 WIN / 0 LOSS** in this *archive-derived check*, not an assertion about the production alert ledger.
- Captured odds in the five settled archive rows: 3.35, 2.25, 45, 3.8, 125; two very high odds coincide with nonzero final scores and highlight why market/eligibility constraints matter. No hypothetical wager is claimed.
- The ML LOGREG production signal cohort was not verified in this run; do **not** infer its alerts or performance from generic archive rows.

## Decision
**No new ML family promoted or reoptimized.** Five settled new captures are insufficient for an independent chronological, embargoed, event-ID-grouped validation; no fresh Brier/log-loss/calibration or prospective ROI is claimed. No comparative model search was performed on the same historical outcomes, to avoid multiple testing. Explicit negative observations and the zero-selection case are retained.

## Next read-only evaluation
Accumulate post-deployment cohort with event ID, captured prediction timestamp, odds 1/X/2, source, model version, model score, final verified result, and unique signal ID. When enough *new* independent results exist, compare no more than two prespecified approaches against normalized market probability using chronological split, match-ID grouping, embargo, Brier, log-loss, calibration, selection rate, WIN/LOSS and ROI at recorded odds, including zero-alert cases. Never use results unavailable at prediction time.

No D1 mutations, Worker/APK changes, filter reactivation, notifications, or bets.
