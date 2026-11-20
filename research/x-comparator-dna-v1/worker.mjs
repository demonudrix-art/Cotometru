// SB RADAR X-COMPARATOR DNA v1 — isolated shadow-only Worker
// Reads live_snapshots + match_results, writes ONLY sb_radar_xcomp_* tables.
// Never sends FCM/Twilio, never touches filters, odds feeds or the Slip.
const RULE = 'XCOMP_DNA_SHADOW_V1';
const STAGES = {45:[20,30,40,45],50:[30,40,45,50],57:[40,45,50,57]};
const DBID='sb_radar_xcomp';
const isoAgo=(mins)=>new Date(Date.now()-mins*60000).toISOString();
function fair(s){
  const a=1/s.p1,b=1/s.px,c=1/s.p2,sum=a+b+c;
  return sum>0?b/sum:NaN;
}
function metric(a,b){
  let squared=0,weight=0;
  for(let i=0;i<4;i++){
    const x=a.features[i],y=b.features[i],w=i===3?1.5:0.65;
    squared+=w*( ((x.gh-y.gh)/.045)**2 + ((x.ga-y.ga)/.045)**2 + ((fair(x)-fair(y))/.06)**2 );
    weight+=3*w;
    if(i){
      const xp=a.features[i-1],yp=b.features[i-1];
      squared+=1.15*(
        (((x.gh-xp.gh)-(y.gh-yp.gh))/.03)**2
        + (((x.ga-xp.ga)-(y.ga-yp.ga))/.03)**2
        + (((fair(x)-fair(xp))-(fair(y)-fair(yp)))/.05)**2
      );
      weight+=3*1.15;
    }
  }
  if(a.corners_home!==null&&b.corners_home!==null){squared+=((a.corners_home-b.corners_home)/3.5)**2;weight++;}
  if(a.corners_away!==null&&b.corners_away!==null){squared+=((a.corners_away-b.corners_away)/3.5)**2;weight++;}
  return Math.sqrt(squared/weight);
}
function makeVectorSql(stage){
 const points=STAGES[stage];
 const joins=points.slice(0,3).map((n,i)=>
   'JOIN sb_radar_xcomp_snapshots_v1 s'+i+
   ' ON s'+i+'.event_id=s3.event_id AND s'+i+'.checkpoint='+n+
   ' AND s'+i+'.home_score=0 AND s'+i+'.away_score=0'
 ).join(' ');
 const parts=points.map((n,i)=>
   "json_object('minute',s"+i+".checkpoint,'gh',s"+i+
   ".gh,'ga',s"+i+".ga,'p1',s"+i+".p1,'px',s"+i+
   ".px,'p2',s"+i+".p2,'ch',s"+i+".corners_home,'ca',s"+i+".corners_away)"
 ).join(',');
 return `INSERT OR IGNORE INTO sb_radar_xcomp_vectors_v1
 (event_id,checkpoint,fixture,asof_utc,kickoff_utc,p1,px,p2,gh,ga,corners_home,corners_away,features_json)
 SELECT s3.event_id,${stage},s3.fixture,s3.captured_utc,s3.kickoff_utc,
 s3.p1,s3.px,s3.p2,s3.gh,s3.ga,s3.corners_home,s3.corners_away,
 json_array(${parts})
 FROM sb_radar_xcomp_snapshots_v1 s3 ${joins}
 WHERE s3.checkpoint=${stage} AND s3.home_score=0 AND s3.away_score=0
 AND s3.captured_utc>=?
 AND s0.captured_utc<s1.captured_utc AND s1.captured_utc<s2.captured_utc
 AND s2.captured_utc<s3.captured_utc`;
}
async function evaluate(env,a){
 const qualifiedHistory=await env.DB.prepare(`
 SELECT v.event_id,v.fixture,v.checkpoint,v.kickoff_utc,v.asof_utc,v.p1,v.px,v.p2,
 v.gh,v.ga,v.corners_home,v.corners_away,v.features_json,
 m.winner_1x2 AS outcome
 FROM sb_radar_xcomp_vectors_v1 v JOIN match_results m ON m.event_id=v.event_id
 WHERE v.checkpoint=? AND v.event_id<>?
 AND v.px BETWEEN ? AND ?
 AND v.asof_utc<? AND m.checked_utc<?
 AND m.verified=1 AND m.event_status='FINISHED'
 AND m.winner_1x2 IN ('1','2','X')
 LIMIT 1500`).bind(a.checkpoint,a.event_id,a.px-.5,a.px+.5,a.asof_utc,a.asof_utc).all();
 a.features=JSON.parse(a.features_json);
 const hist=[];
 for(const row of qualifiedHistory.results||[]){
   const neighbor={...row,features:JSON.parse(row.features_json)};
   const distance=metric(a,neighbor);
   if(Number.isFinite(distance)) hist.push({neighbor,distance});
 }
 hist.sort((a,b)=>a.distance-b.distance);
 const selected=[],perDay=new Map();
 for(const match of hist){
  const day=match.neighbor.kickoff_utc?.slice(0,10)||'unknown';
  if((perDay.get(day)||0)>=4)continue;
  selected.push(match);perDay.set(day,(perDay.get(day)||0)+1);
  if(selected.length===20)break;
 }
 const n=selected.length,win=selected.filter(x=>x.neighbor.outcome==='X').length;
 const mean=n?selected.reduce((v,x)=>v+x.distance,0)/n:null;
 const weights=selected.map(x=>1/(.25+x.distance)),weightSum=weights.reduce((x,y)=>x+y,0);
 const residual=n?selected.reduce((s,x,i)=>s+weights[i]*((x.neighbor.outcome==='X'?1:0)-fair(x.neighbor)),0)/weightSum:0;
 const market=fair(a),pModel=Math.max(.01,Math.min(.99,market+0.4*residual)),ev=pModel*a.px-1;
 const enough=n===20&&perDay.size>=5&&mean<=1.55;
 const decision=!enough?'INSUFFICIENT_DATA':ev>=.06?'RESEARCH_CANDIDATE':'PASS';
 const top=selected.slice(0,6).map(x=>({event_id:x.neighbor.event_id,fixture:x.neighbor.fixture,minute:a.checkpoint,outcome:x.neighbor.outcome,price:x.neighbor.px,distance:+x.distance.toFixed(4)}));
 await env.DB.prepare(`INSERT OR IGNORE INTO sb_radar_xcomp_decisions_v1
 (rule_id,event_id,checkpoint,fixture,asof_utc,odds_x,market_prob,model_prob,model_ev,
 neighbors_count,neighbor_wins,avg_distance,neighbor_ids_json,decision,mode)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
 .bind(RULE,a.event_id,a.checkpoint,a.fixture,a.asof_utc,a.px,market,pModel,ev,n,win,mean,
 JSON.stringify({top6:top,days:perDay.size,scoring:'fair_market_residual_shrink04'}),
 decision,'SHADOW_NO_BETS_NO_ALERTS').run();
 return {id:a.event_id,stage:a.checkpoint,decision};
}
async function run(env){
 const rule=await env.DB.prepare('SELECT status,auto_bet,auto_notify FROM sb_radar_xcomp_rules_v1 WHERE rule_id=?')
   .bind(RULE).first();
 if(!rule || rule.status!=='RESEARCH_ONLY' || rule.auto_bet!==0 || rule.auto_notify!==0) return;
 // Query only recent source captures. Keep first exact capture per event/checkpoint.
 const insertSql=`INSERT OR IGNORE INTO sb_radar_xcomp_snapshots_v1
 (event_id,checkpoint,fixture,captured_utc,kickoff_utc,period,home_score,away_score,
 p1,px,p2,gh,ga,corners_home,corners_away)
 WITH ranked AS(
 SELECT l.event_id,l.minute,l.fixture,l.captured_utc,l.kickoff_utc,l.period,
 l.home_score,l.away_score,l.p1,l.px,l.p2,l.generosity_home gh,
 l.generosity_away ga,l.home_corners ch,l.away_corners ca,
 ROW_NUMBER() OVER(PARTITION BY l.event_id,l.minute ORDER BY l.captured_utc,l.id) rn
 FROM live_snapshots l
 WHERE l.captured_utc>=? AND l.minute IN (20,30,40,45,50,57)
 AND ((l.minute<=45 AND l.period='R1') OR (l.minute>=50 AND l.period='R2'))
 AND l.p1>1 AND l.px>1 AND l.p2>1
 AND l.generosity_home BETWEEN 0 AND 1 AND l.generosity_away BETWEEN 0 AND 1
 ) SELECT event_id,minute,fixture,captured_utc,kickoff_utc,period,
 home_score,away_score,p1,px,p2,gh,ga,ch,ca FROM ranked WHERE rn=1`;
 const since=isoAgo(180);
 await env.DB.prepare(insertSql).bind(since).run();
 for(const stage of [45,50,57]) await env.DB.prepare(makeVectorSql(stage)).bind(since).run();
 // When delayed ingestion catches older checkpoints, do not reselect already frozen decisions.
 const q=await env.DB.prepare(`
 SELECT v.* FROM sb_radar_xcomp_vectors_v1 v
 LEFT JOIN sb_radar_xcomp_decisions_v1 d ON d.rule_id=? AND d.event_id=v.event_id
  AND d.checkpoint=v.checkpoint
 WHERE d.event_id IS NULL AND v.asof_utc>=?
 ORDER BY v.asof_utc ASC LIMIT 80`).bind(RULE,since).all();
 const results=[];
 for(const a of (q.results||[])){
  try {results.push(await evaluate(env,a));}
  catch(error){console.error('XCOMP candidate failed',a.event_id,a.checkpoint,String(error));}
 }
 console.log('XCOMP shadow',JSON.stringify({processed:results.length,candidates:results.filter(x=>x.decision==='RESEARCH_CANDIDATE').length}));
}
export default {
 async fetch(){return new Response('Not found',{status:404});},
 async scheduled(event,env,ctx){ctx.waitUntil(run(env));}
};
