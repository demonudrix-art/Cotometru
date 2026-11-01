# SB Radar FCM Push Bridge

This is **additive** and does not edit the existing SB Radar login, slip, tickets or settlement endpoints. It registers FCM device tokens only after validating the existing mobile device token hash in D1, then reads only the existing BET_NOW alerts for **Golden Ticket** and **ML**. Beta B is excluded.

The cron runs **once a minute**; this is independent of the existing 25-second Android polling fallback. The bridge does not provide instant event-driven FCM. True near-real-time requires a verified trigger from the existing main Worker on signal emission; do not falsely claim it exists.

Required one-time Firebase setup:
1. Create or choose a Firebase project and add Android app package ro.drix.pulse.
2. Set Cloudflare encrypted secrets FIREBASE_CLIENT_CONFIG_JSON and FIREBASE_SERVICE_ACCOUNT_JSON on Worker sb-radar-push-v1, with the Firebase Cloud Messaging API enabled for this project. Never commit service account keys.
3. Reopen the SB Radar 2.3.3 APK, wait for the device FCM registration and verify /v1/health returns fcm_configured=true.
4. Test delivery on a physical Samsung S24 Ultra with the lock screen on and Android notification/Full-Screen permissions enabled.

FCM is optional and never blocks main account login, viewing slips or existing polling notifications. Server credentials are not embedded in APK. 
