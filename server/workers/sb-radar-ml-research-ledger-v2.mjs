/* SB Radar • research ledger v2. Background ONLY: hourly historical replay, BET NOW and Slip
 * are separate streams. Never scores or triggers bets. Nov Romanian local time = UTC+2.
 */
const stamp=()=>new Date().toISOString();
const stmt=(db,sql,...args)=>db.prepare(sql).bind(...args);
const TRACK="WITH days AS (SELECT DISTINCT date(signal_utc,'+2 hours') d FROM sb_radar_winloss_ml_replay_v1 WHERE signal_utc>=? UNION SELECT DISTINCT date(triggered_utc,'+2 hours') FROM ghost_equal_alerts WHERE stage='BET_NOW' AND triggered_utc>=? UNION SELECT DISTINCT date(placed_utc,'+2 hours') FROM ghost_equal_bets WHERE placed_utc>=?), rep AS (SELECT date(signal_utc,'+2 hours') d,COUNT(*) n,SUM(outcome='WIN') w,SUM(outcome='LOSS') l FROM sb_radar_winloss_ml_replay_v1 WHERE signal_utc>=? GROUP BY 1), alerts AS (SELECT date(a.triggered_utc,'+2 hours') d, SUM(a.model_version='SB_RADAR_ML_LOGREG_V1') ml_n,SUM(a.model_version='SB_RADAR_ML_LOGREG_V1' AND r.verified=1 AND r.winner_1x2='X') ml_w,SUM(a.model_version='SB_RADAR_ML_LOGREG_V1' AND r.verified=1 AND r.winner_1x2 IN ('1','2')) ml_l,SUM(a.model_version='SB_RADAR_ML_LOGREG_V1' AND (r.event_id IS NULL OR r.verified!=1 OR r.winner_1x2 NOT IN ('1','2','X'))) ml_pending,SUM(a.model_version='SB_GOLDEN_CLASSIC_00_M57_1PP_V1') classic_n,SUM(a.model_version='SB_GOLDEN_CLASSIC_00_M57_1PP_V1' AND r.verified=1 AND r.winner_1x2='X') classic_w,SUM(a.model_version='SB_GOLDEN_CLASSIC_00_M57_1PP_V1' AND r.verified=1 AND r.winner_1x2 IN ('1','2')) classic_l,SUM(a.model_version='SB_GOLDEN_CLASSIC_00_M57_1PP_V1' AND (r.event_id IS NULL OR r.verified!=1 OR r.winner_1x2 NOT IN ('1','2','X'))) classic_pending FROM ghost_equal_alerts a LEFT JOIN match_results r ON r.event_id=a.event_id WHERE a.stage='BET_NOW' AND a.triggered_utc>=? GROUP BY 1), slips AS (SELECT date(placed_utc,'+2 hours') d,SUM(source_group='ML_LOGREG_CURRENT' AND selection='X') ml_n,SUM(source_group='GOLDEN_CLASSIC_CURRENT' AND selection='X') classic_n,SUM(source_group='NO_LINKED_BET_NOW') unlinked_n,SUM(selection='Peste 0.5') over05_n,SUM(selection='Peste 0.5' AND status='WON') over05_w,SUM(selection='Peste 0.5' AND status='LOST') over05_l FROM sb_radar_slip_intelligence_v2 WHERE placed_utc>=? GROUP BY 1), missing AS (SELECT date(h.signal_utc,'+2 hours') d,SUM(c.event_id IS NULL OR c.country='NECONFIRMATA' OR c.league_name='NECONFIRMATA') missing FROM sb_radar_winloss_ml_replay_v1 h LEFT JOIN sb_radar_event_competition c ON c.event_id=h.event_id WHERE h.signal_utc>=? GROUP BY 1) INSERT OR REPLACE INTO sb_radar_ml_daily_tracking_v2(day_local,observed_utc,replay_n,replay_w,replay_l,real_ml_alert_n,real_ml_alert_w,real_ml_alert_l,real_ml_alert_pending,classic_alert_n,classic_alert_w,classic_alert_l,classic_alert_pending,slip_linked_ml_n,slip_linked_classic_n,slip_unlinked_n,missing_competition,report_json) SELECT d.d,?,COALESCE(rep.n,0),COALESCE(rep.w,0),COALESCE(rep.l,0),COALESCE(alerts.ml_n,0),COALESCE(alerts.ml_w,0),COALESCE(alerts.ml_l,0),COALESCE(alerts.ml_pending,0),COALESCE(alerts.classic_n,0),COALESCE(alerts.classic_w,0),COALESCE(alerts.classic_l,0),COALESCE(alerts.classic_pending,0),COALESCE(slips.ml_n,0),COALESCE(slips.classic_n,0),COALESCE(slips.unlinked_n,0),COALESCE(missing.missing,0),json_object('over_05_slip_n',COALESCE(slips.over05_n,0),'over_05_slip_win',COALESCE(slips.over05_w,0),'over_05_slip_loss',COALESCE(slips.over05_l,0),'data_streams','replay_ml,alert_ml,alert_golden,slip_by_market','note','Historical replay vs actual alert vs manual slip are separate; no bets placed by this job') FROM days d LEFT JOIN rep ON rep.d=d.d LEFT JOIN alerts ON alerts.d=d.d LEFT JOIN slips ON slips.d=d.d LEFT JOIN missing ON missing.d=d.d WHERE d.d IS NOT NULL";
const ARCHIVE="WITH anchor AS (SELECT date('now','+2 hours','-2 days') d), span AS (SELECT a.d, date(a.d,'-6 days') first_day FROM anchor a) INSERT OR IGNORE INTO sb_radar_ml_weekly_archives_v2(asof_day_local,archive_utc,window_start_local,window_end_local,model_version,n,w,l,roi_pct,unique_countries,unique_leagues,metadata_unknown,ml_live_alert_n,ml_live_alert_w,ml_live_alert_l,ml_live_alert_pending,slip_x_n,slip_x_won,slip_x_lost,notes) SELECT span.d,?,span.first_day,span.d,'SB_RADAR_ML_LOGREG_V1',(SELECT COUNT(*) FROM sb_radar_winloss_ml_replay_v1 h WHERE date(h.signal_utc,'+2 hours') BETWEEN span.first_day AND span.d),(SELECT COUNT(*) FROM sb_radar_winloss_ml_replay_v1 h WHERE date(h.signal_utc,'+2 hours') BETWEEN span.first_day AND span.d AND h.outcome='WIN'),(SELECT COUNT(*) FROM sb_radar_winloss_ml_replay_v1 h WHERE date(h.signal_utc,'+2 hours') BETWEEN span.first_day AND span.d AND h.outcome='LOSS'),(SELECT ROUND(100*AVG(h.profit_1u),1) FROM sb_radar_winloss_ml_replay_v1 h WHERE date(h.signal_utc,'+2 hours') BETWEEN span.first_day AND span.d),(SELECT COUNT(DISTINCT c.country) FROM sb_radar_winloss_ml_replay_v1 h JOIN sb_radar_event_competition c ON c.event_id=h.event_id WHERE date(h.signal_utc,'+2 hours') BETWEEN span.first_day AND span.d AND c.country<>'NECONFIRMATA'),(SELECT COUNT(DISTINCT c.country||'|'||c.league_name) FROM sb_radar_winloss_ml_replay_v1 h JOIN sb_radar_event_competition c ON c.event_id=h.event_id WHERE date(h.signal_utc,'+2 hours') BETWEEN span.first_day AND span.d AND c.country<>'NECONFIRMATA' AND c.league_name<>'NECONFIRMATA'),(SELECT COUNT(*) FROM sb_radar_winloss_ml_replay_v1 h LEFT JOIN sb_radar_event_competition c ON c.event_id=h.event_id WHERE date(h.signal_utc,'+2 hours') BETWEEN span.first_day AND span.d AND (c.event_id IS NULL OR c.country='NECONFIRMATA' OR c.league_name='NECONFIRMATA')),(SELECT COUNT(*) FROM ghost_equal_alerts a WHERE a.model_version='SB_RADAR_ML_LOGREG_V1' AND a.stage='BET_NOW' AND date(a.triggered_utc,'+2 hours') BETWEEN span.first_day AND span.d),(SELECT COUNT(*) FROM ghost_equal_alerts a JOIN match_results r ON r.event_id=a.event_id WHERE a.model_version='SB_RADAR_ML_LOGREG_V1' AND a.stage='BET_NOW' AND r.verified=1 AND r.winner_1x2='X' AND date(a.triggered_utc,'+2 hours') BETWEEN span.first_day AND span.d),(SELECT COUNT(*) FROM ghost_equal_alerts a JOIN match_results r ON r.event_id=a.event_id WHERE a.model_version='SB_RADAR_ML_LOGREG_V1' AND a.stage='BET_NOW' AND r.verified=1 AND r.winner_1x2 IN ('1','2') AND date(a.triggered_utc,'+2 hours') BETWEEN span.first_day AND span.d),(SELECT COUNT(*) FROM ghost_equal_alerts a LEFT JOIN match_results r ON r.event_id=a.event_id WHERE a.model_version='SB_RADAR_ML_LOGREG_V1' AND a.stage='BET_NOW' AND date(a.triggered_utc,'+2 hours') BETWEEN span.first_day AND span.d AND (r.event_id IS NULL OR r.verified!=1 OR r.winner_1x2 NOT IN ('1','2','X'))),(SELECT COUNT(*) FROM ghost_equal_bets b WHERE b.selection='X' AND date(b.placed_utc,'+2 hours') BETWEEN span.first_day AND span.d),(SELECT COUNT(*) FROM ghost_equal_bets b WHERE b.selection='X' AND b.status='WON' AND date(b.placed_utc,'+2 hours') BETWEEN span.first_day AND span.d),(SELECT COUNT(*) FROM ghost_equal_bets b WHERE b.selection='X' AND b.status='LOST' AND date(b.placed_utc,'+2 hours') BETWEEN span.first_day AND span.d),'Immutable as-of snapshot made 2 days after window end; early result verification may still be pending. No alerts or bets triggered.' FROM span";

/* Prospective walk-forward: freeze previous 7 days once per day, before testing new
 * signals; report only events first observed AFTER the freeze timestamp. Data
 * before activation remains explicitly retrospective, never a true holdout.
 */
function localParts(t){
 const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(t);
 const get=k=>p.find(x=>x.type===k)?.value;
 return [Number(get('year')),Number(get('month')),Number(get('day'))];
}
function offsetHours(t){
 const p=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Bucharest',timeZoneName:'shortOffset'}).formatToParts(t);
 const z=p.find(x=>x.type==='timeZoneName')?.value||'GMT+2',m=z.match(/GMT([+-]\d+)/);
 return m?Number(m[1]):2;
}
function localDayStartUtc(parts){
 const [y,m,d]=parts,ms=Date.UTC(y,m-1,d);
 let utc=ms-offsetHours(new Date(ms+12*3600000))*3600000;
 utc=ms-offsetHours(new Date(utc))*3600000;
 return new Date(utc).toISOString();
}
function withOffset(sql,offset){return sql.replaceAll("'+2 hours'","'"+(offset>=0?'+':'')+offset+" hours'")}
function scopeDims(offset){
 const hr="CAST(strftime('%H',signal_utc,'"+(offset>=0?'+':'')+offset+" hours') AS INTEGER)";
 const band="CASE WHEN "+hr+"<6 THEN '00-06' WHEN "+hr+"<12 THEN '06-12' WHEN "+hr+"<15 THEN '12-15' WHEN "+hr+"<18 THEN '15-18' ELSE '18-24' END";
 const score="CASE WHEN ml_score>=0.60 THEN 'GE_0.60' ELSE 'LT_0.60' END";
 const odds="CASE WHEN odds_x<2 THEN 'LT_2.00' WHEN odds_x<2.15 THEN '2.00_TO_2.14' ELSE 'GE_2.15' END";
 return [['ALL',"'*'"],['COUNTRY',"country"],['LEAGUE',"country||' | '||league_key"],['TYPE',"COALESCE(NULLIF(match_type,''),'OTHER_OR_UNKNOWN')"],['HOUR_GROUP',band],['ML_SCORE',score],['HOUR_SCORE',band+"||' | '||"+score],['SCORE_ODDS',score+"||' | '||"+odds]];
}
async function forward(env,utc,offset){
 const parts=localParts(new Date(utc)),day=parts.map((x,i)=>i===0?String(x):String(x).padStart(2,'0')).join('-');
 const start=localDayStartUtc(parts),begin=new Date(Date.parse(start)-7*86400000).toISOString();
 const onTime=Date.parse(utc)-Date.parse(start)<=60*60000?1:0;
 const dims=scopeDims(offset);let added=0,events=0;
 const trainScope=dims.map(([kind,key])=>"SELECT '"+kind+"' scope,"+key+" scope_key,outcome,profit_1u FROM base");
 const freeze=(group)=>"WITH base AS (SELECT * FROM sb_radar_winloss_ml_enriched_v1 WHERE signal_utc>=? AND signal_utc<?), dims AS ("+
   group.map(x=>trainScope[dims.indexOf(x)]).join(' UNION ALL ')+
   ") INSERT OR IGNORE INTO sb_radar_ml_forward_frozen_v3(day_local,scope,scope_key,frozen_utc,train_start_utc,train_end_utc,train_n,train_w,train_l,train_roi_pct,min_sample_pass,valid_on_time,last_checked_utc) SELECT ?,scope,scope_key,?,?,?,COUNT(*),SUM(outcome='WIN'),SUM(outcome='LOSS'),ROUND(100*AVG(profit_1u),1),CASE WHEN COUNT(*)>=10 THEN 1 ELSE 0 END,?,? FROM dims GROUP BY scope,scope_key";
 for(let i=0;i<dims.length;i+=4){
  const out=await stmt(env.DB,freeze(dims.slice(i,i+4)),begin,start,day,utc,begin,start,onTime,utc).run();
  added+=Number(out.meta?.changes||0);
 }
 const sample="SELECT q.event_id,q.signal_utc,q.odds_x,q.ml_score,COALESCE(NULLIF(c.country,'NECONFIRMATA'),t.country,'') country,CASE WHEN lower(COALESCE(NULLIF(c.league_name,'NECONFIRMATA'),t.league_name,'')) LIKE 'tercera federacion%' THEN 'Tercera Federacion' WHEN lower(COALESCE(NULLIF(c.league_name,'NECONFIRMATA'),t.league_name,'')) LIKE 'serie d%' THEN 'Serie D' WHEN lower(COALESCE(NULLIF(c.league_name,'NECONFIRMATA'),t.league_name,'')) LIKE 'segunda federacion%' THEN 'Segunda Federacion' ELSE COALESCE(NULLIF(c.league_name,'NECONFIRMATA'),t.league_name,'') END league_key,COALESCE(c.match_type,'OTHER_OR_UNKNOWN') match_type,CASE WHEN r.verified=1 AND r.winner_1x2='X' THEN 'WIN' WHEN r.verified=1 AND r.winner_1x2 IN ('1','2') THEN 'LOSS' ELSE 'PENDING' END outcome,CASE WHEN r.verified=1 AND r.winner_1x2='X' THEN q.odds_x-1 WHEN r.verified=1 AND r.winner_1x2 IN ('1','2') THEN -1 ELSE NULL END profit_1u FROM sb_radar_winloss_map_candidates_v2 q LEFT JOIN match_results r ON r.event_id=q.event_id LEFT JOIN event_catalog e ON e.event_id=q.event_id LEFT JOIN sb_radar_event_competition c ON c.event_id=q.event_id LEFT JOIN sb_radar_tournament_labels t ON t.tournament_id=e.tournament_id WHERE q.route='ML' AND q.signal_utc>=? AND q.signal_utc<=?";
 const observe=(group)=>"WITH base AS ("+sample+"), dims AS ("+group.map(([kind,key])=>"SELECT event_id,signal_utc,'"+kind+"' scope,"+key+" scope_key,outcome,profit_1u FROM base").join(' UNION ALL ')+") INSERT INTO sb_radar_ml_forward_observations_v3(day_local,event_id,scope,scope_key,signal_utc,outcome,profit_1u,observed_utc) SELECT ?,event_id,scope,scope_key,signal_utc,outcome,profit_1u,? FROM dims WHERE scope_key<>'' ON CONFLICT(day_local,event_id,scope,scope_key) DO UPDATE SET outcome=excluded.outcome,profit_1u=excluded.profit_1u,observed_utc=excluded.observed_utc";
 for(let i=0;i<dims.length;i+=4){
  const r=await stmt(env.DB,observe(dims.slice(i,i+4)),start,utc,day,utc).run();events+=Number(r.meta?.changes||0);
 }
 // If a new league appears with no 7-day history, freeze it with zero
 // training and invalidate "on-time" so no new signal can be called an advantage.
 await stmt(env.DB,"INSERT OR IGNORE INTO sb_radar_ml_forward_frozen_v3(day_local,scope,scope_key,frozen_utc,train_start_utc,train_end_utc,train_n,train_w,train_l,train_roi_pct,min_sample_pass,valid_on_time,last_checked_utc) SELECT DISTINCT day_local,scope,scope_key,?, ?,?,0,0,0,NULL,0,0,? FROM sb_radar_ml_forward_observations_v3 WHERE day_local=?",utc,begin,start,utc,day).run();
 const correlated=(suffix)=>"(SELECT COUNT(*) FROM sb_radar_ml_forward_observations_v3 o WHERE o.day_local=sb_radar_ml_forward_frozen_v3.day_local AND o.scope=sb_radar_ml_forward_frozen_v3.scope AND o.scope_key=sb_radar_ml_forward_frozen_v3.scope_key AND o.signal_utc>=sb_radar_ml_forward_frozen_v3.frozen_utc"+(suffix?" AND o.outcome='"+suffix+"'":"")+")";
 const update="UPDATE sb_radar_ml_forward_frozen_v3 SET test_n="+correlated('')+",test_w="+correlated('WIN')+",test_l="+correlated('LOSS')+",test_pending="+correlated('PENDING')+",last_checked_utc=? WHERE day_local=?";
 const upd=await stmt(env.DB,update,utc,day).run();
 return{day,train_from:begin,train_to:start,frozen_groups_added:added,observations_written:events,forward_tests_updated:Number(upd.meta?.changes||0),on_time:onTime};
}

async function run(env){
 const started=Date.now(),utc=stamp(),from=new Date(Date.now()-11*86400000).toISOString(),offset=offsetHours(new Date()),report={run_utc:utc,status:'RUNNING'};
 try{
  const track=await stmt(env.DB,withOffset(TRACK,offset),from,from,from,from,from,from,from,utc).run();
  report.daily_rows=Number(track.meta?.changes||0);
  const weekly=await stmt(env.DB,withOffset(ARCHIVE,offset),utc).run();
  report.weekly_archives_added=Number(weekly.meta?.changes||0);
  report.forward=await forward(env,utc,offset);
  report.elapsed_ms=Date.now()-started;report.status='OK';
  await stmt(env.DB,'INSERT OR IGNORE INTO sb_radar_ml_ledger_runs_v2(run_utc,status,days_written,weekly_archives_added,frozen_groups_added,forward_tests_updated,elapsed_ms) VALUES(?,?,?,?,?,?,?)',utc,'OK',report.daily_rows,report.weekly_archives_added,report.forward.frozen_groups_added,report.forward.forward_tests_updated,report.elapsed_ms).run();
 }catch(e){report.elapsed_ms=Date.now()-started;report.status='ERROR';report.error=String(e?.message||e).slice(0,500)}
 return report;
}
export default {
 async scheduled(_event,env,ctx){ctx.waitUntil(run(env))},
 async fetch(req,env){
  if(req.method!=='GET'||new URL(req.url).pathname!=='/health')return new Response('Not found',{status:404});
  const [days,latest,archives,slips]=await Promise.all([
   stmt(env.DB,"SELECT day_local,replay_n,replay_w,replay_l,real_ml_alert_n,real_ml_alert_w,real_ml_alert_l,real_ml_alert_pending,classic_alert_n,classic_alert_w,classic_alert_l,classic_alert_pending,slip_linked_ml_n,slip_linked_classic_n,slip_unlinked_n,observed_utc FROM sb_radar_ml_daily_tracking_v2 ORDER BY day_local DESC LIMIT 8").all(),
   stmt(env.DB,"SELECT MAX(observed_utc) utc FROM sb_radar_ml_daily_tracking_v2").first(),
   stmt(env.DB,"SELECT asof_day_local,n,w,l,roi_pct,metadata_unknown,archive_utc FROM sb_radar_ml_weekly_archives_v2 ORDER BY asof_day_local DESC LIMIT 3").all(),
   stmt(env.DB,"SELECT source_group,selection,status,COUNT(*) n FROM sb_radar_slip_intelligence_v2 WHERE placed_utc>='2026-11-06T00:00:00Z' GROUP BY source_group,selection,status ORDER BY n DESC LIMIT 25").all()
  ]);
  const forward=await stmt(env.DB,"SELECT day_local,scope,scope_key,frozen_utc,train_n,train_w,train_l,min_sample_pass,valid_on_time,test_n,test_w,test_l,test_pending,last_checked_utc FROM sb_radar_ml_forward_frozen_v3 WHERE day_local=(SELECT MAX(day_local) FROM sb_radar_ml_forward_frozen_v3) AND (scope='ALL' OR (scope='COUNTRY' AND train_n>=10)) ORDER BY scope,train_n DESC LIMIT 12").all();
  const fresh=latest?.utc&&Date.now()-Date.parse(latest.utc)<9000000;
  return Response.json({service:'sb-radar-ml-research-ledger-v2',cron:'25 * * * *',isolated:true,fresh:!!fresh,daily:days.results,archive:archives.results,slip_streams:slips.results,prospective:forward.results},{headers:{'cache-control':'no-store'}});
 }
};