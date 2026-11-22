/* REGISTA LAB V2 — visual module, no auto-bets and no fake notifications */
(function(){
'use strict';
if(window.__SB_REGISTA_V2__)return;window.__SB_REGISTA_V2__=true;
const STYLE=String.raw`
#sbTripleArchmlwind,#sbTripleArchmlgeneral,#sbrXCoverage,#sbBetaLiveNotice{display:none!important}
#sbRegistaLab{position:relative;display:block;margin:12px 2px 16px;color:#eaf7f7;border:1px solid #386c72;border-radius:17px;overflow:hidden;background:linear-gradient(125deg,#12343c 0%,#112333 55%,#161c2e 100%);box-shadow:0 6px 22px #010a1245;font:12px system-ui,sans-serif}
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
`;
const css=document.createElement('style');css.id='sbRegistaLabV2Css';css.textContent=STYLE;document.head.append(css);
function mount(){
if(document.getElementById('sbRegistaLab'))document.getElementById('sbRegistaLab').remove();
let live=document.getElementById('live');if(!live)return false;
let section=document.createElement('section');section.id='sbRegistaLab';
section.innerHTML='<details id="rlDetails"><summary><span class="rl-icon">♜</span><span class="rl-head"><strong>REGISTA · BET NOW</strong><small>FULL · LEAGUE · TOP 10 · predicții originale</small></span><span class="rl-summary-count" id="rlSummaryCount">—</span><span style="color:#c6e5df">⌄</span></summary><div class="rl-body"><div class="rl-statline"><div class="rl-stat"><b id="rl24">—</b><small>24h</small></div><div class="rl-stat"><b id="rl7d">—</b><small>7 zile</small></div><div class="rl-stat"><b id="rlWl">—</b><small>WIN / LOSS</small></div></div><div class="rl-tabs"><button class="rl-tab active" data-rlt="FULL">FULL</button><button class="rl-tab" data-rlt="LEAGUE">LEAGUE</button><button class="rl-tab" data-rlt="TOP10">TOP 10</button></div><div id="rlSourceStatus" class="rl-warning">Verific sursa Regista…</div><div id="rlCards"></div><details class="rl-archive" id="rlArchive"><summary>▤ Arhivă Regista · contor și rezultate</summary><div class="rl-archive-body" id="rlArchiveBody">Se verifică…</div></details><div style="padding-top:12px"><a href="https://www.registacalcio.it/en/schedina" target="_blank" rel="noopener noreferrer">Sursa originală Regista</a></div></div></details>';
live.insertBefore(section,live.querySelector('#sb57TopDuo')?.nextSibling||live.firstChild);
section.querySelectorAll('.rl-tab').forEach(b=>b.onclick=()=>{section.querySelectorAll('.rl-tab').forEach(x=>x.classList.toggle('active',x===b));current=b.dataset.rlt;render();});
section.querySelector('#rlDetails').addEventListener('toggle',ev=>{if(ev.target.open)poll(true)});
return true;
}
let current='FULL',model={items:[],counts:{},sync:null},busy=false,lastAt=0;
function txt(el,s){if(el)el.textContent=String(s);}
function resultName(item){if(item.result_status==='WIN')return '✓ WIN';if(item.result_status==='LOSS')return '✕ LOSS';if(item.status==='BET_NOW')return 'BET NOW · verifică piața';if(item.status==='MATCHED')return 'Monitorizare înainte de start';return item.status==='UNVERIFIED_SOURCE'?'Sursă neconfirmată':'În observație';}
function card(item){const el=document.createElement('article');el.className='rl-card';const name=document.createElement('div');name.className='rl-fixture';name.textContent=String(item.fixture||'Meci necunoscut').replace(/[·•]/g,' – ');
const title=document.createElement('div');title.className='rl-top';const prob=document.createElement('strong');prob.className='rl-pct';prob.textContent=Number.isFinite(Number(item.probability_pct))?Number(item.probability_pct).toFixed(0)+'%':'—';
title.append(name,prob);el.append(title);
const meta=document.createElement('div');meta.className='rl-meta';meta.textContent=(item.market||'SELECȚIE NECUNOSCUTĂ')+(item.odds_at_signal?' · Cotă SB '+Number(item.odds_at_signal).toFixed(2):' · Cotă neconfirmată');el.append(meta);
const result=document.createElement('div');result.className='rl-result';result.textContent=resultName(item)+(item.result_status==='WIN'||item.result_status==='LOSS'?' · '+(item.final_home??'—')+'–'+(item.final_away??'—'):'');el.append(result);
const actions=document.createElement('div');actions.className='rl-actions';
if(item.status==='BET_NOW'&&Number.isSafeInteger(Number(item.event_id))&&Number(item.event_id)>0&&Number(item.odds_at_signal)>1){
const b=document.createElement('button');b.className='rl-bet';b.textContent='BET NOW · fișa meciului';b.onclick=()=>{const eventId=Number(item.event_id);if(typeof window.SBRadarOpenAlert==='function')window.SBRadarOpenAlert('live',null,eventId);else location.assign('/app?tab=live&event_id='+eventId)};actions.append(b);
}
if(item.source_url&&/^https:\/\/(?:www\.)?registacalcio\.it\//.test(item.source_url)){const a=document.createElement('a');a.href=item.source_url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Regista ↗';actions.append(a);}
el.append(actions);return el;
}
function render(){const panel=document.getElementById('sbRegistaLab');if(!panel)return;
const items=(model.items||[]).filter(x=>x.list_code===current),cards=panel.querySelector('#rlCards'),arch=panel.querySelector('#rlArchiveBody');
cards.replaceChildren();arch.replaceChildren();const active=items.filter(x=>x.status==='BET_NOW'||x.status==='MATCHED').slice(0,20);
if(!active.length){const x=document.createElement('div');x.className='rl-warning';x.textContent='Niciun semnal verificat pentru '+(current==='TOP10'?'TOP 10':current)+'. Nu se generează BET NOW fără date și cote confirmate.';cards.append(x);}else active.forEach(x=>cards.append(card(x)));
const historical=items.filter(x=>x.result_status==='WIN'||x.result_status==='LOSS'||x.status==='EXPIRED').slice(0,60);
if(!historical.length)arch.textContent='Arhiva este goală. Se vor contoriza numai pronosticuri salvate înaintea meciurilor.';else historical.forEach(x=>arch.append(card(x)));
const c=model.counts?.[current]||{};txt(panel.querySelector('#rl24'),c.last24h??0);txt(panel.querySelector('#rl7d'),c.last7d??0);txt(panel.querySelector('#rlWl'),(c.wins??0)+' / '+(c.losses??0));
txt(panel.querySelector('#rlSummaryCount'),(c.betnow??0)+' BET NOW');
const status=panel.querySelector('#rlSourceStatus'),s=model.sync;
if(s?.stored_rows>0){status.style.display='none';}
else{status.style.display='block';status.textContent=s?.error?'Regista: import nevalidat ('+String(s.error).replace('Error: ','')+'). Nu există alerte până la verificarea sursei.':'Sursa Regista încă nu are predicții importate și potrivite cu Superbet.';}
}
async function poll(force){if(busy||!document.getElementById('sbRegistaLab')||(!force&&Date.now()-lastAt<30000))return;if(typeof api!=='function')return;busy=true;try{const d=await api('/api/mobile/regista/summary');if(!d?.items)throw Error('No data');model=d;lastAt=Date.now();render();}catch(e){const s=document.getElementById('rlSourceStatus');if(s){s.style.display='block';s.textContent='Regista indisponibil momentan. Nu se emit semnale fără date verificate.';}}finally{busy=false;}}
function boot(){if(!mount())return;setTimeout(()=>poll(true),500);setInterval(()=>{if(!document.hidden)poll(false)},30000);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();