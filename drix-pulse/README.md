# DRIX Pulse — Android (single-user beta)
Native Android alarm client for GHOST EGAL. No activation-code input in the APK. Connects to the existing Cloudflare Worker; stores actual X bets, odds, stakes and settled P&L in D1. All displayed times are **Europe/Bucharest**.

## User flow
1. Install `app-debug.apk`. A unique device credential is generated at first launch. Only the first claimed Android installation can enroll; new devices require an explicit backend reset.
2. Grant **Notifications**. The app starts a foreground background monitor every ~15 seconds and displays a persistent 'Radar pornit' notification while active.
3. For important events, native high-importance channels create sound, vibration, heads-up, lock-screen-visible notification with a link to the Superbet match.
4. `LIVE` opens Superbet or prefills `SLIP`. In SLIP enter **actual bookie price** and **stake**, tap `Confirmă că am pus X`.
5. ROI tab uses **actual** settled bets, independent of GHOST prospective simulated performance. Can manually grade WON, LOST, VOID, CASHOUT. For signals with event ID, results are automatically graded only when `match_results.verified=1`.

## Reliability and limits
- Initial build uses a native **foreground data-sync service**, not FCM; Android can suspend/kill services especially under Samsung battery management. Thus lock-screen operation is provided, **not a latency guarantee**.
- Persistent monitor costs battery/network and Android may restrict long-running FGS. Samsung battery unrestricted setting may help but does not supersede OS restrictions.
- Recommend **FCM HIGH priority** integration for production reliably-on-lock-screen service; needs Firebase Android app registration and a server-side service account. Cannot truthfully claim FCM delivery before provisioned and physical-phone locked-screen tests.
- Not an automated bettor. No bets are placed at Superbet.
- First-device no-code claim is a **single-owner beta convenience**, not strong authentication if someone claims the public endpoint ahead of the intended user. Replace with an authenticated owner-approved enrollment before public distribution.
- Debug APK is developer-signed; for store release use signed release build, proper app icon and Play policy compliance.
- Data sync / ROI uses Cloudflare D1. No ChatGPT access to phone-local inputs until they are saved and retrieved in the database; Cloudflare automations can audit them.

## Build
```bash
cd drix-pulse
gradle :app:assembleDebug
```
GitHub workflow: `.github/workflows/drix-pulse-build.yml`, output artifact `DRIX-Pulse-Android`.
