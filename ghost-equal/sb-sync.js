
/** SB Radar active-bet fast sync and idempotent win notification queue. */
const BASE='https://production-superbet-offer-ro.freetls.fastly.net/v3/ro-RO/events';
const nowISO=()=>new Date().toISOString();
const num=x=>x===null||x===undefined||x===''?null:Number.isFinite(Number(x))?Number(x):null;
export async function syncActiveBets(env){
 const at=nowISO(),now=Date.now();
 const active=(await env.DB.prepare(
  "SELECT DISTINCT b.event_id,q.fixture,q.kickoff_utc FROM ghost_equal_bets b "+
  "JOIN quote_state q ON q.event_id=b.event_id "+
  "WHERE b.status='OPEN' AND b.selection='X' AND b.event_id IS NOT NULL "+
  "AND q.kickoff_utc BETWEEN ? AND ? ORDER BY q.kickoff_utc DESC LIMIT 40"
 ).bind(new Date(now-8*3600000).toISOString(),new Date(now+15*60000).toISOString()).all()).results||[];
 if(!active.length)return {checked:0,extended_samples:0,verified_finals:0};
 let samples=0,finals=0,errors=[];
 for(let start=0;start<active.length;start+=12){
  const chunk=active.slice(start,start+12),url=new URL(BASE);
  url.searchParams.set('events',chunk.map(x=>Number(x.event_id)).sort((a,b)=>a-b).join(','));
  url.searchParams.set('includeOnly','fixture,inPlayStats,inPlayStatsMetadata,markets,results');
  url.searchParams.set('markets','547');
  let body;
  try{
   const response=await fetch(url.toString(),{headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error('HTTP '+response.status);
   body=await response.json();
  }catch(e){errors.push(String(e).slice(0,70));continue}
  for(const ev of body.events||[]){
   const id=Number(ev.event_id),row=chunk.find(x=>Number(x.event_id)===id);
   if(!row)continue;
   const st=ev.inplay_stats||{},meta=ev.inplay_stats_metadata||{};
   const min=num(st.minutes),h=num(st.home_team_score),a=num(st.away_team_score);
   if(min!==null&&min>=78&&min<=180&&h!==null&&a!==null&&String(meta.status||'').toUpperCase()!=='FINISHED'){
    // Track matches beyond the separate 78' analytical alert cutoff.
    // Never invent minute advances; overwrite a same-minute row only when score changed.
    const res=await env.DB.prepare(
     "INSERT INTO ghost_equal_samples(event_id,captured_utc,minute,home_score,away_score,fixture) VALUES(?,?,?,?,?,?) "+
     "ON CONFLICT(event_id,minute) DO UPDATE SET captured_utc=excluded.captured_utc,home_score=excluded.home_score,away_score=excluded.away_score "+
     "WHERE ghost_equal_samples.home_score IS NOT excluded.home_score OR ghost_equal_samples.away_score IS NOT excluded.away_score"
    ).bind(id,at,min,h,a,row.fixture).run();
    samples+=Number(res.meta?.changes||0);
   }
   if(String(meta.status||'').toUpperCase()!=='FINISHED')continue;
   // Final result is accepted only after market-547 verifies exactly one winner.
   const market=(ev.results||[]).find(x=>Number(x.id)===547);
   const odds=market?.odds||[],names=new Set(odds.map(o=>o.metadata?.name)),w=odds.filter(o=>Number(o.status)===3).map(o=>o.metadata?.name);
   const verified=odds.length===3&&names.size===3&&['1','X','2'].every(x=>names.has(x))&&
     odds.every(o=>Number(o.status)===3||Number(o.status)===4)&&w.length===1&&['1','X','2'].includes(w[0]);
   if(!verified)continue;
   await env.DB.prepare(
    "INSERT INTO match_results(event_id,fixture,kickoff_utc,checked_utc,event_status,home_score,away_score,winner_1x2,result_market_json,result_source,verified) "+
    "VALUES(?,?,?,?,'FINISHED',?,?,?,?,?,1) "+
    "ON CONFLICT(event_id) DO UPDATE SET checked_utc=excluded.checked_utc,event_status='FINISHED',"+
    "home_score=excluded.home_score,away_score=excluded.away_score,winner_1x2=excluded.winner_1x2,"+
    "result_market_json=excluded.result_market_json,result_source=excluded.result_source,verified=1"
   ).bind(id,row.fixture,row.kickoff_utc,at,h,a,w[0],JSON.stringify(market),'Verified market 547 • active slip sync').run();
   await env.DB.prepare('UPDATE quote_state SET settled=1,last_result_check_utc=? WHERE event_id=?').bind(at,id).run();
   finals++;
  }
 }
 return {checked:active.length,extended_samples:samples,verified_finals:finals,errors};
}
