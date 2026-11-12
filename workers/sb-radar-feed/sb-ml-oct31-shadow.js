// SB RADAR OCT31 ML LOGREG V1 — faithful numerical score, SHADOW ONLY.
// Recovered 2026-11-12 from the 2026-10-31 walk-forward coefficients and
// verified independently against 189 preserved D1 scores (absolute max error < 5e-11).
// Historical accepted() gates had six non-score vetoes in 189 examples; DO NOT
// send betting alerts before the full 31-Oct gate has been recovered and audited.
const MODEL='SB_RADAR_ML_LOGREG_V1';
export const CUTOFF=0.55172;
const n=x=>x===null||x===undefined||x===''?NaN:Number(x);
export function oct31MLScore({px,gh,ga,dh,da}) {
  if(![px,gh,ga,dh,da].every(Number.isFinite)||px<=1||gh<0||ga<0||gh>1||ga>1)return NaN;
  const z=0.08445
   -0.3838*((px-2.2)/0.45)
   -0.28291*((-(dh+da)-0.06)/0.035)
   +0.06037*((Math.abs(gh-ga)-0.17)/0.16)
   -0.0963*((Math.max(gh,ga)-0.4)/0.15);
  return 1/(1+Math.exp(-Math.max(-30,Math.min(30,z))));
}
export async function sampleOct31MLShadow(env){
  const t=new Date().toISOString(),since=new Date(Date.now()-4*60000).toISOString();
  let seen=0,inserted=0,pass=0;
  const errors=[];
  try {
    const rows=(await env.DB.prepare("SELECT s.event_id,s.fixture,s.captured_utc,s.minute,s.home_score,s.away_score,s.p1,s.px,s.p2,s.gh,s.ga FROM ghost_equal_samples s WHERE s.captured_utc>=? AND s.minute BETWEEN 57 AND 59 AND s.home_score=s.away_score AND s.home_score IS NOT NULL AND s.p1>1 AND s.px>1 AND s.p2>1 AND s.gh BETWEEN 0 AND 1 AND s.ga BETWEEN 0 AND 1 AND NOT EXISTS(SELECT 1 FROM ghost_equal_red_exclusions r WHERE r.event_id=s.event_id) AND NOT EXISTS(SELECT 1 FROM sb_radar_oct31_ml_shadow_v1 m WHERE m.event_id=s.event_id) ORDER BY s.captured_utc ASC LIMIT 80").bind(since).all()).results||[];
    const unique=new Set();
    for(const row of rows){
      const id=Number(row.event_id),minute=n(row.minute);
      if(unique.has(id))continue;unique.add(id);seen++;
      const prior=await env.DB.prepare("SELECT minute,home_score,away_score,gh,ga,captured_utc FROM ghost_equal_samples WHERE event_id=? AND minute BETWEEN ? AND ? AND captured_utc<=? AND captured_utc>=? ORDER BY ABS(minute-?),captured_utc DESC LIMIT 1")
       .bind(id,minute-15,minute-7,row.captured_utc,new Date(Date.parse(row.captured_utc)-20*60000).toISOString(),minute-10).first();
      if(!prior||prior.home_score!==row.home_score||prior.away_score!==row.away_score)continue;
      const gh=n(row.gh),ga=n(row.ga),dh=gh-n(prior.gh),da=ga-n(prior.ga),px=n(row.px);
      const score=oct31MLScore({px,gh,ga,dh,da});
      if(!Number.isFinite(score)||!Number.isFinite(dh)||!Number.isFinite(da))continue;
      const selected=score>=CUTOFF?1:0;
      const save=await env.DB.prepare("INSERT OR IGNORE INTO sb_radar_oct31_ml_shadow_v1(event_id,fixture,captured_utc,minute,home_score,away_score,p1,px,p2,gh,ga,dh,da,ml_score,ml_cutoff,score_pass,model_version,source) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
       .bind(id,row.fixture||'',row.captured_utc,minute,row.home_score,row.away_score,row.p1,px,row.p2,gh,ga,dh,da,score,CUTOFF,selected,MODEL,'RECONSTRUCTED_OCT31_SHADOW').run();
      if(Number(save.meta?.changes||0)>0){inserted++;pass+=selected;}
    }
  }catch(e){errors.push(String(e).slice(0,220));console.warn('ML_OCT31_SHADOW',String(e).slice(0,180));}
  if(seen||errors.length||new Date().getUTCMinutes()%5===0)try{
   await env.DB.prepare("INSERT INTO sb_radar_oct31_ml_shadow_runs_v1(checked_utc,candidates,inserted,above_cutoff,errors) VALUES(?,?,?,?,?)")
   .bind(t,seen,inserted,pass,errors.join(' | ')||null).run();
  }catch(e){console.warn('ML_OCT31_SHADOW_LOG',String(e).slice(0,180))}
  return {checked_utc:t,seen,inserted,score_pass:pass,errors};
}
