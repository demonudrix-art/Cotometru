/* SB Radar Chrome Bridge — server-side device registry and safe coordination.
   All device identity/authorization lives in Cloudflare D1. */
const now=()=>new Date().toISOString();
const reply=(data,status=200,ext=false)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(ext?{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'}:{})}});
const err=(error,status=400,ext=false)=>reply({ok:false,error},status,ext);
async function digest(text){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');}
function randomToken(len=32){const buf=crypto.getRandomValues(new Uint8Array(len));return Array.from(buf,b=>b.toString(16).padStart(2,'0')).join('');}
function sameOrigin(req){const u=new URL(req.url);return req.headers.get('Origin')===u.origin;}
function isId(t){return /^[A-Za-z0-9_-]{24,96}$/.test(String(t||''));}
async function read(req){try{return await req.json()}catch{return {};}}
function licenseValid(x){return !!x&&x.license_status==='ACTIVE'&&!!x.expires_utc&&Date.parse(x.expires_utc)>Date.now();}
async function validDevice(req,env){
 const id=String(req.headers.get('X-SBR-Device')||'');
 const t=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
 if(!isId(id)||!/^[a-f0-9]{64}$/.test(t))return null;
 const hash=await digest(t);
 return await env.DB.prepare("SELECT d.device_id,d.owner_username,d.display_name,d.pairing_status,d.enabled,d.superbet_session_ok,l.status AS license_status,l.expires_utc,l.monthly_price_lei,l.billing_cycle,l.plan_name FROM sb_radar_chrome_devices_v1 d JOIN sb_radar_chrome_auth_v1 a ON d.device_id=a.device_id LEFT JOIN sb_radar_chrome_licenses_v1 l ON l.device_id=d.device_id WHERE d.device_id=? AND a.token_hash=?").bind(id,hash).first();
}
async function admin(req,env,authenticated){
 if(!(await authenticated(req,env)))return err('Acces doar administrator',401);
 if(req.method!=='GET'&&!sameOrigin(req))return err('Origine invalidă',403);
 return null;
}
const stateRow=async env=>await env.DB.prepare("SELECT value FROM sb_radar_chrome_bridge_settings_v1 WHERE key='execution_enabled'").first();
async function state(env){
 const total=await env.DB.prepare("SELECT COUNT(*) total,COALESCE(SUM(CASE WHEN pairing_status='active' AND enabled=1 AND datetime(last_heartbeat_utc)>=datetime('now','-50 seconds') THEN 1 ELSE 0 END),0) online,COALESCE(SUM(CASE WHEN pairing_status='pending' THEN 1 ELSE 0 END),0) pending FROM sb_radar_chrome_devices_v1").first();
 return {total:total?.total||0,online:total?.online||0,pending:total?.pending||0,execution_enabled:(await stateRow(env))?.value==='true'};
}
async function event(env,kind,deviceId=null,eventId=null,desc=''){
 await env.DB.prepare("INSERT INTO sb_radar_chrome_events_v1(kind,device_id,event_id,description) VALUES(?,?,?,?)").bind(kind,deviceId,eventId,String(desc).slice(0,300)).run();
}
export async function chromeBridgeApi(req,env,path,authenticated){
 const isExtension=!path.includes('/admin/');
 if(req.method==='OPTIONS'&&isExtension)return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization, X-SBR-Device, Content-Type','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Max-Age':'600'}});
 try{
 if(path==='/api/chrome/register'&&req.method==='POST'){
  const j=await read(req),user=String(j.username||'').trim().toLowerCase(),mail=String(j.email||'').trim().toLowerCase(),id=String(j.device_id||''),token=String(j.token||''),name=String(j.display_name||'').trim().slice(0,70);
  if(!isId(id)||!/^[a-f0-9]{64}$/.test(token)||!name||name.length<2)return err('Date dispozitiv invalide',400,true);
  const a=await env.DB.prepare('SELECT username,email FROM sb_admin WHERE id=1').first();
  if(!a||user!==String(a.username).toLowerCase()||mail!==String(a.email||'').toLowerCase())return err('Cont SB Radar nerecunoscut',403,true);
  const old=await env.DB.prepare("SELECT pairing_status FROM sb_radar_chrome_devices_v1 WHERE device_id=?").bind(id).first();
  if(old)return err('Acest identificator este deja înregistrat. Verifică asocierea.',409,true);
  const cnt=await env.DB.prepare("SELECT COUNT(*) n FROM sb_radar_chrome_devices_v1 WHERE pairing_status='pending' AND owner_username=?").bind(user).first();
  if(Number(cnt?.n||0)>=12)return err('Prea multe cereri în așteptare',429,true);
  const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%900000+100000);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO sb_radar_chrome_devices_v1(device_id,owner_username,owner_email,display_name,pairing_status,enabled,install_version) VALUES(?,?,?,?,'pending',0,?)").bind(id,user,mail,name,String(j.version||'').slice(0,25)),
    env.DB.prepare('INSERT INTO sb_radar_chrome_auth_v1(device_id,token_hash,approval_code_hash,approval_expires_utc,registered_utc) VALUES(?,?,?,?,?)').bind(id,await digest(token),await digest(code),new Date(Date.now()+20*60000).toISOString(),now())
  ]);
  await event(env,'PAIR_REQUEST',id,null,name);
  return reply({ok:true,device_id:id,pairing_status:'pending',approval_code:code,approval_expires_minutes:20},200,true);
 }
 if(path==='/api/chrome/device'&&req.method==='GET'){
  const d=await validDevice(req,env);if(!d)return err('Cheie dispozitiv invalidă',401,true);
  return reply({ok:true,device_id:d.device_id,display_name:d.display_name,pairing_status:d.pairing_status,enabled:!!d.enabled,license_active:licenseValid(d),license_status:d.license_status||'NONE',license_expires_utc:d.expires_utc||null,license_plan:d.plan_name||null,execution_enabled:(await stateRow(env))?.value==='true'&&licenseValid(d)},200,true);
 }
 if(path==='/api/chrome/heartbeat'&&req.method==='POST'){
  const d=await validDevice(req,env);if(!d)return err('Cheie dispozitiv invalidă',401,true);
  if(d.pairing_status!=='active'||!d.enabled)return err('Dispozitiv neaprobat sau revocat',403,true);
  const j=await read(req);
  await env.DB.prepare('UPDATE sb_radar_chrome_devices_v1 SET last_heartbeat_utc=?,superbet_session_ok=?,last_error=?,install_version=? WHERE device_id=?').bind(now(),j.superbet_session_ok===true?1:0,String(j.last_error||'').slice(0,220),String(j.version||'').slice(0,25),d.device_id).run();
  return reply({ok:true,server_utc:now(),license_active:licenseValid(d),license_status:d.license_status||'NONE',license_expires_utc:d.expires_utc||null,execution_enabled:(await stateRow(env))?.value==='true'&&licenseValid(d)},200,true);
 }

 if(path==='/api/chrome/job'&&req.method==='GET'){
  const d=await validDevice(req,env);
  if(!d)return err('Cheie dispozitiv invalidă',401,true);
  if(d.pairing_status!=='active'||!d.enabled)return err('Calculator neaprobat',403,true);
  if(!licenseValid(d))return reply({ok:true,job:null,reason:'LICENSE_INACTIVE'},200,true);
  if((await stateRow(env))?.value!=='true')return reply({ok:true,job:null,reason:'AUTO_DISABLED'},200,true);
  const raw=(await env.DB.prepare("SELECT a.event_id,a.fixture,a.triggered_utc,a.minute,a.home_score,a.away_score,a.gh,a.ga,a.dgh10,a.dga10,a.px FROM ghost_equal_alerts a WHERE a.stage='BET_NOW' AND a.source='SB_RADAR_GOLDEN_V2' AND a.minute=57 AND a.home_score=0 AND a.away_score=0 AND a.gh>=0.28 AND a.gh<0.30 AND a.ga>=0 AND a.ga<0.30 AND a.dgh10<=-0.009999 AND a.dga10<=-0.009999 AND a.px>1 AND datetime(a.triggered_utc)>=datetime('now','-100 seconds') AND NOT EXISTS(SELECT 1 FROM ghost_equal_red_exclusions e WHERE e.event_id=a.event_id) ORDER BY a.triggered_utc DESC LIMIT 12").all()).results||[];
  for(const a of raw){
   const eventId=String(a.event_id),purple=Number(a.px)>=2.05&&Number(a.px)<2.15;
   const blocked=await env.DB.prepare("SELECT 1 FROM sb_radar_slip_guard_v1 WHERE owner_username=? AND event_key=? LIMIT 1").bind(d.owner_username,'event:'+eventId).first();
   if(blocked)continue;
   const category=purple?'strong-silver':'strong',stake=purple?75:50;
   await env.DB.prepare("INSERT OR IGNORE INTO sb_radar_chrome_execution_claims_v1(owner_username,event_id,fixture,market,selection,signal_category,stake_lei,state,signal_utc,odd_x) VALUES(?, ?, ?,'FINAL','X',? ,? ,'pending',?,?)").bind(d.owner_username,eventId,a.fixture,category,stake,a.triggered_utc,a.px).run();
  }
  // Atomic acquisition: only one device can lease a pending/expired unsubmitted job.
  const leaseRows=(await env.DB.prepare("UPDATE sb_radar_chrome_execution_claims_v1 SET device_id=?,state='leased',lease_expires_utc=datetime('now','+90 seconds'),updated_utc=? WHERE rowid=(SELECT rowid FROM sb_radar_chrome_execution_claims_v1 WHERE owner_username=? AND ((state='pending') OR (state IN ('leased','preparing') AND datetime(lease_expires_utc)<datetime('now'))) AND datetime(created_utc)>=datetime('now','-4 minutes') ORDER BY created_utc ASC LIMIT 1) RETURNING event_id,fixture,signal_category,stake_lei,odd_x,lease_expires_utc,client_ref").bind(d.device_id,now(),d.owner_username).all()).results||[];
  const leased=leaseRows[0]||null;
  if(!leased)return reply({ok:true,job:null,reason:'QUEUE_EMPTY'},200,true);
  const key='event:'+leased.event_id;
  let ref=leased.client_ref;
  if(!ref){ref=crypto.randomUUID();await env.DB.prepare("UPDATE sb_radar_chrome_execution_claims_v1 SET client_ref=? WHERE owner_username=? AND event_id=? AND device_id=? AND state='leased' AND client_ref IS NULL").bind(ref,d.owner_username,leased.event_id,d.device_id).run();}
  const guard=await env.DB.prepare("INSERT OR IGNORE INTO sb_radar_slip_guard_v1(owner_username,event_key,market,selection,client_ref,source,device_id) VALUES(?,?,'MATCH','ANY',?,'chrome',?)").bind(d.owner_username,key,ref,d.device_id).run();
  if(!Number(guard.meta?.changes||0)){
   const exists=await env.DB.prepare("SELECT source,client_ref FROM sb_radar_slip_guard_v1 WHERE owner_username=? AND event_key=?").bind(d.owner_username,key).first();
   if(!(exists?.source==='chrome'&&exists?.client_ref===ref)){
    await env.DB.prepare("UPDATE sb_radar_chrome_execution_claims_v1 SET state='cancelled',failure_reason='SLIP_DUPLICATE',updated_utc=? WHERE owner_username=? AND event_id=? AND device_id=? AND state='leased'").bind(now(),d.owner_username,leased.event_id,d.device_id).run();
    return reply({ok:true,job:null,reason:'DUPLICATE_GUARD'},200,true);
   }
  }
  await event(env,'JOB_LEASED',d.device_id,leased.event_id);
  return reply({ok:true,job:{event_id:leased.event_id,fixture:leased.fixture,category:leased.signal_category,stake_lei:leased.stake_lei,odd_x:leased.odd_x,lease_expires_utc:leased.lease_expires_utc,selection:'X',market:'FINAL'}},200,true);
 }
 if(path==='/api/chrome/submit-started'&&req.method==='POST'){
  const d=await validDevice(req,env);if(!d||d.pairing_status!=='active'||!d.enabled||!licenseValid(d))return err('Dispozitiv sau licență nevalidă',403,true);
  if((await stateRow(env))?.value!=='true')return err('Execuția automată este oprită',409,true);
  const j=await read(req),id=String(j.event_id||'');
  if(!/^\d{4,20}$/.test(id))return err('Eveniment invalid',400,true);
  const r=await env.DB.prepare("UPDATE sb_radar_chrome_execution_claims_v1 SET state='submitting',updated_utc=? WHERE owner_username=? AND event_id=? AND device_id=? AND state IN ('leased','preparing') AND datetime(lease_expires_utc)>datetime('now')").bind(now(),d.owner_username,id,d.device_id).run();
  if(Number(r.meta?.changes||0)!==1)return err('Lease expirat sau rezervat de alt executor; nu trimite pariul',409,true);
  await event(env,'BOOKMAKER_SUBMITTING',d.device_id,id);
  return reply({ok:true,state:'submitting'},200,true);
 }
 if(path==='/api/chrome/confirm'&&req.method==='POST'){
  const d=await validDevice(req,env);if(!d||d.pairing_status!=='active'||!d.enabled||!licenseValid(d))return err('Dispozitiv sau licență nevalidă',403,true);
  const j=await read(req),eventId=String(j.event_id||''),ticket=String(j.bookmaker_ticket_id||'').trim(),odds=Number(j.odds),evidence=String(j.evidence||'').trim();
  if(!/^\d{4,20}$/.test(eventId)||!/^[A-Za-z0-9_-]{5,100}$/.test(ticket)||!Number.isFinite(odds)||odds<1.001||odds>10000||!['SUPERBET_ACCEPTED_TICKET','SUPERBET_MY_BETS_CONFIRMED'].includes(evidence))return err('Lipsește ID-ul de bilet și dovada acceptării Superbet',400,true);
  const claim=await env.DB.prepare("SELECT event_id,fixture,stake_lei,signal_category,state,bookmaker_ticket_id,client_ref FROM sb_radar_chrome_execution_claims_v1 WHERE owner_username=? AND event_id=? AND device_id=?").bind(d.owner_username,eventId,d.device_id).first();
  if(!claim)return err('Sarcină inexistentă la acest calculator',404,true);
  if(claim.state==='placed'&&claim.bookmaker_ticket_id===ticket)return reply({ok:true,duplicate:true,state:'placed'},200,true);
  if(!['submitting','unknown'].includes(claim.state))return err('Confirmarea este permisă numai după trimiterea reală a pariului',409,true);
  const owner=await env.DB.prepare("SELECT p.device_id FROM sb_device_profiles p JOIN sb_admin a ON p.username=a.username AND a.id=1 JOIN ghost_equal_mobile_devices m ON m.device_id=p.device_id AND m.blocked=0 ORDER BY (SELECT COUNT(*) FROM ghost_equal_bets b WHERE b.device_id=p.device_id) DESC LIMIT 1").first();
  if(!owner)return err('Nu există dispozitiv Slip Admin pentru sincronizare',503,true);
  const ref=String(claim.client_ref||crypto.randomUUID()),at=now();
  try{
   await env.DB.batch([
    env.DB.prepare("UPDATE sb_radar_chrome_execution_claims_v1 SET state='placed',bookmaker_ticket_id=?,bookmaker_accepted_utc=?,accepted_evidence=?,odd_x=?,client_ref=?,updated_utc=? WHERE owner_username=? AND event_id=? AND device_id=? AND state IN ('submitting','unknown')").bind(ticket,at,evidence,odds,ref,at,d.owner_username,eventId,d.device_id),
    env.DB.prepare("INSERT OR IGNORE INTO ghost_equal_bets(client_ref,device_id,event_id,fixture,selection,stake_lei,odds,placed_utc,status,potential_return_lei,notes) VALUES(?,?,?,?,?,?,?,?,'OPEN',?,?)").bind(ref,owner.device_id,Number(eventId),claim.fixture,'X',claim.stake_lei,odds,at,Math.round(claim.stake_lei*odds*100)/100,'BILET PLASAT AUTOMAT | Superbet '+ticket+' | '+claim.signal_category),
    env.DB.prepare("INSERT OR IGNORE INTO sb_radar_auto_ticket_push_v1(ticket_id,device_id) SELECT ?,device_id FROM sb_radar_fcm_registry WHERE device_id IN (SELECT device_id FROM sb_owner_authorized_devices)").bind(ticket)
   ]);
  }catch(e){return err('Confirmarea nu poate fi scrisă. Nu repeta pariul; verifică biletul în Superbet.',503,true)}
  await event(env,'AUTO_BET_PLACED',d.device_id,eventId,'Superbet #'+ticket+' • '+claim.stake_lei+' lei');
  try{if(env.FCM_DISPATCHER&&typeof env.FCM_DISPATCHER.deliverAutoTicket==='function')await env.FCM_DISPATCHER.deliverAutoTicket({ticket_id:ticket});}catch(e){console.warn('AUTO_BET_FCM_PENDING',String(e).slice(0,130))}
  return reply({ok:true,state:'placed',ticket_id:ticket,recorded_in_slip:true,notification_queued:true},200,true);
 }
 if(path==='/api/chrome/report-error'&&req.method==='POST'){
  const d=await validDevice(req,env);if(!d)return err('Dispozitiv invalid',401,true);
  const j=await read(req),id=String(j.event_id||''),reason=String(j.reason||'').slice(0,200);
  if(!/^\d{4,20}$/.test(id))return err('Eveniment invalid',400,true);
  await env.DB.prepare("UPDATE sb_radar_chrome_execution_claims_v1 SET state=CASE WHEN state='submitting' THEN 'unknown' ELSE 'failed' END,failure_reason=?,updated_utc=? WHERE owner_username=? AND event_id=? AND device_id=? AND state IN ('leased','preparing','submitting')").bind(reason,now(),d.owner_username,id,d.device_id).run();
  await event(env,'EXECUTOR_ERROR',d.device_id,id,reason);
  return reply({ok:true,action:'CHECK_SUPERBET_BEFORE_RETRY'},200,true);
 }

 if(path==='/api/chrome/admin/status'&&req.method==='GET'){
  const denied=await admin(req,env,authenticated);if(denied)return denied;
  return reply({ok:true,...await state(env)});
 }
 if(path==='/api/chrome/admin/devices'&&req.method==='GET'){
  const denied=await admin(req,env,authenticated);if(denied)return denied;
  const devices=(await env.DB.prepare("SELECT d.device_id,d.owner_username,d.owner_email,d.display_name,d.pairing_status,d.enabled,d.superbet_session_ok,d.install_version,d.last_heartbeat_utc,d.registered_utc,d.approved_utc,d.last_error,a.approval_expires_utc,l.status AS license_status,l.expires_utc,l.monthly_price_lei,l.billing_cycle,l.plan_name,COALESCE((SELECT ROUND(SUM(amount_lei),2) FROM sb_radar_chrome_license_payments_v1 p WHERE p.device_id=d.device_id),0) AS amount_paid_lei FROM sb_radar_chrome_devices_v1 d JOIN sb_radar_chrome_auth_v1 a ON d.device_id=a.device_id LEFT JOIN sb_radar_chrome_licenses_v1 l ON l.device_id=d.device_id ORDER BY d.registered_utc DESC LIMIT 300").all()).results||[];
  return reply({ok:true,devices:devices.map(x=>({...x,online:x.pairing_status==='active'&&x.enabled===1&&!!x.last_heartbeat_utc&&Date.now()-Date.parse(x.last_heartbeat_utc)<50000,license_active:licenseValid(x)})),...await state(env)});
 }
 if(path==='/api/chrome/admin/approve'&&req.method==='POST'){
  const denied=await admin(req,env,authenticated);if(denied)return denied;
  const j=await read(req),id=String(j.device_id||''),code=String(j.code||'');
  if(!isId(id)||!/^\d{6}$/.test(code))return err('Identificator sau cod invalid');
  const p=await env.DB.prepare("SELECT d.pairing_status,a.approval_code_hash,a.approval_expires_utc FROM sb_radar_chrome_devices_v1 d JOIN sb_radar_chrome_auth_v1 a ON d.device_id=a.device_id WHERE d.device_id=?").bind(id).first();
  if(!p||p.pairing_status!=='pending'||Date.parse(p.approval_expires_utc)<Date.now()||await digest(code)!==p.approval_code_hash)return err('Cod expirat, greșit sau dispozitivul nu este în așteptare',403);
  await env.DB.prepare("UPDATE sb_radar_chrome_devices_v1 SET pairing_status='active',enabled=1,approved_utc=? WHERE device_id=? AND pairing_status='pending'").bind(now(),id).run();
  await event(env,'DEVICE_APPROVED',id);
  return reply({ok:true,device_id:id});
 }
 if(path==='/api/chrome/admin/revoke'&&req.method==='POST'){
  const denied=await admin(req,env,authenticated);if(denied)return denied;
  const j=await read(req),id=String(j.device_id||'');
  if(!isId(id))return err('Identificator invalid');
  await env.DB.prepare("UPDATE sb_radar_chrome_devices_v1 SET pairing_status='revoked',enabled=0,superbet_session_ok=0,revoked_utc=? WHERE device_id=?").bind(now(),id).run();
  await event(env,'DEVICE_REVOKED',id);
  return reply({ok:true});
 }

 if(path==='/api/chrome/admin/license-plan'&&req.method==='POST'){
  const denied=await admin(req,env,authenticated);if(denied)return denied;
  const j=await read(req),id=String(j.device_id||''),rate=Number(j.price_lei),cycle=String(j.billing_cycle||'monthly'),plan=String(j.plan_name||'Personalizat').trim().slice(0,65);
  if(!isId(id)||!Number.isFinite(rate)||rate<0||rate>100000||!['monthly','yearly'].includes(cycle)||!plan)return err('Date licență invalide',400);
  const d=await env.DB.prepare('SELECT owner_username FROM sb_radar_chrome_devices_v1 WHERE device_id=?').bind(id).first();
  if(!d)return err('Extensie necunoscută',404);
  const cur=now();
  await env.DB.prepare("INSERT INTO sb_radar_chrome_licenses_v1(device_id,status,updated_utc,monthly_price_lei,plan_name,billing_cycle) VALUES(?,'REVOKED',?,?,?,?) ON CONFLICT(device_id) DO UPDATE SET monthly_price_lei=excluded.monthly_price_lei,plan_name=excluded.plan_name,billing_cycle=excluded.billing_cycle,updated_utc=excluded.updated_utc").bind(id,cur,rate,plan,cycle).run();
  await event(env,'LICENSE_PLAN',id,null,plan+': '+rate+' lei / '+cycle);
  return reply({ok:true,device_id:id,price_lei:rate,billing_cycle:cycle});
 }
 if(path==='/api/chrome/admin/license-payment'&&req.method==='POST'){
  const denied=await admin(req,env,authenticated);if(denied)return denied;
  const j=await read(req),id=String(j.device_id||''),amount=Number(j.amount_lei),ref=String(j.payment_reference||'').trim(),comment=String(j.notes||'').slice(0,200);
  if(!isId(id)||!Number.isFinite(amount)||amount<0||amount>100000||!/^[A-Za-z0-9_-]{16,90}$/.test(ref))return err('Plată sau referință invalidă',400);
  const l=await env.DB.prepare('SELECT monthly_price_lei,billing_cycle FROM sb_radar_chrome_licenses_v1 WHERE device_id=?').bind(id).first();
  if(!l)return err('Configurează mai întâi planul licenței',409);
  const price=Number(l.monthly_price_lei),unitDays=l.billing_cycle==='yearly'?365:30;
  let days=price>0?Math.floor((amount/price)*unitDays):Number(j.free_days||0);
  if(!Number.isInteger(days)||days<1||days>3660)return err(price>0?'Suma nu acoperă minimum o zi, sau depășește 10 ani':'Pentru licența gratuită indică între 1 și 3660 zile',400);
  if(price>0&&amount<=0)return err('Plata este zero',400);
  try{
   const r=await env.DB.batch([
    env.DB.prepare("INSERT INTO sb_radar_chrome_license_payments_v1(device_id,amount_lei,coverage_days,method,reference,paid_utc,created_by,notes) VALUES(?,?,?,'manual',?,?,?,?)").bind(id,amount,days,ref,now(),'drix',comment),
    env.DB.prepare("UPDATE sb_radar_chrome_licenses_v1 SET status='ACTIVE',issued_utc=COALESCE(issued_utc,?),updated_utc=?,expires_utc=strftime('%Y-%m-%dT%H:%M:%fZ',datetime(max(coalesce(datetime(expires_utc),datetime('now')),datetime('now')), '+' || ? || ' days')) WHERE device_id=?").bind(now(),now(),days,id)
   ]);
   if(!r[0]?.meta?.changes||!r[1]?.meta?.changes)return err('Plata nu a fost înregistrată',409);
  }catch(e){return err('Plata nu a fost înregistrată; verifică referința unică',409)}
  await event(env,'LICENSE_PAYMENT',id,null,amount+' lei • '+days+' zile');
  const info=await env.DB.prepare('SELECT status,expires_utc,monthly_price_lei,billing_cycle FROM sb_radar_chrome_licenses_v1 WHERE device_id=?').bind(id).first();
  return reply({ok:true,device_id:id,license:info,days_added:days,amount_lei:amount});
 }
 if(path==='/api/chrome/admin/license-revoke'&&req.method==='POST'){
  const denied=await admin(req,env,authenticated);if(denied)return denied;
  const j=await read(req),id=String(j.device_id||'');if(!isId(id))return err('Dispozitiv invalid',400);
  await env.DB.prepare("UPDATE sb_radar_chrome_licenses_v1 SET status='REVOKED',updated_utc=? WHERE device_id=?").bind(now(),id).run();
  await event(env,'LICENSE_REVOKED',id);
  return reply({ok:true});
 }
 if(path==='/api/chrome/admin/license-payments'&&req.method==='GET'){
  const denied=await admin(req,env,authenticated);if(denied)return denied;
  const id=new URL(req.url).searchParams.get('device_id');
  if(!isId(id))return err('Dispozitiv invalid',400);
  const payments=(await env.DB.prepare("SELECT payment_id,amount_lei,coverage_days,method,reference,paid_utc,recorded_utc,created_by,notes FROM sb_radar_chrome_license_payments_v1 WHERE device_id=? ORDER BY paid_utc DESC LIMIT 100").bind(id).all()).results||[];
  return reply({ok:true,payments});
 }

 if(path==='/api/chrome/admin/claims'&&req.method==='GET'){
  const denied=await admin(req,env,authenticated);if(denied)return denied;
  const claims=(await env.DB.prepare("SELECT owner_username,event_id,fixture,signal_category,stake_lei,state,device_id,odd_x,bookmaker_ticket_id,bookmaker_accepted_utc,created_utc,updated_utc,failure_reason FROM sb_radar_chrome_execution_claims_v1 ORDER BY created_utc DESC LIMIT 100").all()).results||[];
  const events=(await env.DB.prepare('SELECT device_id,event_id,kind,description,logged_utc FROM sb_radar_chrome_events_v1 ORDER BY id DESC LIMIT 70').all()).results||[];
  return reply({ok:true,claims,events});
 }
 if(path==='/api/chrome/admin/set-mode'&&req.method==='POST'){
  const denied=await admin(req,env,authenticated);if(denied)return denied;
  const j=await read(req);
  if(j.enabled!==false)return err('Execuția automată rămâne dezactivată până la validarea completă a pipeline-ului',409);
  await env.DB.prepare("UPDATE sb_radar_chrome_bridge_settings_v1 SET value='false',updated_utc=? WHERE key='execution_enabled'").bind(now()).run();
  await event(env,'AUTO_EXECUTION_DISABLED');
  return reply({ok:true,execution_enabled:false});
 }
 return err('Rută inexistentă',404,isExtension);
 }catch(e){return err('Eroare internă Chrome Bridge',500,isExtension);}
}
