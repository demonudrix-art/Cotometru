# BEAST Android Companion v1.2 — Sportmonks GOAL → Auto Touch

Sursă de bază: BEAST Android Companion v1.1 din ramura beast-android-apk.
**TapService.java nu a fost modificat.** Sportmonks apelează direct metoda originală TapService.onGoalSse() cu un mesaj goal compatibil.

## Funcționare

- Introdu propriul token Sportmonks API v3. Este criptat cu Android Keystore/AES-GCM; nu este inclus în cod și nici în APK.
- Introdu fixture ID Sportmonks, nu ID-ul Superbet.
- Pornire 120 minute; GET https://api.sportmonks.com/v3/football/livescores/inplay?include=events la fiecare 10 secunde.
- Este urmărit NUMAI fixture-ul selectat. Primul răspuns valid fixează baza de evenimente istorice fără atingere automată.
- GOAL=14, OWN GOAL=15, PENALTY convertit=16; VAR=10 și penalty shootout=23 sunt ignorate.
- Orice gol cu event ID nou declanșează TapService.onGoalSse() original. Event ID-urile sunt deduplicate în memorie.
- 401/403/404 oprește colectarea; 429 produce pauză Retry-After; restul erorilor fac backoff.
- Bula mobilă, accesibilitatea, coordonatele și butonul de test rămân cele din v1.1.

## Instalare

Android package ID: ro.cotometru.beastcompanion.sportmonks.
Este pachet diferit, instalabil în paralel cu v1.1 pentru a evita problemele semnăturii debug GitHub Actions.
Activează accesibilitatea pentru noul BEAST Sportmonks și poziționează din nou bula.
Nu porni monitorul SSE și Sportmonks simultan.

## Compilare

GitHub Actions: .github/workflows/beast-android-apk.yml
Rulează gradle --no-daemon testDebugUnitTest assembleDebug
Artifact așteptat: BEAST-Android-Sportmonks-v1.2-APK

## Limite

Nu este SSE, ci polling HTTP. La 10 secunde se pot face 360 cereri/oră, în funcție de timpul real de execuție.
Ecranul trebuie deblocat; un gol anulat ulterior la VAR nu anulează gestul.
Un semnal mai rapid nu garantează acceptarea pariului sau a unei alte tranzacții.
