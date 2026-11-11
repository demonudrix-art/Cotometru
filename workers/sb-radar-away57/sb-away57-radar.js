// Away57 second Radar Theo scene, owner-only and independent of Golden/KLOPP.
export async function away57RadarCandidates(env){
 const since=new Date(Date.now()-5*60000).toISOString();
 const rows=(await env.DB.prepare("SELECT event_id,fixture,captured_utc,minute,home_score,away_score,gh,ga,p1,px,p2 FROM ghost_equal_samples WHERE captured_utc>=? AND minute BETWEEN 6 AND 120 ORDER BY captured_utc DESC LIMIT 500").bind(since).all()).results||[];
 const latest=new Map();
 for(const r of rows)if(!latest.has(Number(r.event_id)))latest.set(Number(r.event_id),r);
 const candidates=[];
 for(const r of latest.values()){
  const id=Number(r.event_id),m=Number(r.minute),h=Number(r.home_score),a=Number(r.away_score),p1=Number(r.p1),px=Number(r.px),p2=Number(r.p2);
  if(!Number.isSafeInteger(id)||id<1||m>57||!Number.isFinite(m)||!Number.isFinite(h)||!Number.isFinite(a)||!Number.isFinite(p1)||!Number.isFinite(px)||!Number.isFinite(p2)||Math.min(p1,px,p2)<=1)continue;
  const fav=p2<p1,score11=h===1&&a===1,score00=h===0&&a===0;
  if(!fav||!(score11||score00))continue;
  const inRange=p2>=1.85&&p2<=4;
  let status=score11?(m===57?'VERIFY_57':m>=50?'NEAR_57':'TRACK_11'):'WATCH_00';
  if(!inRange)status='PRICE_OUT';
  const names=String(r.fixture||'').split(/[·•|]/);const slug=z=>z.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90);const deep=names.length===2?'https://superbet.ro/cote/fotbal/'+slug(names[0])+'-vs-'+slug(names[1])+'-'+id:'https://superbet.ro/pariuri-sportive/fotbal/live';
  const gValid=[r.gh,r.ga].every(x=>x!==null&&x!==undefined&&Number.isFinite(Number(x))&&Number(x)>=0&&Number(x)<=1);
  candidates.push({event_id:id,fixture:String(r.fixture||'Meci'),captured_utc:r.captured_utc,minute:m,home_score:h,away_score:a,p1,px,p2,gh:gValid?Number(r.gh):null,ga:gValid?Number(r.ga):null,status,superbet_url:deep,price_in_range:inRange,away_favorite:true,is_signal:false,remaining_min:57-m});
 }
 const rank={VERIFY_57:5,NEAR_57:4,TRACK_11:3,WATCH_00:2,PRICE_OUT:1};
 candidates.sort((a,b)=>(rank[b.status]||0)-(rank[a.status]||0)||b.minute-a.minute||Date.parse(b.captured_utc)-Date.parse(a.captured_utc));
 return {updated_utc:new Date().toISOString(),observed_since_utc:since,candidate_count:candidates.length,candidates:candidates.slice(0,30),filters:[
  {key:'score',name:'1–1 la 57′',description:'Verificăm scorul la minutul 57'},
  {key:'favorite',name:'Favorit oaspeți',description:'Cota 2 mai mică decât cota 1'},
  {key:'price',name:'Cotă 2: 1,85–4,00',description:'Intervalul de test'},
  {key:'model',name:'ML L2 · EV ≥5%',description:'Modelul alege victoria oaspeților cu avantaj estimat de cel puțin 5%'},
  {key:'stake',name:'Miză test 2 lei',description:'Nu se plasează automat niciun pariu'}]};
}

const AWAY57_ARCHIVE_HOURS=48;
function away57MatchUrl(id,fixture){
 const parts=String(fixture||'').split(/[·•|]/);
 const slug=x=>String(x||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90);
 return parts.length===2? 'https://superbet.ro/cote/fotbal/'+slug(parts[0])+'-vs-'+slug(parts[1])+'-'+Number(id):'https://superbet.ro/pariuri-sportive/fotbal/live';
}
export async function away57ArchiveAndTickets(env){
 const since=new Date(Date.now()-AWAY57_ARCHIVE_HOURS*3600000).toISOString();
 const [old,tickets]=await Promise.all([
  env.DB.prepare("WITH recent AS (SELECT event_id,MAX(captured_utc) last_utc FROM ghost_equal_samples INDEXED BY idx_ghost_samples_scan_recent WHERE captured_utc >= ? AND minute BETWEEN 25 AND 57 AND p1 > p2 AND p2>1 AND ((home_score=1 AND away_score=1) OR (home_score=0 AND away_score=0)) GROUP BY event_id) SELECT g.event_id,g.fixture,g.captured_utc,g.minute,g.home_score,g.away_score,g.p1,g.px,g.p2,g.gh,g.ga,m.home_score final_home,m.away_score final_away,m.verified,m.event_status,ec.league_name,ec.country FROM recent r JOIN ghost_equal_samples g ON g.event_id=r.event_id AND g.captured_utc=r.last_utc LEFT JOIN match_results m ON m.event_id=g.event_id LEFT JOIN sb_radar_event_competition ec ON ec.event_id=g.event_id ORDER BY g.captured_utc DESC LIMIT 35").bind(since).all(),
  // Only real manually recorded 2 selections connected to an actual Away57 signal.
  // Don't turn ML candidate recommendations into fake placed tickets.
  env.DB.prepare("SELECT b.id,b.event_id,b.fixture,b.selection,b.stake_lei,b.odds,b.placed_utc,b.status,b.returned_lei,b.settled_utc,b.potential_return_lei,s.signal_utc,s.prob_away FROM ghost_equal_bets b JOIN sb_away57_signals_v1 s ON s.event_id=b.event_id WHERE b.selection IN ('2','Victorie oaspeti','Victorie oaspeți','Oaspeți','Away') ORDER BY b.placed_utc DESC LIMIT 24").all()
 ]);
 const archive=(old.results||[]).map(x=>({...x,superbet_url:away57MatchUrl(x.event_id,x.fixture),
  score_at_observation:String(x.home_score)+'-'+String(x.away_score),
  status:(Number(x.verified)===1&&x.event_status==='FINISHED')?'FINAL':'HISTORIC_CAPTURA'}));
 const registered=(tickets.results||[]).map(x=>({...x,source:'REAL_REGISTERED',superbet_url:away57MatchUrl(x.event_id,x.fixture)}));
 return {archive_hours:AWAY57_ARCHIVE_HOURS,archive,registered_tickets:registered,
   open_tickets:registered.filter(x=>['OPEN','PENDING','ACTIVE','LIVE'].includes(String(x.status||'').toUpperCase())),
   recent_tickets:registered.filter(x=>!['OPEN','PENDING','ACTIVE','LIVE'].includes(String(x.status||'').toUpperCase())),
   tickets_are_real_only:true};
}
export async function away57RadarAudit(env,eventId){
 const id=Number(eventId);
 if(!Number.isSafeInteger(id)||id<=0)return {ok:false,error:'Invalid event id'};
 const [history,prematch,signal,first57,final,league]=await Promise.all([
  env.DB.prepare("SELECT captured_utc,minute,home_score,away_score,p1,px,p2,gh,ga FROM ghost_equal_samples WHERE event_id=? ORDER BY minute DESC,captured_utc DESC LIMIT 140").bind(id).all(),
  env.DB.prepare("SELECT q.captured_utc,q.kickoff_utc,q.p1,q.px,q.p2,q.generosity_home gh,q.generosity_away ga FROM quote_snapshots q WHERE q.event_id=? AND q.kickoff_utc IS NOT NULL AND q.captured_utc<=q.kickoff_utc AND q.p1>1 AND q.px>1 AND q.p2>1 ORDER BY q.captured_utc DESC LIMIT 1").bind(id).first(),
  env.DB.prepare("SELECT event_id,fixture,captured_utc,signal_utc,minute,home_score,away_score,p1,px,p2,gh,ga,prob_home,prob_draw,prob_away,market_away,expected_value,stake_lei,model_version,trace_bins,data_quality,final_home,final_away,outcome,audit_json FROM sb_away57_signals_v1 WHERE event_id=?").bind(id).first(),
  env.DB.prepare("SELECT event_id,fixture,captured_utc,home_score,away_score,p1,px,p2,gh,ga,prior_minute,prior_gh,prior_ga,sample_source FROM sb_radar_df57_archive_v2 WHERE event_id=? LIMIT 1").bind(id).first(),
  env.DB.prepare("SELECT home_score,away_score,verified,event_status,checked_utc FROM match_results WHERE event_id=?").bind(id).first(),
  env.DB.prepare("SELECT league_name,division,country,confidence FROM sb_radar_event_competition WHERE event_id=?").bind(id).first()
 ]);
 const samples=(history.results||[]).filter(s=>Number.isFinite(Number(s.minute)))
  .sort((a,b)=>Number(a.minute)-Number(b.minute)||Date.parse(a.captured_utc)-Date.parse(b.captured_utc));
 // Collapse repeated same-minute updates to last value, preserving chronological truth.
 const uniq=new Map();for(const x of samples)uniq.set(Number(x.minute),x);
 const trace=[...uniq.values()].sort((a,b)=>Number(a.minute)-Number(b.minute));
 const a=first57||trace.find(x=>Number(x.minute)===57)||null;
 const validated=!!a&&Number(a.home_score)===1&&Number(a.away_score)===1;
 const odd2=a?.p2!==null&&a?.p2!==undefined?Number(a.p2):null;
 const homeOdd=a?.p1!==null&&a?.p1!==undefined?Number(a.p1):null;
 const checks=[
  {key:'score',label:'Scor 1–1 la 57′',passed:validated,known:!!a},
  {key:'fav',label:'Oaspeți favoriți (2 < 1)',passed:!!a&&Number.isFinite(odd2)&&Number.isFinite(homeOdd)&&odd2<homeOdd,known:!!a},
  {key:'odd',label:'Cotă 2 între 1,85–4,00',passed:!!a&&odd2>=1.85&&odd2<=4,known:!!a},
  {key:'gen',label:'Generosity H/A validă',passed:!!a&&[a.gh,a.ga].every(x=>x!==null&&x!==undefined&&Number.isFinite(Number(x))&&Number(x)>=0&&Number(x)<=1),known:!!a},
  {key:'ml',label:'Model ML selectează 2 · EV ≥5%',passed:!!signal,known:!!signal}
 ];
 return {ok:true,event_id:id,fixture:String(signal?.fixture||first57?.fixture||''),league,first57:a,prematch,
  checks,trace:trace.slice(-90),signal:signal?{...signal,audit_json:undefined}:null,
  result:Number(final?.verified)===1?final:null,
  note:signal?'Probabilitatea a fost salvată la momentul emiterii.':'Fără semnal ML înregistrat. Necalificarea nu înseamnă că un model a evaluat și respins acest meci; datele pot fi incomplete.',
  sampled_minutes:trace.length,superbet_url:away57MatchUrl(id,signal?.fixture||first57?.fixture)};
}

const CSS=[
 '#away57{padding:12px 12px 115px;min-height:75vh;max-width:1000px;margin:auto;color:#eaf8ff;box-sizing:border-box}',
 '#away57.hidden{display:none!important}',
 '#nav #tab-away57{color:#91dcfb!important;letter-spacing:0!important}',
 '#nav #tab-away57.active{background:#153e63!important;color:white!important}',
 '#a57-tab-fab{position:fixed;right:14px;bottom:9px;z-index:350;border:1px solid #5bbbe8;border-radius:14px;padding:10px 13px;background:#142b42f5;color:#a8ebff;box-shadow:0 4px 18px #0008;font-weight:900;font-size:12px;backdrop-filter:blur(16px)}',
 '#a57-tab-fab.active{background:#14759d;color:#fff}',
 '#a57-tab-fab span{background:#234d61;border-radius:15px;padding:2px 6px;font-size:10px;margin-left:5px}',
 '#away57 .a57-hero{background:radial-gradient(circle at 10% 10%,#346b8a66,transparent 45%),linear-gradient(130deg,#15354a,#171d32);border:1px solid #4488a9;border-radius:21px;padding:17px 14px;margin:2px 0 12px}',
 '#away57 .a57-kicker{font-size:10px;color:#84d8ff;font-weight:900;letter-spacing:.13em}',
 '#away57 h1{font:900 29px var(--sb-display,Arial);color:#f1fdff;margin:6px 0}',
 '#away57 .a57-muted{font-size:11px;color:#a9c9db;line-height:1.5;margin:9px 0}',
 '#away57 .a57-chips{display:flex;flex-wrap:wrap;gap:6px;margin:9px 0}',
 '#away57 .a57-chip{background:#162e43;border:1px solid #396a88;border-radius:12px;padding:6px 9px;color:#b4e8fc;font-size:11px;font-weight:800}',
 '#away57 .a57-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:12px}',
 '#away57 .a57-kpi{background:#122c3e;border:1px solid #366079;border-radius:13px;padding:10px 6px;text-align:center}',
 '#away57 .a57-kpi strong{display:block;font:900 22px var(--sb-display,Arial);color:#f4fdff}',
 '#away57 .a57-kpi small{font-size:10px;color:#8cafc6}',
 '#away57 .a57-radar-card{border:1px solid #408da7;border-radius:21px;background:linear-gradient(145deg,#15354a,#122037);padding:8px 4px 13px;margin:11px 0;overflow:hidden;box-shadow:0 8px 28px #0005}',
 '#away57 .a57-toolbar{padding:9px 12px;display:flex;align-items:center;justify-content:space-between;gap:6px}',
 '#away57 .a57-toolbar strong{font:900 18px var(--sb-display,Arial);color:#dff8ff}',
 '#away57 .a57-toolbar small{display:block;font-size:10px;color:#a4c8d8}',
 '#away57 .a57-mode{border:1px solid #42708a;border-radius:9px;background:#18283b;color:#b9dce9;padding:7px 10px;font-weight:800}',
 '#away57 .a57-mode.active{background:#1794bb;color:#fff}',
 '#away57 #a57-theo{min-height:320px;display:block}',
 '#away57 .a57-hint{text-align:center;color:#8fb4cb;font-size:10px;margin:4px 10px}',
 '#away57 .a57-filters{border:1px solid #36596c;background:#142639;border-radius:14px;margin:12px 0;padding:10px}',
 '#away57 .a57-filters summary{font-size:13px;color:#d5f1ff;font-weight:900;cursor:pointer}',
 '#away57 .a57-conditions{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}',
 '#away57 .a57-conditions span{border:1px solid #38718e;border-radius:10px;background:#122b42;color:#a7e2f4;padding:7px 9px;font-size:11px}',
 '#away57 .a57-heading{font:900 20px var(--sb-display,Arial);margin:15px 0 10px;color:#ecfaff}',
 '#away57 .a57-select{display:flex;gap:7px;overflow-x:auto;padding:2px 0 10px}',
 '#away57 .a57-select button{white-space:nowrap;background:#1a2c40;border:1px solid #426078;border-radius:12px;color:#a9c8d8;padding:9px 10px;font-size:11px;font-weight:900}',
 '#away57 .a57-select button.active{background:#196d97;color:#fff;border-color:#79d4f2}',
 '#away57 .a57-card{border:1px solid #365b76;border-radius:16px;background:linear-gradient(135deg,#1d3549,#15243a);padding:13px;margin:9px 0}',
 '#away57 .a57-card.is-bet{border-color:#66ebbb;box-shadow:0 0 18px #48d8a129}',
 '#away57 .a57-card.is-near{border-color:#dfb967}',
 '#away57 .a57-card h3{font:900 16px var(--sb-display,Arial);margin:0 0 8px;color:#f7feff}',
 '#away57 .a57-card p{color:#a3bbcc;font-size:11px;line-height:1.4;margin:7px 0}',
 '#away57 .a57-data{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:9px 0}',
 '#away57 .a57-data span{background:#10283a;border:1px solid #33556c;border-radius:10px;padding:9px 5px;text-align:center;color:#b2d0e2;font-size:10px}',
 '#away57 .a57-data b{display:block;color:#fff;font-size:15px}',
 '#away57 .a57-progress{height:5px;background:#234256;overflow:hidden;border-radius:8px;margin:9px 0}',
 '#away57 .a57-progress i{display:block;height:100%;background:linear-gradient(90deg,#2866ad,#76def6);border-radius:8px;transition:width .6s}',
 '#away57 .a57-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}',
 '#away57 .a57-actions a,#away57 .a57-actions button{background:#153b54;border:1px solid #4699bb;color:#b4f0ff;padding:9px 12px;border-radius:10px;font-size:11px;text-decoration:none;font-weight:800}',
 '#away57 .a57-actions a.primary{background:#7cddfb;color:#092b39}',
 '#away57 .a57-empty{padding:22px 12px;text-align:center;border:1px dashed #38647e;border-radius:13px;font-size:12px;color:#9fbece}',
 '#away57 .a57-sub{font-size:10px;color:#8daebf;margin-top:10px}',
 'html.a57-web-native #nav.bottom{display:flex!important;position:fixed!important;bottom:0!important;left:0!important;right:0!important;z-index:990!important;gap:4px!important;padding:8px 5px max(9px,env(safe-area-inset-bottom))!important;background:#101923f7!important;border-top:1px solid #34516d!important;backdrop-filter:blur(16px)}',
 'html.a57-web-native #nav.bottom.hidden{display:none!important}',
'html.a57-web-native #nav.bottom button{display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:center!important;flex:1 1 0!important;min-width:0!important;min-height:66px!important;border-radius:13px!important;background:#1a2233!important;border:1px solid #354258!important;color:#adc2d0!important;font:850 10px var(--sb-display,Arial)!important;letter-spacing:0!important;padding:6px 2px!important;line-height:1.25!important}',
'html.a57-web-native #nav.bottom button.active{background:linear-gradient(140deg,#343051,#312438)!important;color:white!important;border-color:#7a5d91!important}',
'html.a57-web-native #nav.bottom #tab-away57{color:#87deff!important;border-color:#396f8d!important}',
'html.a57-web-native #nav.bottom #tab-away57.active{background:linear-gradient(140deg,#12567a,#19344c)!important;color:white!important;border-color:#68d6ff!important}',
'html.a57-web-native #nav.bottom #tab-profile svg{width:20px!important;height:20px!important}',
'html.a57-web-native body{padding-bottom:83px!important}',
 '@media(prefers-reduced-motion:reduce){#away57 .a57-progress i{transition:none}}'
].join('\n');
function away57RadarClient(){
 const by=id=>document.getElementById(id),elem=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n};
 let page,filter='all',current=null,shadow,radar,points,updating=false;
 const fmt=(x,d=2)=>x!=null&&Number.isFinite(Number(x))?Number(x).toFixed(d):'—';
 const when=x=>{const d=new Date(x);return !isNaN(d)?d.toLocaleTimeString('ro-RO',{timeZone:'Europe/Bucharest',hour:'2-digit',minute:'2-digit'}):'—'};
 const sc=x=>String(x.home_score)+'–'+String(x.away_score);
 const state=x=>x.is_signal?'BET NOW · TEST 2 LEI':x.status==='VERIFY_57'?'VERIFICARE ML 57′':x.status==='NEAR_57'?'APROAPE 57′':x.status==='TRACK_11'?'1–1 ÎN OBSERVARE':x.status==='PRICE_OUT'?'COTĂ ÎN AFARA INTERVALULUI':'0–0 · AȘTEPTĂM 1–1';
 function buildTheo(){
  const host=by('a57-theo');if(!host||host.shadowRoot)return;
  const original=document.querySelector('#live .radar-card .radar3d-stage');
  if(!original){host.append(elem('div','a57-empty','Radarul Theo nu este încă disponibil.'));return}
  shadow=host.attachShadow({mode:'open'});
  const style=elem('style');
  style.textContent=[...document.querySelectorAll('style')].filter(s=>s.id!=='a57-radar-css').map(s=>s.textContent||'').join('\n')+
   '\n:host{display:block;width:100%}.radar-card{border:0!important;background:transparent!important;margin:0!important;padding:0!important;box-shadow:none!important}.radar3d-stage{min-height:320px!important;width:100%!important;margin:0 auto!important}.radar3d-stack,.radar3d-ticket-strip,.radar3d-ticket-detail{display:none!important}#radar .dot.a57-win{outline:2px solid #65f9c3!important;background:#41ebb8!important;box-shadow:0 0 18px #4dffc788!important}#radar .dot.a57-near{outline:2px solid #ffc778!important}#radar .dot{z-index:80!important;cursor:pointer!important}';
  shadow.append(style);
  const root=elem('div','radar-card'),stage=original.cloneNode(true);
  stage.querySelectorAll('button').forEach(b=>b.remove());
  root.append(stage);shadow.append(root);
  radar=stage.querySelector('#radar');points=stage.querySelector('#points');
  if(radar)radar.classList.remove('off');
  if(points)points.replaceChildren();
 }
 function visible(){
  const set=new Map();
  (current?.candidates?.candidates||[]).forEach(x=>set.set(String(x.event_id),x));
  (current?.signals||[]).filter(x=>!x.outcome||Date.parse(x.signal_utc)>Date.now()-86400000).forEach(x=>set.set(String(x.event_id),Object.assign({},x,{minute:57,status:'SIGNAL',is_signal:true})));
  return [...set.values()].sort((a,b)=>Number(!!b.is_signal)-Number(!!a.is_signal)||Number(b.minute)-Number(a.minute));
 }
 function markers(items){
  if(!radar||!points)return;points.replaceChildren();
  items.slice(0,25).forEach(x=>{
   const m=Math.max(6,Math.min(57,Number(x.minute)||6)),r=7+(57-m)/51*34,angle=((Math.imul(Number(x.event_id)||7,1103515245)>>>0)%360)*Math.PI/180;
   const dot=elem('a','dot '+(x.is_signal?'bet a57-win':m>=50?'near a57-near':'mid'));
   dot.href='#a57-match-'+x.event_id;dot.style.left=(50+Math.cos(angle)*r)+'%';dot.style.top=(50+Math.sin(angle)*r)+'%';
   dot.style.setProperty('--pulse',m>=55?'.6s':m>=50?'.95s':'1.7s');
   dot.style.setProperty('--spread',m>=50?'22px':'12px');
   dot.title=String(x.fixture||'')+' · '+m+'′ · '+sc(x)+' · '+state(x);
   dot.addEventListener('click',e=>{e.preventDefault();filter='all';renderButtons();cards();setTimeout(()=>by('a57-match-'+x.event_id)?.scrollIntoView({behavior:'smooth',block:'center'}),40)});
   points.append(dot);
  });
 }
 function renderButtons(){by('a57-tabs')?.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.mode===filter))}
 function cards(){
  const root=by('a57-cards');if(!root)return;
  root.replaceChildren();
  const list=visible().filter(x=>filter==='all'||filter==='bet'&&x.is_signal||filter==='near'&&!x.is_signal&&x.home_score===1&&x.away_score===1&&x.minute>=50||filter==='watch'&&!x.is_signal);
  if(!list.length){root.append(elem('div','a57-empty',filter==='bet'?'Nicio alertă Away 57 emisă încă.':'Momentan nu există candidați proaspeți pentru acest filtru.'));return}
  list.slice(0,25).forEach(x=>{
   const card=elem('article','a57-card '+(x.is_signal?'is-bet':x.minute>=50&&x.home_score===1?'is-near':''));card.id='a57-match-'+x.event_id;
   card.append(elem('h3','',String(x.fixture||'Meci').replace('·',' – ')));
   card.append(elem('div','a57-chip',state(x)));
   card.append(elem('p','',x.is_signal?'Semnal ML înregistrat prospectiv; verifică prețul actual.':x.home_score===1?'Candidat 1–1, NU este semnal până la verificarea ML la 57′.':'Observare 0–0: meciul trebuie să ajungă la 1–1.'));
   const data=elem('div','a57-data');
   for(const [k,v] of [['MINUT',x.minute+'′'],['SCOR',sc(x)],['COTĂ 2',fmt(x.p2)],['GEN HOME',x.gh!=null?fmt(x.gh*100,1)+'%':'—'],['GEN AWAY',x.ga!=null?fmt(x.ga*100,1)+'%':'—'],['ML AWAY',x.is_signal?fmt(x.prob_away*100,1)+'%':'LA 57′']]){
    const n=elem('span');n.append(elem('b','',v),elem('small','',k));data.append(n);
   }
   card.append(data);
   const prog=elem('div','a57-progress'),line=elem('i');line.style.width=Math.min(100,Number(x.minute)/57*100)+'%';prog.append(line);card.append(prog);
   const actions=elem('div','a57-actions'),link=elem('a','primary','Deschide Superbet');link.href=x.superbet_url||'https://superbet.ro/pariuri-sportive/fotbal/live';link.target='_blank';link.rel='noopener noreferrer';actions.append(link);
   const audit=elem('button','','Grafic / Audit');audit.type='button';audit.addEventListener('click',()=>{if(typeof window.tab==='function')window.tab('live');if(typeof window.focusEvent==='function')window.focusEvent(Number(x.event_id));});actions.append(audit);card.append(actions);
   card.append(elem('div','a57-sub','Captură '+when(x.captured_utc||x.signal_utc)+' · '+(x.is_signal?'ML '+fmt(x.prob_away*100,1)+'% · EV '+fmt(x.expected_value*100,1)+'% · test 2 lei':'doar monitorizare')));
   root.append(card);
  });
 }
 function paint(){
  if(!current)return;
  const list=visible();
  by('a57-total').textContent=String(list.filter(x=>!x.is_signal).length);
  by('a57-near').textContent=String(list.filter(x=>!x.is_signal&&x.home_score===1&&x.away_score===1&&x.minute>=50).length);
  by('a57-bet').textContent=String(current.stats?.signals||0);
  by('a57-updated').textContent='Capturi '+when(current.candidates?.updated_utc)+' · Scanner ML '+when(current.last_scan?.finished_utc);
  by('a57-radar-count').textContent=list.length+' meciuri';
  markers(list.filter(x=>!x.is_signal||!x.outcome));
  cards();renderButtons();
  const root=by('a57-conditions');root.replaceChildren();
  (current.candidates?.filters||[]).forEach(x=>root.append(elem('span','',x.name+' — '+x.description)));
  const fab=by('a57-tab-fab');if(fab){fab.querySelector('span').textContent=String(list.length);fab.classList.toggle('active',!page.classList.contains('hidden'))}
 }
 async function refresh(){
  if(updating||!page||page.classList.contains('hidden'))return;updating=true;
  try{if(typeof api!=='function')throw Error('API indisponibil');const data=await api('/api/mobile/away57');if(!data?.ok)throw Error(data?.error||'Răspuns invalid');current=data;buildTheo();paint();}
  catch(e){if(!current)by('a57-cards').replaceChildren(elem('div','a57-empty','Nu pot încărca Away 57: '+String(e.message||e)));}
  finally{updating=false}
 }
 function enableSixWebTabs(nav){
  if(!window.DrixNative||typeof window.DrixNative.setNativeTabsVisible!=='function')return false;
  const enforce=()=>{
   try{
    if(!nav.isConnected)return;
    window.DrixNative.setNativeTabsVisible(false);
    if(!nav.classList.contains('hidden')){
     document.documentElement.classList.remove('sb-android-native-nav');
     document.documentElement.classList.add('a57-web-native');
    }
   }catch(e){}
  };
  enforce();setTimeout(enforce,500);setTimeout(enforce,1600);
  new MutationObserver(()=>{if(document.documentElement.classList.contains('sb-android-native-nav'))enforce()}).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
  setInterval(enforce,8000);
  return true;
 }
 function install(){
  const nav=by('nav'),slip=by('slip');if(!nav||!slip||typeof window.tab!=='function')return;
  by('a57-live-shortcut')?.remove();by('a57-tab-fab')?.remove();by('away57')?.remove();by('tab-away57')?.remove();
  page=elem('section','screen hidden');page.id='away57';
  page.innerHTML='<div class="a57-hero"><div class="a57-kicker">SB RADAR · RADAR THEO · SISTEM INDEPENDENT</div><h1>✈ AWAY 57</h1><div class="a57-chips"><span class="a57-chip">1–1 → VICTORIE OASPEȚI (2)</span><span class="a57-chip">ML + GENEROSITY H/A</span><span class="a57-chip">BET NOW · TEST 2 LEI</span></div><p class="a57-muted">Aceeași scenă Radar Theo, dar cu meciuri proprii. Punctele se apropie de centru numai când minutul real avansează; semnalul ML se decide la 57′.</p><div class="a57-grid"><div class="a57-kpi"><strong id="a57-total">0</strong><small>OBSERVARE</small></div><div class="a57-kpi"><strong id="a57-near">0</strong><small>APROAPE 57′</small></div><div class="a57-kpi"><strong id="a57-bet">0</strong><small>BET NOW NOI</small></div></div><p id="a57-updated" class="a57-muted">Conectare la feed…</p></div><div class="a57-radar-card"><div class="a57-toolbar"><div><strong>◉ RADAR THEO · AWAY 57</strong><small id="a57-radar-count">0 meciuri</small></div><div><button id="a57-3d" class="a57-mode active">3D</button><button id="a57-2d" class="a57-mode">2D</button></div></div><div id="a57-theo"></div><p class="a57-hint">Punctele arată doar progresul meciului. Apasă un punct pentru detalii.</p></div><details class="a57-filters"><summary>⚙ Filtre active AWAY 57</summary><div id="a57-conditions" class="a57-conditions"></div></details><h2 class="a57-heading">Meciuri monitorizate</h2><div id="a57-tabs" class="a57-select"><button data-mode="all" class="active">TOATE</button><button data-mode="near">APROAPE 57′</button><button data-mode="watch">OBSERVARE</button><button data-mode="bet">BET NOW</button></div><div id="a57-cards"></div><p class="a57-sub">Cercetare prospectivă; +90,94% din lotul istoric NU este o prognoză de profit. Fără pariuri automate.</p>';
  slip.parentNode.insertBefore(page,slip);
  const tabButton=elem('button','','✈ AWAY 57');tabButton.id='tab-away57';tabButton.type='button';tabButton.addEventListener('click',()=>window.tab('away57'));nav.insertBefore(tabButton,by('tab-slip'));
  // The installed native navigation has five fixed tabs; this dedicated sixth tab
  // remains visible just ABOVE the native navigation, not in RADAR Home content.
  if(window.DrixNative&&!enableSixWebTabs(nav)){const fab=elem('button','','✈ AWAY 57');fab.id='a57-tab-fab';fab.type='button';fab.append(elem('span','','0'));fab.addEventListener('click',()=>window.tab('away57'));document.body.append(fab);}
  by('a57-tabs').addEventListener('click',e=>{const b=e.target.closest('button[data-mode]');if(!b)return;filter=b.dataset.mode;renderButtons();cards()});
  by('a57-3d').addEventListener('click',()=>{shadow?.querySelector('.radar3d-stage')?.classList.remove('radar-mode-flat');by('a57-3d').classList.add('active');by('a57-2d').classList.remove('active')});
  by('a57-2d').addEventListener('click',()=>{shadow?.querySelector('.radar3d-stage')?.classList.add('radar-mode-flat');by('a57-2d').classList.add('active');by('a57-3d').classList.remove('active')});
  const old=window.tab;
  window.tab=function(name){
   if(name==='away57'){
    document.querySelectorAll('.screen').forEach(n=>n.classList.add('hidden'));
    nav.querySelectorAll('button').forEach(n=>n.classList.toggle('active',n.id==='tab-away57'));
    page.classList.remove('hidden');by('a57-tab-fab')?.classList.add('active');buildTheo();refresh();window.scrollTo(0,0);return;
   }
   page.classList.add('hidden');by('a57-tab-fab')?.classList.remove('active');return old.apply(this,arguments);
  };
  if(new URLSearchParams(location.search).get('tab')==='away57')setTimeout(()=>window.tab('away57'),300);
 }
 const start=()=>{install();if(!page){setTimeout(install,400);setTimeout(install,1100)}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 setInterval(()=>{if(page&&!page.classList.contains('hidden'))refresh();},25000);
}
export function withAway57Radar(html){
 if(typeof html!=='string'||html.includes('id="a57-radar-css"'))return html;
 return html.replace('</head>','<style id="a57-radar-css">'+CSS+'</style></head>')
  .replace('</body>','<script id="a57-radar-app">('+away57RadarClient.toString()+')();</script></body>');
}
