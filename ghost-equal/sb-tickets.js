
/** Radar only projects OPEN bets while their match is not verified final. Score status uses fresh observed samples; never treats a temporary deficit as settled loss. */
export async function ticketOverlay(env,bets){
 const now=Date.now(),include=(b)=>b.status==='OPEN';
 const wanted=(bets||[]).filter(include).slice(0,80);
 const ids=[...new Set(wanted.map(b=>Number(b.event_id)).filter(x=>Number.isSafeInteger(x)&&x>0))].slice(0,65);
 let rows=[];
 if(ids.length){
  const marks=ids.map(()=>'?').join(',');
  const sql="SELECT q.event_id,q.fixture,q.kickoff_utc,q.last_status,q.settled AS fixture_settled,q.captured_utc AS quote_utc,"+
   "s.minute,s.home_score,s.away_score,s.captured_utc AS sample_utc,"+
   "m.event_status,m.verified AS result_verified,m.winner_1x2,m.result_market_json,m.home_score AS final_home,m.away_score AS final_away "+
   "FROM quote_state q "+
   "LEFT JOIN ghost_equal_samples s ON s.event_id=q.event_id AND s.minute=(SELECT MAX(z.minute) FROM ghost_equal_samples z WHERE z.event_id=q.event_id) "+
   "LEFT JOIN match_results m ON m.event_id=q.event_id WHERE q.event_id IN ("+marks+")";
  rows=(await env.DB.prepare(sql).bind(...ids).all()).results||[];
 }
 const map=new Map(rows.map(r=>[Number(r.event_id),r]));
 const cards=wanted.map(b=>{
  const r=map.get(Number(b.event_id));
  const sampleMinute=r?.minute==null?null:Number(r.minute),sampleUtc=r?.sample_utc||null;
  const stale=sampleUtc===null||!Number.isFinite(Date.parse(sampleUtc))||now-Date.parse(sampleUtc)>210000;
  const completed=Number(r?.result_verified)===1&&['1','X','2'].includes(String(r?.winner_1x2||''))&&r?.result_market_json!=null;
  // Live state never equals the final betting outcome. No red on stale/unknown data.
  // Only X tickets receive "draw / not draw" status.
  const liveTicketState=completed?'FINISHED':b.selection!=='X'?'OTHER_MARKET':stale?'UNKNOWN':
   r?.home_score==null||r?.away_score==null?'UNKNOWN':
   Number(r.home_score)===Number(r.away_score)?'DRAW_LIVE':'NOT_DRAW_LIVE';
  const obsScore=r?.home_score==null||r?.away_score==null?null:String(r.home_score)+'–'+r.away_score;
  const finalScore=completed&&r.final_home!=null&&r.final_away!=null?String(r.final_home)+'–'+r.final_away:null;
  // Match-minute progress, NOT the probability of winning. Never extrapolate an unobserved minute.
  const progress=completed?100:sampleMinute===null?null:Math.max(0,Math.min(100,Math.round(sampleMinute/90*100)));
  return {
    bet_id:b.id,event_id:b.event_id==null?null:Number(b.event_id),fixture:b.fixture,selection:b.selection,
    stake_lei:Number(b.stake_lei),odds:Number(b.odds),status:b.status,
    potential_return_lei:b.potential_return_lei==null?null:Number(b.potential_return_lei),
    boost_lei:Number(b.boost_lei||0),returned_lei:b.returned_lei==null?null:Number(b.returned_lei),
    placed_utc:b.placed_utc,settled_utc:b.settled_utc,
    minute:stale?null:sampleMinute,last_observed_minute:sampleMinute,
    match_progress_pct:progress,score:stale?null:obsScore,last_observed_score:obsScore,
    sample_utc:sampleUtc,feed_fresh:!stale,
    finished_verified:completed,final_score:finalScore,
    kickoff_utc:r?.kickoff_utc||null,live_status:r?.last_status||null,
    live_ticket_state:liveTicketState,
    feed_status:completed?'FINISHED':!r?'NOT_IN_FEED':stale?'STALE':'LIVE'
  };
 }).filter(t=>!t.finished_verified);
 // A confirmed final result removes the OPEN ticket from radar at once,
 // even if the finance settlement pass has not yet run. SLIP/ROI persists.
 return {tickets:cards,hiddenFinishedEventIds:[...new Set(wanted.filter(b=>map.get(Number(b.event_id)) && Number(map.get(Number(b.event_id)).result_verified)===1 && ['1','X','2'].includes(String(map.get(Number(b.event_id)).winner_1x2||''))&&map.get(Number(b.event_id)).result_market_json!=null).map(b=>Number(b.event_id)))],counts:{
  open:cards.filter(x=>x.status==='OPEN').length,
  recent_finished:cards.filter(x=>x.status!=='OPEN').length,
  open_stake:Math.round(cards.filter(x=>x.status==='OPEN').reduce((a,x)=>a+x.stake_lei,0)*100)/100
 }};
}
