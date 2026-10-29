# GHOST EGAL — Android PWA + Cloudflare Worker

**URL:** https://ghost-equal-alert-v1.drix-beast-xray.workers.dev/

Standalone Worker `ghost-equal-alert-v1`, using the existing `beast-xray-history` Cloudflare D1 database. It leaves `beast-xray-live-v2` and `beast-ghost-pattern-v1` untouched.

## Production rules (locked to the 29 Oct 2026 historical backtest)

- Score **0–0** currently and in the previous sample.
- First actionable signal at minute **57** (through 78 in the implementation).
- Prior sample **7–15 match minutes** behind, nearest to 10 minutes and no older than 20 wall-clock minutes.
- Both Superbet generosity curves decreased at least **0.01**.
- Observed live odds **X >= 1.75**, **1 >= 1.80**, **2 >= 1.80**.
- PREPARE at minutes **50–56** when everything except the minimum entry minute qualifies. BET NOW is a fresh recheck from minute 57.
- One PREPARE and one BET NOW alert at most per match.
- Source field mapping follows the existing BEAST live collector: `market.id=547`, `inPlayStats`, `generosity_prob_home`, `generosity_prob_away`.
- Source outages or missing values: **no alert**. The odds in push notifications are snapshots; check the current 1X2 market at Superbet before betting.

## Architecture

`Cloudflare cron 1m → Superbet in-play JSON (fixture + market 547) → isolated ghost_equal_samples + prior 7–15m comparator → ghost_equal_alerts → Web Push (VAPID) → Chrome Android service worker / installed PWA → Superbet LIVE`

`v_ghost_equal_forward_audit` joins BET NOW signals with independently verified `match_results` for a **hypothetical 50 lei stake**, separate from executed bets. Historical backtest: 15 wins / 5 losses, +566.50 lei hypothetical, not a validated forward return.

## D1 tables

`ghost_equal_samples`, `ghost_equal_alerts`, `ghost_equal_devices`, `ghost_equal_runs`, `ghost_equal_push_keys`. Source of record: `quote_state` and `match_results`. Do not edit other BEAST datasets.

## Android Samsung S24 Ultra

1. Open the URL above in **Chrome**.
2. Enter the pairing code supplied privately in chat. The generated device bearer token stays in local storage.
3. Tap **Activează notificările Android**, approve notifications, and use **Testează notificarea**.
4. In Chrome menu select **Add to Home screen / Install app**. Ensure Android Notifications are enabled for the installed app/Chrome. Remove battery restrictions if the device suppresses push.
5. Tapping a notification goes to the verified Superbet football LIVE landing page. An event-specific deep link has **not** been verified, so none is fabricated.

## Operations and limitations

- Runs every minute; cron configuration propagation can take up to 15 minutes.
- Depends on Superbet public feed compatibility and Cloudflare cron; the specific 57th minute cannot be guaranteed exactly.
- Subscription private key is generated server-side and persisted in D1; restrict D1 access and plan secret rotation.
- Web Push delivery depends on browser, FCM connectivity, Android notification permissions, and battery restrictions. Not yet tested on user's physical S24 Ultra.
- Alerts are informational, not auto-bets. No automatic placement, and a profitable retrospective backtest is not evidence of future profits.
