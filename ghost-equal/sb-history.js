
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
