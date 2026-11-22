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
 const deepEvent=Number(new URLSearchParams(location.search).get('event_id'));if(Number.isSafeInteger(deepEvent)&&deepEvent>0)lastOpenedRegistaEvent=deepEvent;
 setTimeout(()=>poll(true),500);
 setInterval(()=>{if(!document.hidden)poll(false)},30000);
 setInterval(()=>{if(!document.hidden)renderRegistaChecklist()},4000);
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