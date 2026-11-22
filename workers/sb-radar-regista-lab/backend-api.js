/* REGISTA LAB V2 — owner-safe read API. Never creates bets or FCM. */
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const NOW=()=>new Date().toISOString();
const PICK_SQL="SELECT s.signal_id,s.list_code,s.source_url,s.fixture,s.market,s.probability_pct,s.source_first_seen_utc,s.source_last_seen_utc,s.source_published_utc,s.kickoff_utc,s.event_id,s.match_confidence,s.quote_captured_utc,s.odds_at_signal,s.signal_utc,s.status,q.captured_utc AS current_quote_utc, CASE s.market WHEN '1' THEN q.p1 WHEN 'X' THEN q.px WHEN '2' THEN q.p2 ELSE NULL END AS current_odds,r.event_status,r.verified,r.home_score final_home,r.away_score final_away FROM sb_regista_signals_v1 s LEFT JOIN match_results r ON r.event_id=s.event_id LEFT JOIN quote_snapshots q ON q.id=(SELECT q2.id FROM quote_snapshots q2 WHERE q2.event_id=s.event_id AND q2.captured_utc<s.kickoff_utc ORDER BY q2.captured_utc DESC LIMIT 1) ORDER BY s.source_last_seen_utc DESC LIMIT 500";
function finish(row){
if(row?.event_status!=='FINISHED'||Number(row.verified)!==1||!Number.isInteger(Number(row.final_home))||!Number.isInteger(Number(row.final_away))||row.final_home==null||row.final_away==null)return null;
const h=Number(row.final_home),a=Number(row.final_away),m=String(row.market||'').toUpperCase().replace(/\s+/g,'');
const win=m==='1'?h>a:m==='X'?h===a:m==='2'?a>h:m==='BTTS'?h>0&&a>0:m==='NO_BTTS'?h===0||a===0:m==='OVER25'||m==='OVER2.5'?h+a>=3:m==='UNDER25'||m==='UNDER2.5'?h+a<=2:null;
return win===null?null:win?'WIN':'LOSS';
}
function priceMetric(row){
 const odds=Number(row.odds_at_signal),prob=Number(row.probability_pct)/100;
 const supported=['1','2'].includes(String(row.market||'').toUpperCase());
 if(!supported||!Number.isFinite(odds)||odds<=1||!Number.isFinite(prob)||prob<=0||prob>1)
  return {break_even_pct:null,edge_pp:null,ev_pct:null,value_candidate:false,price_status:supported?'NO_PRICE':'UNSUPPORTED_MARKET'};
 const breakEven=1/odds,edgePP=100*(prob-breakEven),evPct=100*(prob*odds-1);
 return {break_even_pct:Math.round(breakEven*10000)/100,edge_pp:Math.round(edgePP*100)/100,
  ev_pct:Math.round(evPct*100)/100,value_candidate:edgePP>=5-1e-8&&evPct>=8-1e-8,
  price_status:edgePP>=5-1e-8&&evPct>=8-1e-8?'VALUE_CANDIDATE':'NO_VALUE'};
}
function wasEmitted(row){
 const k=Date.parse(row.kickoff_utc),emitted=Date.parse(row.signal_utc),first=Date.parse(row.source_first_seen_utc),quoted=Date.parse(row.quote_captured_utc);
 return !!row.signal_utc&&Number(row.event_id)>0&&Number.isFinite(k)&&Number.isFinite(emitted)&&Number.isFinite(first)&&Number.isFinite(quoted)&&
  emitted>=first&&first<=k-300000&&quoted<=emitted&&emitted-quoted<=20*60000&&emitted>=k-45*60000&&emitted<k-300000&&
  priceMetric(row).value_candidate;
}
function currentPriceMetric(row){
 return priceMetric({...row,odds_at_signal:row.current_odds});
}
function ready(row,now){
 if(!wasEmitted(row))return false;
 const id=Number(row.event_id),k=Date.parse(row.kickoff_utc),cap=Date.parse(row.current_quote_utc),last=Date.parse(row.source_last_seen_utc);
 return currentPriceMetric(row).value_candidate&&Number.isSafeInteger(id)&&id>0&&Number(row.match_confidence)>=.98&&
  ['1','2'].includes(row.market)&&Number(row.current_odds)>1&&
  Number.isFinite(k)&&Number.isFinite(cap)&&Number.isFinite(last)&&cap<=now&&now-cap<=20*60000&&
  last<=now&&now-last<=60*60000&&k-now>5*60000&&k-now<=45*60000;
}
function visibleStatus(row,now){
 if(!wasEmitted(row))return row.status;
 if(ready(row,now))return 'BET_NOW';
 if(now>=Date.parse(row.kickoff_utc)-5*60000)return 'EXPIRED';
 if(!Number.isFinite(Date.parse(row.current_quote_utc))||now-Date.parse(row.current_quote_utc)>20*60000)return 'QUOTE_STALE';
 if(!currentPriceMetric(row).value_candidate)return 'PRICE_CHANGED';
 return 'INACTIVE';
}
export async function registaMobileApi(req,env,who,path,slipDeviceFor){
try{
if(path==='/api/mobile/regista/ack'&&req.method==='POST'){
 const input=await req.json().catch(()=>({})),id=String(input.signal_id||'').slice(0,128);
 if(!/^[A-Za-z0-9_:.-]{8,128}$/.test(id))return response({error:'Invalid signal ID'},400);
 const check=await env.DB.prepare("SELECT 1 n FROM sb_regista_signals_v1 WHERE signal_id=? AND status='BET_NOW' AND event_id>0 LIMIT 1").bind(id).first();
 if(!check)return response({error:'Unverified signal'},409);
 await env.DB.prepare("INSERT OR IGNORE INTO sb_regista_local_receipts_v1(device_id,signal_id,notified_utc) VALUES(?,?,?)").bind(String(who.device_id),id,NOW()).run();
 return response({ok:true});
}
if(!['/api/mobile/regista/summary','/api/mobile/regista/alerts'].includes(path)||req.method!=='GET')return response({error:'not_found'},404);
const [records,sync]=await Promise.all([
 env.DB.prepare(PICK_SQL).all(),
 env.DB.prepare('SELECT started_utc,source_status,stored_rows,error FROM sb_regista_sync_runs_v1 ORDER BY id DESC LIMIT 1').first()
]);
const now=Date.now();
const rows=(records.results||[]).map(s=>({...s,...priceMetric(s),current_price:currentPriceMetric(s),signal_emitted:wasEmitted(s),result_status:finish(s),status:visibleStatus(s,now)})); // A previously sent alert remains in history even if its live quote ages.
if(path.endsWith('/alerts')){
 // One vibration per match, not one per Full/League/Top10 membership.
 const precedence={FULL:0,LEAGUE:1,TOP10:2};
 const selected=[],seenEvents=new Set();
 for(const s of rows.filter(r=>r.status==='BET_NOW').sort((a,b)=>(precedence[a.list_code]??9)-(precedence[b.list_code]??9))){
  if(seenEvents.has(s.event_id))continue;seenEvents.add(s.event_id);
  selected.push({signal_id:s.signal_id,event_id:s.event_id,fixture:s.fixture,list_code:s.list_code,market:s.market,probability_pct:s.probability_pct,odds:s.odds_at_signal,kickoff_utc:s.kickoff_utc,stage:'BET_NOW',source:'REGISTA'});
 }
 return response({mode:'LOCAL_VIBRATE_NO_FCM',alerts:selected.slice(0,30)});
}

function performance(rows,now,filter=()=>true){
 // Deduplicate the same prediction if Regista lists it in multiple tabs.
 const map=new Map();
 for(const x of rows.filter(r=>r.signal_emitted&&Number(r.event_id)>0&&filter(r))){
  const key=String(x.event_id)+':'+String(x.market),prior=map.get(key);
  if(!prior||Date.parse(x.signal_utc)<Date.parse(prior.signal_utc))map.set(key,x);
 }
 const picks=[...map.values()],last24h=picks.filter(x=>Date.parse(x.signal_utc)>=now-86400000).length,
       last7d=picks.filter(x=>Date.parse(x.signal_utc)>=now-7*86400000).length;
 const graded=picks.filter(x=>['WIN','LOSS'].includes(x.result_status)&&Number(x.odds_at_signal)>1);
 const wins=graded.filter(x=>x.result_status==='WIN').length,losses=graded.length-wins;
 const net=graded.reduce((acc,x)=>acc+(x.result_status==='WIN'?50*(Number(x.odds_at_signal)-1):-50),0);
 return {betnow:picks.filter(x=>x.status==='BET_NOW').length,emitted_24h:last24h,emitted_7d:last7d,signals_24h:last24h,signals_7d:last7d,signals_total:picks.length,wins,losses,
   pending:picks.length-graded.length,settled:graded.length,stake_unit_lei:50,net_sim_lei:graded.length?Math.round(net*100)/100:null,
   roi_sim_pct:graded.length?Math.round((net/(50*graded.length))*10000)/100:null,
   roi_verified:false, note:'Simulare prospectivă cu miză fixă 50 lei pe selecție distinctă; nu este ROI real la Superbet.'};
}

let actual={tickets_total:0,open:0,settled:0,wins:0,losses:0,stake_lei:0,net_lei:null,roi_pct:null,source:'SLIP_REGISTA_VERIFIED'};
try{
 const slipDevice=typeof slipDeviceFor==='function'?await slipDeviceFor(env,who.device_id):who.device_id;
 const records=await env.DB.prepare("SELECT status,stake_lei,returned_lei FROM ghost_equal_bets WHERE device_id=? AND notes LIKE 'REGISTA_VALUE_V1:%' ORDER BY id DESC LIMIT 300").bind(slipDevice).all();
 const all=records.results||[],finished=all.filter(x=>['WON','LOST','VOID','CASHOUT'].includes(String(x.status||'')));
 const stake=finished.reduce((n,x)=>n+Number(x.stake_lei||0),0);
 const net=finished.reduce((n,x)=>n+Number(x.returned_lei||0)-Number(x.stake_lei||0),0);
 actual={tickets_total:all.length,open:all.filter(x=>x.status==='OPEN').length,settled:finished.length,
  wins:finished.filter(x=>x.status==='WON').length,losses:finished.filter(x=>x.status==='LOST').length,
  stake_lei:Math.round(stake*100)/100,net_lei:finished.length?Math.round(net*100)/100:null,
  roi_pct:stake>0?Math.round((net/stake)*10000)/100:null,source:'SLIP_REGISTA_VERIFIED'};
}catch(e){console.warn('REGISTA_REAL_ROI_READ',String(e).slice(0,120));}
const counts={FULL:{},LEAGUE:{},TOP10:{}};
for(const typ of Object.keys(counts)){
 const r=rows.filter(s=>s.list_code===typ),readyNow=r.filter(s=>s.status==='BET_NOW');
 counts[typ]={
  total:r.length,betnow:readyNow.length,
  last24h:r.filter(s=>s.signal_emitted&&Date.parse(s.signal_utc)>=now-86400000).length,
  last7d:r.filter(s=>s.signal_emitted&&Date.parse(s.signal_utc)>=now-7*86400000).length,
  wins:r.filter(s=>s.signal_emitted&&s.result_status==='WIN').length,
  losses:r.filter(s=>s.signal_emitted&&s.result_status==='LOSS').length,
  pending:r.filter(s=>s.signal_emitted&&!s.result_status).length,
  roi:null, // Do not substitute the retrospective history with ROI real.
  prospective:performance(rows,now,s=>s.list_code===typ)
 };
}
return response({mode:'LOCAL_VIBRATE_NO_FCM',source:'REGISTA',items:rows,sync:sync||null,counts,performance:{...performance(rows,now),real:actual},server_utc:NOW()});
}catch(e){console.error('REGISTA_READ_FAIL',String(e).slice(0,170));return response({error:'REGISTA_LAB_UNAVAILABLE',items:[],counts:{},sync:null},503);}
}