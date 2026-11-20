// X57 COREA PATTERN v1 — independent watch-and-notify; NEVER inserts into bets/ghost_equal_alerts.
const MODEL='X57_COREA_PATTERN';
const SOURCE='SB_RADAR_X57_COREA_V1';
const n=x=>x===null||x===undefined||x===''?NaN:Number(x);
const rounded=x=>Math.round((n(x)+Number.EPSILON)*100)/100;
function freshRed(s){
 try{
  const raw=JSON.parse(s||'{}');
  const o=raw.stats||raw.inplay_stats||raw;
  return n(o.home_team_red_cards||0)>0||n(o.away_team_red_cards||0)>0;
 }catch{return false;}
}
const isZero=q=>Number(q.home_score)===0&&Number(q.away_score)===0;
function exact(q,r){
 if(!r||!isZero(q)||freshRed(q.stats_json))return false;
 const x45=rounded(r.px),x=rounded(q.px),p1=rounded(q.p1),p2=rounded(q.p2),gh=n(q.generosity_home),ga=n(q.generosity_away);
 return x45>=1.80&&x45<=1.95&&x>=1.65&&x<=1.85&&x<=x45-0.07+1e-8&&p1>=3.70&&p1<=4.60&&p2>=3.10&&p2<=4.20&&gh>=.18&&gh<=.24&&ga>=.22&&ga<=.29&&gh<ga;
}
function why(q,r){
 const reasons=[];if(!r){reasons.push('NO_R1_45');return reasons.join(';');}
 const x45=rounded(r.px),x=rounded(q.px),p1=rounded(q.p1),p2=rounded(q.p2),gh=n(q.generosity_home),ga=n(q.generosity_away);
 if(!(x45>=1.80&&x45<=1.95))reasons.push('PX45_OUT');
 if(!(x>=1.65&&x<=1.85))reasons.push('PX57_OUT');
 if(!(x<=x45-.07+1e-8))reasons.push('DROP_X_LT_0_07');
 if(!(p1>=3.70&&p1<=4.60))reasons.push('P1_OUT');
 if(!(p2>=3.10&&p2<=4.20))reasons.push('P2_OUT');
 if(!(gh>=.18&&gh<=.24))reasons.push('GH_OUT');
 if(!(ga>=.22&&ga<=.29))reasons.push('GA_OUT');
 if(!(gh<ga))reasons.push('GH_NOT_BELOW_GA');
 if(freshRed(q.stats_json))reasons.push('RED_CARD');
 return reasons.join(';')||'PASS';
}
async function addSignal(env,q,r,stage,reason){
 const sql="INSERT OR IGNORE INTO sb_radar_x57_live_signals_v1(event_id,stage,fixture,minute,period,captured_utc,px45,p1,px,p2,gh,ga,reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)";
 const v=await env.DB.prepare(sql).bind(Number(q.event_id),stage,String(q.fixture||r?.fixture||'Meci').slice(0,240),Number(q.minute),String(q.period),String(q.captured_utc),r?rounded(r.px):null,Number.isFinite(n(q.p1))?n(q.p1):null,Number.isFinite(n(q.px))?n(q.px):null,Number.isFinite(n(q.p2))?n(q.p2):null,Number.isFinite(n(q.generosity_home))?n(q.generosity_home):null,Number.isFinite(n(q.generosity_away))?n(q.generosity_away):null,reason||null).run();
 return Number(v.meta?.changes||0)===1;
}
function chooseBest(a,b){
 if(!a)return b;
 const da=Math.abs(Number(a.minute)-57),db=Math.abs(Number(b.minute)-57);
 if(db<da)return b;
 if(db>da)return a;
 return String(b.captured_utc)>String(a.captured_utc)?b:a;
}
export async function x57Tick(env,helper){
 const cfg=await env.DB.prepare("SELECT enabled,half_alert,confirm_alert,activated_utc FROM sb_radar_x57_config_v1 WHERE id=1").first();
 if(Number(cfg?.enabled)!==1)return {enabled:false};
 const cutoff=new Date(Date.now()-160000).toISOString();
 const since=cfg.activated_utc>cutoff?cfg.activated_utc:cutoff;
 const frames=(await env.DB.prepare("SELECT event_id,fixture,captured_utc,period,minute,home_score,away_score,p1,px,p2,generosity_home,generosity_away,stats_json FROM live_snapshots WHERE captured_utc>=? AND ((period='P' AND minute=45) OR (period='R2' AND minute BETWEEN 56 AND 58)) AND home_score=0 AND away_score=0 ORDER BY captured_utc DESC LIMIT 700").bind(since).all()).results||[];
 const half=new Map(),late=new Map();
 for(const q of frames){
  const id=Number(q.event_id);
  if(q.period==='P'&&!half.has(id))half.set(id,q);
  else if(q.period==='R2')late.set(id,chooseBest(late.get(id),q));
 }
 const ids=[...new Set([...half.keys(),...late.keys()])];
 if(ids.length===0)return {enabled:true,found:0};
 const sql="SELECT event_id,fixture,captured_utc,minute,period,home_score,away_score,px,p1,p2,stats_json FROM live_snapshots WHERE event_id IN ("+ids.map(()=>'?').join(',')+") AND period='R1' AND minute=45 AND home_score=0 AND away_score=0 AND px>1 ORDER BY captured_utc DESC LIMIT 500";
 const priors=(await env.DB.prepare(sql).bind(...ids).all()).results||[];
 const r1=new Map();for(const x of priors)if(!r1.has(Number(x.event_id)))r1.set(Number(x.event_id),x);
 let candidates=0,confirmed=0,rejected=0;
 if(Number(cfg.half_alert)===1){
  for(const [id,q] of half){
   const r=r1.get(id);if(!r||freshRed(q.stats_json)||freshRed(r.stats_json))continue;
   const x45=rounded(r.px),xp=rounded(q.px),p1=rounded(q.p1),p2=rounded(q.p2);
   if(x45>=1.80&&x45<=1.95&&xp>1&&xp<=1.95&&p1>=2.8&&p2>=2.8&&Number.isFinite(n(q.generosity_home))&&Number.isFinite(n(q.generosity_away))){
    if(await addSignal(env,q,r,'X57_HALF','PRELIMINARY_ONLY'))candidates++;
   }
  }
 }
 // Never confirm on an unverified period, zero score is mandatory in the decisive frame.
 for(const [id,q] of late){
  const r=r1.get(id);
  if(exact(q,r)){
   if(Number(cfg.confirm_alert)===1&&await addSignal(env,q,r,'X57_CONFIRM','PASS'))confirmed++;
  }else if(Number(q.minute)>=58){
   // A rejected preliminary candidate is informational only; it is not a LOSS.
   const existing=await env.DB.prepare("SELECT stage FROM sb_radar_x57_live_signals_v1 WHERE event_id=? AND stage IN ('X57_HALF','X57_CONFIRM')").bind(id).all();
   const stages=(existing.results||[]).map(x=>x.stage);
   if(stages.includes('X57_HALF')&&!stages.includes('X57_CONFIRM')){
    if(await addSignal(env,q,r,'X57_REJECT',why(q,r)))rejected++;
   }
  }
 }
 // FCM sends are separate from betting: never use BET_NOW or any ML/Golden source.
 if(!env.FIREBASE_SERVICE_ACCOUNT_JSON)return {enabled:true,candidates,confirmed,rejected,reason:'firebase_missing'};
 const ready=(await env.DB.prepare("SELECT event_id,stage,fixture,minute,px45,px,gh,ga,created_utc FROM sb_radar_x57_live_signals_v1 WHERE stage IN ('X57_HALF','X57_CONFIRM') AND created_utc>=? ORDER BY created_utc DESC LIMIT 100").bind(new Date(Date.now()-11*60000).toISOString()).all()).results||[];
 if(!ready.length)return {enabled:true,candidates,confirmed,rejected,events:0};
 const devices=(await env.DB.prepare("SELECT device_id,fcm_token FROM sb_radar_fcm_registry WHERE fcm_token IS NOT NULL AND length(fcm_token)>20 AND updated_utc>=? LIMIT 40").bind(new Date(Date.now()-30*86400000).toISOString()).all()).results||[];
 if(!devices.length)return {enabled:true,candidates,confirmed,rejected,events:ready.length,devices:0};
 let token=null,sa=null,sent=0,failed=0;
 for(const a of ready){
  if(a.stage==='X57_HALF'&&Number(cfg.half_alert)!==1)continue;
  if(a.stage==='X57_CONFIRM'&&Number(cfg.confirm_alert)!==1)continue;
  for(const d of devices){
   const claim=await env.DB.prepare("INSERT INTO sb_radar_fcm_sent(device_id,event_id,stage,source,status,attempts,updated_utc) VALUES(?,?,?,?,'sending',1,datetime('now')) ON CONFLICT(device_id,event_id,stage) DO UPDATE SET status='sending',attempts=sb_radar_fcm_sent.attempts+1,updated_utc=datetime('now') WHERE sb_radar_fcm_sent.status='failed' AND sb_radar_fcm_sent.attempts<3")
    .bind(d.device_id,Number(a.event_id),a.stage,SOURCE).run();
   if(Number(claim.meta?.changes||0)!==1)continue;
   try{
    if(!token){sa=helper.parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT_JSON);token=await helper.getAccessToken(sa);}
    const isConfirm=a.stage==='X57_CONFIRM';
    const data={
     event_id:String(a.event_id),stage:a.stage,signal_label:'X57 COREA',
     signal_type:'X57_COREA',model_version:MODEL,fixture:String(a.fixture||'Meci'),
     minute:String(a.minute),home_score:'0',away_score:'0',
     px:String(a.px??''),px45:String(a.px45??''),gh:String(a.gh??''),ga:String(a.ga??''),
     triggered_utc:String(a.created_utc),experimental:'true',full_screen:isConfirm?'true':'false',
     title:isConfirm?'🧬 X57 COREA · CONFIRMAT 57′':'🧬 X57 COREA · CANDIDAT PAUZĂ',
     body:isConfirm?'Filtru experimental confirmat • X la 90′ • verifică prețul':'Doar candidat preliminar • urmărește Road to 57',
     no_auto_bet:'true'
    };
    await helper.sendFcm(env,sa,token,d,data);
    await env.DB.prepare("UPDATE sb_radar_fcm_sent SET status='sent',updated_utc=datetime('now') WHERE device_id=? AND event_id=? AND stage=?").bind(d.device_id,Number(a.event_id),a.stage).run();
    sent++;
   }catch(e){
    failed++;
    console.error('SB_X57_FCM',String(e).slice(0,160));
    await env.DB.prepare("UPDATE sb_radar_fcm_sent SET status='failed',updated_utc=datetime('now') WHERE device_id=? AND event_id=? AND stage=?").bind(d.device_id,Number(a.event_id),a.stage).run();
   }
  }
 }
 return {enabled:true,candidates,confirmed,rejected,events:ready.length,devices:devices.length,sent,failed};
}
