# SB Radar · Golden Trace v1.0 — cod sursă Android

**Stare:** proiect sursă, necompilat / netestat pe un telefon. Nu este un APK gata de instalare. Este un companion separat pentru SB Radar v2.2.0; nu modifică aplicația deja instalată, nu schimbă Worker-ul Cloudflare și nu are nevoie de cheia de semnare a SB Radar.

## Ce include

- Înregistrare din Chrome a evenimentelor de apăsare și a modificării câmpului numeric al mizei, printr-un serviciu Android Accessibility activat manual.
- Salvare traseu locală în datele private ale aplicației; revizuire listă pași; eliminarea ultimului pas.
- Ultimul pas trebuie să fie recunoscut ca buton de plasare (`Pariază`, `Plasează`, `Place Bet` etc.). Traseul trebuie să includă selecția `X`.
- Conectare cu token/device ID distinct la Worker-ul existent `ghost-equal-alert-v1.drix-beast-xray.workers.dev`. API-ul `POST /api/mobile/claim` înregistrează un dispozitiv **PENDING**, care trebuie licențiat și asociat de administrator contului owner pentru a vedea `BETA_A_LOW30`.
- Monitorizare `GET /api/mobile/alerts` la ~15 s printr-un foreground service, numai cât timp utilizatorul îl pornește. Dacă API-ul nu este disponibil, nu se emite click.
- Replay doar la `stage=BET_NOW`, `beta_group=BETA_A_LOW30`, `is_test=false`, `already_in_slip=false`, alertă sub 100 s, URL derivat din event_id și fixture.
- Încercare de deschidere a meciului în Chrome, identificare unică a fiecărui element accesibil, verificarea echipelor, a câmpului mizei și a cotei X. Dacă verificările eșuează, STOP. **Ultimul click este trimis cel mult o dată și NU este confirmarea acceptării pariului.**
- Dezarmat implicit, cu miză 0 lei. Permite armare reală doar după completarea mizei și a plafonului, cu plafon zilnic configurabil (implicit 5 încercări/zi) și o singură încercare pe eveniment. `STOP DE URGENȚĂ` dezarmează și oprește serviciul.

## Compilare fără terminal local

Conține workflow GitHub Actions `.github/workflows/android-apk.yml`. Încarcă conținutul folderului într-un repository GitHub (de preferat privat), apoi deschide `Actions → Build Golden Trace APK → Run workflow`; rezultatul este artifact-ul `SB_Radar_Golden_Trace_debug_APK`. Acest workflow nu a fost executat aici. Nu distribui un APK debug în producție fără verificări și semnare adecvată.

## Procedura de înregistrare

1. Instalează APK-ul compilat și activează `SB Radar · Golden Trace` în setările Android → Accesibilitate.
2. În companion, apasă `Înregistrează dispozitiv în Cloudflare`, apoi administratorul aprobă licența și leagă dispozitivul de profilul **owner**. Apasă `Verifică licența`.
3. Introdu linkul unui meci real de test, direct la `https://superbet.ro/cote/fotbal/...`, apoi `PORNEȘTE ÎNREGISTRAREA + CHROME`.
4. În Chrome, cu contul deja autentificat, mergi pe piața 1X2, selectează **X**, introdu o miză de test și apasă butonul final. **Acțiunea manuală finală poate plasa un pariu real:** nu executa acest pas decât în mediul de test/autorizarea potrivită.
5. Revino în companion; apasă `OPREȘTE + SALVEAZĂ TRASEUL`. Inspectează pașii și șterge eventualele evenimente suplimentare. Traseul trebuie să fie `COMPLET`.
6. Completează suma și plafonul. Lasă debifat `ARMAT` pentru testare; când traseul este validat și doar în condițiile autorizate, bifează și salvează `ARMAT` pentru a permite clickul final.
7. Apasă `PORNEȘTE MONITORUL GOLDEN` și păstrează notificările active.

## Limitări reale (esențiale)

- Android poate împiedica lansarea Chrome din fundal; telefonul blocat sau cu ecranul stins NU este deblocat de aplicație. Dezactivarea optimizării bateriei nu elimină aceste restricții.
- Chrome poate expune diferit elementele paginii după un update sau la cote noi. Un eveniment inaccesibil, mai mulți candidați pentru X sau un câmp de miză neverificabil duc la STOP, nu la clickuri pe coordonate.
- Un `ACTION_CLICK` returnat cu succes nu dovedește că Superbet a acceptat biletul. Nu există reconciliere cu bonul operatorului; nu se repetă ultimul click după timeout.
- API-ul existent afișează `beta_group` **doar pentru dispozitivele owner**. Un nou device neaprobat nu poate declanșa replay Golden Ticket.
- Monitorul cu polling continuu consumă baterie și trafic, și poate fi oprit de Android. Pentru funcționare pe termen lung ar trebui folosite notificări native push (FCM), în loc de polling permanent.
- Acesta este un prototip; înaintea oricărei utilizări cu bani reali trebuie validat prin teste end-to-end, pe modelul de telefon și pe fluxul Superbet autorizat.

## Audit / modificări pe infrastructura live

**Nicio modificare la Cloudflare, Superbet sau la SB Radar APK instalat.** Toate fișierele sunt în acest proiect offline.
