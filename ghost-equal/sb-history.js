
export async function searchHistoricMatches(env,query){
 const q=String(query||'').trim().replace(/\s+/g,' ').slice(0,80);
 if(q.length<2)return {matches:[]};
 const sql="SELECT q.event_id,q.fixture,q.kickoff_utc,q.settled,q.px AS quoted_x,"+
  "s.minute,s.home_score,s.away_score,s.px AS observed_x,s.captured_utc,"+
  "r.event_status,r.verified,"+
  "(SELECT a.minute FROM ghost_equal_alerts a WHERE a.event_id=q.event_id AND a.stage='BET_NOW' LIMIT 1) AS signalled_at "+
  "FROM quote_state q "+
  "LEFT JOIN ghost_equal_samples s ON s.event_id=q.event_id AND s.minute=(SELECT MAX(z.minute) FROM ghost_equal_samples z WHERE z.event_id=q.event_id) "+
  "LEFT JOIN match_results r ON r.event_id=q.event_id "+
  "WHERE LOWER(q.fixture) LIKE ? ORDER BY q.kickoff_utc DESC LIMIT 35";
 const rows=(await env.DB.prepare(sql).bind('%'+q.toLowerCase()+'%').all()).results||[];
 return {matches:rows.map(x=>({
  event_id:x.event_id,fixture:x.fixture,kickoff_utc:x.kickoff_utc,
  minute:null,last_observed_minute:x.minute===null?null:Number(x.minute),
  score:x.home_score===null||x.away_score===null?null:x.home_score+'–'+x.away_score,
  px:x.observed_x??x.quoted_x,stage:x.signalled_at===null?'WAIT_FEED':'BET_NOW',
  bucket:'ARCHIVED',reason:x.signalled_at===null?'Meci din istoric • poți înregistra un pariu plasat':'BET NOW detectat la min. '+x.signalled_at,
  url:null,fresh:false,steps:[],updated_utc:x.captured_utc,finished:Number(x.settled)===1||Number(x.verified)===1
 }))};
}
export async function auditSlip(env,deviceId,id){
 const bet=await env.DB.prepare("SELECT id,event_id,fixture,selection,odds,stake_lei,placed_utc,status,returned_lei,boost_lei,potential_return_lei,notes FROM ghost_equal_bets WHERE id=? AND device_id=?").bind(id,deviceId).first();
 if(!bet)return null;
 if(!bet.event_id)return {bet,samples:[],signal:null,result:null,criteria:null,message:'Biletul nu are identificatorul meciului; nu se poate lega de istoricul GHOST.'};
 const samples=(await env.DB.prepare("SELECT minute,home_score,away_score,gh,ga,p1,px,p2,captured_utc FROM ghost_equal_samples WHERE event_id=? ORDER BY minute ASC LIMIT 110").bind(bet.event_id).all()).results||[];
 const alerts=(await env.DB.prepare("SELECT stage,triggered_utc,minute,home_score,away_score,gh,ga,dgh10,dga10,p1,px,p2 FROM ghost_equal_alerts WHERE event_id=? ORDER BY minute ASC").bind(bet.event_id).all()).results||[];
 const result=await env.DB.prepare("SELECT event_status,verified,home_score,away_score,winner_1x2 FROM match_results WHERE event_id=?").bind(bet.event_id).first();
 const signal=alerts.find(x=>x.stage==='BET_NOW')||null;
 const criteria=signal?{
  equal_at_alert:Number(signal.home_score)===Number(signal.away_score),
  drop_home:Number(signal.dgh10)<=-0.009999,
  drop_away:Number(signal.dga10)<=-0.009999,
  odd_1:Number(signal.p1)>=1.8,
  odd_x:Number(signal.px)>=1.75,
  odd_2:Number(signal.p2)>=1.8,
  minute_57:Number(signal.minute)>=57
 }:null;
 const delta=signal&&Number.isFinite(Date.parse(bet.placed_utc))?Math.round((Date.parse(bet.placed_utc)-Date.parse(signal.triggered_utc))/60000):null;
 return {bet,samples,signal,alerts,criteria,result,minutes_from_signal_to_bet:delta,history_min:samples[0]?.minute??null,history_max:samples[samples.length-1]?.minute??null};
}

/**
 * Immutable event-timestamped GHOST inspection. Never substitute a stale
 * quote_state price or final-minute score for the BET_NOW snapshot.
 * Return null for unobservable conditions, rather than a false "failed".
 */
export async function auditMatch(env,deviceId,eventId,preferredBetId=null){
 const meta=await env.DB.prepare("SELECT event_id,fixture,kickoff_utc FROM quote_state WHERE event_id=? LIMIT 1").bind(eventId).first();
 if(!meta)return null;
 const bets=(await env.DB.prepare("SELECT id,event_id,fixture,selection,stake_lei,odds,placed_utc,status,returned_lei,settled_utc,boost_lei,potential_return_lei FROM ghost_equal_bets WHERE event_id=? AND device_id=? ORDER BY placed_utc ASC,id ASC LIMIT 25").bind(eventId,deviceId).all()).results||[];
 const bet=bets.find(b=>Number(b.id)===Number(preferredBetId))||bets[0]||null;
 const alerts=(await env.DB.prepare("SELECT event_id,stage,triggered_utc,minute,fixture,home_score,away_score,gh,ga,dgh10,dga10,p1,px,p2,source FROM ghost_equal_alerts WHERE event_id=? ORDER BY triggered_utc ASC,minute ASC LIMIT 12").bind(eventId).all()).results||[];
 const signal=alerts.find(a=>a.stage==='BET_NOW')||null;
 const samples=(await env.DB.prepare("SELECT minute,home_score,away_score,gh,ga,p1,px,p2,captured_utc FROM ghost_equal_samples WHERE event_id=? ORDER BY minute ASC LIMIT 120").bind(eventId).all()).results||[];
 const result=await env.DB.prepare("SELECT event_status,verified,home_score,away_score,winner_1x2 FROM match_results WHERE event_id=? LIMIT 1").bind(eventId).first();
 const alertMinute=signal?.minute==null?null:Number(signal.minute);
 let prior=null;
 if(signal && alertMinute!==null){
  const at=Date.parse(signal.triggered_utc);
  prior=samples.filter(x=>Number(x.minute)>=alertMinute-15&&Number(x.minute)<=alertMinute-7)
   .filter(x=>Number.isFinite(at)&&Number.isFinite(Date.parse(x.captured_utc))&&at>=Date.parse(x.captured_utc)&&at-Date.parse(x.captured_utc)<=20*60*1000)
   .sort((a,b)=>Math.abs(Number(a.minute)-(alertMinute-10))-Math.abs(Number(b.minute)-(alertMinute-10))||Date.parse(b.captured_utc)-Date.parse(a.captured_utc))[0]||null;
 }
 const sufficient=v=>v!==null&&v!==undefined&&Number.isFinite(Number(v));
 const check={
  scored_equal: signal&&sufficient(signal.home_score)&&sufficient(signal.away_score)?Number(signal.home_score)===Number(signal.away_score):null,
  prior_same_score:signal&&prior&&sufficient(prior.home_score)&&sufficient(prior.away_score)&&sufficient(signal.home_score)&&sufficient(signal.away_score)?
   Number(prior.home_score)===Number(signal.home_score)&&Number(prior.away_score)===Number(signal.away_score):null,
  curve_home:signal&&sufficient(signal.dgh10)?Number(signal.dgh10)<=-0.009999:null,
  curve_away:signal&&sufficient(signal.dga10)?Number(signal.dga10)<=-0.009999:null,
  price_home:signal&&sufficient(signal.p1)?Number(signal.p1)>=1.8:null,
  price_draw:signal&&sufficient(signal.px)?Number(signal.px)>=1.75:null,
  price_away:signal&&sufficient(signal.p2)?Number(signal.p2)>=1.8:null,
  minute_57:signal&&alertMinute!==null?alertMinute>=57:null
 };
 const checks=Object.entries(check).map(([key,passed])=>({key,passed}));
 const verified=!!signal&&checks.every(x=>x.passed===true);
 return {
  event_id:eventId,fixture:meta.fixture,kickoff_utc:meta.kickoff_utc,
  signal,prior,checks,criteria:check,verified_snapshot:verified,alerts,
  samples,result,bets,bet,signal_exists:!!signal,
  // This is a historical audit, never real-time eligibility.
  historical:true,source:signal?.source??null,
  data_bounds:{first_minute:samples[0]?.minute??null,last_minute:samples[samples.length-1]?.minute??null}
 };
}
