
const API='https://production-superbet-offer-ro.freetls.fastly.net/v3/ro-RO/events';
const LIVE='https://superbet.ro/pariuri-sportive/fotbal/live';
const enc=new TextEncoder();
function json(v,code){return new Response(JSON.stringify(v),{status:code||200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
function n(x){if(x===null||x===undefined||x==='')return null;const y=Number(x);return Number.isFinite(y)?y:null}
function iso(){return new Date().toISOString()}
function b64(bytes){let s='';for(const c of bytes)s+=String.fromCharCode(c);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function un64(s){s=s.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(s+'='.repeat((4-s.length%4)%4)),x=>x.charCodeAt(0))}
function cat(...xs){const out=new Uint8Array(xs.reduce((a,x)=>a+x.length,0));let i=0;for(const x of xs){out.set(x,i);i+=x.length}return out}
async function hash(x){return b64(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(x))))}
async function hkdf(ikm,salt,info,length){const key=await crypto.subtle.importKey('raw',ikm,'HKDF',false,['deriveBits']);return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},key,length*8))}
let vapidCache=null;
async function getVapid(env){
 if(vapidCache)return vapidCache;
 let row=await env.DB.prepare('SELECT public_key,private_key FROM ghost_equal_push_keys WHERE id=1').first();
 if(!row){
  const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const raw=new Uint8Array(await crypto.subtle.exportKey('raw',keys.publicKey));
  const publicKey=b64(raw),privateKey=JSON.stringify(await crypto.subtle.exportKey('jwk',keys.privateKey));
  await env.DB.prepare('INSERT OR IGNORE INTO ghost_equal_push_keys(id,public_key,private_key) VALUES(1,?,?)').bind(publicKey,privateKey).run();
  row=await env.DB.prepare('SELECT public_key,private_key FROM ghost_equal_push_keys WHERE id=1').first();
 }
 if(!row)throw Error('VAPID key unavailable');
 vapidCache={publicKey:row.public_key,privateKey:row.private_key};
 return vapidCache;
}
async function webpush(env,sub,payload){
 const endpoint=new URL(sub.endpoint);
 if(endpoint.protocol!=='https:'||!['https://fcm.googleapis.com','https://updates.push.services.mozilla.com','https://push.services.mozilla.com'].some(x=>endpoint.origin===x)&&!endpoint.hostname.endsWith('.push.apple.com'))throw Error('Unsupported push host');
 const key=await crypto.subtle.importKey('jwk',JSON.parse((await getVapid(env)).privateKey),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const jwtBody={aud:endpoint.origin,exp:Math.floor(Date.now()/1000)+3600,sub:'https://cotometru.ro'};
 const unsigned=b64(enc.encode(JSON.stringify({typ:'JWT',alg:'ES256'})))+'.'+b64(enc.encode(JSON.stringify(jwtBody)));
 const sign=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(unsigned)));
 const jwt=unsigned+'.'+b64(sign);
 const pub=un64(sub.keys.p256dh),auth=un64(sub.keys.auth);
 const ephem=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const sender=new Uint8Array(await crypto.subtle.exportKey('raw',ephem.publicKey));
 const receiver=await crypto.subtle.importKey('raw',pub,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:receiver},ephem.privateKey,256));
 const ikm=await hkdf(shared,auth,cat(enc.encode('WebPush: info'),new Uint8Array([0]),pub,sender),32);
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const cek=await hkdf(ikm,salt,cat(enc.encode('Content-Encoding: aes128gcm'),new Uint8Array([0])),16);
 const nonce=await hkdf(ikm,salt,cat(enc.encode('Content-Encoding: nonce'),new Uint8Array([0])),12);
 const aes=await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['encrypt']);
 const plain=cat(enc.encode(JSON.stringify(payload)),new Uint8Array([2]));
 const crypt=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},aes,plain));
 const data=cat(salt,new Uint8Array([0,0,16,0,65]),sender,crypt);
 return fetch(endpoint.toString(),{method:'POST',headers:{'Authorization':'vapid t='+jwt+', k='+(await getVapid(env)).publicKey,'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream','TTL':'180'},body:data});
}
async function sendAll(env,a){
 const rows=(await env.DB.prepare("SELECT token_hash,subscription FROM ghost_equal_devices WHERE enabled=1 AND subscription IS NOT NULL LIMIT 8").all()).results||[];
 const title=a.stage==='BET_NOW'?'GHOST EGAL | BET NOW X':'GHOST EGAL | PREGĂTEȘTE-TE';
 const body=a.fixture+' | '+a.minute+"' 0-0 | X "+Number(a.px).toFixed(2)+(a.stage==='BET_NOW'?' | Verifică prețul înainte de miză':' | verificare din minutul 57');
 const payload={title,body,eventId:a.event_id,stage:a.stage,url:LIVE,tag:'ghost-'+a.event_id+'-'+a.stage};
 let ok=0;for(const d of rows){try{const sub=JSON.parse(d.subscription);const r=await webpush(env,sub,payload);if(r.ok)ok++;else if(r.status===404||r.status===410)await env.DB.prepare('UPDATE ghost_equal_devices SET enabled=0 WHERE token_hash=?').bind(d.token_hash).run()}catch(e){console.error('push error',String(e).slice(0,120))}}return ok;
}
async function scan(env){
 const t=iso(),ms=Date.now();
 const fixtures=(await env.DB.prepare("SELECT event_id,fixture,kickoff_utc FROM quote_state WHERE settled=0 AND kickoff_utc<=? AND kickoff_utc>=? ORDER BY kickoff_utc DESC LIMIT 110").bind(t,new Date(ms-3*3600000).toISOString()).all()).results||[];
 let saved=0,ready=0,alerts=0,errors=[];
 for(let k=0;k<fixtures.length;k+=16){
  const batch=fixtures.slice(k,k+16),url=new URL(API);url.searchParams.set('events',batch.map(x=>Number(x.event_id)).sort((a,b)=>a-b).join(','));url.searchParams.set('includeOnly','fixture,inPlayStats,inPlayStatsMetadata,markets');url.searchParams.set('markets','547');
  let data;
  try{const res=await fetch(url.toString(),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});if(!res.ok){errors.push('feed_http_'+res.status);continue}data=await res.json()}catch(e){errors.push('feed_unavailable');continue}
  for(const ev of data.events||[]){
   const s=ev.inplay_stats,m=ev.inplay_stats_metadata;
   if(!s||!(m?.status==='STARTED'||s.minutes!==undefined))continue;
   const minute=n(s.minutes),h=n(s.home_team_score),a=n(s.away_team_score);
   if(minute===null||minute<42||minute>78||h===null||a===null)continue;
   const market=(ev.markets||[]).find(x=>x.id===547);
   const o=Object.fromEntries((market?.odds||[]).filter(x=>['1','X','2'].includes(x.metadata?.name)).map(x=>[x.metadata.name,x]));
   const p1=n(o['1']?.price),px=n(o.X?.price),p2=n(o['2']?.price),gh=n(o['1']?.metadata?.extra?.generosity_prob_home),ga=n(o['2']?.metadata?.extra?.generosity_prob_away);
   const f=batch.find(x=>Number(x.event_id)===Number(ev.event_id));if(!f)continue;
   const eventId=Number(ev.event_id);
   const existed=await env.DB.prepare('SELECT 1 present FROM ghost_equal_samples WHERE event_id=? AND minute=? LIMIT 1').bind(eventId,minute).first();
   if(existed)continue;
   const prior=await env.DB.prepare("SELECT minute,home_score,away_score,gh,ga FROM ghost_equal_samples WHERE event_id=? AND minute BETWEEN ? AND ? AND captured_utc>=? ORDER BY ABS(minute - ?) ASC,captured_utc DESC LIMIT 1").bind(eventId,minute-15,minute-7,new Date(ms-20*60000).toISOString(),minute-10).first();
   await env.DB.prepare('INSERT OR IGNORE INTO ghost_equal_samples(event_id,captured_utc,minute,home_score,away_score,gh,ga,p1,px,p2,fixture) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(eventId,t,minute,h,a,gh,ga,p1,px,p2,f.fixture).run();saved++;
   if(h!==0||a!==0||!prior||prior.home_score!==0||prior.away_score!==0||gh===null||ga===null||prior.gh===null||prior.ga===null||p1===null||p2===null||px===null)continue;
   const dh=gh-prior.gh,da=ga-prior.ga;
   const eligible=dh<=-0.009999&&da<=-0.009999&&px>=1.75&&p1>=1.80&&p2>=1.80;
   if(!eligible)continue;ready++;
   const stage=minute>=57?'BET_NOW':(minute>=50?'PREGATIRE':null);
   if(!stage)continue;
   const ins=await env.DB.prepare('INSERT OR IGNORE INTO ghost_equal_alerts(event_id,stage,triggered_utc,minute,fixture,home_score,away_score,gh,ga,dgh10,dga10,p1,px,p2,source) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(eventId,stage,t,minute,f.fixture,h,a,gh,ga,dh,da,p1,px,p2,'LIVE_DIRECT_V1').run();
   if(ins.meta?.changes){alerts++;await sendAll(env,{event_id:eventId,stage,minute,fixture:f.fixture,px})}
  }
 }
 await env.DB.prepare('INSERT INTO ghost_equal_runs(checked_utc,fixtures,samples,eligible,alerts,error) VALUES(?,?,?,?,?,?)').bind(t,fixtures.length,saved,ready,alerts,errors.slice(0,4).join(',')||null).run();
 if(Math.random()<0.025){await env.DB.batch([env.DB.prepare("DELETE FROM ghost_equal_samples WHERE captured_utc < datetime('now','-14 days')"),env.DB.prepare("DELETE FROM ghost_equal_runs WHERE checked_utc < datetime('now','-7 days')")])}
 return{fixtures:fixtures.length,saved,eligible:ready,alerts,error:errors.slice(0,4)};
}
async function authorize(req,env){const t=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');if(!t||t.length<25)return false;const d=await env.DB.prepare('SELECT token_hash FROM ghost_equal_devices WHERE token_hash=?').bind(await hash(t)).first();return !!d}
function html(){return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#101719"><link rel="manifest" href="/manifest.webmanifest"><title>GHOST EGAL | Live</title><style>
:root{font-family:system-ui,Roboto,Arial,sans-serif;color:#ecf5f4;background:#101719}*{box-sizing:border-box}body{margin:0;padding:20px;max-width:740px;margin:auto}h1{font-size:26px;margin:5px 0 9px}p{color:#aabeb8}.hero{padding:18px;background:#182326;border:1px solid #334246;border-radius:20px;margin:0 0 16px}.pill{display:inline-block;background:#123b32;color:#58df9b;padding:4px 9px;border-radius:25px;font-weight:700;font-size:12px}.muted{color:#9db0ae;font-size:13px}.card{background:#1b2529;border:1px solid #3e5555;border-radius:14px;padding:15px;margin:9px 0}.bet{border-color:#ff665b}.prep{border-color:#e4bc60}.title{font-weight:750;font-size:16px}.row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}button,a.action{background:#f46757;color:#111b1d;border:0;padding:12px 15px;border-radius:12px;font-weight:800;cursor:pointer;text-decoration:none;display:inline-block}button.secondary{background:#223b37;color:#d3fce9}input{background:#0f1719;color:white;border:1px solid #657879;border-radius:12px;padding:12px;font-size:16px;width:100%;max-width:320px}#list{min-height:80px}small{color:#9caeac}.hide{display:none}a{color:#62dcab}</style></head><body><div class="hero"><span class="pill">LIVE MONITOR</span><h1>GHOST EGAL</h1><p>Alerte 0–0 pentru piața X. Pregătire din minutul 50, BET NOW numai după 57 și confirmarea filtrului.</p><div id="health" class="muted">Conectare…</div></div><section id="login" class="card"><strong>Activează accesul personal</strong><p>Introdu codul primit în conversație pentru a autoriza dispozitivul.</p><div class="row"><input id="pair" type="password" placeholder="Cod de activare" autocomplete="off"><button id="activate">Activează</button></div></section><section id="account" class="hide"><div class="row"><button id="notify">Activează notificările Android</button><button class="secondary" id="test">Testează notificarea</button><button class="secondary" id="refresh">Actualizează</button></div><p id="state" class="muted"></p><h2>Semnale recente</h2><div id="list"></div><p class="muted">O singură alertă per meci și etapă. Cota din alertă poate fi modificată sau suspendată până deschizi Superbet. Nu se plasează pariuri automat.</p></section><script>
const $=id=>document.getElementById(id);let token=localStorage.getItem('ghost_eq_token')||'';
const api=async(path,opt={})=>{let r=await fetch(path,{...opt,headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,...opt.headers}});let j=await r.json();if(!r.ok)throw Error(j.error||'HTTP '+r.status);return j};
function layout(){const ok=!!token;$('login').classList.toggle('hide',ok);$('account').classList.toggle('hide',!ok)}
$('activate').onclick=async()=>{try{const j=await api('/api/pair',{method:'POST',body:JSON.stringify({code:$('pair').value.trim()})});token=j.token;localStorage.setItem('ghost_eq_token',token);$('pair').value='';layout();refresh()}catch(e){alert(e.message)}};
const swPromise='serviceWorker'in navigator?navigator.serviceWorker.register('/sw.js'):Promise.reject(Error('Not supported'));
$('notify').onclick=async()=>{try{const reg=await swPromise;const perm=await Notification.requestPermission();if(perm!=='granted')throw Error('Permisiunea notificărilor este blocată');const conf=await api('/api/config');let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:conf.vapidPublicKey});await api('/api/subscribe',{method:'POST',body:JSON.stringify({subscription:sub.toJSON()})});$('state').textContent='Notificări push activate pe acest dispozitiv.'}catch(e){$('state').textContent='Eroare notificări: '+e.message}};
$('test').onclick=async()=>{try{await api('/api/test',{method:'POST'});$('state').textContent='Notificare de test trimisă (dacă permisiunea este activă).'}catch(e){$('state').textContent=e.message}};
$('refresh').onclick=refresh;
async function refresh(){if(!token)return;try{const [j,s]=await Promise.all([api('/api/alerts'),api('/api/status')]);$('health').textContent='Ultima scanare: '+(s.lastScan||'niciuna')+' | Evenimente: '+(s.fixtures??'-')+' | Semnale: '+j.alerts.length+' | BET NOW decontate: '+(s.audit?.settled||0)+' | Simulare: '+(s.audit?.simulated_net_lei||0)+' lei';$('list').replaceChildren();if(!j.alerts.length){$('list').textContent='Momentan nu există semnale. Monitorizarea continuă pe server.'}for(const x of j.alerts){const c=document.createElement('div');c.className='card '+(x.stage==='BET_NOW'?'bet':'prep');const h=document.createElement('div');h.className='title';h.textContent=(x.stage==='BET_NOW'?'🔴 BET NOW X':'🟡 PREGĂTEȘTE-TE')+' — '+x.fixture;const m=document.createElement('p');m.textContent=x.minute+"' | scor "+x.home_score+'–'+x.away_score+' | cota X '+Number(x.px).toFixed(2);const s=document.createElement('small');s.textContent='Scădere curbe: '+Number(x.dgh10).toFixed(3)+' / '+Number(x.dga10).toFixed(3)+' | '+x.triggered_utc;const a=document.createElement('a');a.className='action';a.href='https://superbet.ro/pariuri-sportive/fotbal/live';a.target='_blank';a.rel='noopener noreferrer';a.textContent='Deschide Superbet LIVE';c.append(h,m,s,document.createElement('p'),a);$('list').append(c)}}catch(e){$('health').textContent='Nu se poate încărca: '+e.message;if(e.message.includes('401')){token='';localStorage.removeItem('ghost_eq_token');layout()}}}
layout();refresh();setInterval(refresh,30000);
</script></body></html>`}
async function iconPng(n){
 const raw=new Uint8Array((4*n+1)*n);
 for(let y=0;y<n;y++){const pos=y*(4*n+1);raw[pos]=0;for(let x=0;x<n;x++){
  const dx=(x-n/2)/n,dy=(y-n/2)/n,dist=Math.sqrt(dx*dx+dy*dy);
  const ring=dist>.292&&dist<.364,letter=Math.abs(dx)<.22&&Math.abs(dy)<.22&&(Math.abs(dx-dy)<.038||Math.abs(dx+dy)<.038);
  const col=letter?[238,247,245,255]:ring?[244,103,87,255]:[16,23,25,255],at=pos+1+x*4;
  raw.set(col,at);
 }}
 const compressed=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
 function chunk(t,v){const out=new Uint8Array(v.length+12),dv=new DataView(out.buffer);dv.setUint32(0,v.length);out.set(enc.encode(t),4);out.set(v,8);let crc=0xffffffff;for(let i=4;i<out.length-4;i++){crc^=out[i];for(let j=0;j<8;j++)crc=crc&1?(crc>>>1)^0xedb88320:crc>>>1}dv.setUint32(out.length-4,(crc^0xffffffff)>>>0);return out}
 const ih=new Uint8Array(13),dv=new DataView(ih.buffer);dv.setUint32(0,n);dv.setUint32(4,n);ih[8]=8;ih[9]=6;
 return cat(new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',compressed),chunk('IEND',new Uint8Array()));
}
const sw="self.addEventListener('push',function(e){let d={};try{d=e.data?e.data.json():{}}catch(_){}e.waitUntil(self.registration.showNotification(d.title||'GHOST EGAL',{body:d.body||'Semnal LIVE',tag:d.tag||'ghost-eq',renotify:true,requireInteraction:d.stage==='BET_NOW',data:{url:d.url||'/'}}))});self.addEventListener('notificationclick',function(e){e.notification.close();e.waitUntil(clients.openWindow(e.notification.data.url||'/'))})";
export default {
 async scheduled(event,env,ctx){ctx.waitUntil(scan(env).catch(async e=>{console.error('scan error',String(e));await env.DB.prepare('INSERT INTO ghost_equal_runs(checked_utc,fixtures,samples,eligible,alerts,error) VALUES(?,0,0,0,0,?)').bind(iso(),String(e).slice(0,350)).run()}))},
 async fetch(req,env){const url=new URL(req.url),path=url.pathname;
  try{
   if(path==='/health')return json({service:'ghost-equal',status:'ok',version:'1.0.0'});
   if(path==='/manifest.webmanifest')return new Response(JSON.stringify({name:'GHOST EGAL Live',short_name:'GHOST EGAL',start_url:'/',scope:'/',display:'standalone',background_color:'#101719',theme_color:'#101719',icons:[{src:'/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any maskable'},{src:'/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]}),{headers:{'Content-Type':'application/manifest+json'}});
   if(path==='/icon-192.png'||path==='/icon-512.png')return new Response(await iconPng(path==='/icon-192.png'?192:512),{headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=86400'}});
   if(path==='/icon.svg')return new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="100" fill="#101719"/><circle cx="256" cy="256" r="155" fill="none" stroke="#f46757" stroke-width="35"/><text x="256" y="300" text-anchor="middle" fill="white" font-family="Arial" font-size="140" font-weight="bold">X</text></svg>',{headers:{'Content-Type':'image/svg+xml'}});
   if(path==='/sw.js')return new Response(sw,{headers:{'Content-Type':'application/javascript','Service-Worker-Allowed':'/','Cache-Control':'no-cache'}});
   if(path==='/')return new Response(html(),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer'}});
   if(path==='/api/pair'&&req.method==='POST'){const j=await req.json();if(!j.code||j.code!==env.PAIR_CODE)return json({error:'Cod incorect'},403);const t=b64(crypto.getRandomValues(new Uint8Array(32))),id=await hash(t);await env.DB.prepare('INSERT INTO ghost_equal_devices(token_hash,subscription,enabled,last_seen_utc) VALUES(?,NULL,1,?)').bind(id,iso()).run();return json({token:t})}
   if(path.startsWith('/api/')){
    if(!await authorize(req,env))return json({error:'401: dispozitiv neautorizat'},401);
    if(path==='/api/config')return json({vapidPublicKey:env.VAPID_PUBLIC});
    if(path==='/api/subscribe'&&req.method==='POST'){const j=await req.json(),sub=j.subscription;if(!sub||typeof sub.endpoint!=='string'||!sub.keys?.p256dh||!sub.keys?.auth)return json({error:'Invalid subscription'},400);const endpoint=new URL(sub.endpoint);if(endpoint.protocol!=='https:'||sub.endpoint.length>1300)return json({error:'Invalid endpoint'},400);const token=(req.headers.get('Authorization')||'').slice(7);await env.DB.prepare('UPDATE ghost_equal_devices SET subscription=?,enabled=1,last_seen_utc=? WHERE token_hash=?').bind(JSON.stringify(sub),iso(),await hash(token)).run();return json({ok:true})}
    if(path==='/api/test'&&req.method==='POST'){const t=(req.headers.get('Authorization')||'').slice(7),d=await env.DB.prepare('SELECT subscription FROM ghost_equal_devices WHERE token_hash=?').bind(await hash(t)).first();if(!d?.subscription)return json({error:'Activează mai întâi notificările'},400);const r=await webpush(env,JSON.parse(d.subscription),{title:'GHOST EGAL — TEST',body:'Notificările sunt configurate. Nu este un semnal de pariere.',url:'/',stage:'TEST',tag:'test'});return json({ok:r.ok,status:r.status})}
    if(path==='/api/scan'&&req.method==='POST'){const last=await env.DB.prepare('SELECT checked_utc FROM ghost_equal_runs ORDER BY id DESC LIMIT 1').first();if(last&&Date.now()-Date.parse(last.checked_utc)<45000)return json({skipped:true,reason:'recent scan'});return json(await scan(env))}
    if(path==='/api/alerts'){const rows=(await env.DB.prepare("SELECT event_id,stage,triggered_utc,minute,fixture,home_score,away_score,dgh10,dga10,p1,px,p2 FROM ghost_equal_alerts WHERE triggered_utc>=datetime('now','-3 days') ORDER BY triggered_utc DESC LIMIT 60").all()).results||[];return json({alerts:rows})}
    if(path==='/api/status'){const r=await env.DB.prepare('SELECT checked_utc,fixtures,samples,eligible,alerts,error FROM ghost_equal_runs ORDER BY id DESC LIMIT 1').first();const audit=await env.DB.prepare("SELECT COUNT(*) signals,COALESCE(SUM(CASE WHEN final_1x2 IS NOT NULL THEN 1 ELSE 0 END),0) settled,COALESCE(SUM(CASE WHEN final_1x2='X' THEN 1 ELSE 0 END),0) wins,COALESCE(SUM(CASE WHEN final_1x2 IN('1','2') THEN 1 ELSE 0 END),0) losses,ROUND(COALESCE(SUM(simulated_net_lei),0),2) simulated_net_lei FROM v_ghost_equal_forward_audit").first();return json({lastScan:r?.checked_utc||null,fixtures:r?.fixtures||0,run:r||null,audit})}
   }
   return json({error:'Not found'},404);
  }catch(e){console.error('fetch error',String(e));return json({error:'Internal error'},500)}
 }
};
