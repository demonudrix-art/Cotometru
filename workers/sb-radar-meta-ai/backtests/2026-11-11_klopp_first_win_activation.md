# KLOPP — FIRST WIN EXPERIMENTAL (11 noiembrie 2026)

## Owner-requested activation threshold
The production module in Cloudflare Worker `ghost-equal-alert-v1` was updated at 2026-11-11T13:07:56Z; deployment version `7f5f2da2-5222-4ac0-b94f-90b83114d108` received **100%** traffic.

The hourly Auto Tuner selects from its existing *non-proxy prospective filter families*, requiring:
- `n >= 1`, `w >= 1` (at least one **verified prospective WIN**)
- `loss_streak === 0` (most recently settled prediction was a WIN)
- strongest available virtual ROI among these, with larger `n` as a tie break.
- **Removed** prior gates of 25 results, 3 days, 6 recent results, positive conservative uplift and positive ROI as hard acceptance prerequisites. Thus the experimental selector can change more often and may pick an unprofitable model if all eligible candidates are poor.
- After a new selection or resuming from `PAUSED`, set `mode='EXPERIMENTAL'`, not `PROSPECTIVE_LEADER`; label the decision `FIRST_WIN_EXPERIMENTAL`. A chosen filter's *past* matches are never retroactively emitted as signals.
- Keep the existing **3 consecutive LOSS -> PAUSED** branch and one-hour hold. No modifications to actual staking, ticket registration or automatic betting.

## Immediate activation
At 2026-11-11T13:08:40.111Z, in D1 `beast-xray-history`, updated `sb_klopp_wave_active_v1`: `FAIR42 / PAUSED` -> `DROP_FAIR435 / EXPERIMENTAL`. Added audit record to `sb_klopp_wave_switches_v1`.

That decision was based on **2 WIN / 1 LOSS** with **+26.67% retrospective virtual ROI** on only 3 outcomes, so it is **not a validated edge**, and prospective outcomes may lose money. The source selector was evaluated on the most recent hourly prospective result table; older matching results were not replayed as live signals.

## Integrity checks
Verified: updated Worker source includes `n>=1&&w>=1&&loss_streak===0`, the old `n>=25` gate is gone, native three-loss pause is preserved, Cloudflare reports 100% deployment, and the D1/Durable Object/FCM bindings are retained.
This edit did not change the separate RADIO MOV/ROSU, AWAY57, KLOPP candidate collection or other scanners. **No betting transactions placed.**
