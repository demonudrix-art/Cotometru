/* SB Radar Profit Engine — immutable prospective shadow validation.
 * Hourly on existing worker; no real bets, alerts, or live-filter changes.
 */
const MARKET="((1.0/d.px)/(1.0/d.p1+1.0/d.px+1.0/d.p2))";
const M_IDS=new Set(["ML_SCORE060_V1","ML_SCORE060_EDGE015_V1"]);
const G_ID="GOLD_PRICE185_215_V1";
const ML_SQL="INSERT OR IGNORE INTO sb_radar_profit_engine_observations_v1"+
 " (candidate_id,event_id,signal_utc,first_seen_utc,model_version,odds_x,model_p,market_p,selected)"+
 " SELECT ?,d.event_id,d.evaluated_utc,?,d.model_version,d.px,d.ml_score,"+MARKET+","+
 " CASE WHEN d.ml_score>=0.60 AND (?='ML_SCORE060_V1' OR d.ml_score-"+MARKET+">=0.15) THEN 1 ELSE 0 END"+
 " FROM sb_radar_ml_decisions d WHERE d.model_version='SB_RADAR_ML_LOGREG_V1' AND d.accepted=1"+
 " AND d.p1>1 AND d.px>1 AND d.p2>1 AND d.ml_score BETWEEN 0.001 AND 0.999"+
 " AND d.evaluated_utc>=? AND d.evaluated_utc<=? ORDER BY d.evaluated_utc DESC LIMIT 500";
const GOLD_SQL="INSERT OR IGNORE INTO sb_radar_profit_engine_observations_v1"+
 " (candidate_id,event_id,signal_utc,first_seen_utc,model_version,odds_x,model_p,market_p,selected)"+
 " SELECT ?,a.event_id,a.triggered_utc,?,a.model_version,a.px,NULL,"+
 " CASE WHEN a.p1>1 AND a.px>1 AND a.p2>1 THEN (1.0/a.px)/(1.0/a.p1+1.0/a.px+1.0/a.p2) ELSE NULL END,"+
 " CASE WHEN a.px BETWEEN 1.85 AND 2.15 THEN 1 ELSE 0 END"+
 " FROM ghost_equal_alerts a WHERE a.stage='BET_NOW' AND a.model_version='SB_GOLDEN_CLASSIC_00_M57_1PP_V1'"+
 " AND a.px>1 AND a.triggered_utc>=? AND a.triggered_utc<=? ORDER BY a.triggered_utc DESC LIMIT 500";
const SETTLE_SQL="UPDATE sb_radar_profit_engine_observations_v1 AS o"+
 " SET outcome=CASE WHEN r.winner_1x2='X' THEN 'WON' ELSE 'LOST' END,"+
 " unit_profit=CASE WHEN r.winner_1x2='X' THEN o.odds_x-1.0 ELSE -1.0 END,settled_seen_utc=?"+
 " FROM match_results r WHERE o.event_id=r.event_id AND o.outcome='PENDING'"+
 " AND r.verified=1 AND r.event_status IN ('FINISHED','MARKET_SETTLED') AND r.winner_1x2 IN ('1','X','2')";
export async function sbProfitShadowTick(env){
 const now=new Date().toISOString(),hour=now.slice(0,13)+":00:00Z";
 if(await env.DB.prepare("SELECT 1 FROM sb_radar_profit_engine_runs_v1 WHERE hour_utc=?").bind(hour).first())return;
 const claim=await env.DB.prepare("INSERT OR IGNORE INTO sb_radar_profit_engine_runs_v1(hour_utc,started_utc,status) VALUES(?,?,'running')").bind(hour,now).run();
 if(Number(claim.meta?.changes||0)!==1)return;
 try{
  const configs=(await env.DB.prepare("SELECT candidate_id,frozen_at_utc FROM sb_radar_profit_engine_candidates_v1 WHERE status='SHADOW' ORDER BY candidate_id").all()).results||[];
  if(configs.length!==3||configs.some(c=>!M_IDS.has(c.candidate_id)&&c.candidate_id!==G_ID))throw Error("Unexpected shadow candidate config");
  let captured=0;
  for(const c of configs){
   const ml=M_IDS.has(c.candidate_id);
   const params=ml?[c.candidate_id,now,c.candidate_id,c.frozen_at_utc,now]:[c.candidate_id,now,c.frozen_at_utc,now];
   const r=await env.DB.prepare(ml?ML_SQL:GOLD_SQL).bind(...params).run();
   captured+=Number(r.meta?.changes||0);
  }
  const sr=await env.DB.prepare(SETTLE_SQL).bind(now).run();
  const summary=(await env.DB.prepare("SELECT candidate_id,COUNT(*) observed,SUM(selected) signals,"+
   "SUM(selected=1 AND outcome='WON') wins,SUM(selected=1 AND outcome='LOST') losses,"+
   "SUM(selected=1 AND outcome='PENDING') pending,"+
   "ROUND(SUM(CASE WHEN selected=1 AND outcome!='PENDING' THEN unit_profit ELSE 0 END),3) profit_1u,"+
   "COUNT(DISTINCT CASE WHEN selected=1 AND outcome!='PENDING' THEN substr(signal_utc,1,10) END) days"+
   " FROM sb_radar_profit_engine_observations_v1 GROUP BY candidate_id").all()).results||[];
  await env.DB.prepare("UPDATE sb_radar_profit_engine_runs_v1 SET status='ok',finished_utc=?,new_observations=?,settled_observations=?,summary_json=? WHERE hour_utc=?")
   .bind(now,captured,Number(sr.meta?.changes||0),JSON.stringify(summary),hour).run();
 }catch(e){
  const message=String(e?.message||e).slice(0,330);
  await env.DB.prepare("UPDATE sb_radar_profit_engine_runs_v1 SET status='failed',finished_utc=?,last_error=? WHERE hour_utc=?")
   .bind(now,message,hour).run();
  throw e;
 }
}
