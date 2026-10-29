
const urlFor=(id,fixture)=>{
 const parts=String(fixture||'').split(/[·•|]/);
 if(parts.length!==2)return 'https://superbet.ro/pariuri-sportive/fotbal/live';
 const slug=s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,110);
 return 'https://superbet.ro/cote/fotbal/'+slug(parts[0])+'-vs-'+slug(parts[1])+'-'+id;
};
export async function radarSnapshot(env){
 const now=new Date(),after=new Date(Date.now()-3*3600000).toISOString();
 const sql="SELECT q.event_id,q.fixture,q.kickoff_utc,q.captured_utc,q.px AS quoted_x,q.last_status,"+
 "s.minute,s.home_score,s.away_score,s.captured_utc AS sample_utc,s.gh,s.ga,s.p1,s.px,s.p2,"+
 "(SELECT z.gh FROM ghost_equal_samples z WHERE z.event_id=q.event_id AND z.minute BETWEEN s.minute-15 AND s.minute-7 AND z.captured_utc>=datetime('now','-25 minutes') ORDER BY ABS(z.minute-(s.minute-10)),z.captured_utc DESC LIMIT 1) AS prior_gh,"+
 "(SELECT z.ga FROM ghost_equal_samples z WHERE z.event_id=q.event_id AND z.minute BETWEEN s.minute-15 AND s.minute-7 AND z.captured_utc>=datetime('now','-25 minutes') ORDER BY ABS(z.minute-(s.minute-10)),z.captured_utc DESC LIMIT 1) AS prior_ga,"+
 "(SELECT z.home_score FROM ghost_equal_samples z WHERE z.event_id=q.event_id AND z.minute BETWEEN s.minute-15 AND s.minute-7 ORDER BY ABS(z.minute-(s.minute-10)) LIMIT 1) AS prior_home,"+
 "(SELECT z.away_score FROM ghost_equal_samples z WHERE z.event_id=q.event_id AND z.minute BETWEEN s.minute-15 AND s.minute-7 ORDER BY ABS(z.minute-(s.minute-10)) LIMIT 1) AS prior_away,"+
 "(SELECT z.stage FROM ghost_equal_alerts z WHERE z.event_id=q.event_id AND z.stage='BET_NOW' LIMIT 1) AS bet_now_stage,"+
 "(SELECT z.triggered_utc FROM ghost_equal_alerts z WHERE z.event_id=q.event_id AND z.stage='BET_NOW' LIMIT 1) AS bet_now_utc,"+
 "(SELECT z.stage FROM ghost_equal_alerts z WHERE z.event_id=q.event_id AND z.stage='PREGATIRE' LIMIT 1) AS prepared_stage "+
 "FROM quote_state q LEFT JOIN ghost_equal_samples s ON s.event_id=q.event_id AND s.minute=(SELECT MAX(z.minute) FROM ghost_equal_samples z WHERE z.event_id=q.event_id) "+
 "WHERE q.settled=0 AND q.kickoff_utc<=? AND q.kickoff_utc>=? ORDER BY q.kickoff_utc DESC LIMIT 90";
 const rows=(await env.DB.prepare(sql).bind(now.toISOString(),after).all()).results||[];
 const radar=rows.map(r=>{
  const minute=r.minute===null?null:Number(r.minute);
  const fresh=!!r.sample_utc&&(Date.now()-Date.parse(r.sample_utc)<210000);
  const hasScore=fresh&&r.home_score!==null&&r.away_score!==null;
  const zero=hasScore&&Number(r.home_score)===0&&Number(r.away_score)===0;
  const history=zero&&r.prior_home===0&&r.prior_away===0&&r.prior_gh!==null&&r.prior_ga!==null;
  const pressure=history&&r.gh!==null&&r.ga!==null&&Number(r.gh)-Number(r.prior_gh)<=-0.009999&&Number(r.ga)-Number(r.prior_ga)<=-0.009999;
  const priced=fresh&&r.p1!==null&&r.px!==null&&r.p2!==null&&Number(r.p1)>=1.8&&Number(r.px)>=1.75&&Number(r.p2)>=1.8;
  const nowAlert=!!r.bet_now_stage && Date.now()-Date.parse(r.bet_now_utc)<900000;
  let stage='TRACK';
  if(hasScore&&!zero)stage='SCORE_OUT';
  else if(nowAlert)stage='BET_NOW';
  else if(fresh&&minute!==null&&minute>=50&&minute<=57)stage='NEAR_57';
  else if(fresh&&minute!==null&&minute>=40&&minute<50)stage='HALFTIME';
  else if(fresh&&minute!==null&&minute>=57)stage='LATE';
  else if(!fresh)stage='WAIT_FEED';
  const steps=[
   {key:'live',label:'În monitorizare',ok:fresh},
   {key:'score',label:'Scor 0–0 confirmat',ok:zero},
   {key:'history',label:'Două capturi 0–0',ok:history},
   {key:'curve',label:'Curbe GHOST eligibile',ok:pressure},
   {key:'odds',label:'Cote validate',ok:priced},
   {key:'minute',label:'Pragul 57+',ok:fresh&&minute>=57}
  ];
  const approx=Math.max(0,Math.floor((Date.now()-Date.parse(r.kickoff_utc))/60000));
  return {event_id:r.event_id,fixture:r.fixture,kickoff_utc:r.kickoff_utc,minute:fresh?minute:null,estimated_minute:fresh?null:approx,score:hasScore?String(r.home_score)+'–'+r.away_score:null,px:fresh?r.px:r.quoted_x,stage,steps,eligible:pressure&&priced&&zero&&fresh,alert:!!r.bet_now_stage,prepared:!!r.prepared_stage,updated_utc:r.sample_utc,url:urlFor(r.event_id,r.fixture),fresh};
 });
 const counts={tracked:radar.length,live:radar.filter(x=>x.fresh).length,nearing:radar.filter(x=>x.stage==='NEAR_57').length,signals:radar.filter(x=>x.stage==='BET_NOW').length,feedFresh:radar.some(x=>x.fresh)};
 return {radar,counts,checked_utc:now.toISOString()};
}
