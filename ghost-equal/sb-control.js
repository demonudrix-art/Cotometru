
const te=new TextEncoder(),utc=()=>new Date().toISOString();
const json=(x,s=200,h={})=>new Response(JSON.stringify(x),{status:s,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...h}});
async function digest(t){const a=new Uint8Array(await crypto.subtle.digest('SHA-256',te.encode(t)));return Array.from(a,b=>b.toString(16).padStart(2,'0')).join('')}
async function oldDigest(t){const a=new Uint8Array(await crypto.subtle.digest('SHA-256',te.encode(t)));return btoa(String.fromCharCode(...a)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function random(n=32){const a=crypto.getRandomValues(new Uint8Array(n));return btoa(String.fromCharCode(...a)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function pw(p,s){const k=await crypto.subtle.importKey('raw',te.encode(p),'PBKDF2',false,['deriveBits']);const a=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:te.encode(s),iterations:160000,hash:'SHA-256'},k,256));return Array.from(a,b=>b.toString(16).padStart(2,'0')).join('')}
function origin(req){const u=new URL(req.url);return u.protocol==='https:'&&req.headers.get('Origin')===u.origin}
function cookie(req){const c=req.headers.get('Cookie')||'';return c.split(';').map(x=>x.trim()).find(x=>x.startsWith('sbr_session='))?.slice(12)||''}
async function logged(req,env){const t=cookie(req);if(!/^[a-zA-Z0-9_-]{30,80}$/.test(t))return false;return !!await env.DB.prepare('SELECT 1 yes FROM sb_admin_sessions WHERE token_hash=? AND expires_utc>?').bind(await digest(t),utc()).first()}
async function attempts(req,env){const h=await digest('sbr-admin|'+(req.headers.get('CF-Connecting-IP')||'unknown'));const o=await env.DB.prepare('SELECT count,window_utc FROM sb_login_attempts WHERE ip_hash=?').bind(h).first();if(o&&Date.now()-Date.parse(o.window_utc)<900000&&o.count>=10)return true;if(!o||Date.now()-Date.parse(o.window_utc)>=900000)await env.DB.prepare('INSERT INTO sb_login_attempts(ip_hash,count,window_utc) VALUES(?,1,?) ON CONFLICT(ip_hash) DO UPDATE SET count=1,window_utc=excluded.window_utc').bind(h,utc()).run();else await env.DB.prepare('UPDATE sb_login_attempts SET count=count+1 WHERE ip_hash=?').bind(h).run();return false}
export async function licenseInfo(env,device){
 const x=await env.DB.prepare('SELECT d.blocked,l.status,l.expires_utc FROM ghost_equal_mobile_devices d LEFT JOIN sb_licenses l ON l.device_id=d.device_id WHERE d.device_id=?').bind(device).first();
 if(!x)return {active:false,status:'UNKNOWN',expires_utc:null};
 let status=x.blocked?'BLOCKED':x.status==='REVOKED'?'REVOKED':x.status!=='ACTIVE'?'PENDING':Date.parse(x.expires_utc)>Date.now()?'ACTIVE':'EXPIRED';
 return {active:status==='ACTIVE',status,expires_utc:x.expires_utc||null};
}
export async function enroll(env,j){
 const id=String(j.device_id||''),t=String(j.token||'');
 if(!/^[A-Za-z0-9-]{30,80}$/.test(id)||!/^[A-Za-z0-9_-]{40,128}$/.test(t))return json({error:'Dispozitiv invalid'},400);
 const h=await oldDigest(t),model=String(j.model||'Android').slice(0,70),os=String(j.os_version||'').slice(0,25),app=String(j.app_version||'').slice(0,25);
 await env.DB.prepare('INSERT OR IGNORE INTO ghost_equal_mobile_devices(device_id,token_hash,created_utc,last_seen_utc,model,os_version,app_version,blocked) VALUES(?,?,?,?,?,?,?,0)').bind(id,h,utc(),utc(),model,os,app).run();
 const who=await env.DB.prepare('SELECT device_id FROM ghost_equal_mobile_devices WHERE device_id=? AND token_hash=?').bind(id,h).first();
 if(!who)return json({error:'Identitatea acestui telefon diferă de cea înregistrată'},409);
 await env.DB.prepare('UPDATE ghost_equal_mobile_devices SET model=?,os_version=?,app_version=?,last_seen_utc=? WHERE device_id=?').bind(model,os,app,utc(),id).run();
 return json({ok:true,registered:true,license:await licenseInfo(env,id)});
}
function expires(unit,count){const d=new Date();if(unit==='day')d.setUTCDate(d.getUTCDate()+count);else if(unit==='month'){const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+count);d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()))}else if(unit==='year'){const month=d.getUTCMonth(),day=d.getUTCDate();d.setUTCDate(1);d.setUTCFullYear(d.getUTCFullYear()+count);d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),month+1,0)).getUTCDate()))}else throw Error('Perioadă invalidă');if(d.getTime()>Date.now()+5.01*365.25*86400000)throw Error('Maximum 5 ani');return d.toISOString()}
export async function adminApi(req,env,path){
 if(path==='/api/admin/state'&&req.method==='GET')return json({configured:!!await env.DB.prepare('SELECT 1 v FROM sb_admin WHERE id=1').first(),authenticated:await logged(req,env)});
 if(req.method==='POST'&&!origin(req))return json({error:'Origine invalidă'},403);
 if(path==='/api/admin/setup'&&req.method==='POST'){
  if(await attempts(req,env))return json({error:'Prea multe încercări (15 minute)'},429);
  if(await env.DB.prepare('SELECT id FROM sb_admin WHERE id=1').first())return json({error:'Administrator deja creat'},409);
  const j=await req.json(),u=String(j.username||''),p=String(j.password||'');
  if(!/^[A-Za-z0-9_-]{3,30}$/.test(u)||p.length<6||p.length>72||!/[a-zA-Z]/.test(p)||!/[0-9]/.test(p))return json({error:'Utilizator 3-30 litere/cifre; parola minimum 6 cu litere și cifre'},400);
  const key=await env.DB.prepare('SELECT secret_hash,expires_utc FROM sb_admin_setup WHERE id=1').first();
  if(!key||Date.parse(key.expires_utc)<Date.now()||await digest(String(j.bootstrap||''))!==key.secret_hash)return json({error:'Cheie inițială greșită sau expirată'},403);
  const salt=random(16),hash=await pw(p,salt);
  const r=await env.DB.prepare('INSERT OR IGNORE INTO sb_admin(id,username,salt,pass_hash,created_utc) VALUES(1,?,?,?,?)').bind(u,salt,hash,utc()).run();
  if(!r.meta?.changes)return json({error:'Contul admin este deja înregistrat'},409);
  await env.DB.prepare('DELETE FROM sb_admin_setup WHERE id=1').run();return json({ok:true});
 }
 if(path==='/api/admin/login'&&req.method==='POST'){
  if(await attempts(req,env))return json({error:'Prea multe încercări (15 minute)'},429);
  const j=await req.json(),a=await env.DB.prepare('SELECT username,salt,pass_hash FROM sb_admin WHERE id=1').first();
  if(!a||String(j.username||'')!==a.username||await pw(String(j.password||''),a.salt)!==a.pass_hash)return json({error:'Date de autentificare incorecte'},403);
  const t=random(),h=await digest(t);
  await env.DB.prepare('INSERT INTO sb_admin_sessions(token_hash,created_utc,expires_utc) VALUES(?,?,?)').bind(h,utc(),new Date(Date.now()+12*3600000).toISOString()).run();
  return json({ok:true},200,{'Set-Cookie':'sbr_session='+t+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=43200'});
 }
 if(path==='/api/admin/logout'&&req.method==='POST'){
  if(cookie(req))await env.DB.prepare('DELETE FROM sb_admin_sessions WHERE token_hash=?').bind(await digest(cookie(req))).run();
  return json({ok:true},200,{'Set-Cookie':'sbr_session=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0'});
 }
 if(!await logged(req,env))return json({error:'Acces admin neautorizat'},401);
 if(path==='/api/admin/devices'&&req.method==='GET'){
  const r=(await env.DB.prepare('SELECT d.device_id,d.model,d.os_version,d.app_version,d.created_utc,d.last_seen_utc,d.blocked,l.status,l.issued_utc,l.expires_utc FROM ghost_equal_mobile_devices d LEFT JOIN sb_licenses l ON l.device_id=d.device_id ORDER BY d.created_utc DESC LIMIT 250').all()).results||[];
  return json({devices:r.map(d=>({...d,license_status:d.blocked?'BLOCKED':d.status==='REVOKED'?'REVOKED':d.status!=='ACTIVE'?'PENDING':Date.parse(d.expires_utc)>Date.now()?'ACTIVE':'EXPIRED'}))});
 }
 if(path==='/api/admin/license'&&req.method==='POST'){
  const j=await req.json(),id=String(j.device_id||''),count=Number(j.count),unit=String(j.unit||'');
  if(!/^[A-Za-z0-9-]{30,80}$/.test(id)||!Number.isInteger(count)||count<1||count>365||!['day','month','year'].includes(unit))return json({error:'Durata sau dispozitivul sunt invalide'},400);
  let until;try{until=expires(unit,count)}catch(e){return json({error:e.message},400)}
  const d=await env.DB.prepare('SELECT blocked FROM ghost_equal_mobile_devices WHERE device_id=?').bind(id).first();
  if(!d||d.blocked)return json({error:'Telefon inexistent sau blocat'},409);
  await env.DB.prepare("INSERT INTO sb_licenses(device_id,status,issued_utc,expires_utc,updated_utc) VALUES(?,'ACTIVE',?,?,?) ON CONFLICT(device_id) DO UPDATE SET status='ACTIVE',issued_utc=excluded.issued_utc,expires_utc=excluded.expires_utc,updated_utc=excluded.updated_utc").bind(id,utc(),until,utc()).run();
  await env.DB.prepare('INSERT INTO sb_admin_actions(device_id,action,occurred_utc,details) VALUES(?,?,?,?)').bind(id,'GRANT',utc(),unit+':'+count).run();
  return json({ok:true,expires_utc:until});
 }
 for(const action of ['revoke','block','unblock']){
  if(path==='/api/admin/'+action&&req.method==='POST'){
   const id=String((await req.json()).device_id||'');
   if(!/^[A-Za-z0-9-]{30,80}$/.test(id))return json({error:'Identificator invalid'},400);
   if(!await env.DB.prepare('SELECT 1 v FROM ghost_equal_mobile_devices WHERE device_id=?').bind(id).first())return json({error:'Telefon negăsit'},404);
   if(action!=='revoke')await env.DB.prepare('UPDATE ghost_equal_mobile_devices SET blocked=? WHERE device_id=?').bind(action==='block'?1:0,id).run();
   await env.DB.prepare("UPDATE sb_licenses SET status='REVOKED',updated_utc=? WHERE device_id=?").bind(utc(),id).run();
   await env.DB.prepare('INSERT INTO sb_admin_actions(device_id,action,occurred_utc) VALUES(?,?,?)').bind(id,action.toUpperCase(),utc()).run();
   return json({ok:true});
  }
 }
 return json({error:'Endpoint administrator inexistent'},404);
}
