/* SB Radar • hourly ML Win/Loss map v2, isolated from scanner/FCM.
   Replay excludes Golden Classic by first qualified event; real alerts separate.
   Baseline 6–13 November preserved in sb_radar_winloss_map_baseline_v1. */
const iso=()=>new Date().toISOString();
const ago=(date,ms)=>new Date(Date.parse(date)-ms).toISOString();
const db=(env,sql,...params)=>env.DB.prepare(sql).bind(...params);
const CANDIDATES=String.raw`WITH prior AS (
 SELECT s.event_id,s.captured_utc ts,s.minute,s.fixture,s.p1,s.px,s.p2,s.gh,s.ga,
 pr.gh old_gh,pr.ga old_ga,
 ROW_NUMBER() OVER(PARTITION BY s.event_id,s.minute ORDER BY ABS(pr.minute-(s.minute-10)),pr.captured_utc DESC) prior_rank
 FROM ghost_equal_samples s INDEXED BY idx_ghost_samples_scan_recent
 JOIN ghost_equal_samples pr ON pr.event_id=s.event_id
 AND pr.minute BETWEEN s.minute-15 AND s.minute-7 AND pr.captured_utc<=s.captured_utc
 AND (julianday(s.captured_utc)-julianday(pr.captured_utc))*1440<=20.02
 AND pr.home_score=0 AND pr.away_score=0 AND pr.gh BETWEEN 0 AND 1 AND pr.ga BETWEEN 0 AND 1
 WHERE s.captured_utc>=? AND s.captured_utc<=?
 AND s.minute BETWEEN 57 AND 59 AND s.home_score=0 AND s.away_score=0
 AND s.p1>1 AND s.px>1 AND s.p2>1 AND s.gh BETWEEN 0 AND 1 AND s.ga BETWEEN 0 AND 1
 AND NOT EXISTS(SELECT 1 FROM ghost_equal_red_exclusions r WHERE r.event_id=s.event_id AND r.first_seen_utc<=s.captured_utc)
), scored AS (
 SELECT *,1.0/(1.0+exp(-(
   0.08445-0.3838*((px-2.2)/0.45)
   -0.28291*((-((gh-old_gh)+(ga-old_ga))-0.06)/0.035)
   +0.06037*((abs(gh-ga)-0.17)/0.16)
   -0.0963*((max(gh,ga)-0.4)/0.15)
 ))) ml,
 CASE WHEN minute=57 AND gh<0.30 AND ga<0.30
   AND gh-old_gh<=-0.009999 AND ga-old_ga<=-0.009999 THEN 1 ELSE 0 END golden
 FROM prior WHERE prior_rank=1
), ordered AS (
 SELECT *,ROW_NUMBER() OVER(PARTITION BY event_id ORDER BY ts,minute) seq
 FROM scored WHERE golden=1 OR ml>=0.55172
)
INSERT OR IGNORE INTO sb_radar_winloss_map_candidates_v2(
event_id,signal_utc,minute,fixture,odds_x,ml_score,route,first_recorded_utc,updated_utc)
SELECT event_id,ts,minute,fixture,px,ml,
 CASE WHEN golden=1 THEN 'GOLDEN' ELSE 'ML' END,?,? FROM ordered WHERE seq=1`;
const SETTLE=String.raw`INSERT OR IGNORE INTO sb_radar_winloss_ml_replay_v1(
event_id,signal_utc,minute,fixture,odds_x,ml_score,outcome,profit_1u,scope,updated_utc)
SELECT c.event_id,c.signal_utc,c.minute,c.fixture,c.odds_x,c.ml_score,
 CASE WHEN r.winner_1x2='X' THEN 'WIN' ELSE 'LOSS' END,
 CASE WHEN r.winner_1x2='X' THEN c.odds_x-1 ELSE -1 END,
 'REPLAY_ML_SEPARATE_GOLDEN_HOURLY_V2',?
 FROM sb_radar_winloss_map_candidates_v2 c JOIN match_results r ON r.event_id=c.event_id
 WHERE c.route='ML' AND r.verified=1 AND r.winner_1x2 IN ('1','2','X')`;
const CORRECT=String.raw`UPDATE sb_radar_winloss_ml_replay_v1
SET outcome=(SELECT CASE WHEN r.winner_1x2='X' THEN 'WIN' ELSE 'LOSS' END FROM match_results r WHERE r.event_id=sb_radar_winloss_ml_replay_v1.event_id),
profit_1u=(SELECT CASE WHEN r.winner_1x2='X' THEN odds_x-1 ELSE -1 END FROM match_results r WHERE r.event_id=sb_radar_winloss_ml_replay_v1.event_id),
updated_utc=?
WHERE event_id IN (
SELECT h.event_id FROM sb_radar_winloss_ml_replay_v1 h JOIN match_results r ON r.event_id=h.event_id
WHERE r.verified=1 AND r.winner_1x2 IN ('1','2','X')
AND h.outcome!=(CASE WHEN r.winner_1x2='X' THEN 'WIN' ELSE 'LOSS' END))`;
const ROLLING=String.raw`WITH recent AS (
 SELECT * FROM sb_radar_winloss_ml_enriched_v1 WHERE signal_utc>=? AND signal_utc<=?
), grouped AS (
 SELECT 'ALL' scope,'' country,'' league_key,'' match_type,COUNT(*) n,SUM(outcome='WIN') w,SUM(outcome='LOSS') l,
 ROUND(100.0*AVG(profit_1u),1) roi,ROUND(SUM(1.0/odds_x),2) expected FROM recent
 UNION ALL SELECT 'COUNTRY',country,'','',COUNT(*),SUM(outcome='WIN'),SUM(outcome='LOSS'),
 ROUND(100.0*AVG(profit_1u),1),ROUND(SUM(1.0/odds_x),2) FROM recent WHERE country<>'' GROUP BY country
 UNION ALL SELECT 'LEAGUE',country,league_key,'',COUNT(*),SUM(outcome='WIN'),SUM(outcome='LOSS'),
 ROUND(100.0*AVG(profit_1u),1),ROUND(SUM(1.0/odds_x),2) FROM recent WHERE country<>'' AND league_key<>'' GROUP BY country,league_key
 UNION ALL SELECT 'TYPE','','',match_type,COUNT(*),SUM(outcome='WIN'),SUM(outcome='LOSS'),
 ROUND(100.0*AVG(profit_1u),1),ROUND(SUM(1.0/odds_x),2) FROM recent WHERE match_type<>'' GROUP BY match_type
)
INSERT INTO sb_radar_winloss_map_stats_v1(scope,country,league_key,match_type,n,w,l,roi_pct,market_expected_w,period_start,period_end,asof_utc,source)
SELECT scope,country,league_key,match_type,n,w,l,roi,expected,?,?,?,'ML_REPLAY_ROLLING_7D_HOURLY_V2' FROM grouped WHERE n>0`;
const REAL=String.raw`WITH recent AS (
 SELECT * FROM sb_radar_winloss_map_actual_v2 WHERE triggered_utc>=? AND triggered_utc<=?
), grouped AS (
 SELECT 'ALL' scope,'' country,'' league_key,'' match_type,COUNT(*) signals,
 SUM(outcome!='PENDING') verified,SUM(outcome='WIN') w,SUM(outcome='LOSS') l,SUM(outcome='PENDING') pending FROM recent
 UNION ALL SELECT 'COUNTRY',country,'','',COUNT(*),SUM(outcome!='PENDING'),SUM(outcome='WIN'),SUM(outcome='LOSS'),SUM(outcome='PENDING')
 FROM recent WHERE country<>'' GROUP BY country
 UNION ALL SELECT 'LEAGUE',country,league_key,'',COUNT(*),SUM(outcome!='PENDING'),SUM(outcome='WIN'),SUM(outcome='LOSS'),SUM(outcome='PENDING')
 FROM recent WHERE country<>'' AND league_key<>'' GROUP BY country,league_key
 UNION ALL SELECT 'TYPE','','',match_type,COUNT(*),SUM(outcome!='PENDING'),SUM(outcome='WIN'),SUM(outcome='LOSS'),SUM(outcome='PENDING')
 FROM recent WHERE match_type<>'' GROUP BY match_type
)
INSERT INTO sb_radar_winloss_map_live_stats_v2(scope,country,league_key,match_type,signals,verified,w,l,pending,period_start,period_end,asof_utc)
SELECT scope,country,league_key,match_type,signals,verified,w,l,pending,?,?,? FROM grouped WHERE signals>0`;

async function update(env){
 const started=Date.now(),now=iso(),owner=crypto.randomUUID(),report={run_utc:now,status:'RUNNING'};
 let acquired=false,runId=null;
 try{
  const claim=await db(env,"UPDATE sb_radar_winloss_map_control_v2 SET lock_owner=?,locked_until=?,latest_status='RUNNING' WHERE id=1 AND (locked_until IS NULL OR locked_until<?)",owner,new Date(Date.now()+180000).toISOString(),now).run();
  if(Number(claim.meta?.changes)!==1)return {status:'SKIPPED',reason:'lease_held'};
  acquired=true;
  const ctrl=await db(env,'SELECT last_cursor_utc FROM sb_radar_winloss_map_control_v2 WHERE id=1').first();
  const cutoff=ago(now,7*86400000);
  const preferred=ctrl?.last_cursor_utc?ago(ctrl.last_cursor_utc,3*3600000):ago(now,86400000);
  const from=preferred>cutoff?preferred:cutoff;
  report.scan_from=from;report.scan_to=now;
  const record=await db(env,"INSERT INTO sb_radar_winloss_map_runs_v2(run_utc,status,scan_from_utc,scan_to_utc) VALUES(?,'RUNNING',?,?)",now,from,now).run();
  runId=record.meta?.last_row_id;
  if(!runId)throw Error('run_id_missing');
  const cand=await db(env,CANDIDATES,from,now,now,now).run();
  report.candidates=Number(cand.meta?.changes||0);
  const settled=await db(env,SETTLE,now).run();
  report.new_verified=Number(settled.meta?.changes||0);
  const corrections=await db(env,CORRECT,now).run();
  report.corrected=Number(corrections.meta?.changes||0);
  const count=await db(env,'SELECT COUNT(*) n FROM sb_radar_winloss_ml_replay_v1 WHERE signal_utc>=? AND signal_utc<=?',cutoff,now).first();
  if(!(Number(count?.n)>0))throw Error('empty_rolling_data; no overwrite');
  const dayStart=cutoff.slice(0,10),dayEnd=now.slice(0,10);
  const writes=await env.DB.batch([
   env.DB.prepare('DELETE FROM sb_radar_winloss_map_stats_v1'),
   db(env,ROLLING,cutoff,now,dayStart,dayEnd,now),
   env.DB.prepare('DELETE FROM sb_radar_winloss_map_live_stats_v2'),
   db(env,REAL,cutoff,now,dayStart,dayEnd,now)
  ]);
  report.rolling_rows=Number(writes[1]?.meta?.changes||0);
  report.real_rows=Number(writes[3]?.meta?.changes||0);
  if(!report.rolling_rows)throw Error('rolling_aggregate_empty');
  const pending=await db(env,"SELECT COUNT(*) n FROM sb_radar_winloss_map_candidates_v2 c LEFT JOIN match_results r ON r.event_id=c.event_id WHERE c.route='ML' AND c.signal_utc>=? AND (r.event_id IS NULL OR r.verified!=1 OR r.winner_1x2 NOT IN ('1','2','X'))",cutoff).first();
  report.pending=Number(pending?.n||0);
  report.duration_ms=Date.now()-started;
  await db(env,"UPDATE sb_radar_winloss_map_control_v2 SET last_success_utc=?,last_cursor_utc=?,latest_status='OK',latest_error=NULL,lock_owner=NULL,locked_until=NULL WHERE id=1 AND lock_owner=?",now,now,owner).run();
  acquired=false;
  await db(env,"UPDATE sb_radar_winloss_map_runs_v2 SET status='OK',finished_utc=?,candidates_inserted=?,ml_newly_settled=?,corrections=?,rolling_rows=?,live_rows=?,elapsed_ms=? WHERE id=?",iso(),report.candidates,report.new_verified,report.corrected,report.rolling_rows,report.real_rows,report.duration_ms,runId).run();
  report.status='OK';
 }catch(err){
  report.status='ERROR';report.error=String(err?.message||err).slice(0,500);report.duration_ms=Date.now()-started;
  if(runId)try{await db(env,"UPDATE sb_radar_winloss_map_runs_v2 SET status='ERROR',finished_utc=?,elapsed_ms=?,error=? WHERE id=?",iso(),report.duration_ms,report.error,runId).run()}catch(_){}
  if(acquired)try{await db(env,"UPDATE sb_radar_winloss_map_control_v2 SET latest_status='ERROR',latest_error=?,lock_owner=NULL,locked_until=NULL WHERE id=1 AND lock_owner=?",report.error,owner).run()}catch(_){}
 }
 return report;
}
export default {
 async scheduled(event,env,ctx){ctx.waitUntil(update(env))},
 async fetch(request,env){
  if(request.method!=='GET'||new URL(request.url).pathname!=='/health')return new Response('Not found',{status:404});
  const [control,latest,replay,real,candidates]=await Promise.all([
   db(env,'SELECT latest_status,last_success_utc,last_cursor_utc,latest_error FROM sb_radar_winloss_map_control_v2 WHERE id=1').first(),
   db(env,'SELECT run_utc,status,candidates_inserted,ml_newly_settled,corrections,rolling_rows,live_rows,elapsed_ms,error FROM sb_radar_winloss_map_runs_v2 ORDER BY id DESC LIMIT 1').first(),
   db(env,"SELECT n,w,l,roi_pct,period_start,period_end,asof_utc FROM sb_radar_winloss_map_stats_v1 WHERE scope='ALL'").first(),
   db(env,"SELECT signals,verified,w,l,pending,asof_utc FROM sb_radar_winloss_map_live_stats_v2 WHERE scope='ALL'").first(),
   db(env,"SELECT COUNT(*) n FROM sb_radar_winloss_map_candidates_v2 WHERE route='ML'").first()
  ]);
  const fresh=control?.last_success_utc&&Date.now()-Date.parse(control.last_success_utc)<9000000;
  return Response.json({service:'sb-radar-winloss-hourly-v2',cron:'0 * * * *',isolated:true,fresh:!!fresh,control,latest,rolling:replay,real_alerts:real,ml_candidates:candidates?.n,note:'Historical frequencies are not next-match probabilities or stake recommendations.'},{headers:{'cache-control':'no-store'}});
 }
};