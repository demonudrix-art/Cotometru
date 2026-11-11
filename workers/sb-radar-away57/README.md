# AWAY 57 — server production integration (2026-11-11)

Owner-only experimental research lane for **1–1 at 57′ -> away win (2)**. **Never auto-place bets.** The suggested stake is **2 lei**, not a live balance change.

## Source
- `sb-away57.js` is the isolated Cloudflare Worker module (model weights, trend features, D1 scanner, historical read-only replay, owner-only API, UI injection).
- Production Worker: `ghost-equal-alert-v1`, D1 binding `DB` to `beast-xray-history` (`b760fd71-b051-4c55-a734-108f494e7b7d`).
- Model version `AWAY57_LOGREG_L2_0015_20261105_V1` frozen; historical 18 selections / 13 wins / 5 losses / +90.94% *virtual retrospective ROI* is **not** a prospective track record.

## Database
- `sb_away57_signals_v1`: signal-level immutable time, score, prices, Generosity, probabilities, expected value, 2 lei suggested stake, later result and model version.
- `sb_away57_scan_runs_v1`: real scan heartbeat, processed/matched/inserted counts, no fake UI animations.

## Live code paths in `ghost-equal-alert-v1/index.js`
The production script has been patched in place. If rebuilding it later, **preserve** these changes; the repository does not contain the entire production Worker bundle:

```js
import {scanAway57,away57Snapshot,away57MobileAlerts,away57Replay,withAway57} from './sb-away57.js';
// scheduled() 1 minute cron, independent of Golden/KLOPP
ctx.waitUntil(scanAway57(env).catch(e=>console.error('AWAY57_SCAN',String(e).slice(0,160))));
// /app render
withAway57(withKloppWave(withHomePulse(appHtml())))
// In authenticated mobile API, owner-only:
if(path==='/api/mobile/away57'&&req.method==='GET'){
  if(!await hasPrivateAnalytics(env,who.device_id))return json({error:'Owner only'},403);
  return json(await away57Snapshot(env));
}
if(path==='/api/mobile/away57/replay'&&req.method==='GET'){
  if(!await hasPrivateAnalytics(env,who.device_id))return json({error:'Owner only'},403);
  return json(await away57Replay(env,new URL(req.url).searchParams.get('event_id')));
}
// /api/mobile/alerts: include away57MobileAlerts only for betaOwner
const away57Alerts=betaOwner?await away57MobileAlerts(env):[];
// in alerts array: ...away57Alerts
```

## Signal semantics
- score 1–1 at archived minute 57, away price 1.85–4.00, away favorite relative to home (p2 < p1).
- Pre-match 1/X/2 + both Generosity, progressive bins from live snapshots, 57′ 1/X/2 + Generosity, signal only when away 2 is the highest modeled EV and EV >= 5%.
- Prevent stale-score alert, one signal per event, never interfere with existing mov/roșu.
- `/api/mobile/alerts` can supply 3-minute owner-only `BET_NOW` message with `selection:'2'` and `suggested_stake_lei:2`. **Phone notification reception cannot be confirmed without Android implementation on installed APK.**

## Android continuity blocker
The user's latest signed APK is **v2.3.32**, while current public GitHub main Android source is **v2.3.29** and lacks newer native KLOPP changes.
- Proof-of-concept native Away 57 navigation/notification code is preserved on branch `feature/away57-android-native-v2330-preview`, **not installed**.
- The original v2.3.32 APK and release PKCS#12 key are in the user's private Library; certificate fingerprints match, but **never upload the key to GitHub**.
- Recover current native code first, bump to >v2.3.32, build and sign with the same certificate; test update-in-place and all previous screens. Debug APK is NOT an upgrade.

## Production verification
Cloudflare successful module deployment and 100% deployment reported. At 2026-11-11T03:33:24Z the new scanner wrote its first real heartbeat to D1 without error; it found no new eligible 1–1 match in that run.
