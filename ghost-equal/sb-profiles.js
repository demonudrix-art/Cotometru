
/*
 * SB Radar personal profiles. A profile belongs to a licensed Android device,
 * never to an IP address, and never grants administrative API permissions.
 * The existing administrator username/password is reused ONLY by /api/admin/login;
 * no plaintext copy or new password record is made here.
 */
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const utc=()=>new Date().toISOString();
const validName=x=>/^[A-Za-z0-9_-]{3,30}$/.test(x);
const themes=new Set(['red','cyan','gold','slate','green']);
async function ensureProfile(env,deviceId){
 let p=await env.DB.prepare("SELECT username,display_name,avatar_theme,is_owner,created_utc,updated_utc FROM sb_device_profiles WHERE device_id=?").bind(deviceId).first();
 if(p)return p;
 const username='user_'+deviceId.replace(/[^a-zA-Z0-9]/g,'').slice(0,12).toLowerCase();
 await env.DB.prepare("INSERT OR IGNORE INTO sb_device_profiles(device_id,username,display_name,avatar_theme,is_owner,created_utc,updated_utc) VALUES(?,?,?,'red',0,?,?)").bind(deviceId,username,'Membru Radar',utc(),utc()).run();
 return await env.DB.prepare("SELECT username,display_name,avatar_theme,is_owner,created_utc,updated_utc FROM sb_device_profiles WHERE device_id=?").bind(deviceId).first();
}
export async function profileApi(req,env,path,deviceId,adminAuthenticated){
 let p=await ensureProfile(env,deviceId);
 if(!p)return json({error:'Profilul nu a putut fi creat'},500);
 if(path==='/api/mobile/profile'&&req.method==='GET'){
  const d=await env.DB.prepare("SELECT model,os_version,app_version FROM ghost_equal_mobile_devices WHERE device_id=?").bind(deviceId).first();
  return json({profile:{...p,is_owner:!!p.is_owner},device:{model:d?.model||'Android',os_version:d?.os_version||null,app_version:d?.app_version||null,id_suffix:String(deviceId).slice(-6)},auth:{adminSession:await adminAuthenticated(req,env)}});
 }
 // Only same-origin browser form actions; bearer token checked upstream.
 if(req.method==='POST'){
  const origin=req.headers.get('Origin');
  if(origin!==new URL(req.url).origin)return json({error:'Cerere din origine nepermisă'},403);
 }
 if(path==='/api/mobile/profile'&&req.method==='POST'){
  const j=await req.json(),username=String(j.username??'').trim(),displayName=String(j.display_name??'').trim(),theme=String(j.avatar_theme??'red');
  if(!validName(username)||displayName.length<2||displayName.length>50||/[\u0000-\u001f<>]/.test(displayName)||!themes.has(theme))return json({error:'Utilizator 3–30 litere/cifre; nume public 2–50 caractere'},400);
  const admin=await env.DB.prepare('SELECT username FROM sb_admin WHERE id=1').first();
  if(admin&&username.toLowerCase()===String(admin.username).toLowerCase()&& !p.is_owner &&username.toLowerCase()!==String(p.username).toLowerCase())return json({error:'Acest utilizator aparține administratorului'},409);
  if(admin&&String(p.username).toLowerCase()===String(admin.username).toLowerCase()&&username.toLowerCase()!==String(admin.username).toLowerCase())return json({error:'Utilizatorul administratorului este protejat. Poți modifica doar numele afișat și avatarul.'},409);
  if(p.is_owner&&admin&&username.toLowerCase()!==String(admin.username).toLowerCase())return json({error:'Numele contului proprietar este gestionat din administrare'},409);
  try{
   const res=await env.DB.prepare('UPDATE sb_device_profiles SET username=?,display_name=?,avatar_theme=?,updated_utc=? WHERE device_id=?').bind(username,displayName,theme,utc(),deviceId).run();
   if(!res.meta?.changes)return json({error:'Profil indisponibil'},404);
  }catch(e){if(/UNIQUE|constraint/i.test(String(e)))return json({error:'Numele de utilizator este deja folosit'},409);throw e}
  p=await ensureProfile(env,deviceId);return json({ok:true,profile:{...p,is_owner:!!p.is_owner}});
 }
 if(path==='/api/mobile/profile/link-owner'&&req.method==='POST'){
  if(!await adminAuthenticated(req,env))return json({error:'Autentifică-te cu utilizatorul și parola existentă din Admin'},401);
  const admin=await env.DB.prepare('SELECT username FROM sb_admin WHERE id=1').first();
  if(!admin)return json({error:'Administratorul nu este configurat'},404);
  const existing=await env.DB.prepare('SELECT device_id FROM sb_device_profiles WHERE is_owner=1 AND device_id<>?').bind(deviceId).first();
  if(existing)return json({error:'Profilul proprietar este deja asociat altui telefon. Mutarea se face numai din administrare.'},409);
  // Only the administrator currently authenticated can establish this link.
  await env.DB.prepare('UPDATE sb_device_profiles SET username=?,is_owner=1,updated_utc=? WHERE device_id=?').bind(admin.username,utc(),deviceId).run();
  p=await ensureProfile(env,deviceId);
  return json({ok:true,profile:{...p,is_owner:!!p.is_owner}});
 }
 return json({error:'Funcție profil indisponibilă'},404);
}
