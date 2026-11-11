# SB RADAR · META AI (research lab)

Status: **research prototype only**, 2026-11-11. The controller code lives in `meta-selector.js`. It is not loaded by the production Cloudflare Worker and does not modify any active Radar, Radio Mov/Rosu, KLOPP, or Away57 model. It neither places bets nor sends notifications, modifies slips, or writes D1.

## Goal

A **supervisor of independently validated predictive models**, not 100 copies of the same signal. The existing D1 contains approximately 355k sampled Radar frames, 266k pre-match quotes, 91k live snapshots, and 7.4k result records. These counts are **not** independent training examples; effective sample size is the number of distinct games with verified final results and complete as-of features.

## Model families (research candidates, NOT trained here)

- Price-only 1/X/2 implied probabilities (mandatory bookmaker baseline)
- Logistic / multinomial regularized model
- Gradient-boosted trees
- Random forest
- Simple sequence model of 1/X/2 price changes
- Separate Generosity drift / spike
- 57-minute snapshot model
- Pressure/momentum trend (only where collected, no post-event leakage)
- League-level hierarchical priors with shrinkage
- Calibrated stacked ensemble with separate out-of-sample data

The controller treats models from the same family as correlated and only admits its strongest validated member. Adding more models alone does not improve evidence.

## Four strict checks

1. Train and evaluate **chronologically**; each prediction must use only data available at its capture timestamp. Group match IDs to prevent the same game's later snapshots contaminating training.
2. Validate independently **on untouched forward windows**. Brier / log loss must beat the price-only benchmark on the **same events**, with calibration and selection rate reported.
3. Admit models with sufficient independent samples, freshness, and acceptable drift. Conservative odds-based EV uses a haircut; the heuristic is not a mathematically guaranteed confidence interval.
4. Permit **ABSTAIN** for most matches. Never choose high past ROI by searching hundreds of combinations and then report it as prospective profit.

## Separate research objectives

- **VALUE**: maximize risk-adjusted expected value after estimation error; requires strong calibration.
- **HIGH_WIN**: maximize hit rate while imposing a minimum value condition. Hit rate alone is insufficient because short odds can lose money.
- Selection thresholds are **research defaults** and require prospective calibration. The current code permits no production alert.

## What is implemented today

- Read-only, deterministic `evaluateMetaAI(snapshot, modelOutputs, policy)` pure function.
- Model provenance checks, chronological timestamps, out-of-sample sample count, relative Brier improvement, calibration error and drift.
- One model per correlated family, reliability weighting, 30% market-prior shrinkage.
- Research-only candidate / no-candidate outcomes, diagnostic reasons, no betting or notification hooks.
- Tested: no models -> abstain; 2 distinct validated families -> research candidate; same correlated family -> abstain; tiny test set -> abstain.

## What is NOT implemented

- **No 100 trained models**, no live data feeding this module, no periodic autonomous learning, no proven ROI or win rate.
- Future steps: data quality and event-time join audit; model training offline; fixed chronological walk-forward; independent validation; prospective shadow mode; compare with Away57, KLOPP, Radio Mov/Red, and market baseline without changing their behavior.
