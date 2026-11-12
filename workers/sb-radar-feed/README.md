# SB Radar — feed resilience (12 Nov 2026)

## Production paths

- Primary **ghost-equal-alert-v1** scans Superbet market 547 and keeps the existing Golden Classic eligibility rules unchanged.
- Independent discovery **sb-radar-live-discovery-v1** runs every minute and repairs the fixture catalog in `quote_state`.
- Independent archive **beast-xray-live-v2** now runs every minute (was every five minutes) and records actual score, clock, 1/X/2 odds and Superbet generosity in `live_snapshots`.
- Independent **sb-radar-secondary57-v1** runs every minute with 8-second bursts around captured minute 55–57. It preserves genuine minute-57 frames; it does not directly issue bets or betting alerts.
- The primary scanner uses `radar-feed-resilience.js` for Superbet single-event retry on missing/incomplete batch responses, then accepts only full, very recent live-collector snapshots. All 1/X/2 and generosity fields must be valid and from the same observation.
- **sb-radar-system-pulse-v1** displays feed-resilience counters in the existing feed metrics. Owners can also inspect `/api/mobile/feed-health`.

## Data safety

No missing price or generosity value is generated or borrowed from another bookmaker, and no prematch quote is substituted as an in-play quote. A cached snapshot expires after 45 seconds, or 22 seconds close to minute 57, or **12 seconds at minute 57**. Mismatched score/minute or red cards block fallback. Unrecoverable data remains marked unresolved, and no synthetic betting signal is sent.

The three transport/capture lanes are not three independent upstream providers: all Superbet odds and generosity originate from the **same Superbet API**. ScoreAlarm provides different statistics where available, not equivalent bookmaker generosity. Full provider-outage protection requires an additional licensed, verified, ID-matched provider exposing equivalent fields.

## Bounded work

Full scans may retry at most 12 individual events; the high-frequency fast ticker is limited to 1 extra singleton request per scan. Requests are bypassed for complete primary responses. No changes to Android APK, Slip, Over 0.5, Home Pulse, Road to 57, betting filter rules or paused Twilio.

## Monitoring

`sb_radar_feed_resilience_v1` (id=1) tracks: timestamp, requested events, primary errors, incompleteness, individual retries/recoveries, fresh snapshot recoveries, stale rejects and unresolved events. Pulse consumes this table. Historical minute-57 archival uses `sb_radar_secondary_57_captures_v1` and `sb_radar_secondary_57_runs_v1`.

Worker version before resilience: `9fa59012-ed15-44e4-92e3-016d6e77e499`. Resilience deployment: `6756614b-e07c-47ff-b1cb-efe860ab0a5e`. Bounded-retry deployment: `09cbb3fe-7934-4252-b163-88b82d51807d`.

This is availability engineering and observability, not a guarantee that all football matches, data points or alerts will always be available.
