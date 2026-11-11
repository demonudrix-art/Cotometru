# META AI | EPL-Pulse pretrained Poisson (test exploratoriu)

Data evaluării: 2026-11-11. Stare: **RESEARCH / NU ACTIVĂM ÎN PRODUCȚIE**.

## Model primit și importat
Utilizatorul a furnizat `home_goals_model(1).pkl`, `away_goals_model(1).pkl`, `feature_list(1).pkl` din [Chaste20/EPL-Pulse_v1](https://huggingface.co/Chaste20/EPL-Pulse_v1).
Două modele Poisson statsmodels cu log-link; 6 coeficienți fiecare, ordinea intrărilor: `const, EloDiff, Home_GF, Home_GA, Away_GF, Away_GA`. Greutățile originale au fost citite din binarele joblib **fără dezserializare sau executare de cod** și păstrate în `external_pretrained/epl_pulse_poisson/coefficients_safe_v1.json`, cu SHA-256 original.
**Lipsește `team_state.pkl`** (Elo și forma originală a echipelor). Prin urmare, nu este posibil un replay fidel al modelului original.

## Metoda evaluării preliminare
- 20 meciuri English Premier League, 2026-10-31 — 2026-11-08, cu rezultat final confirmat în Cloudflare D1 `beast-xray-history`, plus 1/X/2 și Generosity din **ultima captură pre-meci**.
- Rezultatele jocurilor istorice și forma echipelor au fost corelate cu [open-matchday/results_2627.csv](https://github.com/oladeeayo/open-matchday/blob/master/data/ENG_1_premier-league/results_2627.csv), blob Git `b1fc05b202bb5cbb029d5fae836a6102c4965d79`. ID de eveniment/rezultat verificate pentru toate cele 20.
- Deoarece starea `team_state.pkl` lipsește, `Home_GF`, `Home_GA`, `Away_GF`, `Away_GA` au fost **aproximate** ca medie în ultimele 5 meciuri jucate anterior, în sezonul 2026/27. `EloDiff` a fost reconstruit în același sezon, pornind de la Elo=1500 pentru fiecare echipă, K=20, avantaj casă de 65 în așteptarea actualizării. Această reconstituire **nu dovedește** că este metoda autorului original.
- Pentru fiecare joc: `lambda = exp(coef0 + sum(coef_i*feature_i))`; enumerarea Poisson home/away 0..16 goluri, combinarea în 1/X/2.
- Piața de referință: inversele cotelor `p1,px,p2`, normalizate pentru a elimina marja.
- Metricile de mai jos sunt multiclass Brier **sumă** pe cele trei rezultate, nu Brier binar, și log-loss.
- Regulă de selecție virtuală unică pe meci: EV model `p*cota-1>=0.05`, cota 1.85–4.00, alege cel mai mare EV; miză egală 1 unitate, doar pre-meci. **Nu este Away57 și nu folosește Generosity la inferență.**

## Rezultate (20 meciuri)
| Metrică | Poisson cu intrări aproximative | Piața normalizată |
|---|---:|---:|
| Multiclass Brier ↓ | 0.597247 | **0.588626** |
| Log-loss ↓ | 0.999493 | **0.990300** |
| Clasificare 1/X/2 corectă | 9/20 | **10/20** |

Selecție 1/X/2 la EV >= 5% și cote între 1.85 și 4:
- **10 selecții; 5 WIN; 5 LOSS**.
- Profit net virtual **+3.12 unități**, ROI **+31.20%**; la miză egală de 2 lei, profit net **+6.24 lei** din total 20 lei mizat.
- În interiorul celor 10, selecția **2** a avut **2 selecții, 0 WIN, 2 LOSS, ROI -100%**.

| Selecție virtuală | Piață | Cotă capturată | Final | Rezultat |
|---|---:|---:|---|---|
| Chelsea – Manchester United | 1 | 2.25 | 2–0 | WIN |
| Bournemouth – Leeds United | 2 | 3.65 | 2–0 | LOSS |
| Brentford – Nottingham Forest | 1 | 2.15 | 2–0 | WIN |
| Coventry City – Sunderland | 1 | 2.90 | 3–1 | WIN |
| Hull City – Ipswich | 1 | 3.00 | 2–2 | LOSS |
| Liverpool – Arsenal | 1 | 2.87 | 0–1 | LOSS |
| Leeds United – Tottenham | 1 | 2.77 | 1–0 | WIN |
| Ipswich – Bournemouth | 1 | 3.55 | 1–2 | LOSS |
| Sunderland – Chelsea | 1 | 3.05 | 1–0 | WIN |
| Manchester United – Aston Villa | 2 | 3.40 | 4–4 | LOSS |

## Limitări critice
1. Lipsește `team_state.pkl` al autorului; valorile Elo și forma sunt **proxy**, iar datele folosite pentru evaluare nu reproduc cu certitudine caracteristicile originale.
2. Sunt doar 20 de meciuri EPL, nu 14 zile complete de toate ligile, și modelul este pre-meci — deci **nu poate fi promovat pentru Away57 la scorul 1–1 la 57′**.
3. Rezultatul ROI pozitiv la 10 selecții nu compensează faptul că Brier și log-loss sunt **mai rele** decât piața. Volatilitatea e foarte mare.
4. Modelul nu a fost antrenat pe Generosity, astfel că nu se introduc valorile Generosity în vectorul său de intrare.
5. Testarea este retrospectivă și a fost concepută după mai multe analize; nu reprezintă un set prospectiv neatins. Nu sunt incluse alunecarea cotei sau comisioane.

**Decizie META AI: NU PROMOVA / NU EMITE BET NOW.** 
Următorul pas: obținerea `team_state.pkl` exact, reconstruirea completă a intrărilor și o comparație independentă pe meciuri noi. Apoi analiza Generosity într-un model separat, cu suficiente exemple pentru calibrare. Păstrăm Radio Mov/Roșu, Away57 și KLOPP neschimbate.
