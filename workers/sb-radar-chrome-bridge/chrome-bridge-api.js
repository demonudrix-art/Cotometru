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
