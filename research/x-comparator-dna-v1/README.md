# X-COMPARATOR DNA V1 — SHADOW research

**Stare:** instalat ca Worker Cloudflare separat, `sb-radar-xcomp-dna-shadow-v1`; cercetare numai, fără notificări, Slip, Twilio sau pariuri automate.

## Meta-prompt / specificația înghețată

Analizează toate meciurile SB Radar 0–0 la minutele **45, 50 și 57**, folosind exclusiv datele capturate până la decizie. Identifică până la 20 de vecini istorici cu scor 0–0 și rezultat final verificat *înainte* de timpul deciziei, pe baza tuturor reperelor disponibile:

- la 45': 20, 30, 40, 45;
- la 50': 30, 40, 45, 50;
- la 57': 40, 45, 50, 57.

Pentru fiecare meci folosește **generosity HOME și AWAY**, niveluri și diferențe de la un reper la altul, **probabilitatea X dedusă din cotele 1/X/2 după eliminarea marjei** și dinamica acesteia. Folosește și cornerele HOME/AWAY dacă există **de ambele părți**, fără a trata valori `NULL` drept zero.

**Nu folosi atacuri periculoase, șuturi sau șuturi pe poartă până când există acoperire stabilă pentru meciul nou și istoricul relevant.** Tabelele momentum au ultima captură din 17 noiembrie 2026.

Evită:
1. orice rezultat istoric verificat abia după timestampul predicției;
2. orice date ale meciului analizat ulterioare checkpointului;
3. folosirea rezultatelor pentru a alege vecinii (se utilizează numai caracteristicile);
4. supraînvățarea pe cele 12 meciuri anterioare, pe Ho Chi Minh – Thai Nguyen, sau pe zilele 17–19 noiembrie;
5. semnale false din capturi incomplete.

Distanță: metrică normalizată pe niveluri și schimbări, cu cornere opționale. Alege cei mai apropiați **20** de vecini cu cotă X într-un interval de ±0,50 și maximum **4 vecini/zi**, din minimum **5 zile distincte**. Dacă distanța medie >1,55, declară date insuficiente.

Estimare: `p_final = p_X_piață_fără_marjă + 0,4 × media_ponderată(y_egal - p_X_istoric_piață)`, limitată la [1%,99%]. Un candidat de cercetare necesită `p_final × cota_X - 1 >= 0,06`; altfel `PASS`. **Aceasta este o ipoteză de model, nu o probabilitate calibrată de câștig.**

Persistă decizia, cota, p_market, p_model, EV, 20 vecini, numărul de egaluri și top 6 cele mai apropiate meciuri în D1.

### Constrângeri de operare

- Întotdeauna `SHADOW_NO_BETS_NO_ALERTS`.
- Nu trimite FCM, nu porni Twilio, nu crea BET NOW sau Slip.
- Nu schimba Golden Classic, ML sau GAP NAVY.
- Nu rula aceleași decizii de două ori: cheia unică este (`rule_id,event_id,checkpoint`).
- Nu deschide un endpoint public de acces la statistici; fetch returnează 404.
- Rulează incremental, pe capturi recente, o dată la cinci minute; păstrează primul snapshot exact la fiecare reper.

## Structuri D1

- `sb_radar_xcomp_snapshots_v1`: prima captură exactă pe meci/minut; 19.811 rânduri normalizate inițial.
- `sb_radar_xcomp_vectors_v1`: meciuri 0–0 cu istoric complet per checkpoint, 697 / 412 / 335 vectori inițiali la 45 / 50 / 57.
- `sb_radar_xcomp_rules_v1`: modelul de cercetare înghețat.
- `sb_radar_xcomp_decisions_v1`: decizii auditate cu vecinii.
- `sb_radar_xcomp_score_v1`: evaluare după rezultate verificate.

## Primul replay cronologic (2026-11-14...19)

| Checkpoint | 14–16 nov. | 17–19 nov. |
|---|---|---|
| 45' | 10 WIN / 18 LOSS; ROI −12,2% | 1 WIN / 3 LOSS; ROI −44,5% |
| 50' | 1 WIN / 4 LOSS; ROI −57,6% | 2 WIN / 2 LOSS; ROI +23,8% |
| 57' | 0 selecții | 1 WIN / 1 LOSS; ROI +3,5% |

**Nu este un filtru profitabil demonstrat.** Rezultatele de la 50' și 57' sunt bazate pe prea puține selecții. Scopul cronului este doar acumularea prospectivă de decizii pentru audit.

Exemplu Ho Chi Minh – Thai Nguyen (20 nov.): PASS la 45, 50 și 57; meciul a fost câștigat de gazde. Aceasta este o verificare retrospectivă de sanity-check, nu dovada unei alerte live emise anterior.

## Criteriu de promovare

Păstrează modelul exclusiv în SHADOW până la minimum 200 de decizii prospective și 21 de zile distincte, ROI net peste benchmark-ul bazat pe cote și interval de încredere care justifică în mod credibil un avantaj. Nu activa pariere automată.
