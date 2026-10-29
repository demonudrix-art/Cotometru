
const urlFor=(id,fixture)=>{
 const parts=String(fixture||'').split(/[·•|]/);
 if(parts.length!==2)return 'https://superbet.ro/pariuri-sportive/fotbal/live';
 const slug=s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,110);
 return 'https://superbet.ro/cote/fotbal/'+slug(parts[0])+'-vs-'+slug(parts[1])+'-'+id;
};
export async function radarSnapshot(env){
 const now=new Date(),after=new Date(Date.now()-5*3600000).toISOString();
 const sql="SELECT q.event_id,q.fixture,q.kickoff_utc,q.captured_utc,q.px AS quoted_x,q.last_status,q.settled AS is_settled,r.event_status AS result_status,r.verified AS result_verified,"+
 "s.minute,s.home_score,s.away_score,s.captured_utc AS sample_utc,s.gh,s.ga,s.p1,s.px,s.p2,"+
 "(SELECT z.gh FROM ghost_equal_samples z WHERE z.event_id=q.event_id AND z.minute BETWEEN s.minute-15 AND s.minute-7 AND datetime(z.captured_utc)>=datetime('now','-25 minutes') ORDER BY ABS(z.minute-(s.minute-10)),z.captured_utc DESC LIMIT 1) AS prior_gh,"+
 "(SELECT z.ga FROM ghost_equal_samples z WHERE z.event_id=q.event_id AND z.minute BETWEEN s.minute-15 AND s.minute-7 AND datetime(z.captured_utc)>=datetime('now','-25 minutes') ORDER BY ABS(z.minute-(s.minute-10)),z.captured_utc DESC LIMIT 1) AS prior_ga,"+
 "(SELECT z.home_score FROM ghost_equal_samples z WHERE z.event_id=q.event_id AND z.minute BETWEEN s.minute-15 AND s.minute-7 AND datetime(z.captured_utc)>=datetime('now','-25 minutes') ORDER BY ABS(z.minute-(s.minute-10)) LIMIT 1) AS prior_home,"+
 "(SELECT z.away_score FROM ghost_equal_samples z WHERE z.event_id=q.event_id AND z.minute BETWEEN s.minute-15 AND s.minute-7 AND datetime(z.captured_utc)>=datetime('now','-25 minutes') ORDER BY ABS(z.minute-(s.minute-10)) LIMIT 1) AS prior_away,"+
 "(SELECT z.stage FROM ghost_equal_alerts z WHERE z.event_id=q.event_id AND z.stage='BET_NOW' LIMIT 1) AS bet_now_stage,"+
 "(SELECT z.triggered_utc FROM ghost_equal_alerts z WHERE z.event_id=q.event_id AND z.stage='BET_NOW' LIMIT 1) AS bet_now_utc,"+
 "(SELECT z.stage FROM ghost_equal_alerts z WHERE z.event_id=q.event_id AND z.stage='PREGATIRE' LIMIT 1) AS prepared_stage "+
 "FROM quote_state q LEFT JOIN match_results r ON r.event_id=q.event_id LEFT JOIN ghost_equal_samples s ON s.event_id=q.event_id AND s.minute=(SELECT MAX(z.minute) FROM ghost_equal_samples z WHERE z.event_id=q.event_id) "+
 "WHERE q.kickoff_utc<=? AND q.kickoff_utc>=? ORDER BY q.kickoff_utc DESC LIMIT 160";
 const rows=(await env.DB.prepare(sql).bind(now.toISOString(),after).all()).results||[];
 const radar=rows.map(r=>{
  const minute=r.minute===null?null:Number(r.minute);
  const fresh=!!r.sample_utc&&(Date.now()-Date.parse(r.sample_utc)<210000);
  const hasScore=fresh&&r.home_score!==null&&r.away_score!==null;
  const tied=hasScore&&Number(r.home_score)===Number(r.away_score);
  const history=tied&&r.prior_home!==null&&r.prior_away!==null&&Number(r.prior_home)===Number(r.home_score)&&Number(r.prior_away)===Number(r.away_score)&&r.prior_gh!==null&&r.prior_ga!==null;
  const pressure=history&&r.gh!==null&&r.ga!==null&&Number(r.gh)-Number(r.prior_gh)<=-0.009999&&Number(r.ga)-Number(r.prior_ga)<=-0.009999;
  const priced=fresh&&r.p1!==null&&r.px!==null&&r.p2!==null&&Number(r.p1)>=1.8&&Number(r.px)>=1.75&&Number(r.p2)>=1.8;
  const nowAlert=!!r.bet_now_stage && Date.now()-Date.parse(r.bet_now_utc)<900000;
  const ageMin=Number.isFinite(Date.parse(r.kickoff_utc))?(Date.now()-Date.parse(r.kickoff_utc))/60000:0;
  const sampleAgeMin=Number.isFinite(Date.parse(r.sample_utc))?(Date.now()-Date.parse(r.sample_utc))/60000:Infinity;
  const finished=Number(r.is_settled)===1||(Number(r.result_verified)===1&&String(r.result_status).toUpperCase()==='FINISHED');
  let stage='TRACK';
  if(hasScore&&!tied)stage='SCORE_OUT';
  else if(nowAlert)stage='BET_NOW';
  else if(fresh&&minute!==null&&minute>=50&&minute<=57)stage='NEAR_57';
  else if(fresh&&minute!==null&&minute>=40&&minute<50)stage='HALFTIME';
  else if(fresh&&minute!==null&&minute>=57)stage='LATE';
  else if(!fresh)stage='WAIT_FEED';
  const steps=[
   {key:'live',label:'În monitorizare',ok:fresh},
   {key:'score',label:'Scor egal confirmat',ok:tied},
   {key:'history',label:'Același scor egal acum ~10 min',ok:history},
   {key:'curve',label:'Curbe GHOST eligibile',ok:pressure},
   {key:'odds',label:'Cote validate',ok:priced},
   {key:'minute',label:'Pragul 57+',ok:fresh&&minute>=57}
  ];
  const approx=Math.max(0,Math.floor(ageMin));
  // Lifecycle affects VISIBILITY only. The independent live scanner still evaluates
  // every candidate through minute 78; parked matches can return to the main radar.
  let bucket='ACTIVE',reason='În radar';
  if(finished){bucket='ARCHIVED';reason='Meci încheiat / rezultat verificat'}
  else if(minute!==null&&minute>=78 && sampleAgeMin>12){bucket='ARCHIVED';reason='Fereastra GHOST închisă (min. 78)'}
  else if(ageMin>175&&(!fresh||minute===null)){bucket='ARCHIVED';reason='Fereastra de monitorizare depășită'}
  else if(minute!==null&&minute>=70&&sampleAgeMin>22){bucket='ARCHIVED';reason='Fără actualizări după finalul ferestrei utile'}
  else if(nowAlert){bucket='ACTIVE';reason='Semnal BET NOW recent'}
  else if(!fresh){bucket='WATCH';reason=minute===null?'Se așteaptă primul semnal live':'Date LIVE întârziate; încă monitorizat'}
  else if(!tied){bucket='WATCH';reason='Scor neegal; se poate întoarce la egal'}
  else if(minute!==null&&minute>=57&&!pressure){bucket='WATCH';reason='Minut 57+; curbele nu confirmă încă'}
  else if(minute!==null&&minute>=57&&!priced){bucket='WATCH';reason='Minut 57+; cotele nu confirmă încă'}
  else if(minute!==null&&minute>=57){bucket='ACTIVE';reason='GHOST candidat: verificare BET NOW'}
  else{bucket='ACTIVE';reason=minute>=50?'Apropiere de minutul 57':'Scor egal în monitorizare'}
  return {event_id:r.event_id,fixture:r.fixture,kickoff_utc:r.kickoff_utc,minute:fresh?minute:null,last_observed_minute:minute,estimated_minute:fresh?null:approx,score:hasScore?String(r.home_score)+'–'+r.away_score:null,px:fresh?r.px:r.quoted_x,stage,steps,eligible:pressure&&priced&&tied&&fresh,alert:!!r.bet_now_stage,prepared:!!r.prepared_stage,updated_utc:r.sample_utc,url:urlFor(r.event_id,r.fixture),fresh,bucket,reason,result_verified:finished&&Number(r.result_verified)===1};
 });
 const priority=x=>x.stage==='BET_NOW'?1e5:(x.eligible?8e4:0)+(x.fresh?1e4:0)+(Math.min(57,x.minute||0)*10);
 const active=radar.filter(x=>x.bucket==='ACTIVE').sort((a,b)=>priority(b)-priority(a));
 const watchlist=radar.filter(x=>x.bucket==='WATCH').sort((a,b)=>(b.last_observed_minute||0)-(a.last_observed_minute||0));
 const archived=radar.filter(x=>x.bucket==='ARCHIVED').sort((a,b)=>Date.parse(b.updated_utc||b.kickoff_utc)-Date.parse(a.updated_utc||a.kickoff_utc));
 const counts={tracked:active.length,live:active.filter(x=>x.fresh).length,nearing:active.filter(x=>x.stage==='NEAR_57').length,signals:active.filter(x=>x.stage==='BET_NOW').length,watching:watchlist.length,archived:archived.length,total:radar.length,feedFresh:active.some(x=>x.fresh)};
 return {radar:active.slice(0,55),watchlist:watchlist.slice(0,45),archived:archived.slice(0,30),counts,checked_utc:now.toISOString()};
}
