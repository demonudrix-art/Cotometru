# OMEGA — cercetare profesionistă SB Radar, prima execuție
**Data:** 2026-11-15 (UTC); **status:** exploratory, no verified positive edge.
**Scope:** Cloudflare D1 beast-xray-history; only aggregate outputs, read-only historical tables. No live filter, Android, stake, bookmaker, FCM or scan settings changed.

## Mandatory separation
- Market/no-vig probabilities are **benchmarks**, not independently estimated true probabilities.
- D1 historical capture P&L is **virtual**, not externally operator-confirmed money.
- A matched signal followed by a shorter X price 1–4 minutes later while score remains 0–0 is NOT closing-line value: time passing with 0–0 naturally affects the odds.
- Candidate promotion requires independent future dates, good score calibration, nonnegative net ROI at executable prices after costs, and multiplicity-adjusted evidence. No profit guarantee.

## Live data inventory as inspected
- `quote_snapshots`: 341,698 rows across 8,966 matches.
- `live_snapshots`: 230,101 rows across 6,989 matches.
- `match_results`: 9,337 rows, of which **8,178** are verified `FINISHED`, across 955 tournaments; kickoff range 2026-10-21 to 2026-11-15. Valid score fields for 8,154 / 8,178. This is a **short calendar history**, not multi-season training for team-strength Poisson.
- `sb_radar_ml_decisions` and `ghost_equal_alerts` are distinct; do not confuse model decisions with delivered BET NOW signals.

## Study A — 0–0 moment-of-entry benchmark
Precondition: score 0–0, valid 1X2 odds, minute in 40/50/55/57/60/65/70, captured at or after Nov 2. Select earliest valid snapshot **per event_id and minute**, group by minute, join verified FINISHED result, evaluate virtual unit stake on X. Same match may contribute to different minutes — **groups are not independent**. This is a retrospective exploratory comparison, not a prospective rule.

| Minute | Settled n | X wins | X rate | No-vig market p(X) | Mean odds X | Virtual ROI |
|---:|---:|---:|---:|---:|---:|---:|
| 40 | 666 | 207 | 31.08% | 31.43% | 2.998 | -12.93% |
| 50 | 388 | 137 | 35.31% | 36.24% | 2.540 | -14.01% |
| 55 | 303 | 117 | 38.61% | 38.77% | 2.366 | -11.75% |
| 57 | 334 | 126 | 37.72% | 39.59% | 2.330 | -16.06% |
| 60 | 269 | 111 | 41.26% | 41.36% | 2.222 | -11.34% |
| 65 | 247 | 110 | 44.53% | 44.61% | 2.059 | -9.42% |
| 70 | 210 | 98 | 46.67% | 48.40% | 1.877 | -14.82% |

**Interpretation:** unfiltered 0–0 draw betting was negative at each examined minute. Later minute 65 is not proven superior since cohorts differ and there is selection/survival bias.

## Study B — fixed simple time-only calibrated blend, train/test split
Before evaluating test data, fixed formula: `p = 0.75 * p_market_no_vig + 0.25 * (train_draws + 4)/(train_matches + 10)` using exact-minute training group; Laplace-like prior 40% with 10 pseudo-games. Training captures 2026-11-02 through Nov 10 inclusive; test Nov 11–15 inclusive. Uses earliest valid 0–0 snapshot per match/minute; joins verified final score only for target. Scoring Brier (smaller better). No real bet executed.

| Minute | Train n | Test n | Test WIN | Market Brier | Blend Brier | Edge>5% simulated count |
|---:|---:|---:|---:|---:|---:|---:|
| 40 | 226 | 440 | 138 | .210160 | .210829 | 11 |
| 50 | 106 | 282 | 101 | .225547 | .225973 | 4 |
| 55 | 76 | 227 | 90 | .235191 | .235690 | 4 |
| 57 | 104 | 230 | 82 | .228456 | .228908 | 6 |
| 60 | 70 | 199 | 82 | .240235 | .239999 | 4 |
| 65 | 70 | 177 | 80 | .245758 | .245621 | 1 |
| 70 | 63 | 147 | 71 | .241247 | .242817 | 0 |

The blend loses to market in 5 of 7 minute groups and two narrow improvements are unlikely to be robust. The edge threshold is an exploratory simulation, not a proposed live rule. Model is **not validated**.

## Study C — don't confuse line drift with CLV
On alerts since restoring live filters Nov 12: 18 Golden signals (16 comparable next-price), 108 ML signals (96 comparable). Comparing signal X odds to first valid X quote 1–4 minutes later while still 0–0:
- Golden: average initial/next odds -1 = +0.99%; 56.25% prices shortened.
- ML: +1.87%; 67.71% prices shortened.
- Unfiltered 0–0 minute 57: 235 eligible, 221 comparable; +1.06%; 66.52% prices shortened.

**Interpretation:** odds shortening is common in all 0–0 cohorts as time passes; it is NOT evidence of informed betting or an exploitable closing-line advantage. For true execution quality measure include quote freshness, bookmaker matched accept/price timestamps, status and follow-up score state.

## ML forecast audit (separate cohort)
Previous 2026-11-15 audit, valid verified restored decisions: Brier ML .250909 vs no-vig market .227593 (n=306); later n=331 Brier ML .250402 vs market .228091; 75% market/25% ML Brier .230046 (still worse than market). Historic Oct31–Nov2 n=189 ML Brier .244235 vs market .258925. Dramatic temporal drift; does not justify retrofitting threshold on the test days. Robust out-of-time validation is required.

## Prospective freeze (no extra work on scanner)
D1 `sb_radar_omega_research_register_v1` created with frozen rules starting at 2026-11-15T13:06:20.277Z:
- `OMEGA_M50_00X_BASE_V1`: shadow baseline all valid 0–0 minute 50, target >=150 distinct settled events over >=10 independent days.
- `OMEGA_M65_00X_BASE_V1`: same for minute 65.
- `OMEGA_HAZARD_TEAM_POISSON_V1`: **BLOCKED_DATA** until long enough independent historical calendar and normalized team IDs. Never claim untrained models work.

The existing hourly worker `sbProfitShadowTick` continues monitoring its **three separate frozen candidates**, but its D1 config table cannot be extended without a code review (it asserts exact candidate count 3). This OMEGA registry is distinct and handled by the existing daily research task. Raw snapshots already stream to D1; do not add duplicate scheduled scanners or Workers.

## Decision and next research
1. **No automatic live model promotion.** Retain current ML/Golden as baselines; do not increase financial risk based on virtual P&L.
2. Add execution-confirmation ledger: real bookmaker acceptance/time/price is not yet evidenced by D1 auto-slip. Separate virtual, manual and operator-confirmed results.
3. Investigate high-quality external price feeds / exchange markets as benchmark *only when access and lawful terms exist*. One Superbet source does not reveal the true sharp closing line.
4. Use a strictly chronological time-to-goal/hazard model with time- and league-conditioned shrinkage and no leakage once enough data exists.
5. Continue out-of-time daily evaluations; cluster by event/day, adjust for multiple tested approaches (White's Reality Check), report confidence intervals and no-bet selection frequency.
6. The biggest immediate professional win is **better decision quality and a verified P&L ledger**, not increasing the number of alert bets.

## Public research consulted
- Dixon & Coles (1997), *Modelling Association Football Scores and Inefficiencies in the Football Betting Market*: https://doi.org/10.1111/1467-9876.00065
- White (2000), *A Reality Check for Data Snooping*: https://doi.org/10.1111/1468-0262.00152
- Gneiting & Raftery (2007), *Strictly Proper Scoring Rules, Prediction, and Estimation*: https://doi.org/10.1198/016214506000001437
- *Optimal sports betting strategies in practice: an experimental review* (2021): https://doi.org/10.1093/imaman/dpaa029

A positive outcome in a paper or on another market does not prove a strategy works in SB Radar.
