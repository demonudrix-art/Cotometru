/* REGISTA LAB V2 — owner-safe read API. Never creates bets or FCM. */
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const NOW=()=>new Date().toISOString();
const PICK_SQL="SELECT s.signal_id,s.list_code,s.source_url,s.fixture,s.market,s.probability_pct,s.source_first_seen_utc,s.source_last_seen_utc,s.source_published_utc,s.kickoff_utc,s.event_id,s.match_confidence,s.quote_captured_utc,s.odds_at_signal,s.signal_utc,s.status,r.event_status,r.verified,r.home_score final_home,r.away_score final_away FROM sb_regista_signals_v1 s LEFT JOIN match_results r ON r.event_id=s.event_id ORDER BY s.source_last_seen_utc DESC LIMIT 500";
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
function ready(row,now){
if(row.status!=='BET_NOW')return false;
const id=Number(row.event_id),k=Date.parse(row.kickoff_utc),cap=Date.parse(row.quote_captured_utc),seen=Date.parse(row.source_first_seen_utc),last=Date.parse(row.source_last_seen_utc);
return priceMetric(row).value_candidate&&Number.isSafeInteger(id)&&id>0&&Number(row.match_confidence)>=.98&&['1','2'].includes(row.market)&&Number(row.odds_at_signal)>1&&Number.isFinite(k)&&Number.isFinite(cap)&&Number.isFinite(seen)&&Number.isFinite(last)&&seen<=k-300000&&cap<=now&&now-cap<=20*60000&&last<=now&&now-last<=60*60000&&k-now>0&&k-now<=45*60000;
}
export async function registaMobileApi(req,env,who,path){
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
const rows=(records.results||[]).map(s=>({...s,...priceMetric(s),result_status:finish(s),status:ready(s,now)?'BET_NOW':s.status==='BET_NOW'?(Date.parse(s.kickoff_utc)>now?'MATCHED':'EXPIRED'):s.status})); // Gate active signals by expected value; no false alerts.
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
const counts={FULL:{},LEAGUE:{},TOP10:{}};
for(const typ of Object.keys(counts)){
 const r=rows.filter(s=>s.list_code===typ),readyNow=r.filter(s=>s.status==='BET_NOW');
 counts[typ]={
  total:r.length,betnow:readyNow.length,
  last24h:r.filter(s=>Date.parse(s.kickoff_utc)>=now-86400000&&Date.parse(s.kickoff_utc)<=now).length,
  last7d:r.filter(s=>Date.parse(s.kickoff_utc)>=now-7*86400000&&Date.parse(s.kickoff_utc)<=now).length,
  wins:r.filter(s=>s.result_status==='WIN').length,
  losses:r.filter(s=>s.result_status==='LOSS').length,
  pending:r.filter(s=>!s.result_status).length,
  roi:null // Observed prospective ROI not proven; retrospective source imports cannot validate profit.
 };
}
return response({mode:'LOCAL_VIBRATE_NO_FCM',source:'REGISTA',items:rows,sync:sync||null,counts,server_utc:NOW()});
}catch(e){console.error('REGISTA_READ_FAIL',String(e).slice(0,170));return response({error:'REGISTA_LAB_UNAVAILABLE',items:[],counts:{},sync:null},503);}
}