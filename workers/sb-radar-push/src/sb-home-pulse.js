// SB Radar Home System Pulse v1. Independent UI only; no signal/bet control.
const CSS = String.raw`
<style id="sb-home-pulse-style">
/* SB Radar v2 native dashboard palette: integrated compact telemetry strip.
   Retire only the legacy Home GPS widget, not its scanner/alert pipeline. */
#live #sbSignalPipeline{display:none!important;visibility:hidden!important}
#live #sbPulseHome{
 --sp-line:#36516a;--sp-ink:#e4edf5;--sp-dim:#9cb3c5;
 margin:7px 1px 13px;border:1px solid var(--sp-line);
 background:linear-gradient(128deg,#1a2939 0%,#172536 53%,#14212f 100%);
 border-radius:15px;box-shadow:0 4px 18px #0000001b;
 color:var(--sp-ink);max-width:100%;overflow:hidden;
 font-family:Inter,system-ui,sans-serif
}
#sbPulseHome summary{list-style:none;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
#sbPulseHome summary::-webkit-details-marker{display:none}
#sbPulseHome>summary{display:block;padding:9px 11px 8px}
#sbPulseHome .sbr-pulse-title{display:flex;gap:7px;align-items:center;min-width:0;height:17px}
#sbPulseHome .sbr-pulse-symbol{font-size:12px;color:#60cbb3;line-height:1;opacity:.9}
#sbPulseHome .sbr-pulse-name{font-size:10.5px;letter-spacing:.11em;font-weight:850;color:#b8cedd;white-space:nowrap}
#sbPulseHome .sbr-pulse-state{margin-left:auto;font-size:10px;white-space:nowrap;font-weight:700;
 font-variant-numeric:tabular-nums;max-width:48%;text-align:right;overflow:hidden;text-overflow:ellipsis}
#sbPulseHome .sbr-pulse-toggle{font-size:12px;margin-left:1px;color:#abc1d2;transition:transform .2s}
#sbPulseHome[open] .sbr-pulse-toggle{transform:rotate(180deg)}
#sbPulseHome .sbr-pulse-lanes{
 display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;
 border-top:1px solid #51708747;margin-top:6px;padding-top:5px
}
#sbPulseHome .sbr-pulse-lane{
 display:grid;grid-template-columns:13px minmax(0,1fr);grid-template-rows:14px 12px;
 align-items:center;column-gap:3px;min-width:0;padding:3px 5px 2px;
 border-right:1px solid #56708654;background:transparent;box-sizing:border-box
}
#sbPulseHome .sbr-pulse-lane:last-child{border-right:0}
#sbPulseHome .sbr-pulse-heart{
 grid-row:1/3;grid-column:1;display:inline-grid;place-items:center;
 font-size:12px;line-height:1;color:#738ba0;transform-origin:center center
}
#sbPulseHome .sbr-pulse-lane[data-state="ok"] .sbr-pulse-heart{color:#69d9b0}
#sbPulseHome .sbr-pulse-lane[data-state="ok"][data-fresh="1"] .sbr-pulse-heart{
 animation:sbr-home-heartbeat 2.8s ease-in-out infinite
}
#sbPulseHome .sbr-pulse-lane[data-state="warn"] .sbr-pulse-heart{color:#f0be6c}
#sbPulseHome .sbr-pulse-lane[data-state="down"] .sbr-pulse-heart{color:#ff7c87}
#sbPulseHome .sbr-pulse-lane[data-state="unknown"] .sbr-pulse-heart{color:#6b8293}
#sbPulseHome .sbr-pulse-label{
 grid-column:2;grid-row:1;font-size:9.5px;font-weight:750;color:#dce8f2;
 white-space:nowrap;overflow:hidden;text-overflow:ellipsis
}
#sbPulseHome .sbr-pulse-age{
 grid-column:2;grid-row:2;font-size:9px;color:#98adbf;
 white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums
}
#sbPulseHome .sbr-pulse-details{border-top:1px solid #3b5369;padding:9px 11px 10px}
#sbPulseHome .sbr-pulse-summary{font-size:10px;line-height:1.45;color:#aabfd0;margin-bottom:8px}
#sbPulseHome .sbr-pulse-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
#sbPulseHome .sbr-pulse-row{
 display:block;min-width:0;margin:0;border:1px solid #3a5368;
 border-radius:10px;background:#203044b5;overflow:hidden
}
#sbPulseHome .sbr-pulse-row[open]{grid-column:1/-1;background:#24374b}
#sbPulseHome .sbr-pulse-row>summary{
 min-height:41px;padding:7px 8px;display:flex;align-items:center;gap:6px;box-sizing:border-box
}
#sbPulseHome .sbr-pulse-indicator{font-size:11px;line-height:1;color:#8699aa}
#sbPulseHome .sbr-pulse-row[data-state="ok"] .sbr-pulse-indicator{color:#62d5aa}
#sbPulseHome .sbr-pulse-row[data-state="warn"] .sbr-pulse-indicator{color:#f2c275}
#sbPulseHome .sbr-pulse-row[data-state="down"] .sbr-pulse-indicator{color:#ff7b88}
#sbPulseHome .sbr-pulse-body{min-width:0;flex:1;font-size:10px;line-height:1.25;color:#b8c9d7}
#sbPulseHome .sbr-pulse-body b{
 color:#dce8f2;font-size:10px;font-weight:750;display:block;white-space:nowrap;
 overflow:hidden;text-overflow:ellipsis
}
#sbPulseHome .sbr-pulse-status{font-size:9px;font-weight:850;color:#75ddb7;margin-left:auto}
#sbPulseHome .sbr-pulse-row[data-state="warn"] .sbr-pulse-status{color:#f1c17b}
#sbPulseHome .sbr-pulse-row[data-state="down"] .sbr-pulse-status{color:#ff8a96}
#sbPulseHome .sbr-pulse-row[data-state="unknown"] .sbr-pulse-status{color:#a4b1bd}
#sbPulseHome .sbr-pulse-row .sbr-pulse-detail{
 color:#b8cbd8;font-size:10.5px;line-height:1.55;
 padding:0 9px 9px;overflow-wrap:anywhere
}
#sbPulseHome .sbr-pulse-incident{
 font-size:9.5px;color:#9db3c5;line-height:1.5;margin-top:8px;
 border-top:1px solid #40586a;padding-top:7px;overflow-wrap:anywhere
}
@keyframes sbr-home-heartbeat{
 0%,19%,33%,48%,100%{transform:scale(1)}
 23%{transform:scale(1.18)}
 40%{transform:scale(1.10)}
}
@media(prefers-reduced-motion:reduce){#sbPulseHome .sbr-pulse-heart{animation:none!important}}
@media(max-width:370px){
 #sbPulseHome .sbr-pulse-lane{grid-template-columns:11px minmax(0,1fr);column-gap:2px;padding-left:3px;padding-right:3px}
 #sbPulseHome .sbr-pulse-heart{font-size:11px}
 #sbPulseHome .sbr-pulse-label,#sbPulseHome .sbr-pulse-age{font-size:8.5px}
}
</style>
`;
const JS = String.raw`
(function(){
'use strict';
if(window.__sbHomePulseInstalled)return;
window.__sbHomePulseInstalled=true;
var heartMap=[['feed','Live'],['scanner','57′'],['chrome','Chrome'],['android','APK']];
var allNames={cloudflare:'Cloudflare',feed:'Cote Superbet Live',scanner:'Scanner 57′',
 chrome:'Chrome Slaves',notifications:'Notificări FCM',database:'Baza D1',
 android:'APK Android',pipeline:'Pipeline semnale',history:'Live istoric'};
var order=['cloudflare','feed','scanner','chrome','notifications','database','android','pipeline','history'];
var card=document.createElement('details');
card.id='sbPulseHome';
card.setAttribute('aria-label','System Pulse · starea reală a componentelor');
card.innerHTML='<summary><div class="sbr-pulse-title"><span class="sbr-pulse-symbol" aria-hidden="true">♥</span>'+
'<strong class="sbr-pulse-name">SYSTEM PULSE</strong><span class="sbr-pulse-state" id="sbPulseHomeState">Verificare…</span>'+
'<span class="sbr-pulse-toggle" aria-hidden="true">⌄</span></div>'+
'<div class="sbr-pulse-lanes">'+heartMap.map(function(x){return '<span class="sbr-pulse-lane" data-pulse-component="'+x[0]+'" data-state="unknown">'+
'<span class="sbr-pulse-heart" aria-hidden="true">♥</span><span class="sbr-pulse-label">'+x[1]+'</span>'+
'<span class="sbr-pulse-age">—</span></span>';}).join('')+
'</div></summary><div class="sbr-pulse-details"><div class="sbr-pulse-summary" id="sbPulseHomeSummary">Starea se actualizează din Cloudflare D1.</div>'+
'<div class="sbr-pulse-list" id="sbPulseHomeList"></div><div class="sbr-pulse-incident" id="sbPulseHomeIncident"></div></div>';
function mount(){
 var live=document.getElementById('live');
 var duo=document.getElementById('sb57TopDuo');
 if(!live||!duo)return false;
 if(!card.isConnected)duo.insertAdjacentElement('afterend',card);
 return true;
}
var priorGeneration='',loading=false,lastGood=0;
function isVisible(){
 var live=document.getElementById('live');
 return !document.hidden && live && !live.classList.contains('hidden') && !live.hasAttribute('hidden');
}
function stateOf(p,stale){
 if(!p)return 'unknown';
 if(stale)return 'unknown';
 return ['ok','warn','down'].includes(p.status)?p.status:'unknown';
}
function ageText(sec){
 if(sec===null||sec===undefined||sec==='')return '—';
 var n=Number(sec);
 if(!Number.isFinite(n)||n<0)return '—';
 if(n<60)return Math.floor(n)+'s';
 if(n<3600)return Math.floor(n/60)+'m';
 return Math.floor(n/3600)+'h';
}
function show(data){
 if(!data||!Array.isArray(data.components))return;
 var map={};data.components.forEach(function(x){map[x.component]=x;});
 var stale=!!data.stale||!(Number(data.age_sec)>=0)||Number(data.age_sec)>150;
 var ok=0,warn=0,down=0;
 order.forEach(function(name){
  var st=stateOf(map[name],stale);
  if(st==='ok')ok++;else if(st==='warn'||st==='unknown')warn++;else down++;
 });
 var header=document.getElementById('sbPulseHomeState');
 header.textContent=stale?'Date învechite':down?down+' incident'+(down===1?'':'e'):warn?ok+'/9 OK · '+warn+(warn===1?' atenție':' atenții'):ok+'/9 OK';
 header.style.color=stale||down?'#ff8995':warn?'#f2c275':'#78ddb3';
 heartMap.forEach(function(pair){
  var root=card.querySelector('[data-pulse-component="'+pair[0]+'"]');
  var obj=map[pair[0]],state=stateOf(obj,stale);
  if(!root)return;
  root.dataset.state=state;
  var a=root.querySelector('.sbr-pulse-age'),m=obj&&obj.metrics||{};
  var age=pair[0]==='feed'?m.sample_age_sec:
    pair[0]==='scanner'?m.age_sec:pair[0]==='chrome'?m.poll_age_sec:m.age_sec;
  var maxFresh=pair[0]==='android'?90:pair[0]==='chrome'?65:80;
  root.dataset.fresh=(state==='ok'&&age!=null&&Number.isFinite(Number(age))&&Number(age)<=maxFresh)?'1':'0';
  if(pair[0]==='chrome'&&m.ready!=null)a.textContent=String(m.ready)+'/'+String(m.enabled||0);
  else a.textContent=(state==='unknown'?'—':ageText(age));
  root.setAttribute('aria-label',pair[1]+' · '+state+' · '+(obj?obj.detail:'fără date'));
 });
 var summary=document.getElementById('sbPulseHomeSummary');
 summary.textContent=(stale?'Telemetria nu a fost actualizată recent.':'Ultima verificare '+ageText(data.age_sec)+' în urmă.')+
   ' • '+ok+' OK · '+warn+' atenționări · '+down+' erori';
 var list=document.getElementById('sbPulseHomeList');
 var generation=String(data.generated_utc||'')+order.map(function(n){return (map[n]||{}).status||'';}).join('|');
 if(generation!==priorGeneration){
   list.replaceChildren();
   order.forEach(function(name){
    var p=map[name],s=stateOf(p,stale);
    var row=document.createElement('details');row.className='sbr-pulse-row';row.dataset.state=s;
    var head=document.createElement('summary');
    var mark=document.createElement('span');mark.className='sbr-pulse-indicator';
    mark.textContent=s==='ok'?'●':s==='warn'?'◐':s==='down'?'×':'○';
    var title=document.createElement('span');title.className='sbr-pulse-body';
    var bold=document.createElement('b');bold.textContent=allNames[name]||name;
    title.appendChild(bold);
    var short=document.createElement('span');short.className='sbr-pulse-status';
    short.textContent=s==='ok'?'OK':s==='warn'?'ATENȚIE':s==='down'?'EROARE':'—';
    head.append(mark,title,short);
    var detail=document.createElement('div');detail.className='sbr-pulse-detail';
    detail.textContent=p?p.detail:'Nu există date confirmate';
    row.append(head,detail);list.appendChild(row);
   });
   priorGeneration=generation;
 }
 var inc=document.getElementById('sbPulseHomeIncident');
 var i=Array.isArray(data.incidents)?data.incidents[0]:null;
 inc.textContent=i?'Ultimul incident: '+String(i.component)+' → '+String(i.new_status)+' · '+String(i.observed_utc):
   'Fără modificări de stare înregistrate.';
}
async function refresh(){
 if(loading||!mount()||!isVisible())return;
 if(typeof api!=='function'){document.getElementById('sbPulseHomeState').textContent='Așteptare conexiune';return;}
 loading=true;
 try{
  var data=await api('/api/mobile/home-pulse');
  show(data);lastGood=Date.now();
 }catch(e){
  var state=document.getElementById('sbPulseHomeState');
  if(state){state.textContent='Telemetrie indisponibilă';state.style.color='#ff8995';}
  heartMap.forEach(function(x){var node=card.querySelector('[data-pulse-component="'+x[0]+'"]');if(node){node.dataset.state='unknown';node.dataset.fresh='0';node.querySelector('.sbr-pulse-age').textContent='—';}});
  document.getElementById('sbPulseHomeSummary').textContent='Nu se poate verifica System Pulse; ultimul răspuns valid '+(lastGood?ageText((Date.now()-lastGood)/1000)+' în urmă':'necunoscut')+'.';
 }
 finally{loading=false;}
}
if(mount())refresh();
else setTimeout(function(){mount();refresh();},650);
document.addEventListener('visibilitychange',function(){if(!document.hidden)refresh();});
card.addEventListener('toggle',function(){if(card.open)refresh();});
setInterval(refresh,30000);
})();
`;
export function withHomePulse(html){
 if(typeof html!=='string'||html.includes('id="sb-home-pulse-style"'))return html;
 // Inject after all legacy Home styles/scripts so the visual override wins.
 return html.replace('</head>',CSS+'</head>').replace('</body>','<script id="sb-home-pulse-js">'+JS+'</script></body>');
}
export async function homePulseSnapshot(env){
 const [parts,incident]=await Promise.all([
   env.DB.prepare('SELECT component,status,detail,metric_json,observed_utc FROM sb_radar_pulse_state_v1 ORDER BY component').all(),
   env.DB.prepare('SELECT component,previous_status,new_status,detail,observed_utc FROM sb_radar_pulse_incidents_v1 ORDER BY id DESC LIMIT 3').all()
 ]);
 const rows=parts.results||[],date=rows.map(x=>Date.parse(x.observed_utc)).filter(Number.isFinite);
 const newest=date.length?Math.max(...date):null;
 const age=newest===null?null:Math.max(0,Math.floor((Date.now()-newest)/1000));
 return {ok:true,generated_utc:newest===null?null:new Date(newest).toISOString(),
   age_sec:age,stale:age===null||age>150,
   components:rows.map(row=>{
     let metrics={};try{metrics=JSON.parse(row.metric_json||'{}')}catch(_){}
     return {component:row.component,status:row.status,detail:row.detail,metrics,observed_utc:row.observed_utc};
   }),
   incidents:(incident.results||[]).map(row=>({
     component:row.component,previous_status:row.previous_status,
     new_status:row.new_status,detail:row.detail,observed_utc:row.observed_utc
   }))
 };
}
