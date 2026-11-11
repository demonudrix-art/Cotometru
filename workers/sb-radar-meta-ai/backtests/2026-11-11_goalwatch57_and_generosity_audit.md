# META AI — audit nou: Generosity, traiectoria scorului și GOAL WATCH 57+
Data: 2026-11-11. **Cercetare retrospectivă. Nicio schimbare de producție.**

## Descoperirea pozitivă: probabilitatea unui gol după 57′ la 0–0
Folosim doar prima captură a meciului la minutul 57 în arhiva `sb_radar_df57_archive_v2`, dacă scorul este 0–0 și există cote 1/X/2, Generosity valid (criteriu de integritate, nu feature pentru model) și rezultat final verificat.

Antrenare 29 octombrie–4 noiembrie: **513 meciuri**. Model logistic L2 pe cotele normalizate, cota X și marja pieței; probabilitatea `P(final 0–0)`. Pragul pentru gol după 57 se fixează la **P(final 0–0) ≤ 0.2908125236491297**, percentila 20% *calculată exclusiv pe antrenare*. Decizia este `SHADOW_CANDIDATE`, nu bet.

| Fereastră | Toate meciurile 0–0 la 57′ | Gol ulterior în toate | Candidate (prag fix) | Gol ulterior candidate | Rată gol în candidate |
|---|---:|---:|---:|---:|---:|
| Antrenare 29.10–04.11 | 513 | - | 103 | 79 | 76,70% |
| **Validare 05–07.11** | 279 | 199/279 (71,33%) | 73 | **58** | **79,45%** |
| **Test ulterior 08–10.11** | 210 | 151/210 (71,90%) | 52 | **44** | **84,62%** |
| Două perioade ulterioare | **489** | 350/489 (71,57%) | **125** | **102** | **81,60%** |

Aceste 125 de selecții au **102 meciuri cu cel puțin un gol după 57′** și **23 fără niciun gol**. Nu există cotele istorice de piață pentru următorul gol / Over 0,5 restul meciului, deci **nu se poate calcula un ROI real sau virtual valid** pentru acest obiectiv. Nu transforma hit-rate în avantaj financiar.

### Model de risc: Brier pentru P(final 0–0) (binar)
| Fereastră | Constant | Price-only | Cote+Generosity+delta 47–57 |
|---|---:|---:|---:|
| 05–07.11 | 0,207069 | **0,198651** | 0,202997 |
| 08–10.11 | 0,205186 | **0,203589** | 0,205174 |

Modelul cu Generosity este **mai slab decât price-only** pe ambele perioade. Diferența față de bază în perioada ulterioară e mică, iar incertitudinea e mare. Nu pretinde validare statistică de profit.

### Verificare dacă același scor ajută pariul X la 57′
La pragul fix de selecție pentru gol ulterior, nu avem cota corespunzătoare, dar am simulat separat un pariu **X** pe subsetul de risc mic de 0–0: **22 WIN / 13 LOSS și ROI +18,14%** pe 5–7 noiembrie, apoi **12 WIN / 20 LOSS și ROI −27,34%** pe 8–10 noiembrie. **Nu merită activat ca pariu X.**

## Testul de independență: Generosity vs prețuri
La 4.295 capturi valide din 29 octombrie–10 noiembrie:
- Corelație `GH` cu probabilitatea home implicită după eliminarea marjei: **0,955769**.
- Corelație `GA` cu probabilitatea away implicită după eliminarea marjei: **0,950564**.
Corelație mare NU înseamnă identitate sau lipsa completă a informației suplimentare.

Test aparte pe finalul **victorie oaspeți (2)**, orice scor la primul 57:
- Train 29.10–04.11: 2.094 meciuri.
- Development 05–07.11: 1.280 meciuri.
- Later 08–10.11: **921 meciuri**.
- Brier pe 921: piața no-vig **0,140164**; Logistic L2 cu cote/scor **0,144815**; cote/scor + Generosity + variație **0,144891**. Niciunul nu depășește piața.
- În testul cu Away57 selectat 1–1, oaspeți favoriți, cota 2 [1,85;4], EV estimat ≥5%, **zero selecții** în perioada ulterioară pentru ambele modele recalibrate; nu se inventează ROI.

## Traiectoria scorului 47′ → 57′: altă informație, dar instabilă
Modelul Away57 live are `score=1` fix pentru toate meciurile 1–1 și folosește istoricul cotelor/Generosity, dar **nu are explicit în vectorul de 22 de caracteristici cine a egalat între 47′ și 57′**. Comparăm contextul experimental fără modificarea modelului live.

Din 201 meciuri candidate cu 1–1 la 57, cote away 1,85–4, away favorite:
- Dev 29 oct.–7 nov.: stabile 1–1 la 47′ **47 WIN / 63 LOSS, ROI +2,75%**; schimbat scorul **17 WIN /34 LOSS, ROI −21,65%**.
- Ulterior 8–10 nov.: stabile **8 WIN / 14 LOSS, ROI −8,77%**; schimbat scorul **10 WIN / 8 LOSS, ROI +49,00%**.
Efectul SE INVERSEAZĂ între perioade, deci nu se poate trata ca avantaj demonstrat.
- Din 40 de meciuri candidate ulterior, 10 au fost cazuri 1–0 la 47 → 1–1 la 57 (oaspeții au egalat): **5 WIN / 5 LOSS, ROI +38%**, dar în dev 7/21 ROI −17,52%; insuficient și contradictoriu.

### Ablation cu feature de traiectorie pentru toate meciurile 1–1
Model L2 antrenat pe 308 de meciuri; dev 202, later 127. Brier away:
- Dev: piață **0,159106**; model de bază 0,160734; cu tranziții **0,162162**.
- Later: piață **0,158974**; model de bază 0,159885; cu tranziții **0,163710**.
Modelul cu informație de tranziție nu depășește piața. ROI de 5 WIN / 2 LOSS în 7 selecții la modelul de bază (+110%) și 4 WIN / 3 LOSS (+62,14%) cu tranziție sunt subseturi prea mici, iar în dev au fost negative. **Niciun model pentru Away 2 nu este promovat.**

## Artefacte create și verificate în GitHub
- `workers/sb-radar-meta-ai/research-goalless57.js` — ablation 0–0 până la final
- `workers/sb-radar-meta-ai/goalwatch57-shadow-model.json` — coeficienți antrenați și prag fix din train
- `workers/sb-radar-meta-ai/goalwatch57-shadow-predict.js` — predicție fără efecte secundare, doar shadow
- `workers/sb-radar-meta-ai/away-market-vs-generosity-ablation.js` — 4.295 de capturi, Brier și EV
- `workers/sb-radar-meta-ai/away57-transition-ablation.js` — schimbare scor 47–57

## Prioritate următoare
1. Validare **prospectivă** a regulii GOAL WATCH 57+ cu prag fix, doar pe meciuri noi după 11.11; observă ROI doar dacă există cota de piață corespunzătoare, verificată la același timestamp.
2. Crește acoperirea datelor cu signal timestamp, minute și scor, cote Over 0,5 / next goal când sunt disponibile, cu sursă legitimă.
3. Nu folosi modele complexe ca substitut pentru date independente: Generosity și cote sunt puternic corelate.
4. Păstrează Away57, KLOPP, Radio Mov/Roșu și infrastructura nemodificate.

**Limită:** Perioadele au fost analizate retrospectiv și în cercetări anterioare; niciun lot nu mai este un test „orb” complet nepătat. Selecția Goal Watch este promițătoare pentru hit-rate, nu dovedită pentru profit.
