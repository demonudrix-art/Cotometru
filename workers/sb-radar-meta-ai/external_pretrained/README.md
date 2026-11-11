# SB Radar — modele externe deja antrenate (carantină)

Importate în cercetarea META AI la **11 noiembrie 2026**. Nu sunt conectate la Worker, la alerte, la Android sau la pariuri.

## Greutăți efectiv copiate în GitHub

| Sursă | Fișier preantrenat | Rol | Stadiu |
|---|---|---|---|
| [brysonhen/football_matchup_predictor](https://github.com/brysonhen/football_matchup_predictor) | `bryson_epl/model.joblib.b64` | Logistic Regression 1/X/2, **Premier League pre-meci**, cu StandardScaler | Copiat, în carantină |
| [EmanKhaliq49/FIFA-2026-HUB](https://github.com/EmanKhaliq49/FIFA-2026-HUB) | `eman_wc/model.pkl.b64` | Logistic Regression pentru meciuri internaționale | Copiat, în carantină |
| [EmanKhaliq49/FIFA-2026-HUB](https://github.com/EmanKhaliq49/FIFA-2026-HUB) | `eman_wc/wc_xg_model.pkl.b64` | Model XGBoost de xG / match | Copiat, în carantină |

Alături de primul model avem snapshotul de formă al echipelor (`team_snapshots.joblib.b64`) și `metadata.json` (cele 12 intrări, sezoane și metrici). Toate fișierele binare sunt păstrate ca **base64 text**, cu SHA-ul obiectului Git original în `manifest.json`; importatorul recreează exact binarele și verifică hashul.

Sursele declară licență MIT, dar reutilizarea trebuie să păstreze atribuirea și condițiile licenței originale; datele preluate din competiții pot avea propriile condiții.

## Alte modele identificate și pregătite pentru descărcare

- [Chaste20/EPL-Pulse_v1](https://huggingface.co/Chaste20/EPL-Pulse_v1): două modele Poisson deja antrenate (goluri acasă/deplasare), care produc distribuții 1/X/2. **Nu s-au putut descărca aici**.
- [ruslanmv/sports-trends-models](https://huggingface.co/ruslanmv/sports-trends-models/tree/main/football/latest): HistGradientBoosting calibrat 1/X/2, cu Elo/formă/H2H. **Nu s-a putut descărca aici**.

Acestea sunt în manifest ca **remote/not downloaded**. Pentru a le importa pe o mașină cu acces la Hugging Face, se poate rula:

```sh
python workers/sb-radar-meta-ai/external_pretrained/import_pretrained.py --download-hf
```

Fără `--download-hf`, scriptul **materializează și verifică doar binarele GitHub deja importate** în `quarantine/`:

```sh
python workers/sb-radar-meta-ai/external_pretrained/import_pretrained.py
```

`quarantine/import_status.json` indică fișierele și SHA-256. Niciun model nu este **dezserializat, executat sau încărcat** de acest script.

## Reguli obligatorii înainte de predicții reale

1. **Securitate:** Python pickle / joblib pot executa cod la deserializare. Fișierele externe rămân în carantină până la audit și încărcare izolată într-un mediu controlat.
2. **Intrări:** modelul EPL are nevoie de 12 variabile de formă/odihnă ale echipelor, nu de vectorul SB Radar Generosity. Modelul internațional necesită propriile codificări ale echipelor. Nu se pot forța date incompatibile în predict().
3. **Domeniu:** pre-meci EPL sau internaționale nu este echivalent cu 1–1 la minutul 57 în ligile Superbet. Aceste modele pot fi doar experți de context/priors după adaptare și controlul distribuției.
4. **Validare:** Brier, log-loss, WIN, LOSS și ROI se vor măsura **doar după** construirea features corecte, maparea meciurilor și evaluarea pe aceleași evenimente, cu timestamp disponibil la decizie.
5. **Fără producție:** nu se modifică Radio Mov/Roșu, KLOPP, Away 57, Cloudflare Worker, D1 sau APK. **Zero automatizare a pariurilor.**

## Situație

**3 modele externe antrenate copiate; 2 surse Hugging Face identificabile dar încă nedescărcate.**
Acesta este un import de artefacte, **nu** o validare de profit sau un ensemble live.
