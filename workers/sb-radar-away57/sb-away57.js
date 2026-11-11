// AWAY 57 — independent experimental 1–1 / away-win observer.
// Frozen model reconstructed from 843 historic training matches (2026-10-29 .. 2026-11-05).
// NOT a validated betting advantage. NEVER places bets, modifies Golden or KLOPP selections.
export const AWAY57_VERSION='AWAY57_LOGREG_L2_0015_20261105_V1';
const FEATURE_NAMES=['pre1','prex','pre2','m1','mx','m2','score','gh_pre','ga_pre','gh_57','ga_57','gh_delta','ga_delta','gh_trend','ga_trend','gvol','gh_avg','ga_avg','n_traces','mx_trend','m1_trend','m2_trend'];
const MU=[.42039222,.254656032,.324951748,.338532546,.388626626,.272840828,.378410439,.445848819,.342277759,.344849967,.272066872,-.100998852,-.070210887,-.053634451,-.0492481,.290358902,.403901353,.318147767,5.029655991,.088378571,-.045184322,-.043194249];
const SD=[.15263668,.043234758,.143692942,.122976231,.054806958,.111570711,.4849907,.164733881,.157389944,.139274274,.127280873,.076001606,.067985447,.110936267,.102394654,.310167238,.168272258,.158120374,2.084871394,.047602092,.102050268,.094795124];
const WEIGHTS=[
[.01112699,.057569124,-.068118264,-.040656717,.072523513,-.060813988,-.050063665,.048397691,.059068937,-.037406753,.027474871,-.05055185,-.077684049,-.006713331,-.00559045,.020982438,-.032133711,.010662692,-.04450157,.012737671,-.11165447,.042492672,.010323291],
[.263709181,-.01901749,.083702463,-.004983469,-.00621454,.093789384,-.039222391,-.126025754,-.023757775,-.011867418,.024566236,-.010842997,.096513162,.008242785,.007449473,.001318736,-.000788717,.023901936,-.006450403,-.046832405,.060006682,-.00562673,-.024075439],
[-.274836171,-.038551635,-.015584199,.045640186,-.066308974,-.032975395,.089286056,.077628063,-.035311162,.049274171,-.052041108,.061394848,-.018829113,-.001529454,-.001859023,-.022301174,.032922428,-.034564629,.050951973,.034094734,.051647788,-.036865942,.013752148]
];
const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
const BINS=[10,20,30,40,45,50,55];
const min2=x=>Math.max(-6,Math.min(6,x));
function num(x){if(x===null||x===undefined||x==='')return null;const y=Number(x);return Number.isFinite(y)?y:null;}
function fair(a){const inverse=a.map(x=>1/Number(x));const s=inverse.reduce((a,b)=>a+b,0);return inverse.map(x=>x/s);}
function validPrices(a){return a.every(x=>Number.isFinite(num(x))&&Number(x)>1.01);}
function validGen(a){return a.every(x=>Number.isFinite(num(x))&&Number(x)>=0&&Number(x)<=1);}
function binAt(minute){if(minute<10||minute>57)return null;if(minute<20)return 10;if(minute<30)return 20;if(minute<40)return 30;if(minute<45)return 40;if(minute<50)return 45;if(minute<55)return 50;return 55;}
function softmax(a){const mx=Math.max(...a),ex=a.map(x=>Math.exp(Math.max(-50,Math.min(40,x-mx)))),s=ex.reduce((a,b)=>a+b,0);return ex.map(x=>x/s);}
function modelPrediction(features){
 const v=FEATURE_NAMES.map((key,i)=>min2((Number(features[key]||0)-MU[i])/SD[i]));
 const logits=WEIGHTS.map(w=>w[0]+v.reduce((s,x,i)=>s+x*w[i+1],0));
 const p=softmax(logits);return {home:p[0],draw:p[1],away:p[2]};
}
function encodeFixture(fixture,id){
 const names=String(fixture||'').split(/[·•|]/);
 if(names.length!==2||!Number.isSafeInteger(Number(id))||Number(id)<1)return 'https://superbet.ro/pariuri-sportive/fotbal/live';
 const slug=s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100);
 const a=slug(names[0]),b=slug(names[1]);
 return a&&b?'https://superbet.ro/cote/fotbal/'+a+'-vs-'+b+'-'+id:'https://superbet.ro/pariuri-sportive/fotbal/live';
}
async function inputsFor(env,snapshot){
 const db=env.DB,id=Number(snapshot.event_id);
 const prematch=await db.prepare("SELECT p1,px,p2,generosity_home gh,generosity_away ga,captured_utc,kickoff_utc FROM quote_snapshots WHERE event_id=? AND kickoff_utc IS NOT NULL AND captured_utc<=kickoff_utc AND captured_utc<=? AND p1>1.01 AND px>1.01 AND p2>1.01 ORDER BY captured_utc DESC LIMIT 1").bind(id,snapshot.captured_utc).first();
 if(!prematch||!validPrices([prematch.p1,prematch.px,prematch.p2])||!validGen([prematch.gh,prematch.ga]))return null;
 const staged=(await db.prepare("SELECT captured_utc,minute,p1,px,p2,generosity_home gh,generosity_away ga FROM live_snapshots WHERE event_id=? AND minute BETWEEN 10 AND 57 AND captured_utc<=? AND p1>1.01 AND px>1.01 AND p2>1.01 ORDER BY minute ASC,captured_utc ASC LIMIT 240").bind(id,snapshot.captured_utc).all()).results||[];
 const byBin=new Map();
 for(const s of staged){const b=binAt(Number(s.minute));if(b!==null)byBin.set(b,s);}
 const f={},p=fair([prematch.p1,prematch.px,prematch.p2]),m=fair([snapshot.p1,snapshot.px,snapshot.p2]);
 ['pre1','prex','pre2'].forEach((k,i)=>f[k]=p[i]);
 ['m1','mx','m2'].forEach((k,i)=>f[k]=m[i]);
 f.score=1;f.gh_pre=Number(prematch.gh);f.ga_pre=Number(prematch.ga);
 f.gh_57=Number(snapshot.gh);f.ga_57=Number(snapshot.ga);
 f.gh_delta=f.gh_57-f.gh_pre;f.ga_delta=f.ga_57-f.ga_pre;
 let last=[Number(prematch.p1),Number(prematch.px),Number(prematch.p2),f.gh_pre,f.ga_pre],n=0,sumGh=0,sumGa=0,vol=0,prevGh=null,prevGa=null;
 for(const bin of BINS){
  const stage=byBin.get(bin);
  if(stage){
   const hasG=validGen([stage.gh,stage.ga]);
   last=[Number(stage.p1),Number(stage.px),Number(stage.p2),hasG?Number(stage.gh):last[3],hasG?Number(stage.ga):last[4]];
   if(hasG){if(prevGh!==null)vol+=Math.abs(last[3]-prevGh)+Math.abs(last[4]-prevGa);prevGh=last[3];prevGa=last[4];n++;sumGh+=last[3];sumGa+=last[4];}
  }
  const prices=fair(last.slice(0,3));
  f['m1_'+bin]=prices[0];f['mx_'+bin]=prices[1];f['m2_'+bin]=prices[2];
  f['gh_'+bin]=last[3];f['ga_'+bin]=last[4];
 }
 f.gh_trend=f.gh_57-(f.gh_40||f.gh_pre);
 f.ga_trend=f.ga_57-(f.ga_40||f.ga_pre);
 f.gvol=vol;f.gh_avg=n?sumGh/n:f.gh_pre;f.ga_avg=n?sumGa/n:f.ga_pre;
 // The experiment counted populated bins even when some Generosity values were missing.
 f.n_traces=byBin.size;
 f.mx_trend=m[1]-f.mx_40;f.m1_trend=m[0]-f.m1_40;f.m2_trend=m[2]-f.m2_40;
 return {features:f,trace_bins:byBin.size,trace_gen_bins:n,prematch_utc:prematch.captured_utc,market:m,predicted:modelPrediction(f)};
}
async function settleAway57(env){
 const pending=(await env.DB.prepare("SELECT event_id FROM sb_away57_signals_v1 WHERE outcome IS NULL ORDER BY signal_utc DESC LIMIT 65").all()).results||[];
 for(const row of pending){
  const m=await env.DB.prepare("SELECT home_score,away_score,verified,event_status FROM match_results WHERE event_id=?").bind(row.event_id).first();
  if(!m||Number(m.verified)!==1||m.event_status!=='FINISHED'||m.home_score===null||m.away_score===null)continue;
  const result=Number(m.away_score)>Number(m.home_score)?'WIN':'LOSS';
  await env.DB.prepare("UPDATE sb_away57_signals_v1 SET outcome=?,final_home=?,final_away=?,settled_utc=? WHERE event_id=? AND outcome IS NULL")
   .bind(result,Number(m.home_score),Number(m.away_score),new Date().toISOString(),row.event_id).run();
 }
}
export async function scanAway57(env,options={}){
 const db=env.DB; if(!db)return {ok:false,reason:'DB_MISSING'};
 const reused=Array.isArray(options.frames);
 // Reuse the primary scanner's existing minute-57 frames when available.
 // Otherwise consume the one FIRST57 D1 archive shared by primary and backup.
 // Neither mode fetches Superbet or starts a separate provider scanner.
 const started=new Date().toISOString();
 // Isolated from Golden and KLOPP; no slips or stake policy writes.
 if(options.settle!==false)await settleAway57(env);
 const since=new Date(Date.now()-150000).toISOString();
 const rows=reused?options.frames:(await db.prepare("SELECT event_id,fixture,captured_utc,home_score,away_score,p1,px,p2,gh,ga FROM sb_radar_df57_archive_v2 WHERE captured_utc>=? AND home_score=1 AND away_score=1 AND p1>1.01 AND px>1.01 AND p2 BETWEEN 1.85 AND 4 AND gh BETWEEN 0 AND 1 AND ga BETWEEN 0 AND 1 ORDER BY captured_utc DESC LIMIT 35").bind(since).all()).results||[];
 let checked=0,matched=0,inserted=0;
 for(const s of rows){
  if(!Number.isSafeInteger(Number(s.event_id))||Date.now()-Date.parse(s.captured_utc)>150000)continue;
  if(s.minute!==undefined&&Number(s.minute)!==57)continue;
  if(Number(s.home_score)!==1||Number(s.away_score)!==1)continue;
  if(![s.p1,s.px,s.p2].every(v=>Number.isFinite(Number(v))&&Number(v)>1.01)||!(Number(s.p2)>=1.85&&Number(s.p2)<=4))continue;
  if(![s.gh,s.ga].every(v=>v!==null&&v!==undefined&&Number(v)>=0&&Number(v)<=1))continue;
  if(!(Number(s.p2)<Number(s.p1)))continue;
  const exists=await db.prepare("SELECT 1 AS found FROM sb_away57_signals_v1 WHERE event_id=?").bind(s.event_id).first();
  if(exists)continue;
  // Fail closed when a later sample reports a goal; never alert using an obsolete 1–1 snapshot.
  const latest=await db.prepare("SELECT home_score,away_score,minute,captured_utc FROM ghost_equal_samples WHERE event_id=? ORDER BY captured_utc DESC LIMIT 1").bind(s.event_id).first();
  if(latest&&Date.parse(latest.captured_utc)>Date.parse(s.captured_utc)+2500){
   if(Number(latest.home_score)!==1||Number(latest.away_score)!==1||Number(latest.minute)>59)continue;
  }
  const row=await inputsFor(env,s);if(!row||row.trace_bins<1)continue;
  checked++;
  const p=row.predicted,odds=[Number(s.p1),Number(s.px),Number(s.p2)],prob=[p.home,p.draw,p.away];
  let best=-Infinity,chosen=-1;
  for(let c=0;c<3;c++){const ev=prob[c]*odds[c]-1;if(odds[c]>=1.85&&odds[c]<=4&&ev>best){best=ev;chosen=c;}}
  if(chosen!==2||best<0.05)continue;
  matched++;
  const market=row.market[2],now=new Date().toISOString();
  const audit={features:row.features,model_training_utc:'2026-11-05T23:59:59Z',prematch_utc:row.prematch_utc,trace_gen_bins:row.trace_gen_bins,
   check:'1-1@57, p2<p1, selected maximum 1X2 EV>=0.05, odds [1.85,4], test only',
   shared_scanner_source:reused?'PRIMARY_IN_MEMORY_57':'PRIMARY_SECONDARY_FIRST57_D1'};
  const res=await db.prepare("INSERT OR IGNORE INTO sb_away57_signals_v1(event_id,fixture,captured_utc,signal_utc,minute,home_score,away_score,p1,px,p2,gh,ga,prob_home,prob_draw,prob_away,market_away,expected_value,stake_lei,model_version,trace_bins,data_quality,audit_json) VALUES(?,?,?,?,57,1,1,?,?,?,?,?,?,?,?,?,?,2,?,?,?,?)").bind(
   Number(s.event_id),String(s.fixture||''),String(s.captured_utc),now,
   Number(s.p1),Number(s.px),Number(s.p2),Number(s.gh),Number(s.ga),p.home,p.draw,p.away,market,best,
   AWAY57_VERSION,row.trace_bins,row.trace_bins>=3?'OK':'LOW_TRACE',JSON.stringify(audit)
  ).run();
  if(Number(res.meta?.changes||0)===1)inserted++;
 }
 const finished=new Date().toISOString();
 if(options.recordRun!==false)await db.prepare("INSERT INTO sb_away57_scan_runs_v1(started_utc,finished_utc,scanned,checked,matched,inserted,error) VALUES(?,?,?,?,?,?,NULL)").bind(started,finished,rows.length,checked,matched,inserted).run();
 return {ok:true,scanned:rows.length,checked,matched,inserted,model:AWAY57_VERSION,at:finished,shared_scanner_source:reused?'PRIMARY_IN_MEMORY_57':'PRIMARY_SECONDARY_FIRST57_D1',external_provider_requests:0};
}
export async function away57Replay(env,eventId){
 const id=Number(eventId);if(!Number.isSafeInteger(id)||id<=0)return {ok:false,error:'Invalid event id'};
 const s=await env.DB.prepare("SELECT event_id,fixture,captured_utc,home_score,away_score,p1,px,p2,gh,ga FROM sb_radar_df57_archive_v2 WHERE event_id=? AND home_score=1 AND away_score=1 ORDER BY captured_utc DESC LIMIT 1").bind(id).first();
 if(!s)return {ok:false,error:'No 1–1 minute 57 snapshot for event'};
 const d=await inputsFor(env,s);if(!d)return {ok:false,error:'Missing valid historical prematch/live data'};
 const p=d.predicted,odds=[Number(s.p1),Number(s.px),Number(s.p2)],probs=[p.home,p.draw,p.away];
 let ev=-Infinity,choice=-1;for(let c=0;c<3;c++){const z=probs[c]*odds[c]-1;if(odds[c]>=1.85&&odds[c]<=4&&z>ev){ev=z;choice=c}}
 const isSignal=(choice===2&&ev>=.05&&Number(s.p2)<Number(s.p1));
 const final=await env.DB.prepare("SELECT home_score,away_score,verified FROM match_results WHERE event_id=?").bind(id).first();
 return {ok:true,mode:'REPLAY_READ_ONLY',model:AWAY57_VERSION,event_id:id,fixture:s.fixture,captured_utc:s.captured_utc,selection:['1','X','2'][choice]||null,away57_selected:isSignal,expected_value:ev,
  p_model:p,p_market:fair(odds),odds,gh:s.gh,ga:s.ga,trace_bins:d.trace_bins,features:d.features,
  final:final&&Number(final.verified)===1?{home:final.home_score,away:final.away_score}:null};
}
export async function away57Snapshot(env){
 const signals=(await env.DB.prepare("SELECT event_id,fixture,captured_utc,signal_utc,minute,home_score,away_score,p1,px,p2,gh,ga,prob_home,prob_draw,prob_away,market_away,expected_value,stake_lei,model_version,trace_bins,data_quality,final_home,final_away,outcome,settled_utc FROM sb_away57_signals_v1 ORDER BY signal_utc DESC LIMIT 30").all()).results||[];
 const totals=await env.DB.prepare("SELECT COUNT(*) AS signals,COALESCE(SUM(CASE WHEN outcome='WIN' THEN 1 ELSE 0 END),0) AS wins,COALESCE(SUM(CASE WHEN outcome='LOSS' THEN 1 ELSE 0 END),0) AS losses FROM sb_away57_signals_v1").first();
 const latest_scan=await env.DB.prepare("SELECT finished_utc,scanned,checked,matched,inserted,error FROM sb_away57_scan_runs_v1 ORDER BY id DESC LIMIT 1").first();
 return {ok:true,name:'AWAY 57',model:AWAY57_VERSION,mode:'PROSPECTIVE_TEST_ONLY',selection:'2',suggested_stake_lei:2,auto_betting:false,updated_utc:new Date().toISOString(),stats:totals,last_scan:latest_scan,
  historical_research:{selections:18,wins:13,losses:5,roi_virtual_pct:90.94,validated:false,scope:'1–1 at minute 57, away shorter than home, selected using older retrospective data'},
  signals:signals.map(s=>({...s,superbet_url:encodeFixture(s.fixture,s.event_id)}))};
}
export async function away57MobileAlerts(env,appVersion=''){
 // SAFETY: installed v2.3.32 native handler mislabels this market as X/Gold Rush.
 // Keep in-app prospective signals only until a dedicated, tested Android 2-market notification parser ships.
 return [];
 // Legacy native notification path reused ONLY for v2.3.33+; older APKs must not see this alias.
 const m=/^(\d+)\.(\d+)\.(\d+)/.exec(String(appVersion));
 if(!m||(Number(m[1])*1000000+Number(m[2])*1000+Number(m[3]))<2003033)return [];
 const since=new Date(Date.now()-3*60000).toISOString();
 const rows=(await env.DB.prepare("SELECT event_id,fixture,signal_utc,minute,home_score,away_score,p1,px,p2,gh,ga,prob_away,expected_value,stake_lei,model_version FROM sb_away57_signals_v1 WHERE signal_utc>=? ORDER BY signal_utc DESC LIMIT 8").bind(since).all()).results||[];
 return rows.map(s=>({event_id:s.event_id,fixture:s.fixture,triggered_utc:s.signal_utc,stage:'BET_NOW',minute:57,home_score:1,away_score:1,
  p1:s.p1,px:s.px,p2:s.p2,gh:s.gh,ga:s.ga,model_probability:s.prob_away,expected_value:s.expected_value,
  selection:'2',signal_label:'GOLD RUSH',signal_type:'AWAY_57',signal_theme:'away57',model_version:'GOLD_RUSH_'+s.model_version,suggested_stake_lei:2,
  alert_type:'AWAY57_TEST_BETNOW',informational:true,auto_betting:false,full_screen:false,fullscreen:false,url:'/app?tab=away57&event_id='+s.event_id}));
}
const AWAY_CSS=[
 '#away57{padding:17px 12px 100px;min-height:70vh;color:#e9f4ff;max-width:920px;margin:0 auto;font-family:inherit}',
 '#away57.hidden{display:none!important}',
 '#away57 .a57-head{border-radius:22px;padding:21px 18px;background:radial-gradient(circle at 12% 7%,rgba(67,191,237,.22),transparent 44%),linear-gradient(135deg,#0d293d,#16182d);border:1px solid rgba(92,195,244,.36);box-shadow:0 12px 34px #0007;position:relative;overflow:hidden}',
 '#away57 .a57-head:after{content:"";position:absolute;inset:auto -25% -110px -25%;height:130px;background:radial-gradient(ellipse,rgba(28,197,250,.22),transparent 70%);pointer-events:none;animation:a57glow 5s ease-in-out infinite alternate}',
 '@keyframes a57glow{to{opacity:.32;transform:translateY(-20px)}}',
 '#away57 h1{font-size:28px;letter-spacing:.035em;margin:3px 0 5px;color:#fff}#away57 .a57-kicker{font-size:11px;letter-spacing:.15em;color:#74dbff;font-weight:800}',
 '#away57 p{font-size:12px;line-height:1.5;color:#b8c9d8}#away57 .a57-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}',
 '#away57 .a57-kpi{background:#102331c9;border:1px solid #254457;border-radius:14px;padding:10px;text-align:center}#away57 .a57-kpi strong{font-size:19px;color:#e7faff;display:block}#away57 .a57-kpi span{font-size:10px;color:#89a6b8}',
 '#away57 .a57-card{border-radius:17px;border:1px solid #274d65;background:linear-gradient(150deg,rgba(18,43,57,.95),rgba(16,23,38,.97));margin:10px 0;padding:14px;box-shadow:0 8px 25px #0005}',
 '#away57 .a57-card h3{font-size:15px;margin:0 0 8px;color:#f3fbff}#away57 .a57-row{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin:8px 0}',
 '#away57 .a57-chip{padding:5px 9px;border:1px solid #31586d;border-radius:12px;background:#122f40;color:#c4e9fb;font-size:11px;font-weight:700}',
 '#away57 .a57-good{color:#77edc0}#away57 .a57-bad{color:#ff909f}#away57 .a57-action{color:#061c28;background:#7bd9f6;text-decoration:none;border-radius:12px;padding:10px 13px;font-weight:800;font-size:12px;display:inline-block}',
 '#away57 .a57-soft{background:#172635;border:1px solid #355369;color:#d9effa;border-radius:11px;padding:10px 12px;cursor:pointer;font-weight:700}',
 '#away57 .a57-sub{font-size:11px;color:#8ea8b9;margin:9px 0}#away57 #a57-refresh{border:1px solid #3b7e9b;border-radius:12px;background:#163748;color:#b9edff;padding:8px 12px}',
 '#away57 .a57-empty{padding:26px 14px;text-align:center;border:1px dashed #33556a;border-radius:17px;color:#96b4c5;font-size:13px}',
 '#tab-away57{color:#9cecff!important}#tab-away57.active{color:#fff!important;background:linear-gradient(145deg,#136084,#193248)!important}',
 '#a57-live-shortcut{width:100%;border:1px solid #236078;border-radius:14px;background:linear-gradient(90deg,#112836,#102635);color:#8ce8ff;padding:11px;margin:7px 0;text-align:left;font-size:12px;font-weight:800}',
 '@media(prefers-reduced-motion:reduce){#away57 .a57-head:after{animation:none}}'
].join('');
function away57Client(){
 let currentPage=null,inProgress=false;
 const $=id=>document.getElementById(id);
 const fmt=(v,d=2)=>Number.isFinite(Number(v))?Number(v).toFixed(d):'—';
 const timestamp=t=>{if(!t)return '—';const v=new Date(t);return Number.isNaN(v.getTime())?t:v.toLocaleString('ro-RO',{timeZone:'Europe/Bucharest',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})};
 function element(tag,cls,txt){const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=String(txt);return n;}
 async function load(){
  if(inProgress||!currentPage||currentPage.classList.contains('hidden'))return;
  inProgress=true;const area=$('a57-feed'),refresh=$('a57-refresh');
  if(refresh)refresh.textContent='Se actualizează…';
  try{
   if(typeof api!=='function')throw Error('Autentificarea aplicației este indisponibilă');
   const data=await api('/api/mobile/away57');
   if(!data||!data.ok)throw Error(data?.error||'Răspuns invalid');
   const stats=data.stats||{};
   const scan=data.last_scan;
   if($('a57-scan'))$('a57-scan').textContent=scan?'Ultima scanare: '+timestamp(scan.finished_utc)+' · '+scan.scanned+' capturi verificate':'Scanarea automată nu a fost încă confirmată';
   $('a57-total').textContent=String(stats.signals||0);
   $('a57-wins').textContent=String(stats.wins||0);
   $('a57-losses').textContent=String(stats.losses||0);
   area.replaceChildren();
   const signals=data.signals||[];
   if(!signals.length){area.appendChild(element('div','a57-empty','Niciun semnal nou. Laboratorul verifică numai meciurile 1–1 la minutul 57.'));return;}
   for(const s of signals.slice(0,18)){
    const card=element('article','a57-card');
    const head=element('h3',null,String(s.fixture||'Meci necunoscut').replace('·',' – '));card.appendChild(head);
    const status=s.outcome==='WIN'?'✓ WIN':s.outcome==='LOSS'?'✕ LOSS':'◉ BET NOW · TEST';
    const badge=element('div','a57-row');badge.append(
      element('span','a57-chip',status),
      element('span','a57-chip','1–1 la 57′'),
      element('span','a57-chip','Victorie oaspeți (2)'),
      element('span','a57-chip','2 LEI')
    );card.appendChild(badge);
    const nums=element('div','a57-row');nums.append(
      element('span','a57-chip','Cotă 2: '+fmt(s.p2)),
      element('span','a57-chip','ML: '+fmt(100*s.prob_away,1)+'%'),
      element('span','a57-chip','EV estimat: '+fmt(100*s.expected_value,1)+'%')
    );card.appendChild(nums);
    const gen=element('div','a57-sub','Generosity H/A: '+fmt(100*s.gh,1)+'% / '+fmt(100*s.ga,1)+'% · Capturi: '+(s.trace_bins||0)+' · '+timestamp(s.captured_utc));
    card.appendChild(gen);
    if(s.outcome)card.appendChild(element('div',s.outcome==='WIN'?'a57-good':'a57-bad','Final '+s.final_home+'–'+s.final_away+' · '+s.outcome));
    const actions=element('div','a57-row');
    const link=element('a','a57-action','Deschide meciul Superbet');link.href=String(s.superbet_url||'https://superbet.ro/pariuri-sportive/fotbal/live');link.rel='noopener noreferrer';actions.appendChild(link);
    const audit=element('button','a57-soft','Grafic / Audit');audit.type='button';audit.addEventListener('click',()=>{try{if(typeof window.tab==='function')window.tab('live');if(typeof focusEvent==='function')focusEvent(Number(s.event_id));}catch(e){}});actions.appendChild(audit);
    card.appendChild(actions);area.appendChild(card);
   }
  }catch(e){area.replaceChildren(element('div','a57-empty','Date indisponibile: '+(e?.message||'eroare de rețea')));}
  finally{inProgress=false;if(refresh)refresh.textContent='↻ Actualizează';}
 }
 function install(){
  const nav=$('nav');if(!nav||typeof window.tab!=='function')return;
  if(!$('away57')){
   const p=element('section','hidden');p.id='away57';
   p.innerHTML='<div class="a57-head"><div class="a57-kicker">SB RADAR · LABORATOR PROSPECTIV</div><h1>✈ AWAY 57</h1><p>1–1 la minutul 57 • ML L2 cu evoluția cotelor 1/X/2 și Generosity Home/Away • recomandare de test: 2 lei • fără pariuri automate.</p><p><strong>Reper istoric, NEVALIDAT:</strong> 13 WIN / 18 selecții favoriți · ROI virtual +90,94%. Aceasta NU este o estimare a profitului viitor.</p><div class="a57-grid"><div class="a57-kpi"><strong id="a57-total">0</strong><span>Semnale noi</span></div><div class="a57-kpi"><strong id="a57-wins">0</strong><span>WIN confirmate</span></div><div class="a57-kpi"><strong id="a57-losses">0</strong><span>LOSS confirmate</span></div></div><div id="a57-scan" class="a57-sub">Scanarea automată nu a fost încă confirmată</div><button id="a57-refresh" type="button">↻ Actualizează</button></div><div id="a57-feed" style="margin-top:12px"></div>';
   nav.parentNode.insertBefore(p,nav);currentPage=p;
   $('a57-refresh').addEventListener('click',load);
  }else currentPage=$('away57');
  if(!$('tab-away57')){
   const btn=element('button',null,'✈ AWAY 57');btn.id='tab-away57';btn.type='button';btn.addEventListener('click',()=>window.tab('away57'));nav.insertBefore(btn,$('tab-slip')||nav.firstChild);
  }
  const radar=$('live');
  if(radar&&!$('a57-live-shortcut')){const btn=element('button',null,'✈ AWAY 57 · ML 1–1 → 2 · TEST 2 LEI');btn.id='a57-live-shortcut';btn.type='button';btn.addEventListener('click',()=>window.tab('away57'));radar.insertBefore(btn,radar.firstChild);}
  if(!window.tab.__away57v1){
   const old=window.tab;
   const wrapped=function(route){
    if(route==='away57'){
     ['live','slip','roi','profile','klopp'].forEach(id=>{const x=$(id);if(x)x.classList.add('hidden');});
     if(currentPage)currentPage.classList.remove('hidden');
     Array.from(nav.querySelectorAll('button')).forEach(b=>b.classList.toggle('active',b.id==='tab-away57'));
     window.scrollTo(0,0);
     try{if(window.DrixNative)window.DrixNative.setNativeTabActive('away57')}catch(e){}
     load();return;
    }
    if(currentPage)currentPage.classList.add('hidden');
    return old.apply(this,arguments);
   };
   wrapped.__away57v1=true;window.tab=wrapped;
  }
 }
 function start(){install();setTimeout(install,350);setTimeout(install,1200);if(new URLSearchParams(location.search).get('tab')==='away57')setTimeout(()=>{install();window.tab('away57')},450);}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 setInterval(()=>{if(currentPage&&!currentPage.classList.contains('hidden')&&document.visibilityState==='visible')load();},30000);
}
export function withAway57(html){
 if(typeof html!=='string'||html.includes('id="sb-away57-css"'))return html;
 return html.replace('</head>','<style id="sb-away57-css">'+AWAY_CSS+'</style></head>')
  .replace('</body>','<script id="sb-away57-client">('+away57Client.toString()+')();</script></body>');
}
