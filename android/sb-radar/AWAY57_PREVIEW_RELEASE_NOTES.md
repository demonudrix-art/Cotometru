# Away 57 — Android preview (NOT FOR INSTALLATION)

This branch contains native navigation and isolated vibration-only **AWAY 57 · BET NOW · 2 LEI** notification support for the SB Radar WebView app.

**Important:** The Android source available in GitHub at the start of this change was version **2.3.29**. The user's latest release APK in their private Library is **v2.3.32**, with additional native KLOPP functionality absent from this source. Therefore this branch is only a source preview; DO NOT distribute or install its debug APK as an update.

The frozen experimental model, production server scan, owner-only API, web menu and prospective D1 audit are on the Cloudflare Worker, and the server module source is in `workers/sb-radar-away57/sb-away57.js`.

To produce a safe signed update:
1. Recover or merge the **complete v2.3.32 Android source** including native KLOPP handlers and latest notification paths.
2. Apply the native Away 57 navigation + separate notification channel from this preview.
3. Bump versionCode above the installed app and versionName to v2.3.33 or newer.
4. Build release using **the original release PKCS#12 key already held securely in the user's private Library** (never add it or its password to GitHub).
5. Validate package id, signing certificate SHA-256, install upgrade on a device without uninstall, and verify preexisting KLOPP/strong alerts and new Away57 alerts.

The 18 selected historical 1–1/away-favorite signals and +90.94% virtual ROI were selected retrospectively; no prospective profit or winning signal is guaranteed. Never place bets automatically.
