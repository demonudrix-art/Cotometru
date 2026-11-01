# SB Radar Android 2.3.2 — ecran blocat

* Golden Ticket și ML au canale independente, de importanță HIGH, cu Full-Screen Intent când Android autorizează permisiunea, ecran nativ, sunet repetitiv și vibrație cu oprire explicită / oprire automată la 45 secunde.
* Monitorul Foreground Service verifică serverul existent la 25 de secunde. Se repornește când deschizi aplicația, dar Android poate întrerupe serviciul în modul de economisire a bateriei. Nu se promite monitorizare permanentă.
* Nu se reactivează Beta B. Notificările câștigate rămân separate.
* Aplicația solicită autorizarea notificărilor și oferă acces la setarea specială pentru alerte peste ecranul blocat. Dacă aceasta este refuzată, rămâne notificarea obișnuită cu prioritate ridicată.
* Test local Golden Ticket și ML disponibil prin interfața JS: DrixNative.testGoldenAlert() / DrixNative.testMlAlert(). Apelul DrixNative.testNotification() testează Golden Ticket.
* **FCM nu este încă conectat.** Nu există un proiect Firebase / credențiale de expediere în integrarea Worker. Pollingul rămâne calea de livrare până la instalarea FCM pe client și server.
* APK-ul debug din GitHub Actions este semnat cu cheia debug temporară. Acea semnătură nu elimină avertismentele Android/Play Protect și nu garantează actualizarea peste o versiune instalată cu alt certificat. Nu dezinstala fără a salva datele/contul; Android poate refuza update-ul în cazul cheilor diferite.
* Pentru semnare release stabilă, cheia privată trebuie păstrată **în siguranță**, de exemplu în GitHub Actions Secrets, niciodată în repository. Un certificat de semnare nu conferă automat încrederea Play Protect.
