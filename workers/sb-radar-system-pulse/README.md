# SB Radar — System Pulse v1

Monitorizare pasivă, independentă de scanner, filtre, mize și execuția Chrome. Nu emite și nu repetă pariuri.

## Flux
- `quote_state.captured_utc`: cotele Superbet / freshness (verde sub 75s, portocaliu 75–180s, roșu peste 180s).
- `sb_radar_scan_health`: scanner 57' (verde sub 75s și fără erori, portocaliu sub 150s sau cu erori, roșu dacă e învechit).
- `live_runs` + `live_snapshots`: **istoric separat**; o eroare aici nu înseamnă automat feed principal oprit.
- `sb_radar_chrome_devices_v1` + `sb_radar_chrome_events_v1`: heartbeat Chrome, sesiune activă și dovada job-pollului. Extensia 1.0.11 păstrează fallback 30s.
- `sb_radar_fcm_sent` vs `ghost_equal_alerts`: trimis versus semnal; trimiterea FCM **nu** înseamnă afișare/confirmare pe Android.
- `sb_radar_scan_gaps` + claims eșuate: incident tehnic versus lipsa unui semnal eligibil.
- `sb_radar_pulse_mobile_v1`: Android 30s foreground, inactive în fundal (nu folosi alarmă agresivă pentru a forța procesare permanentă).

Workerul salvează doar tranzițiile `ok/warn/down` în `sb_radar_pulse_incidents_v1`. Cronul este o dată pe minut, fără request extern de monitorizare pentru fiecare meci. Read-only asupra sistemelor de pariuri.

## Deploy operator (neefectuat prin conexiunea ChatGPT)
Din rădăcina repository-ului GitHub, cu `wrangler` autentificat în contul corect:
```bash
npx wrangler deploy -c workers/sb-radar-system-pulse/wrangler.toml
```
Cont D1: `beast-xray-history` — schema pulse a fost creată la 2026-11-07.
Verifică apoi `GET https://sb-radar-system-pulse-v1.drix-beast-xray.workers.dev/health`. Pentru `GET /v1/pulse` este obligatoriu token Android autorizat owner; endpoint-ul nu este public.

## Bug real — ingestia secundară Live
În workerul `beast-xray-live-v2`, interogarea `live_state ... IN (?,?,...)` folosea simultan până la 180 de parametri SQL. Baza activă a avut peste 100; jurnalul `live_runs` arată `too many SQL variables`. Varianta corectată în `workers/beast-xray-live-v2/worker.js` împarte citirea în loturi de 50. Este **doar cod sursă**, nu a fost publicată în workerul de producție. Publicarea lui trebuie să păstreze binding-ul D1 și programarea deja existente.

## APK
GitHub Actions compilează versiunea 2.3.27, iar actualizarea finală trebuie semnată cu certificatul release existent (nu cu cheia debug a GitHub Actions). Nu include cheia PKCS#12 în acest repository.
