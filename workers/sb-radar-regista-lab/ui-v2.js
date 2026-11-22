/* REGISTA LAB V2 — visual module, no auto-bets and no fake notifications */
(function(){
'use strict';
if(window.__SB_REGISTA_V2__)return;window.__SB_REGISTA_V2__=true;
const STYLE=String.raw`
#sbTripleArchmlwind,#sbTripleArchmlgeneral,#sbrXCoverage,#sbBetaLiveNotice{display:none!important}
#sbRegistaLab{position:relative;display:block!important;visibility:visible!important;opacity:1!important;width:100%;grid-column:1/-1!important;margin:12px 2px 16px;color:#eaf7f7;border:1px solid #386c72;border-radius:17px;overflow:hidden;background:linear-gradient(125deg,#12343c 0%,#112333 55%,#161c2e 100%);box-shadow:0 6px 22px #010a1245;font:12px system-ui,sans-serif}
#sbRegistaLab *{box-sizing:border-box}
#sbRegistaLab>details>summary{display:flex;align-items:center;gap:12px;list-style:none;cursor:pointer;min-height:72px;padding:12px 13px}
#sbRegistaLab summary::-webkit-details-marker{display:none}
#sbRegistaLab .rl-icon{position:relative;flex:0 0 43px;width:43px;height:43px;border-radius:14px;background:radial-gradient(circle at 45% 30%,#466e6b,#1e383e 72%);display:grid;place-items:center;font-size:26px;color:#eafacb;isolation:isolate;box-shadow:0 0 0 1px #98e4d950}
#sbRegistaLab .rl-icon:after{content:"";position:absolute;inset:-5px;border:1px dashed #6eeee0;border-radius:17px;animation:rl-ring 12s linear infinite;pointer-events:none;opacity:.5}
#sbRegistaLab[open] .rl-icon:after,#sbRegistaLab:has(>details[open]) .rl-icon:after{animation-duration:3s;opacity:1}
#sbRegistaLab .rl-icon:before{content:"✧";position:absolute;top:-11px;right:-7px;font-size:17px;color:#b5ffd5;animation:rl-spark 1.5s ease-in-out infinite;pointer-events:none}
@keyframes rl-ring{to{transform:rotate(360deg)}}@keyframes rl-spark{50%{opacity:.25;transform:translateY(5px) scale(.78)}}
#sbRegistaLab .rl-head{min-width:0;flex:1}#sbRegistaLab .rl-head strong{display:block;font-weight:900;font-size:14px;letter-spacing:.07em;color:#ecfff7}#sbRegistaLab .rl-head small{display:block;margin-top:4px;color:#a6c2ca;font-size:10px}
#sbRegistaLab .rl-summary-count{border:1px solid #3b8180;background:#1a4c50;color:#d7fcf1;border-radius:18px;padding:5px 7px;font-size:11px;font-weight:800}
#sbRegistaLab .rl-body{padding:0 13px 13px}#sbRegistaLab .rl-tabs{display:flex;gap:6px;margin:7px 0 10px}
#sbRegistaLab .rl-tab{flex:1;border:1px solid #38716f;background:#132d3d;color:#b6d4d7;padding:9px 6px;border-radius:10px;font-weight:850;font-size:11px;cursor:pointer}
#sbRegistaLab .rl-tab.active{background:#1f6658;border-color:#76e6bc;color:#effff5}
#sbRegistaLab .rl-statline{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:9px 0}
#sbRegistaLab .rl-stat{padding:8px 5px;text-align:center;border-radius:10px;background:#1a303c;border:1px solid #36565f}
#sbRegistaLab .rl-stat b{display:block;color:#dcfff1;font-size:15px;font-variant-numeric:tabular-nums}#sbRegistaLab .rl-stat small{font-size:9px;color:#aac4c9}
#sbRegistaLab .rl-card{background:#192d3c;border:1px solid #335866;border-radius:12px;padding:10px;margin:8px 0;overflow:hidden}
#sbRegistaLab .rl-top{display:flex;justify-content:space-between;gap:10px;align-items:center}#sbRegistaLab .rl-fixture{font-weight:800;font-size:12px;line-height:1.4;color:#efffff}
#sbRegistaLab .rl-pct{white-space:nowrap;color:#9ff2ce;font-size:16px;font-weight:900}#sbRegistaLab .rl-meta{color:#b5cbd0;font-size:10px;margin:5px 0}
#sbRegistaLab .rl-result{font-size:10px;color:#8bd6ca;font-weight:800}
#sbRegistaLab .rl-actions{display:flex;align-items:center;gap:8px;margin-top:8px}
#sbRegistaLab .rl-bet{border:1px solid #96e3a8;background:linear-gradient(90deg,#256f5b,#235b65);font-weight:900;color:#f0fffa;border-radius:9px;padding:8px 10px;cursor:pointer;font-size:11px}
#sbRegistaLab a{color:#92e4dc;font-size:10px;text-decoration:underline}
#sbRegistaLab .rl-warning{background:#3c2c22;border:1px solid #7f5e33;border-radius:10px;padding:10px;margin:10px 0;color:#ffe2a5;line-height:1.45;font-size:11px}
#sbRegistaLab .rl-archive{border:1px solid #365c68;border-radius:12px;margin-top:10px;overflow:hidden}
#sbRegistaLab .rl-archive>summary{cursor:pointer;padding:11px;font-weight:850;background:#1b3640;list-style:none}
#sbRegistaLab .rl-archive .rl-archive-body{padding:8px;max-height:340px;overflow:auto}
@media(prefers-reduced-motion:reduce){#sbRegistaLab .rl-icon:after,#sbRegistaLab .rl-icon:before{animation:none!important}}

/* REGISTA DESIGN V3: compact independent filter, native-feeling animated drawer. */
#live #sbRegistaLab{margin:8px 0 14px!important;width:100%!important;grid-column:1/-1!important;background:linear-gradient(142deg,#0a2c34,#0d2536 57%,#142237)!important;border:1px solid #389c8a!important;box-shadow:0 7px 22px #0006,inset 0 1px #ffffff13!important;}
#sbRegistaLab>details>summary{min-height:68px;position:relative;background:linear-gradient(90deg,#123b3c,#152b43);padding:10px 13px!important}
#sbRegistaLab>details>summary:after{content:"";position:absolute;bottom:0;left:9px;right:9px;height:1px;background:linear-gradient(90deg,transparent,#5ecab76b,transparent);opacity:.6}
#sbRegistaLab .rl-logo-image{width:31px;height:31px;object-fit:contain;filter:drop-shadow(0 1px 5px #95eecb44);z-index:1}
#sbRegistaLab .rl-logo-fallback{font-weight:1000;font-style:italic;color:#e2ffef;font-family:Georgia,serif;font-size:28px;text-shadow:0 0 12px #9bf6d777}
#sbRegistaLab .rl-icon{font-size:21px!important}
#sbRegistaLab .rl-open-arrow{display:grid;place-items:center;color:#a6f7df;transition:transform .3s ease;font-size:15px;flex:0 0 10px}
#sbRegistaLab:has(>details[open]) .rl-open-arrow{transform:rotate(180deg)}
#sbRegistaLab:has(>details[open]){border-color:#79f9d4!important;box-shadow:0 5px 27px #39ccaa38!important}
#sbRegistaLab>details[open]>.rl-body{animation:rl-reveal .36s cubic-bezier(.18,.88,.18,1) both;transform-origin:top}
@keyframes rl-reveal{from{opacity:.12;transform:translateY(-10px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
#sbRegistaLab .rl-head strong{font-size:14px;letter-spacing:.05em}
#sbRegistaLab .rl-head small{font-size:10px}
#sbRegistaLab .rl-statline{grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
#sbRegistaLab .rl-stat{padding:8px 2px;background:linear-gradient(145deg,#173748,#1c3140);border-color:#396779}
#sbRegistaLab .rl-stat b{font-size:15px;line-height:1.35}
#sbRegistaLab .rl-stat small{font-size:9px}
#sbRegistaLab .rl-roi-good b{color:#8ff5b3}#sbRegistaLab .rl-roi-bad b{color:#ffad9d}
#sbRegistaLab .rl-featured{margin:12px 0 11px}
#sbRegistaLab .rl-featured-title{display:flex;justify-content:space-between;align-items:center;margin:5px 1px 7px;gap:7px;font-size:12px;font-weight:900;color:#eafff4}
#sbRegistaLab .rl-featured-title small{font-size:9px;font-weight:600;color:#a5bfc7}
#sbRegistaLab .rl-featured .rl-card{border:1px solid #69e4bd;background:linear-gradient(135deg,#143f36,#14354b 72%,#203c50);padding:11px;box-shadow:0 4px 15px #001a1966}
#sbRegistaLab .rl-featured .rl-card .rl-result{color:#b8ffe4}
#sbRegistaLab .rl-featured .rl-top .rl-fixture{font-size:14px}
#sbRegistaLab .rl-featured .rl-pct{font-size:18px;color:#c9ffe5}
#sbRegistaLab .rl-featured-empty{border:1px dashed #4e837d;border-radius:12px;padding:13px;background:#12313d;color:#b6d7d1;font-size:11px;line-height:1.5}
#sbRegistaLab .rl-observations{border:1px solid #315970;border-radius:12px;background:#132635;margin-top:10px;overflow:hidden}
#sbRegistaLab .rl-observations>summary{display:flex;justify-content:space-between;gap:8px;list-style:none;cursor:pointer;padding:11px 10px;font-size:11px;color:#bbd7e1;font-weight:850}
#sbRegistaLab .rl-observations>summary:after{content:"⌄";color:#8fe8ce}
#sbRegistaLab .rl-observations[open]>.rl-observe-content{animation:rl-reveal .32s ease both;padding:2px 9px 9px}
#sbRegistaLab .rl-archive[open]>.rl-archive-body{animation:rl-reveal .3s ease both}
#sbRegistaLab .rl-bet{min-height:37px;box-shadow:0 3px 12px #42b78c22}
#sbRegistaLab .rl-source-note{font-size:10px;color:#9bbebf;margin-top:10px}
#sbPendingAlertList>.sb-pending-entry.regista{border-left:3px solid #65edbf;background:linear-gradient(120deg,#183b3b,#192e43);box-shadow:inset 0 1px #a2fbd113}
#sbPendingAlertList>.sb-pending-entry.regista .sb-pending-filter{color:#91f4cf}
#sbPendingAlertList>.sb-pending-entry.regista .sb-pending-meta{color:#9bdccc}
#sbPendingAlertList>.sb-pending-entry.regista .sb-pending-actions{grid-column:2}
#sbPendingAlertList>.sb-pending-entry.regista .sb-pending-actions button{background:#174d43;color:#eafff4;border:1px solid #479b80}
@media(max-width:380px){#sbRegistaLab .rl-head strong{font-size:12px}#sbRegistaLab .rl-stat b{font-size:13px}}
@media(prefers-reduced-motion:reduce){#sbRegistaLab>details[open]>.rl-body,#sbRegistaLab .rl-observations[open]>.rl-observe-content{animation:none}}

/* REGISTA V4 compact Golden/GAP archive-inspired 24h/7d result blocks */
#sbRegistaLab .rl-period-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:11px 0 9px}
#sbRegistaLab .rl-period{display:grid;place-items:center;gap:4px;min-width:0;border:1px solid #5a7779;border-radius:15px;background:linear-gradient(125deg,#111c2d,#162336);padding:11px 4px}
#sbRegistaLab .rl-period small{font-size:10px;font-weight:1000;color:#a7ecd5;letter-spacing:.05em}
#sbRegistaLab .rl-period strong{font-size:11px;color:#a7cbd0}
#sbRegistaLab .rl-period b{font-size:16px;color:#e3fff1}
#sbRegistaLab .rl-period em{font-size:11px;font-weight:900;font-style:normal;color:#a5b6bd}
#sbRegistaLab .rl-totals{display:flex;gap:5px;flex-wrap:wrap;justify-content:space-between;margin:0 0 10px}
#sbRegistaLab .rl-totals span{display:flex;align-items:center;gap:4px;border:1px solid #335d66;background:#14323f;border-radius:9px;padding:6px 7px;color:#bfdcda;font-size:10px;white-space:nowrap}
#sbRegistaLab .rl-totals b{color:#d2ffee}
#sbRegistaLab .rl-featured-title{display:block;color:#baffdf}
#sbRegistaLab .rl-featured-title small{display:block;margin-top:5px;line-height:1.4}
#sbRegistaLab .rl-card.rl-alert-emitted{background:linear-gradient(125deg,#173c41,#182c45);border-left:4px solid #62deb4;border-top-color:#51bba4;border-right-color:#346e77;border-bottom-color:#396978;box-shadow:0 6px 17px #0005;padding:12px}
#sbRegistaLab .rl-card.rl-alert-emitted .rl-fixture{font-size:14px;font-weight:900}
#sbRegistaLab .rl-card.rl-alert-emitted .rl-pct{font-size:17px;color:#baffda}
#sbRegistaLab .rl-card.rl-alert-emitted .rl-result{padding:7px 8px;background:#1b4a4c;border-radius:9px;margin:6px 0}
#sbRegistaLab .rl-card.rl-alert-expired{border-left-color:#65969a}
#sbRegistaLab .rl-alert-meta{font-size:11px;line-height:1.6;margin:8px 0;color:#d6f8ed}
#sbRegistaLab .rl-live-price{font-size:10px;color:#9bd6cf;margin:3px 0 7px}
#sbRegistaLab .rl-bet{min-height:38px;border-radius:10px}

/* HOME SNEAK PEEK V1: narrow, fast, all three filters without inventing advance BET NOW. */
body.sb-peek-home-v1 #sbGlobalSearch:not(.sb-peek-search-open){display:none!important}
body.sb-peek-home-v1 #sbGlobalSearch.sb-peek-search-open{display:block!important;margin:7px 0 12px!important;animation:sb-peek-in .23s ease both}
#live #sbPeekHub{position:relative;display:grid;gap:8px;margin:5px 0 12px!important;padding:11px 9px;background:linear-gradient(130deg,#102535,#132739 72%,#142735);border:1px solid #377b78;border-radius:17px;box-shadow:inset 0 1px #ffffff16,0 5px 21px #0003;color:#e8faf8}
#sbPeekHub .sb-peek-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 2px}
#sbPeekHub .sb-peek-eye{font-weight:1000;color:#e9ffef;letter-spacing:.065em;font-size:12px}
#sbPeekHub .sb-peek-eye small{font-size:9px;color:#8cbdb7;letter-spacing:0;margin-left:5px}
#sbPeekSearchToggle{cursor:pointer;min-height:31px;border:1px solid #43847f;background:#183b46;border-radius:9px;padding:5px 11px;color:#d4fff6;font-size:11px;font-weight:850}
#sbPeekHub .sb-peek-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
#sbPeekHub .sb-peek-tile{display:flex;flex-direction:column;align-items:flex-start;gap:5px;cursor:pointer;min-width:0;min-height:86px;padding:10px 8px;text-align:left;background:#132231;border:1px solid #4f6277;border-radius:13px;transition:transform .18s ease,background .18s ease}
#sbPeekHub .sb-peek-tile:active{transform:scale(.97)}
#sbPeekHub .sb-peek-tile span{font-size:10px;font-weight:950;letter-spacing:.035em;white-space:nowrap}
#sbPeekHub .sb-peek-tile strong{font-size:12px;font-weight:950;color:#e8fff7;line-height:1.25;min-height:26px;max-width:100%;overflow-wrap:break-word}
#sbPeekHub .sb-peek-tile small{font-size:9px;line-height:1.35;font-weight:650;color:#c1d3d8;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#sbPeekHub .sb-peek-gold{border-color:#987747;background:linear-gradient(130deg,#28231e,#222332)}
#sbPeekHub .sb-peek-gold span{color:#f4ce88}
#sbPeekHub .sb-peek-navy{border-color:#3166a2;background:linear-gradient(130deg,#142945,#172437)}
#sbPeekHub .sb-peek-navy span{color:#93caff}
#sbPeekHub .sb-peek-regista{border-color:#379e80;background:linear-gradient(130deg,#123b39,#1b303e)}
#sbPeekHub .sb-peek-regista span{color:#92efc2}
#sbPeekUpcoming{border:1px solid #355e67;border-radius:10px;background:#122431;overflow:hidden}
#sbPeekUpcoming>summary{display:flex;align-items:center;justify-content:space-between;gap:9px;padding:9px 10px;cursor:pointer;color:#c7ede6;font-size:11px;font-weight:850;list-style:none}
#sbPeekUpcoming>summary:after{content:"⌄";color:#7acfb1}
#sbPeekUpcoming>summary b{font-size:10px;color:#8ddfcb;margin-left:auto}
#sbPeekUpcoming[open]>summary{border-bottom:1px solid #3b6269}
#sbPeekUpcomingList{display:grid;padding:4px 8px}
.sb-peek-upcoming-row{background:none!important;border:0!important;border-bottom:1px solid #33525f!important;box-shadow:none!important;border-radius:0!important;padding:10px 4px!important;display:flex!important;gap:9px;align-items:flex-start;text-align:left!important;width:100%;color:#e5fbf4;cursor:pointer}
.sb-peek-upcoming-row:last-child{border-bottom:0!important}
.sb-peek-upcoming-row>strong{white-space:nowrap;flex:0 0 43px;color:#a5eec9;font-size:11px}
.sb-peek-upcoming-row>span{min-width:0;display:grid;gap:4px}
.sb-peek-upcoming-row b{font-size:11px;font-weight:850}
.sb-peek-upcoming-row small{font-size:10px;color:#a9ccd4;line-height:1.35}
.sb-peek-disclaimer{font-size:9px;color:#a1bfc0;line-height:1.45;margin:3px 10px 12px}
#live #sbPeekRoadDrawer{display:block;margin:8px 0 10px;border:1px solid #526878;border-radius:14px;background:linear-gradient(120deg,#152937,#152238);overflow:hidden}
#live #sbPeekRoadDrawer>summary{display:grid!important;grid-template-columns:minmax(0,1fr) auto;gap:4px 8px;align-items:center;min-height:54px;padding:9px 12px;list-style:none;cursor:pointer;color:#e4eefe;font-size:11px;font-weight:900}
#sbPeekRoadDrawer>summary .sb-peek-road-titles{grid-column:1;min-width:0;white-space:normal;color:#dce9fa}
#sbPeekRoadDrawer>summary .sb-peek-road-regista{grid-column:1/-1;grid-row:2;min-width:0;font-size:10px;font-weight:800;color:#91dfc9;line-height:1.4}
#sbPeekRoadDrawer>summary .sb-peek-chevron{grid-column:2;grid-row:1}
#sbPeekRoadDrawer>summary #sbPeekRoadHint{display:none!important}
#sbPeekRoadDrawer>summary #sbPeekRoadHint{font-size:10px;color:#a3cddd;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#sbPeekRoadDrawer .sb-peek-separator{opacity:.4}
#sbPeekRoadDrawer .sb-peek-chevron{color:#7ecbb5;transition:transform .2s}
#sbPeekRoadDrawer[open] .sb-peek-chevron{transform:rotate(180deg)}
#live #sbPeekRoadDrawer #sb57TopDuo{margin:6px 8px 10px!important}
#live #sbPeekRoadDrawer[open] #sb57TopDuo{animation:sb-peek-in .25s ease both}
#live #sbPeekRadarNotice{display:flex;align-items:center;gap:8px;width:calc(100% - 8px);max-width:100%;margin:10px 4px 2px;padding:9px 10px;border:1px solid #438d75;border-radius:12px;background:linear-gradient(95deg,#153e36,#142e43);color:#cef8e4;text-align:left;cursor:pointer;min-height:40px;font-size:10px;font-weight:800}
#sbPeekRadarNotice[hidden]{display:none!important}
#sbPeekRadarNotice .sb-peek-radar-dot{display:grid;place-items:center;width:22px;height:22px;background:#255e48;border:1px solid #55b890;border-radius:50%;color:#d9ffe5;box-shadow:0 0 12px #60e6a63c;animation:sb-peek-breathe 2.5s infinite ease-in-out}
#sbPeekRadarText{flex:1;min-width:0;line-height:1.35}
@keyframes sb-peek-in{from{opacity:.1;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}
@keyframes sb-peek-breathe{0%,100%{box-shadow:0 0 5px #60e6a63a}50%{box-shadow:0 0 15px #60e6a69d}}
@media(max-width:370px){#sbPeekHub .sb-peek-tile{padding:8px 6px;min-height:89px}#sbPeekHub .sb-peek-tile span{font-size:9px}#sbPeekHub .sb-peek-tile strong{font-size:11px}#sbPeekRoadDrawer>summary{font-size:10px}}
@media(prefers-reduced-motion:reduce){#sbPeekRadarNotice .sb-peek-radar-dot{animation:none}#live #sbPeekRoadDrawer[open] #sb57TopDuo{animation:none}}
`;
const css=document.createElement('style');css.id='sbRegistaLabV2Css';css.textContent=STYLE;document.head.append(css);
function mount(){
let live=document.getElementById('live');if(!live)return false;
let section=document.getElementById('sbRegistaLab');
if(!section){section=document.createElement('section');section.id='sbRegistaLab';live.insertBefore(section,live.firstChild);}
section.style.setProperty('display','block','important');
section.style.setProperty('visibility','visible','important');
section.style.setProperty('opacity','1','important');
section.style.setProperty('grid-column','1 / -1','important');
section.style.setProperty('width','100%','important');
section.removeAttribute('hidden');
section.innerHTML='<details id="rlDetails"><summary><span class="rl-icon"><img class="rl-logo-image" src="/api/public/regista-logo" alt="Regista" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="rl-logo-fallback" hidden>R</span></span><span class="rl-head"><strong>REGISTA · BET NOW</strong><small>Value experimental · selecții 1 / 2 · cote Superbet</small></span><span class="rl-summary-count" id="rlSummaryCount">—</span><span class="rl-open-arrow">⌄</span></summary><div class="rl-body"><div class="rl-period-grid"><div class="rl-period"><small>ULTIMELE 24H</small><strong id="rl24">—</strong><b id="rl24Wl">—</b><em id="rl24Roi">ROI —</em></div><div class="rl-period"><small>ULTIMELE 7 ZILE</small><strong id="rl7d">—</strong><b id="rl7dWl">—</b><em id="rl7dRoi">ROI —</em></div></div><div class="rl-totals"><span>WIN / LOSS <b id="rlWl">—</b></span><span>ROI REAL <b id="rlRoiReal">—</b></span><span>ROI SIM 50 LEI <b id="rlRoi">—</b></span></div><div class="rl-featured"><div class="rl-featured-title">✧ BET NOW · ALERTE EMISE <small>Se păstrează după start. LIVE înseamnă bilet în curs; BET NOW e doar înaintea meciului.</small></div><div id="rlFeaturedCards"></div></div><div id="rlSourceStatus" class="rl-warning">Verific sursa Regista…</div><details class="rl-observations" id="rlObservations"><summary>☷ Pronosticuri originale Regista · Full / League / Top 10</summary><div class="rl-observe-content"><div class="rl-tabs"><button class="rl-tab active" data-rlt="FULL">FULL</button><button class="rl-tab" data-rlt="LEAGUE">LEAGUE</button><button class="rl-tab" data-rlt="TOP10">TOP 10</button></div><div id="rlCards"></div></div></details><details class="rl-archive" id="rlArchive"><summary>▤ Istoric WIN / LOSS · selecții observate</summary><div class="rl-archive-body" id="rlArchiveBody">Se verifică…</div></details><div class="rl-source-note">ROI SIM = calcul prospectiv, nu profit real. <a href="https://www.registacalcio.it/en/schedina" target="_blank" rel="noopener noreferrer">Sursa Regista</a></div></div></details>';
if(section.parentElement!==live)live.insertBefore(section,live.firstChild);
else if(section!==live.firstElementChild)live.insertBefore(section,live.firstChild);
section.querySelectorAll('.rl-tab').forEach(b=>b.onclick=()=>{section.querySelectorAll('.rl-tab').forEach(x=>x.classList.toggle('active',x===b));current=b.dataset.rlt;render();});
section.querySelector('#rlDetails').addEventListener('toggle',ev=>{if(ev.target.open)poll(true)});
return true;
}
let current='LEAGUE',model={items:[],counts:{},sync:null},busy=false,lastAt=0;
function txt(el,s){if(el)el.textContent=String(s);}
function resultName(item){if(item.result_status==='WIN')return '✓ WIN';if(item.result_status==='LOSS')return '✕ LOSS';if(item.signal_emitted){if(item.status==='BET_NOW')return '● BET NOW ACTIV · notificare emisă';if(item.status==='PRICE_CHANGED')return '◷ BET NOW EMIS · cota s-a schimbat';if(item.status==='QUOTE_STALE')return '◷ BET NOW EMIS · captură actuală lipsă';return '◷ BET NOW EMIS · fereastra închisă';}if(item.status==='MATCHED')return item.price_status==='NO_VALUE'?'PRONOSTIC · fără avantaj la cotă':item.price_status==='VALUE_CANDIDATE'?'PRONOSTIC VALUE · în observație':'PRONOSTIC · în observație';return item.status==='UNVERIFIED_SOURCE'?'Sursă neconfirmată':'Pronostic informativ · neconfirmat';}
function fillRegistaSlip(item){
 const eventId=Number(item?.event_id),selection=String(item?.market||'').toUpperCase(),odds=Number(item?.odds_at_signal);
 if(!Number.isSafeInteger(eventId)||eventId<1||!['1','X','2'].includes(selection)||!Number.isFinite(odds)||odds<=1)return false;
 const old=document.getElementById('fixture');
 if(old&&old.value.trim()&&old.value.trim()!==String(item.fixture||'').trim()&&typeof sbBetSaved!=='undefined'&&!sbBetSaved){
  if(!window.confirm('Înlocuiești biletul incomplet din Slip cu selecția Regista?'))return false;
 }
 if(typeof selectBet==='function')selectBet({event_id:eventId,fixture:item.fixture,px:null,fresh:false,sb_regista:true});
 else if(typeof tab==='function')tab('slip');
 const sel=document.getElementById('selection');
 if(sel){
  if(!Array.from(sel.options).some(o=>o.value===selection)){
   const opt=document.createElement('option');opt.value=selection;opt.textContent=selection==='1'?'1 • Victorie gazde':selection==='2'?'2 • Victorie oaspeți':'X • Egal';sel.append(opt);
  }
  sel.value=selection;sel.dispatchEvent(new Event('change',{bubbles:true}));
 }
 const ev=document.getElementById('eventId'),fi=document.getElementById('fixture'),price=document.getElementById('odds'),stake=document.getElementById('stake');
 if(ev)ev.value=String(eventId);if(fi)fi.value=String(item.fixture||'');if(price)price.value=odds.toFixed(2);
 if(stake)stake.value='50';
 window.__sbRegistaSlipContext={signal_id:String(item.signal_id||''),event_id:eventId,selection};
 const info=document.getElementById('betmsg');
 if(info){info.className='sub sb-bet-message';info.textContent='♜ REGISTA '+String(item.list_code||'')+' · '+selection+' · '+odds.toFixed(2)+' este COTA SALVATĂ LA SEMNAL, nu confirmarea cotei de pe biletul tău. Completează cota și ORA REALĂ ale pariului deja plasat înainte de Înregistrează. Nu se plasează un nou pariu.';}
 if(typeof sbUpdateBetPreview==='function')sbUpdateBetPreview();
 const sc=document.getElementById('slip');if(sc)sc.scrollIntoView({block:'start',behavior:'smooth'});
 return true;
}
function registaMatchPanel(eventId){
 const id=Number(eventId),root=document.getElementById('routeBody');
 if(!Number.isSafeInteger(id)||id<1||!root||document.getElementById('routeBackdrop')?.classList.contains('hidden'))return;
 const candidates=(model.items||[]).filter(x=>Number(x.event_id)===id&&x.signal_emitted&&['1','X','2'].includes(String(x.market||'').toUpperCase())&&Number(x.odds_at_signal)>1);
 if(!candidates.length)return;
 const seq={LEAGUE:0,FULL:1,TOP10:2},item=candidates.sort((a,b)=>(seq[a.list_code]??9)-(seq[b.list_code]??9))[0];
 const existing=root.querySelector('[data-regista-event]');
 if(existing&&existing.dataset.registaEvent===String(id))return;
 if(existing)existing.remove();
 const panel=document.createElement('section');panel.dataset.registaEvent=String(id);
 panel.style.cssText='margin:10px 0;padding:12px;border:1px solid #51b899;border-radius:13px;background:linear-gradient(120deg,#123d3b,#142634);color:#e4fff3;box-shadow:0 5px 18px #0003';
 const title=document.createElement('strong');title.textContent='♜ REGISTA · SELECȚIA SALVATĂ LA ALERTĂ';
 title.style.cssText='display:block;font-size:12px;letter-spacing:.04em';
 const info=document.createElement('div');info.textContent=String(item.fixture||'')+' · '+String(item.market)+' @ '+Number(item.odds_at_signal).toFixed(2)+' · estimare '+Number(item.probability_pct).toFixed(0)+'%';
 info.style.cssText='margin:7px 0;font-size:14px;font-weight:750';
 const stamp=document.createElement('small');stamp.textContent='Cota la semnal '+(item.quote_captured_utc?new Date(item.quote_captured_utc).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest',hour:'2-digit',minute:'2-digit'}):'—')+'; nu este neapărat cota actuală sau cea acceptată pe bilet.';
 stamp.style.cssText='display:block;color:#b5d8cb;margin-bottom:9px';
 const button=document.createElement('button');button.type='button';button.className='rl-bet';button.textContent='▤ Înregistrează în Slip · miză 50 lei';button.onclick=()=>fillRegistaSlip(item);
 panel.append(title,info,stamp,button);
 root.insertBefore(panel,root.firstChild); // Keep Regista pick visible above loading and offline audit messages
}
let lastOpenedRegistaEvent=0;
document.addEventListener('sb-regista-match-open',event=>{
 const id=Number(event.detail?.event_id);if(!Number.isSafeInteger(id)||id<1)return;
 lastOpenedRegistaEvent=id;
 if((model.items||[]).length){registaMatchPanel(id);return;}
 // Authentication and Regista polling can finish after the match sheet opens.
 const retry=()=>registaMatchPanel(id);setTimeout(retry,1200);setTimeout(retry,3500);
});
function card(item){
 const el=document.createElement('article');el.className='rl-card';
 if(item.signal_emitted){el.classList.add('rl-alert-emitted');if(item.status!=='BET_NOW')el.classList.add('rl-alert-expired');}
 const title=document.createElement('div');title.className='rl-top';
 const name=document.createElement('div');name.className='rl-fixture';
 name.textContent=String(item.fixture||'Meci necunoscut').replace(/[·•]/g,' – ');
 const prob=document.createElement('strong');prob.className='rl-pct';
 prob.textContent=Number.isFinite(Number(item.probability_pct))?Number(item.probability_pct).toFixed(0)+'%':'—';
 title.append(name,prob);el.append(title);
 const meta=document.createElement('div');meta.className=item.signal_emitted?'rl-alert-meta':'rl-meta';
 const market=String(item.market||'').toUpperCase(),markets={'1':'Victorie gazde','2':'Victorie oaspeți','X':'Egal'};
 meta.textContent=(markets[market]||market||'Selecție')+' · '+market+(Number(item.odds_at_signal)>1?' @ '+Number(item.odds_at_signal).toFixed(2)+' · COTĂ LA SEMNAL':' · cotă neconfirmată');
 el.append(meta);
 if(item.signal_emitted){
  const live=document.createElement('div');live.className='rl-live-price';
  const at=item.signal_utc?new Date(item.signal_utc).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
  const fresh=Number(item.current_odds)>1&&Date.now()-Date.parse(item.current_quote_utc)<20*60000&&Date.now()<Date.parse(item.kickoff_utc);
  live.textContent='Alertă '+at+(fresh?' · cota mai recentă '+Number(item.current_odds).toFixed(2)+' (verifică în Superbet)':' · cotă actuală neconfirmată');
  el.append(live);
 }
 const result=document.createElement('div');result.className='rl-result';
 result.textContent=resultName(item)+(item.result_status==='WIN'||item.result_status==='LOSS'?' · '+(item.final_home??'—')+'–'+(item.final_away??'—'):'');el.append(result);
 const actions=document.createElement('div');actions.className='rl-actions';
 if(item.signal_emitted&&Number.isSafeInteger(Number(item.event_id))&&Number(item.event_id)>0&&['1','X','2'].includes(market)&&Number(item.odds_at_signal)>1){
  const btn=document.createElement('button');btn.className='rl-bet';btn.type='button';
  btn.textContent='▤ În Slip · '+market+' @'+Number(item.odds_at_signal).toFixed(2)+' · 50 lei';btn.onclick=()=>fillRegistaSlip(item);actions.append(btn);
 }
 if(Number.isSafeInteger(Number(item.event_id))&&Number(item.event_id)>0){
  const btn=document.createElement('button');btn.className='rl-bet';btn.type='button';btn.textContent='Fișa';
  btn.onclick=()=>registaOpenMatch(Number(item.event_id));actions.append(btn);
 }
 el.append(actions);return el;
}
function registaOpenMatch(eventId){
 const id=Number(eventId);
 if(!Number.isSafeInteger(id)||id<=0)return;
 lastOpenedRegistaEvent=id;
 if(typeof focusEvent==='function'){
  try{const promise=focusEvent(id);if(promise?.then)promise.then(()=>registaMatchPanel(id)).catch(()=>{});}
  catch(e){console.warn('REGISTA_OPEN_MATCH',String(e));}
 }
 setTimeout(()=>registaMatchPanel(id),600);
 setTimeout(()=>registaMatchPanel(id),1800);
}
function renderRegistaChecklist(){
 const box=document.getElementById('sbRadarLast'),root=document.getElementById('sbPendingAlertList');
 if(!box||!root)return;
 const now=Date.now(),seen=new Set();
 const items=(model.items||[]).filter(x=>{
  if(!x.signal_emitted)return false;
  const at=Date.parse(x.signal_utc||'');
  return Number.isSafeInteger(Number(x.event_id))&&Number(x.event_id)>0&&Number(x.odds_at_signal)>1&&
   Number.isFinite(at)&&at<=now&&at>=now-48*3600000&&['1','X','2'].includes(String(x.market||'').toUpperCase());
 }).sort((a,b)=>Date.parse(b.signal_utc)-Date.parse(a.signal_utc))
  .filter(x=>{const key=String(x.event_id)+':'+String(x.market);if(seen.has(key))return false;seen.add(key);return true;});
 const betList=(typeof dashboard!=='undefined'&&Array.isArray(dashboard?.bets))?dashboard.bets:[];
 const sig=items.map(x=>[x.event_id,x.market,x.status,x.result_status,x.signal_utc,x.odds_at_signal,betList.find(b=>Number(b.event_id)===Number(x.event_id)&&String(b.selection)===String(x.market))?.id||0]).join('|');
 const existing=[...root.querySelectorAll('[data-regista-checklist]')];
 if(root.dataset.sbRegistaSignature===sig&&existing.length===items.length)return;
 existing.forEach(el=>el.remove());
 root.dataset.sbRegistaSignature=sig;
 if(items.length){
  root.querySelectorAll(':scope > .sb-pending-empty').forEach(el=>{el.style.display='none';});
 }
 for(const item of items){
  const id=Number(item.event_id),inSlip=betList.find(b=>Number(b.event_id)===id&&String(b.selection)===String(item.market)),key='sb_regista_manual_check_'+id+':'+String(item.market);
  let manually=false;try{manually=localStorage.getItem(key)==='1'}catch(_){}
  const row=document.createElement('div');row.className='sb-pending-entry regista'+(inSlip||manually?' checked':'');row.dataset.registaChecklist=String(id);row.dataset.registaSelection=String(item.market);
  const check=document.createElement('input');check.type='checkbox';check.className='sb-pending-checkbox';check.checked=!!inSlip||manually;check.disabled=!!inSlip;
  check.title=inSlip?'Înregistrat în Slip':'Marchează doar dacă ai plasat personal biletul; această bifă nu îl înregistrează în Slip.';
  check.onchange=()=>{try{if(check.checked)localStorage.setItem(key,'1');else localStorage.removeItem(key);}catch(_){} row.classList.toggle('checked',check.checked);const state=row.querySelector('.sb-pending-state');if(state)state.textContent=check.checked?'✓ BIFAT MANUAL · neconfirmat în Slip':'○ NEÎNREGISTRAT ÎN SLIP';};
  const body=document.createElement('div');body.className='sb-pending-content';
  const head=document.createElement('div');head.className='sb-pending-top';
  const badge=document.createElement('span');badge.className='sb-pending-filter';badge.textContent='♜ REGISTA · VALUE';
  const time=document.createElement('time');time.className='sb-pending-time';time.textContent=new Date(item.signal_utc).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest',hour:'2-digit',minute:'2-digit'});
  head.append(badge,time);
  const fixture=document.createElement('div');fixture.className='sb-pending-fixture';fixture.textContent=String(item.fixture);
  const meta=document.createElement('div');meta.className='sb-pending-meta';meta.textContent='Se detectează '+String(item.market)+' @ '+Number(item.odds_at_signal).toFixed(2)+' · '+Number(item.probability_pct).toFixed(0)+'% Regista · EV estimat '+(Number(item.ev_pct)>=0?'+':'')+Number(item.ev_pct||0).toFixed(1)+'%';
  const state=document.createElement('div');state.className='sb-pending-state';
  state.textContent=inSlip?'✓ ÎN SLIP · bilet #'+String(inSlip.id):manually?'✓ BIFAT MANUAL · neconfirmat în Slip':item.result_status?'Rezultat '+item.result_status:'○ NEÎNREGISTRAT ÎN SLIP · cotă salvată';
  body.append(head,fixture,meta,state);
  const actions=document.createElement('div');actions.className='sb-pending-actions';
  const show=document.createElement('button');show.type='button';show.textContent='Fișa meciului';show.onclick=()=>registaOpenMatch(id);
  const slip=document.createElement('button');slip.type='button';slip.textContent=inSlip?'✓ În Slip':'＋ În SLIP';
  slip.onclick=()=>{if(inSlip&&typeof openTicketDetails==='function')openTicketDetails(Number(inSlip.id));else fillRegistaSlip(item);};
  actions.append(show,slip);row.append(check,body,actions);
  root.prepend(row);
 }
 const clock=box.querySelector('.sb-radar-last-head time');
 if(clock){
  const base=(clock.textContent||'').replace(/ · ♜ \d+ REGISTA(?:.*)?$/,'');
  clock.textContent=base+(items.length?' · ♜ '+items.filter(x=>!betList.some(b=>Number(b.event_id)===Number(x.event_id)&&String(b.selection)===String(x.market))).length+' REGISTA':'');
 }
}


/* HOME SNEAK PEEK V1 — UI only, never grants BET NOW or emits alerts. */
function sbPeekTime(ts){
 const n=Date.parse(ts||'');
 return Number.isFinite(n)?new Date(n).toLocaleTimeString('ro-RO',{timeZone:'Europe/Bucharest',hour:'2-digit',minute:'2-digit',hour12:false}):'—';
}
function sbPeekCountdown(ms){
 if(!Number.isFinite(ms))return '—';
 if(ms<=0)return 'ACUM';
 const m=Math.ceil(ms/60000),h=Math.floor(m/60);
 return h>0?h+'h '+String(m%60).padStart(2,'0')+'m':m+' min';
}
function sbPeekUpcoming(){
 const now=Date.now(),seen=new Set();
 return (model.items||[]).filter(x=>{
  const k=Date.parse(x.kickoff_utc),observed=Date.parse(x.source_last_seen_utc||'');
  return k>now+3*60000&&k<now+7*86400000&&Number(x.event_id)>0&&Number(x.match_confidence)>=.98&&
   Number.isFinite(observed)&&observed<=now+60000&&now-observed<3*3600000&&
   x.result_status!=='WIN'&&x.result_status!=='LOSS';
 }).sort((a,b)=>Date.parse(a.kickoff_utc)-Date.parse(b.kickoff_utc))
 .filter(x=>{
  const key=String(x.event_id)+':'+String(x.market);
  if(seen.has(key))return false;seen.add(key);return true;
 }).slice(0,16);
}
function sbPeekFutureOneTwo(rows){
 // This is a candidate to RECHECK, not an early BET NOW decision.
 return rows.find(x=>['1','2'].includes(String(x.market||'').toUpperCase()))||null;
}
function sbPeekWatchState(kind){
 const d=(typeof dashboard!=='undefined'&&dashboard&&typeof dashboard==='object')?dashboard:{};
 const alerts=kind==='golden'?(d.alerts||[]).filter(a=>/GOLDEN/i.test(String(a.signal_source||a.source||a.model_version||''))):d.gapNavy||[];
 const now=Date.now(),fresh=alerts.filter(x=>{const t=Date.parse(x.triggered_utc||'');return Number.isFinite(t)&&t<=now&&now-t<20*60000;});
 if(fresh.length)return {title:fresh.length+' confirmat',note:String(fresh[0]?.fixture||'Semnal emis'),urgent:true};
 const unique=new Set(),all=[...(d.radar||[]),...(d.watchlist||[])],watch=[];
 for(const x of all){
  const id=Number(x.event_id),min=Number(x.minute);
  if(!Number.isSafeInteger(id)||id<1||unique.has(id)||!x.fresh||!Number.isFinite(min))continue;
  const z=String(x.score||'').replace(/[–—−]/g,'-').replace(/\s/g,'')==='0-0'||(x.home_score!=null&&x.away_score!=null&&Number(x.home_score)===0&&Number(x.away_score)===0);
  const check=kind==='golden'?min>=45&&min<57:min>=39&&min<50;
  if(z&&check){unique.add(id);watch.push({remaining:(kind==='golden'?57:50)-min,name:String(x.fixture||'Meci monitorizat')});}
 }
 watch.sort((a,b)=>a.remaining-b.remaining);
 if(watch.length)return {title:watch[0].remaining+'′ până la '+(kind==='golden'?'57′':'50′'),note:watch[0].name,urgent:false};
 return {title:kind==='golden'?'La minutul 57′':'La minutul 50′',note:'Fără candidat prioritar acum',urgent:false};
}
function sbPeekMount(){
 const live=document.getElementById('live');if(!live)return false;
 document.body.classList.add('sb-peek-home-v1');
 let hub=document.getElementById('sbPeekHub');
 if(!hub){
  hub=document.createElement('section');hub.id='sbPeekHub';hub.setAttribute('aria-label','Rezumat rapid Golden GAP Regista');
  hub.innerHTML='<div class="sb-peek-head"><span class="sb-peek-eye">◈ SNEAK PEEK <small>CE URMEAZĂ</small></span><button id="sbPeekSearchToggle" type="button" aria-expanded="false" aria-controls="sbGlobalSearch">⌕ Caută</button></div>'+
   '<div class="sb-peek-tiles">'+
     '<button type="button" class="sb-peek-tile sb-peek-gold" id="sbPeekGolden"><span>🟡 GOLDEN</span><strong id="sbPeekGoldenTime">57′</strong><small id="sbPeekGoldenMatch">Monitorizare</small></button>'+
     '<button type="button" class="sb-peek-tile sb-peek-navy" id="sbPeekGap"><span>🔵 GAP</span><strong id="sbPeekGapTime">50′</strong><small id="sbPeekGapMatch">Monitorizare</small></button>'+
     '<button type="button" class="sb-peek-tile sb-peek-regista" id="sbPeekRegista"><span>♜ REGISTA</span><strong id="sbPeekRegTime">Se verifică…</strong><small id="sbPeekRegMatch">Program pre-meci</small></button>'+
   '</div>'+
   '<details id="sbPeekUpcoming"><summary><span>♜ Următoarele meciuri Regista</span><b id="sbPeekUpcomingCount">—</b></summary><div id="sbPeekUpcomingList">Se citesc pronosticurile Regista…</div><p class="sb-peek-disclaimer">Pronosticurile viitoare NU sunt BET NOW. Confirmarea necesită cotă 1/2 recentă și control de valoare în fereastra pre-meci.</p></details>';
  live.prepend(hub);
  hub.querySelector('#sbPeekGolden').addEventListener('click',()=>{const drawer=document.getElementById('sbPeekRoadDrawer');if(drawer)drawer.open=true;(drawer||document.getElementById('sb57TopDuo'))?.scrollIntoView({behavior:'smooth',block:'start'});});
  hub.querySelector('#sbPeekGap').addEventListener('click',()=>{const drawer=document.getElementById('sbPeekRoadDrawer');if(drawer)drawer.open=true;(drawer||document.getElementById('sb57TopDuo'))?.scrollIntoView({behavior:'smooth',block:'start'});});
  hub.querySelector('#sbPeekRegista').addEventListener('click',()=>{const d=document.getElementById('rlDetails');if(d)d.open=true;document.getElementById('sbRegistaLab')?.scrollIntoView({behavior:'smooth',block:'start'});});
  hub.querySelector('#sbPeekSearchToggle').addEventListener('click',()=>{
   const search=document.getElementById('sbGlobalSearch');if(!search)return;
   const open=!search.classList.contains('sb-peek-search-open');
   search.classList.toggle('sb-peek-search-open',open);
   hub.querySelector('#sbPeekSearchToggle').setAttribute('aria-expanded',String(open));
   if(open){search.scrollIntoView({behavior:'smooth',block:'nearest'});setTimeout(()=>document.getElementById('historicFind')?.focus(),90);}
  });
 }
 // Preserve existing road-to-57 DOM and events, simply fold the large section.
 const road=document.getElementById('sb57TopDuo');
 if(road&&!road.closest('#sbPeekRoadDrawer')){
  let drawer=document.getElementById('sbPeekRoadDrawer');
  if(!drawer){
   drawer=document.createElement('details');drawer.id='sbPeekRoadDrawer';drawer.open=false;
   drawer.innerHTML='<summary><span class="sb-peek-road-titles">🟡 GOLDEN 57′ <span class="sb-peek-separator">/</span> 🔵 GAP 50′</span><strong id="sbPeekRoadHint">Monitorizare</strong><span class="sb-peek-road-regista" id="sbPeekRoadRegista">♜ REGISTA · următoarea verificare se calculează</span><span class="sb-peek-chevron">⌄</span></summary>';
   road.parentNode.insertBefore(drawer,road);
  }
  drawer.append(road);
 }
 const radarCard=document.querySelector('#live .radar-card');
 if(radarCard&&!document.getElementById('sbPeekRadarNotice')){
  const note=document.createElement('button');note.id='sbPeekRadarNotice';note.type='button';
  note.setAttribute('aria-label','Vezi următorul meci Regista pe radar; informație programată, nu semnal BET NOW');
  note.innerHTML='<span class="sb-peek-radar-dot">♜</span><span id="sbPeekRadarText">REGISTA · încărcare program</span><span aria-hidden="true">⌄</span>';
  note.addEventListener('click',()=>{document.getElementById('sbPeekHub')?.scrollIntoView({behavior:'smooth',block:'start'});const list=document.getElementById('sbPeekUpcoming');if(list)list.open=true;});
  const header=radarCard.querySelector('.radar-top');if(header)header.insertAdjacentElement('afterend',note);else radarCard.prepend(note);
 }
 return true;
}
function sbPeekUpdate(){
 if(!sbPeekMount())return;
 const hub=document.getElementById('sbPeekHub');if(!hub)return;
 const set=(id,value)=>{const n=document.getElementById(id);if(n&&n.textContent!==value)n.textContent=value;};
 const g=sbPeekWatchState('golden'),n=sbPeekWatchState('gap');
 set('sbPeekGoldenTime',g.title);set('sbPeekGoldenMatch',g.note);
 set('sbPeekGapTime',n.title);set('sbPeekGapMatch',n.note);
 const roadHint=document.getElementById('sbPeekRoadHint');
 if(roadHint)roadHint.textContent=g.urgent||n.urgent?'● ALERTĂ CONFIRMATĂ':g.title.includes('până')?'Golden '+g.title:n.title.includes('până')?'GAP '+n.title:'Deschide monitorizarea';
 const now=Date.now(),arr=sbPeekUpcoming(),soon=arr[0],next=sbPeekFutureOneTwo(arr);
 const target=next?Date.parse(next.kickoff_utc)-45*60000:NaN,until=target-now;
 const nextTime=next?sbPeekTime(next.kickoff_utc):null;
 const windowLabel=next?(until>0?'Verificare în '+sbPeekCountdown(until):now<Date.parse(next.kickoff_utc)-5*60000?'În verificare, NU BET NOW':'Start '+nextTime):'Fără 1/2 viitor';
 const nextFixture=next?String(next.fixture||'Meci'):'Nicio selecție 1/2 disponibilă';
 set('sbPeekRoadRegista',next?'♜ REGISTA · '+nextFixture+' · posibilă verificare '+(until>0?'în '+sbPeekCountdown(until)+' ('+sbPeekTime(new Date(target).toISOString())+')':windowLabel):soon?'♜ REGISTA · '+sbPeekTime(soon.kickoff_utc)+' · '+soon.market+' · informativ':'♜ REGISTA · fără viitor 1/2 confirmat');
 set('sbPeekRegTime',windowLabel);
 set('sbPeekRegMatch',next?nextFixture+' · '+nextTime:'Așteptăm importul Regista');
 set('sbPeekUpcomingCount',arr.length+' programate');
 const more=document.getElementById('sbPeekUpcomingList');
 if(more){
  const sig=arr.slice(0,5).map(x=>[x.event_id,x.market,x.list_code,x.kickoff_utc].join('|')).join(';');
  if(more.dataset.signature!==sig){
   more.dataset.signature=sig;more.replaceChildren();
   if(!arr.length){const empty=document.createElement('p');empty.textContent='Nu există pronosticuri viitoare asociate cu certitudine unor meciuri din Superbet.';more.append(empty);}
   for(const item of arr.slice(0,5)){
    const row=document.createElement('button');row.type='button';row.className='sb-peek-upcoming-row';
    const time=document.createElement('strong');time.textContent=sbPeekTime(item.kickoff_utc);
    const textWrap=document.createElement('span'),title=document.createElement('b'),meta=document.createElement('small');
    title.textContent=String(item.fixture||'Meci programat');
    const market=String(item.market||'').toUpperCase(),supported=['1','2'].includes(market);
    const label=market==='1'?'Victorie gazde':market==='2'?'Victorie oaspeți':market==='BTTS'?'Ambele marchează':market;
    meta.textContent=label+' · '+String(item.probability_pct??'—')+'% Regista · '+(supported?'1/2: reevaluare cotă în ultimele 45′':'Informativ; fără BET NOW pe această piață');
    textWrap.append(title,meta);row.append(time,textWrap);
    row.addEventListener('click',()=>{
     const details=document.getElementById('rlDetails');if(details)details.open=true;
     const observation=document.getElementById('rlObservations');if(observation)observation.open=true;
     if(['FULL','LEAGUE','TOP10'].includes(item.list_code))current=item.list_code;
     document.querySelectorAll('#sbRegistaLab .rl-tab').forEach(t=>t.classList.toggle('active',t.dataset.rlt===current));
     render();
     document.getElementById('sbRegistaLab')?.scrollIntoView({behavior:'smooth',block:'start'});
    });
    more.append(row);
   }
  }
 }
 const radar=document.getElementById('sbPeekRadarNotice'),rtext=document.getElementById('sbPeekRadarText');
 if(radar&&rtext){
  radar.hidden=!soon;
  if(soon){
   const label=next?'♜ REGISTA · '+sbPeekTime(next.kickoff_utc)+' · '+windowLabel:'♜ REGISTA · '+sbPeekTime(soon.kickoff_utc)+' · pronostic programat';
   if(rtext.textContent!==label)rtext.textContent=label;
  }
 }
}

function render(){
 const panel=document.getElementById('sbRegistaLab');if(!panel)return;
 const items=(model.items||[]).filter(x=>x.list_code===current);
 const cards=panel.querySelector('#rlCards'),arch=panel.querySelector('#rlArchiveBody'),featured=panel.querySelector('#rlFeaturedCards');
 if(!cards||!arch||!featured)return;
 cards.replaceChildren();arch.replaceChildren();featured.replaceChildren();
 const now=Date.now(),seen=new Set();
 const emitted=(model.items||[]).filter(x=>x.signal_emitted&&Date.parse(x.signal_utc)>=now-86400000)
  .sort((a,b)=>Date.parse(b.signal_utc)-Date.parse(a.signal_utc))
  .filter(x=>{const key=String(x.event_id)+':'+String(x.market);if(seen.has(key))return false;seen.add(key);return true;});
 const activeNow=emitted.filter(x=>x.status==='BET_NOW');
 if(!emitted.length){const el=document.createElement('div');el.className='rl-featured-empty';el.textContent='Nicio alertă BET NOW emisă în ultimele 24h. Pronosticurile Regista rămân în observație.';featured.append(el);}
 else emitted.slice(0,10).forEach(x=>featured.append(card(x)));
 const observing=items.filter(x=>!x.signal_emitted&&(x.status==='MATCHED'||x.status==='UNMATCHED')).slice(0,20);
 if(!observing.length)cards.textContent='Nu sunt alte pronosticuri în observație pentru '+(current==='TOP10'?'Top 10':current)+'.';else observing.forEach(x=>cards.append(card(x)));
 const historic=items.filter(x=>x.signal_emitted&&x.status!=='BET_NOW').slice(0,60);
 if(!historic.length)arch.textContent='Fără BET NOW expirate sau decontate în această listă.';else historic.forEach(x=>arch.append(card(x)));
 const perf=model.performance||{},p24=perf.periods?.last24h||{},p7=perf.periods?.last7d||{};
 txt(panel.querySelector('#rl24'),String(p24.emitted??0)+' EMIS');
 txt(panel.querySelector('#rl7d'),String(p7.emitted??0)+' EMIS');
 txt(panel.querySelector('#rl24Wl'),(p24.wins??0)+'W / '+(p24.losses??0)+'L');
 txt(panel.querySelector('#rl7dWl'),(p7.wins??0)+'W / '+(p7.losses??0)+'L');
 const fmtRoi=x=>x==null?'ROI —':'ROI '+(x>=0?'+':'')+Number(x).toFixed(1)+'%';
 txt(panel.querySelector('#rl24Roi'),fmtRoi(p24.roi_sim_pct));
 txt(panel.querySelector('#rl7dRoi'),fmtRoi(p7.roi_sim_pct));
 txt(panel.querySelector('#rlWl'),(perf.wins??0)+'W / '+(perf.losses??0)+'L');
 const sim=perf.roi_sim_pct,real=perf.real?.roi_pct;
 txt(panel.querySelector('#rlRoi'),sim==null?'—':(sim>=0?'+':'')+Number(sim).toFixed(1)+'%');
 txt(panel.querySelector('#rlRoiReal'),real==null?'—':(real>=0?'+':'')+Number(real).toFixed(1)+'%');
 const liveTickets=Number(perf.real?.live||0),openTickets=Number(perf.real?.open||0);
 const badgeParts=[emitted.length+' EMIS'];
 if(liveTickets>0)badgeParts.push(liveTickets+' LIVE');
 if(activeNow.length>0)badgeParts.push(activeNow.length+' BET NOW');
 if(liveTickets===0&&activeNow.length===0)badgeParts.push('0 PRE-MECI');
 txt(panel.querySelector('#rlSummaryCount'),badgeParts.join(' · '));
 const badge=panel.querySelector('#rlSummaryCount');
 if(badge)badge.title='EMIS = alerte istorice 24h · LIVE = bilete personale în joc cu date confirmate · PRE-MECI/BET NOW = oportunități încă disponibile înainte de start';
 const status=panel.querySelector('#rlSourceStatus'),sync=model.sync;
 if(sync?.stored_rows>0){status.style.display='none';}
 else{status.style.display='block';status.textContent=sync?.error?'Import Regista nevalidat: '+String(sync.error).slice(0,130):'Sursa Regista nu are încă date verificate.';}
 renderRegistaChecklist();
 sbPeekUpdate();
}
function localPulse(rows){
  if(document.hidden||!Array.isArray(rows)||typeof navigator.vibrate!=='function')return;
  try{
    const installed=String(window.DrixNative?.getAppVersion?.()||'');
    const v=installed.split('.').map(Number);
    if(v.length===3&&v[0]===2&&v[1]===3&&v[2]>=51)return; // New APK uses OS notifications.
    for(const item of rows){
      if(item.status!=='BET_NOW'||Number(item.event_id)<=0||Number(item.odds_at_signal)<=1)continue;
      const key='sb_regista_web_vibrate_event_'+String(item.event_id);
      if(localStorage.getItem(key))continue;
      localStorage.setItem(key,'1');
      navigator.vibrate([260,140,260,170,550]);
      break; // one vibration for this polling cycle
    }
  }catch(_){}
}
async function poll(force){if(busy||!document.getElementById('sbRegistaLab')||(!force&&Date.now()-lastAt<30000))return;if(typeof api!=='function')return;busy=true;try{const d=await api('/api/mobile/regista/summary');if(!d?.items)throw Error('No data');model=d;const initial=!lastAt;lastAt=Date.now();if(initial){const hot=d.items.find(x=>x.status==='BET_NOW');if(hot){current=hot.list_code;document.querySelectorAll('#sbRegistaLab .rl-tab').forEach(x=>x.classList.toggle('active',x.dataset.rlt===current));}}render();if(lastOpenedRegistaEvent)registaMatchPanel(lastOpenedRegistaEvent);localPulse(d.items);}catch(e){const s=document.getElementById('rlSourceStatus');if(s){s.style.display='block';s.textContent='Regista indisponibil momentan. Nu se emit semnale fără date verificate.';}}finally{busy=false;}}
function boot(){
 if(!mount())return;
 sbPeekMount();sbPeekUpdate();
 const deepEvent=Number(new URLSearchParams(location.search).get('event_id'));if(Number.isSafeInteger(deepEvent)&&deepEvent>0)lastOpenedRegistaEvent=deepEvent;
 setTimeout(()=>poll(true),500);
 setInterval(()=>{if(!document.hidden)poll(false)},30000);
 setInterval(()=>{if(!document.hidden)renderRegistaChecklist()},4000);
 setInterval(()=>{if(!document.hidden)sbPeekUpdate()},8000);
 setTimeout(()=>{if(lastOpenedRegistaEvent)registaMatchPanel(lastOpenedRegistaEvent)},4800);
 const route=document.getElementById('routeBody');
 if(route){let pending=false;new MutationObserver(()=>{
  if(!lastOpenedRegistaEvent||pending||route.querySelector('[data-regista-event]')||document.getElementById('routeBackdrop')?.classList.contains('hidden'))return;
  pending=true;setTimeout(()=>{pending=false;registaMatchPanel(lastOpenedRegistaEvent);},80);
 }).observe(route,{childList:true,subtree:false});}

 // Some legacy home scripts rebuild the Live subtree: recover the card if removed.
 setInterval(()=>{const root=document.getElementById('live');if(root&&!document.getElementById('sbRegistaLab')){if(mount()){render();poll(true);}}},5000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();