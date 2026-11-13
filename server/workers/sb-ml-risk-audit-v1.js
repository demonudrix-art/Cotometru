/**
 * SB Radar - ML LogReg V1 risk research for private per-match Audit.
 * Data isolation: read-only; never imported into scanner, alerts, FCM or slips.
 * Audit is OWNER-ONLY. Logistic output is not a win probability.
 */
const MODEL='SB_RADAR_ML_LOGREG_V1';
const SNAPSHOT='SB_META_RECONCILED_20261113';
const exec=(env,sql,...values)=>env.DB.prepare(sql).bind(...values);
const safeNum=x=>x===null||x===undefined?null:Number.isFinite(Number(x))?Number(x):null;
function roHour(utc){
 if(!utc||!Number.isFinite(Date.parse(utc)))return null;
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Bucharest',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(utc));
 const n=Number(parts.find(x=>x.type==='hour')?.value);
 return Number.isInteger(n)&&n>=0&&n<=23?n:null;
}
function hrBin(h){return h===null?null:h<6?'00-06':h<12?'06-12':h<15?'12-15':h<18?'15-18':'18-24'}
function scoreBin(s){return s===null?null:s>=.60?'GE_0.60':'LT_0.60'}
function oddsBin(o){return o===null||o<=1?null:o<2?'LT_2.00':o<2.15?'2.00_TO_2.14':'GE_2.15'}
function statData(rows,items){
 const map=new Map(rows.map(r=>[r.dimension+'::'+r.dimension_key,r]));
 return items.map(x=>{const y=map.get(x.dimension+'::'+x.key);return {...x,stat:y?{
   n:Number(y.n||0),w:Number(y.w||0),l:Number(y.l||0),
   roi_pct:safeNum(y.roi_pct),avg_odds:safeNum(y.avg_odds),
   avg_ml:safeNum(y.avg_ml),asof_utc:y.asof_utc||null}:null}});
}
const infoSql="SELECT e.event_id,e.fixture,e.tournament_id,e.category_id,COALESCE(NULLIF(c.country,'NECONFIRMATA'),t.country,'') country,COALESCE(NULLIF(c.league_name,'NECONFIRMATA'),t.league_name,'') league,COALESCE(c.match_type,'OTHER_OR_UNKNOWN') match_type,c.source as metadata_source,d.evaluated_utc,d.ml_score,d.ml_cutoff,d.px ml_px,d.accepted,d.model_version as decision_model,q.route as replay_route,q.signal_utc replay_utc,q.ml_score replay_ml,q.odds_x replay_odds,a.triggered_utc alert_utc,a.model_version alert_model,a.stage alert_stage,a.px alert_odds FROM event_catalog e LEFT JOIN sb_radar_event_competition c ON c.event_id=e.event_id LEFT JOIN sb_radar_tournament_labels t ON t.tournament_id=e.tournament_id LEFT JOIN sb_radar_ml_decisions d ON d.event_id=e.event_id AND d.model_version='SB_RADAR_ML_LOGREG_V1' LEFT JOIN sb_radar_winloss_map_candidates_v2 q ON q.event_id=e.event_id LEFT JOIN ghost_equal_alerts a ON a.event_id=e.event_id AND a.stage='BET_NOW' WHERE e.event_id=? LIMIT 1";
const histSql="SELECT scope,scope_key,COUNT(*) days,SUM(test_n) test_n,SUM(test_w) test_w,SUM(test_l) test_l,ROUND(100.0*SUM(test_w)/NULLIF(SUM(test_n),0),1) win_pct,SUM(CASE WHEN eligible_at_day_start=1 THEN 1 ELSE 0 END) eligible_days FROM sb_radar_ml_walkforward_v2 WHERE snapshot_id=? AND (scope=? AND scope_key=? OR scope='ALL' AND scope_key='*') AND eligible_at_day_start=1 GROUP BY scope,scope_key";
const prospectSql="SELECT day_local,scope,scope_key,valid_on_time,min_sample_pass,train_n,train_w,train_l,test_n,test_w,test_l,test_pending,frozen_utc,last_checked_utc FROM sb_radar_ml_forward_frozen_v3 WHERE (scope=? AND scope_key=? OR scope='ALL' AND scope_key='*') ORDER BY day_local DESC LIMIT 10";
const slipNowSql="SELECT selection,status,COUNT(*) n,ROUND(SUM(stake_lei),2) stake_lei,ROUND(SUM(CASE WHEN status IN ('WON','LOST','VOID','CASHOUT') THEN COALESCE(returned_lei,0)-stake_lei END),2) settled_net_lei FROM ghost_equal_bets WHERE device_id=? AND event_id=? GROUP BY selection,status ORDER BY selection,status";
const slip7Sql="SELECT a.model_version AS linked_model,b.selection,b.status,COUNT(*) n,ROUND(SUM(b.stake_lei),2) stake_lei,ROUND(SUM(CASE WHEN b.status IN ('WON','LOST','VOID','CASHOUT') THEN COALESCE(b.returned_lei,0)-b.stake_lei END),2) settled_net_lei FROM ghost_equal_bets b LEFT JOIN ghost_equal_alerts a ON a.event_id=b.event_id AND a.stage='BET_NOW' WHERE b.device_id=? AND b.placed_utc>=? AND b.selection='X' GROUP BY a.model_version,b.selection,b.status";
function makeConditions(conditions){
 return '('+conditions.map(()=>"dimension=? AND dimension_key=?").join(') OR (')+')';
}
export async function auditMlRisk(env,eventId,deviceId){
 const row=await exec(env,infoSql,eventId).first();
 if(!row)return{status:'NO_CATALOG',model:MODEL};
 const isML=row.alert_model===MODEL;
 const isGolden=row.alert_model==='SB_GOLDEN_CLASSIC_00_M57_1PP_V1'||row.replay_route==='GOLDEN';
 const score=safeNum(row.ml_score)??safeNum(row.replay_ml);
 const odd=safeNum(row.ml_px)??safeNum(row.replay_odds)??safeNum(row.alert_odds);
 const time=row.alert_utc||row.replay_utc||row.evaluated_utc;
 const hour=roHour(time),hb=hrBin(hour),sb=scoreBin(score),ob=oddsBin(odd);
 const typ=String(row.match_type||'OTHER_OR_UNKNOWN');
 const typesAllowed=new Set(['YOUTH','RESERVES','WOMEN','CUP']);
 const tkey=typesAllowed.has(typ)?typ:'OTHER_OR_UNKNOWN';
 const groups=[];
 if(hb)groups.push({dimension:'HOUR_GROUP',key:hb,label:'Ora semnalului'});
 if(sb)groups.push({dimension:'ML_SCORE',key:sb,label:'Interval scor ML'});
 if(ob)groups.push({dimension:'ODDS_X',key:ob,label:'Interval cota X'});
 if(hb&&sb)groups.push({dimension:'HOUR_SCORE',key:hb+' | '+sb,label:'Ora + scor ML'});
 if(sb&&ob)groups.push({dimension:'SCORE_ODDS',key:sb+' | '+ob,label:'Scor ML + cota X'});
 if(hb&&sb&&ob)groups.push({dimension:'HOUR_SCORE_ODDS',key:hb+' | '+sb+' | '+ob,label:'Ora + scor ML + cota X'});
 if(tkey!=='OTHER_OR_UNKNOWN')groups.push({dimension:'TYPE',key:tkey,label:'Tip competiție'});
 if(hb&&tkey!=='OTHER_OR_UNKNOWN')groups.push({dimension:'HOUR_TYPE',key:hb+' | '+tkey,label:'Ora + tip competiție'});
 let rolling=[],baseline=[];
 if(groups.length){
  const where=makeConditions(groups);
  const params=groups.flatMap(x=>[x.dimension,x.key]);
  const [a,b]=await Promise.all([
   exec(env,'SELECT dimension,dimension_key,n,w,l,roi_pct,avg_odds,avg_ml,asof_utc FROM sb_radar_ml_risk_segments_v1 WHERE '+where,...params).all(),
   exec(env,'SELECT dimension,dimension_key,n,w,l,roi_pct,avg_odds,avg_ml,run.asof_utc FROM sb_radar_ml_snapshot_stats_v2 snap JOIN sb_radar_ml_snapshot_runs_v2 run ON run.snapshot_id=snap.snapshot_id WHERE snap.snapshot_id=? AND ('+where+')',SNAPSHOT,...params).all()
  ]);
  rolling=statData(a.results||[],groups);baseline=statData(b.results||[],groups);
 }
 const wfScope=hb&&sb?'HOUR_SCORE':'ALL',wfKey=hb&&sb?hb+' | '+sb:'*';
 const since=new Date(Date.now()-7*86400000).toISOString();
 const [wf,forward,slipNow,slip7]=await Promise.all([
  exec(env,histSql,SNAPSHOT,wfScope,wfKey).all(),
  exec(env,prospectSql,wfScope,wfKey).all(),
  exec(env,slipNowSql,deviceId,eventId).all(),
  exec(env,slip7Sql,deviceId,since).all()
 ]);
 const asof=rolling.find(x=>x.stat?.asof_utc)?.stat?.asof_utc||null;
 const evidence=rolling.find(x=>x.dimension==='HOUR_SCORE_ODDS')?.stat;
 const tooSmall=!evidence||evidence.n<10;
 return{
  version:'ML_RISK_AUDIT_V1',status:score===null?'NO_MODEL_SCORE':'OK',
  context:isGolden?'GOLDEN_ML_CONTEXT_ONLY':isML?'ML_PRODUCTION_ALERT':row.accepted===1?'ML_DECISION_ACCEPTED_NO_BETNOW':'ML_REJECTED_OR_UNCONFIRMED',
  model:MODEL,metadata:{country:row.country,league:row.league,type:tkey,source:row.metadata_source||null},
  signal:{evaluated_utc:time||null,minute_local_hour:hour,model_score:score,cutoff:safeNum(row.ml_cutoff)||0.55172,accepted:row.accepted===1,
   odds_x:odd,has_ml_bet_now:isML,has_golden_bet_now:isGolden},
  bins:{hour:hb,score:sb,odds:ob},
  rolling:{window_days:7,asof_utc:asof,segments:rolling},
  baseline:{snapshot_id:SNAPSHOT,period_label:'6–13 nov. 2026',segments:baseline,overlaps_rolling:true},
  retrospective_walkforward:{mode:'RETROSPECTIVE_NOT_PROSPECTIVE',scope:wfScope,key:wfKey,rows:wf.results||[]},
  prospective_walkforward:{mode:'FROZEN_EARLY_DAY_ONLY',rows:forward.results||[]},
  slip:{event_bets:slipNow.results||[],x_last_7d_by_alert:slip7.results||[]},
  caution:tooSmall?'INSUFFICIENT_COMBINATION_N':'HISTORICAL_ONLY_NO_GUARANTEE',
  notes:'All WIN/LOSS segments refer only to replay of ML LogReg V1; actual BET NOW and user slips are separate. Score is a logistic ranking, not P(draw). No stake recommendation.'
 };
}