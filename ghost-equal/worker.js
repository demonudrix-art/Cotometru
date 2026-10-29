
const API='https://production-superbet-offer-ro.freetls.fastly.net/v3/ro-RO/events';
const LIVE='https://superbet.ro/pariuri-sportive/fotbal/live';
function matchUrl(id,fixture){
 const name=String(fixture||'').split(/[·•|]/);
 if(name.length!==2||!Number.isSafeInteger(Number(id))||Number(id)<1)return LIVE;
 const slug=x=>x.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,110);
 const a=slug(name[0]),b=slug(name[1]);return a&&b?'https://superbet.ro/cote/fotbal/'+a+'-vs-'+b+'-'+id:LIVE;
}
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
 const payload={title,body,eventId:a.event_id,stage:a.stage,url:matchUrl(a.event_id,a.fixture),tag:'ghost-'+a.event_id+'-'+a.stage};
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
const $=id=>document.getElementById(id);let token=localStorage.getItem('ghost_eq_token')||'';const matchUrl=(id,fixture)=>{const pair=String(fixture||'').split(/[·•|]/);const slug=x=>x.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,110);return pair.length===2?'https://superbet.ro/cote/fotbal/'+slug(pair[0])+'-vs-'+slug(pair[1])+'-'+id:'https://superbet.ro/pariuri-sportive/fotbal/live';};
const api=async(path,opt={})=>{let r=await fetch(path,{...opt,headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,...opt.headers}});let j=await r.json();if(!r.ok)throw Error(j.error||'HTTP '+r.status);return j};
function layout(){const ok=!!token;$('login').classList.toggle('hide',ok);$('account').classList.toggle('hide',!ok)}
$('activate').onclick=async()=>{try{const j=await api('/api/pair',{method:'POST',body:JSON.stringify({code:$('pair').value.trim()})});token=j.token;localStorage.setItem('ghost_eq_token',token);$('pair').value='';layout();refresh()}catch(e){alert(e.message)}};
const swPromise='serviceWorker'in navigator?navigator.serviceWorker.register('/sw.js'):Promise.reject(Error('Not supported'));
$('notify').onclick=async()=>{try{const reg=await swPromise;const perm=await Notification.requestPermission();if(perm!=='granted')throw Error('Permisiunea notificărilor este blocată');const conf=await api('/api/config');let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:conf.vapidPublicKey});await api('/api/subscribe',{method:'POST',body:JSON.stringify({subscription:sub.toJSON()})});$('state').textContent='Notificări push activate pe acest dispozitiv.'}catch(e){$('state').textContent='Eroare notificări: '+e.message}};
$('test').onclick=async()=>{try{await api('/api/test',{method:'POST'});$('state').textContent='Notificare de test trimisă (dacă permisiunea este activă).'}catch(e){$('state').textContent=e.message}};
$('refresh').onclick=refresh;
async function refresh(){if(!token)return;try{const [j,s]=await Promise.all([api('/api/alerts'),api('/api/status')]);$('health').textContent='Ultima scanare: '+(s.lastScan||'niciuna')+' | Evenimente: '+(s.fixtures??'-')+' | Semnale: '+j.alerts.length+' | BET NOW decontate: '+(s.audit?.settled||0)+' | Simulare: '+(s.audit?.simulated_net_lei||0)+' lei';$('list').replaceChildren();if(!j.alerts.length){$('list').textContent='Momentan nu există semnale. Monitorizarea continuă pe server.'}for(const x of j.alerts){const c=document.createElement('div');c.className='card '+(x.stage==='BET_NOW'?'bet':'prep');const h=document.createElement('div');h.className='title';h.textContent=(x.stage==='BET_NOW'?'🔴 BET NOW X':'🟡 PREGĂTEȘTE-TE')+' — '+x.fixture;const m=document.createElement('p');m.textContent=x.minute+"' | scor "+x.home_score+'–'+x.away_score+' | cota X '+Number(x.px).toFixed(2);const s=document.createElement('small');s.textContent='Scădere curbe: '+Number(x.dgh10).toFixed(3)+' / '+Number(x.dga10).toFixed(3)+' | '+x.triggered_utc;const a=document.createElement('a');a.className='action';a.href=matchUrl(x.event_id,x.fixture);a.target='_blank';a.rel='noopener noreferrer';a.textContent='Deschide meciul Superbet';c.append(h,m,s,document.createElement('p'),a);$('list').append(c)}}catch(e){$('health').textContent='Nu se poate încărca: '+e.message;if(e.message.includes('401')){token='';localStorage.removeItem('ghost_eq_token');layout()}}}
layout();refresh();setInterval(refresh,30000);setInterval(()=>{if(!document.hidden&&token)api('/api/scan',{method:'POST'}).then(refresh).catch(e=>{$('state').textContent='Scanare manuală: '+e.message})},50000);
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

// Fast lane: 25-second polling only while kickoff-window candidates exist.
// The 1-minute Cloudflare Cron is retained as watchdog and starter.
async function armFastLane(env){
 if(!env.FAST_TICK)return;
 const id=env.FAST_TICK.idFromName('ghost-equal-global');
 await env.FAST_TICK.get(id).fetch('https://timer.internal/arm',{method:'POST'});
}
export class GhostEqualFastTicker {
 constructor(state,env){this.state=state;this.env=env;}
 async fetch(request){
  const at=await this.state.storage.getAlarm();
  if(at===null)await this.state.storage.setAlarm(Date.now()+5000);
  return new Response('armed',{status:202});
 }
 async alarm(){
  try{
   const now=Date.now();
   const current=await this.env.DB.prepare('SELECT COUNT(*) n FROM quote_state WHERE settled=0 AND kickoff_utc<=? AND kickoff_utc>=?').bind(new Date(now).toISOString(),new Date(now-3*3600000).toISOString()).first();
   if(!current?.n)return;
   // Schedule next iteration before external IO, so a temporary feed problem doesn't stop watching.
   await this.state.storage.setAlarm(Date.now()+25000);
   await scan(this.env);
  }catch(e){
   console.error('GHOST_FAST_TICK_ERROR',String(e).slice(0,240));
   await this.state.storage.setAlarm(Date.now()+60000);
  }
 }
}


function nativeAppHtml(){return \`<!doctype html><html lang="ro"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0d151b"><title>DRIX Pulse</title><style>
:root{color-scheme:dark;font-family:system-ui,-apple-system,Roboto,Arial;background:#0d151b;color:#f3f8f7}*{box-sizing:border-box}body{margin:0 auto;max-width:680px;background:radial-gradient(ellipse 90% 45% at 90% -15%,#174b45 0%,transparent 65%),#0d151b;min-height:100vh;padding:20px 17px 115px}header{display:flex;align-items:center;justify-content:space-between;padding:10px 1px 22px}.brand{display:flex;align-items:center;gap:12px}.mark{width:45px;height:45px;border:2px solid #ff7464;border-radius:15px;color:#ff7464;display:grid;place-items:center;font-size:26px;font-weight:900;box-shadow:0 0 22px #ff6e5c24}h1{font-size:24px;letter-spacing:-1px;margin:0}h1 span{color:#65e9b6}.micro{font-size:11px;letter-spacing:2px;font-weight:800;color:#7d9b98}.status{font-size:11px;background:#16362e;border:1px solid #2d6852;color:#62dda5;border-radius:24px;padding:8px 10px;font-weight:800}.hero{background:linear-gradient(135deg,#1a3438,#17242c 68%);border:1px solid #345057;border-radius:24px;padding:24px 20px 20px;box-shadow:0 12px 40px #0004}.tiny{font-size:11px;font-weight:750;color:#8ca5a8;letter-spacing:1px}.hero h2{font-size:25px;letter-spacing:-.8px;margin:12px 0}.hero p{color:#abc0bf;font-size:13px;line-height:1.5;margin:9px 0 16px}.action{display:inline-block;background:#ff7568;border:none;border-radius:13px;padding:12px 15px;color:#182022;font-weight:850;font-size:13px;text-decoration:none;cursor:pointer}.action.green{background:#5ce2af}.action.ghost{background:#294448;color:#e2f3ed}.action.dim{background:#273239;color:#d3dddd}.action:disabled{opacity:.48}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 0}.kpi{background:#17222a;border:1px solid #2c3d45;border-radius:18px;padding:16px}.kpi .num{font-size:25px;font-weight:850;margin-top:7px;letter-spacing:-1px}.kpi span{font-size:11px;color:#93aaa9}h3{font-size:17px;letter-spacing:-.3px;margin:23px 0 12px}.card{padding:16px;background:#19252c;border:1px solid #34434b;border-radius:18px;margin:11px 0}.card.urgent{border-color:#ff7568;box-shadow:0 0 0 1px #ff756822}.card.prepare{border-color:#a58e5a}.row{display:flex;align-items:center;justify-content:space-between;gap:8px}.fixture{font-size:17px;font-weight:800;margin:9px 0;line-height:1.3}.sub{color:#a4b7b8;font-size:12px;line-height:1.5}.tag{font-size:11px;color:#fbcc7d;font-weight:850}.tag.red{color:#ff8176}.bigodd{font-size:25px;color:#fff;font-weight:900}.btnrow{display:flex;gap:9px;margin-top:14px;flex-wrap:wrap}.muted{color:#8ca7a6;font-size:12px}.empty{border:1px dashed #365258;border-radius:16px;padding:24px;text-align:center;color:#a1bbba}.bottom{position:fixed;left:0;right:0;bottom:0;background:#111b22eF;backdrop-filter:blur(20px);border-top:1px solid #314047;padding:9px max(12px,env(safe-area-inset-left)) calc(9px + env(safe-area-inset-bottom));display:flex;justify-content:center;gap:5px}.bottom button{width:31%;max-width:200px;background:transparent;color:#79918f;border:0;border-radius:13px;padding:11px 6px;font-size:12px;font-weight:800;cursor:pointer}.bottom button.active{background:#1a3433;color:#6ce5b5}.hidden{display:none!important}input,textarea{width:100%;border:1px solid #375059;border-radius:12px;padding:13px;background:#0e191f;color:white;font:inherit;outline:none}input:focus,textarea:focus{border-color:#65d8ae}label{display:block;font-size:12px;color:#a3b9b7;margin:12px 0 6px;font-weight:650}form{background:#18252d;border:1px solid #30474b;padding:17px;border-radius:19px}.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.all{width:100%;margin-top:15px}.good{color:#69e5a9}.bad{color:#ff8579}.metric{font-size:31px;font-weight:900}.screen{min-height:100px}.settle button{margin-top:7px}.note{font-size:11px;color:#7c9997;margin-top:8px}</style></head><body>
<header><div class="brand"><div class="mark">X</div><div><div class="micro">PERSONAL SIGNAL DESK</div><h1>DRIX <span>Pulse</span></h1></div></div><div id="chip" class="status">SE CONECTEAZĂ</div></header>
<section id="live" class="screen"><div class="hero"><div class="tiny">GHOST EGAL • LIVE MONITOR</div><h2>Un pas înaintea egalului.</h2><p>Semnale pregătitoare din minutul 50 și BET NOW după minutul 57. Alertele sunt semnale, nu pariuri plasate.</p><div class="btnrow"><button id="monitor" class="action green" onclick="monitor()">Pornește monitorizarea</button><button class="action ghost" onclick="testAlert()">Testează alerta</button></div><div class="note" id="heartbeat">Se încarcă datele...</div></div><div class="grid"><div class="kpi"><span>SEMNALE BET NOW</span><div id="signalsCount" class="num">—</div></div><div class="kpi"><span>PARIURI ÎNREGISTRATE</span><div id="betsCount" class="num">—</div></div></div><h3>Radarul semnalelor</h3><div id="alerts"><div class="empty">Căutăm meciuri eligibile…</div></div></section>
<section id="slip" class="screen hidden"><h3>Slip de pariuri</h3><p class="sub">Înregistrează numai un pariu pe care l-ai plasat efectiv. Cota reală și miza determină ROI-ul.</p><form id="betform"><input type="hidden" id="eventId"><label>Meci</label><input id="fixture" maxlength="180" required placeholder="Ex. Echipa A – Echipa B"><div class="two"><div><label>Selecție</label><input value="X • Egal" disabled></div><div><label>Cotă reală</label><input id="odds" type="number" min="1.01" max="10000" step=".01" inputmode="decimal" required placeholder="2.45"></div></div><div class="two"><div><label>Miză (RON)</label><input id="stake" type="number" min=".01" max="1000000" step=".01" inputmode="decimal" value="50" required></div><div><label>Data & ora</label><input id="placed" disabled></div></div><button type="submit" class="action green all">Confirmă că am pus X</button><div class="note" id="betmsg">Pariurile nu sunt plasate de aplicație; aici le înregistrezi pentru audit.</div></form><h3>Jurnalul meu</h3><div id="bets"></div></section>
<section id="roi" class="screen hidden"><h3>Rezultatele mele reale</h3><div class="card"><div class="tiny">PROFIT NET • PARIURI DECONTATE</div><div class="metric" id="net">0,00 lei</div><p class="muted">Calculat numai din pariurile efectiv înregistrate și decontate.</p></div><div class="grid"><div class="kpi"><span>ROI REAL</span><div class="num" id="roiValue">—</div></div><div class="kpi"><span>RATĂ CÂȘTIG</span><div class="num" id="winrate">—</div></div><div class="kpi"><span>MIZE DECONTATE</span><div class="num" id="totalStake">0</div></div><div class="kpi"><span>PARIURI DESCHISE</span><div class="num" id="open">0</div></div></div><h3>Audit personal</h3><p class="sub">Mizele pariurilor încă deschise nu sunt considerate pierdere. Rezultatele pot fi marcate manual, iar cele cu identificator de meci pot fi decontate automat după confirmarea rezultatului oficial.</p><div id="history"></div></section>
<nav class="bottom"><button id="tab-live" class="active" onclick="tab('live')">◉ &nbsp;LIVE</button><button id="tab-slip" onclick="tab('slip')">✎ &nbsp;SLIP</button><button id="tab-roi" onclick="tab('roi')">▥ &nbsp;ROI</button></nav>
<script>
const $=id=>document.getElementById(id); const token=window.DrixNative?window.DrixNative.getToken():'';const money=x=>Number(x||0).toLocaleString('ro-RO',{minimumFractionDigits:2,maximumFractionDigits:2});const tm=s=>{if(!s)return '—';let d=new Date(s.endsWith('Z')||s.includes('+')?s:s.replace(' ','T')+'Z');return d.toLocaleString('ro-RO',{timeZone:'Europe/Bucharest',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})};const text=(tag,v,cls)=>{const x=document.createElement(tag);x.textContent=v;if(cls)x.className=cls;return x};const api=async(p,opt={})=>{let r=await fetch(p,{...opt,headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,...opt.headers}});let d=await r.json();if(!r.ok)throw Error(d.error||'Eroare HTTP '+r.status);return d};
function tab(v){for(const x of ['live','slip','roi']){$(x).classList.toggle('hidden',x!==v);$('tab-'+x).classList.toggle('active',x===v)}if(v==='slip')$('placed').value=tm(new Date().toISOString());if(v==='roi')load()}
async function monitor(){if(!window.DrixNative)return alert('Monitorizarea pe ecran blocat este disponibilă în aplicația Android.');let state=window.DrixNative.isMonitoring();if(state==='true')window.DrixNative.stopMonitor();else window.DrixNative.startMonitor();setTimeout(showMonitor,650)}
function showMonitor(){if(!window.DrixNative)return;$('monitor').textContent=window.DrixNative.isMonitoring()==='true'?'Oprește monitorizarea':'Pornește monitorizarea';}
function testAlert(){if(window.DrixNative)window.DrixNative.testNotification();else alert('Testul nativ funcționează în APK.')}
function selectBet(x){$('eventId').value=x.event_id||'';$('fixture').value=x.fixture||'';$('odds').value=x.px||'';tab('slip');window.scrollTo(0,0)}
let lastAlerts=[];
async function load(){if(!token){$('chip').textContent='FĂRĂ ACCES';return}try{const d=await api('/api/mobile/dashboard');$('chip').textContent='● MONITOR ONLINE';$('heartbeat').textContent='Ultima scanare: '+tm(d.lastScan)+' • Ore România • Verifică și cota la operator';$('signalsCount').textContent=d.alerts.filter(x=>x.stage==='BET_NOW').length;$('betsCount').textContent=d.bets.length;lastAlerts=d.alerts;const root=$('alerts');root.replaceChildren();if(!d.alerts.length)root.append(text('div','Momentan nu există semnale eligibile. Scanarea continuă pe server.','empty'));for(const x of d.alerts){const c=text('div','','card '+(x.stage==='BET_NOW'?'urgent':'prepare'));const head=text('div',x.stage==='BET_NOW'?'● BET NOW X':'● PREGĂTEȘTE-TE','tag '+(x.stage==='BET_NOW'?'red':''));const flex=text('div','','row');flex.append(head,text('div',tm(x.triggered_utc),'muted'));c.append(flex,text('div',x.fixture,'fixture'),text('div',x.minute+"′ • scor "+x.home_score+'–'+x.away_score,'sub'));const odd=text('div','X  '+money(x.px),'bigodd');c.append(odd);const rr=text('div','','btnrow');const a=text('a','Deschide Superbet','action');a.href=x.url;a.target='_blank';a.rel='noopener';const b=text('button','Am pus X','action ghost');b.onclick=()=>selectBet(x);rr.append(a,b);c.append(rr);root.append(c)}
const r=d.roi;$('net').textContent=money(r.net)+' lei';$('net').className='metric '+(r.net<0?'bad':'good');$('roiValue').textContent=r.roi===null?'—':money(r.roi)+'%';$('winrate').textContent=r.winrate===null?'—':money(r.winrate)+'%';$('totalStake').textContent=money(r.settledStake)+' lei';$('open').textContent=r.open;for(const id of ['bets','history']){$(id).replaceChildren();for(const b of d.bets){const c=text('div','','card');let row=text('div','','row');row.append(text('strong',b.fixture),text('span',b.status,'tag'));c.append(row,text('div','X • cota '+money(b.odds)+' • '+money(b.stake_lei)+' lei • '+tm(b.placed_utc),'sub'));if(b.status!=='OPEN'){const net=Number(b.returned_lei)-Number(b.stake_lei);c.append(text('div',(net>=0?'+':'')+money(net)+' lei',net>=0?'good':'bad'))}else{const rr=text('div','','btnrow settle');for(const status of ['WON','LOST','VOID','CASHOUT']){const btn=text('button',({WON:'Câștigat',LOST:'Pierdut',VOID:'Anulat',CASHOUT:'Cash out'})[status],'action dim');btn.onclick=()=>settle(b,status);rr.append(btn)}c.append(rr)}$(id).append(c)}if(!d.bets.length)$(id).append(text('div','Nu ai înregistrat încă pariuri.','empty'))}
}catch(e){$('chip').textContent='● CONEXIUNE PIERDUTĂ';$('heartbeat').textContent=e.message}}
async function settle(b,status){let amount; if(status==='CASHOUT'){const x=prompt('Ce sumă ai primit la cash out (lei)?','0');if(x===null)return;amount=Number(x.replace(',','.'));if(!Number.isFinite(amount)||amount<0)return alert('Sumă invalidă')}if(!confirm('Confirmi rezultatul '+status+' pentru '+b.fixture+'?'))return;try{await api('/api/mobile/bets/'+b.id+'/settle',{method:'POST',body:JSON.stringify({status,returned_lei:amount})});await load()}catch(e){alert(e.message)}}
$('betform').onsubmit=async e=>{e.preventDefault();const data={client_ref:crypto.randomUUID(),event_id:$('eventId').value?Number($('eventId').value):null,fixture:$('fixture').value.trim(),odds:Number($('odds').value),stake_lei:Number($('stake').value)};const b=$('betform').querySelector('button[type=submit]');b.disabled=true;try{await api('/api/mobile/bets',{method:'POST',body:JSON.stringify(data)});$('betmsg').textContent='✓ Pariu X salvat în jurnal la ora României';$('fixture').value='';$('eventId').value='';$('odds').value='';await load()}catch(err){$('betmsg').textContent='Eroare: '+err.message}finally{b.disabled=false}};
showMonitor();$('placed').value=tm(new Date().toISOString());load();setInterval(()=>{load();showMonitor()},25000);
</script></body></html>\`}
async function mobileWho(req,env){const t=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');if(t.length<35)return null;return await env.DB.prepare('SELECT device_id FROM ghost_equal_mobile_devices WHERE token_hash=?').bind(await hash(t)).first();}
async function settleVerified(env){
 await env.DB.prepare("UPDATE ghost_equal_bets SET status=CASE WHEN (SELECT winner_1x2 FROM match_results WHERE event_id=ghost_equal_bets.event_id AND verified=1)='X' THEN 'WON' ELSE 'LOST' END,returned_lei=CASE WHEN (SELECT winner_1x2 FROM match_results WHERE event_id=ghost_equal_bets.event_id AND verified=1)='X' THEN ROUND(stake_lei*odds,2) ELSE 0 END,settled_utc=? WHERE status='OPEN' AND event_id IS NOT NULL AND event_id IN (SELECT event_id FROM match_results WHERE verified=1 AND winner_1x2 IN ('1','X','2'))").bind(iso()).run();
}
async function mobileDashboard(env,deviceId){
 await settleVerified(env);
 const alerts=(await env.DB.prepare("SELECT event_id,stage,triggered_utc,minute,fixture,home_score,away_score,px FROM ghost_equal_alerts WHERE triggered_utc>=? ORDER BY triggered_utc DESC LIMIT 45").bind(new Date(Date.now()-72*3600000).toISOString()).all()).results||[];
 const bets=(await env.DB.prepare('SELECT id,event_id,fixture,selection,stake_lei,odds,placed_utc,status,returned_lei,settled_utc FROM ghost_equal_bets WHERE device_id=? ORDER BY placed_utc DESC,id DESC LIMIT 300').bind(deviceId).all()).results||[];
 const a=await env.DB.prepare("SELECT COUNT(*) total, SUM(CASE WHEN status='OPEN' THEN 1 ELSE 0 END) open, SUM(CASE WHEN status<>'OPEN' THEN stake_lei ELSE 0 END) settledStake, SUM(CASE WHEN status<>'OPEN' THEN returned_lei-stake_lei ELSE 0 END) net, SUM(CASE WHEN status='WON' THEN 1 ELSE 0 END) wins, SUM(CASE WHEN status IN ('WON','LOST') THEN 1 ELSE 0 END) graded FROM ghost_equal_bets WHERE device_id=?").bind(deviceId).first();
 const settledStake=Number(a?.settledStake||0),net=Number(a?.net||0),graded=Number(a?.graded||0);
 const scan=await env.DB.prepare('SELECT checked_utc FROM ghost_equal_runs ORDER BY id DESC LIMIT 1').first();
 return {lastScan:scan?.checked_utc||null,alerts:alerts.map(x=>({...x,url:matchUrl(x.event_id,x.fixture)})),bets,roi:{total:Number(a?.total||0),open:Number(a?.open||0),settledStake,net:Math.round(net*100)/100,roi:settledStake?Math.round(net/settledStake*10000)/100:null,winrate:graded?Math.round(Number(a?.wins||0)/graded*10000)/100:null}};
}
async function mobileApi(req,env,path){
 if(path==='/api/mobile/claim'&&req.method==='POST'){
  const j=await req.json(),deviceId=String(j.device_id||''),token=String(j.token||'');
  if(!/^[A-Za-z0-9-]{30,80}$/.test(deviceId)||!(/^[A-Za-z0-9_-]{40,128}$/.test(token)))return json({error:'Instalare invalidă'},400);
  const h=await hash(token);
  await env.DB.prepare("INSERT OR IGNORE INTO ghost_equal_mobile_devices(device_id,token_hash,created_utc,last_seen_utc) SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM ghost_equal_mobile_devices)").bind(deviceId,h,iso(),iso()).run();
  const ok=await env.DB.prepare('SELECT 1 yes FROM ghost_equal_mobile_devices WHERE device_id=? AND token_hash=?').bind(deviceId,h).first();
  return ok?json({ok:true}):json({error:'Aplicația este deja asociată altui dispozitiv. Nu s-a activat o nouă instalare.'},409);
 }
 const who=await mobileWho(req,env);if(!who)return json({error:'Acces Android neautorizat'},401);
 if(path==='/api/mobile/dashboard'&&req.method==='GET')return json(await mobileDashboard(env,who.device_id));
 if(path==='/api/mobile/alerts'&&req.method==='GET'){
  const a=(await env.DB.prepare("SELECT event_id,stage,triggered_utc,minute,fixture,px FROM ghost_equal_alerts WHERE triggered_utc >= ? ORDER BY triggered_utc DESC LIMIT 30").bind(new Date(Date.now()-6*3600000).toISOString()).all()).results||[];
  return json({alerts:a.map(x=>({...x,url:matchUrl(x.event_id,x.fixture)}))});
 }
 if(path==='/api/mobile/bets'&&req.method==='POST'){
  const j=await req.json(),ref=String(j.client_ref||''),fixture=String(j.fixture||'').trim(),eventId=j.event_id==null?null:Number(j.event_id),stake=Number(j.stake_lei),odds=Number(j.odds);
  if(!/^[0-9a-f-]{36}$/.test(ref)||fixture.length<3||fixture.length>180||!Number.isFinite(stake)||stake<.01||stake>1000000||!Number.isFinite(odds)||odds<1.01||odds>10000||(eventId!==null&&(!Number.isSafeInteger(eventId)||eventId<1)))return json({error:'Date pariului invalide'},400);
  await env.DB.prepare("INSERT OR IGNORE INTO ghost_equal_bets(client_ref,device_id,event_id,fixture,selection,stake_lei,odds,placed_utc,status) VALUES(?,?,?,?, 'X',?,?,?,'OPEN')").bind(ref,who.device_id,eventId,fixture,Math.round(stake*100)/100,odds,iso()).run();
  const b=await env.DB.prepare('SELECT id,status,placed_utc FROM ghost_equal_bets WHERE client_ref=? AND device_id=?').bind(ref,who.device_id).first();
  return b?json({ok:true,bet:b}):json({error:'Pariul nu a putut fi salvat'},500);
 }
 const m=path.match(/^\/api\/mobile\/bets\/(\d+)\/settle$/);
 if(m&&req.method==='POST'){
  const j=await req.json(),state=String(j.status||''),id=Number(m[1]);
  if(!['WON','LOST','VOID','CASHOUT'].includes(state)||!Number.isSafeInteger(id))return json({error:'Rezultat invalid'},400);
  const bet=await env.DB.prepare("SELECT stake_lei,odds,status FROM ghost_equal_bets WHERE id=? AND device_id=?").bind(id,who.device_id).first();
  if(!bet||bet.status!=='OPEN')return json({error:'Pariul nu este deschis'},409);
  const returned=state==='WON'?Math.round(Number(bet.stake_lei)*Number(bet.odds)*100)/100:state==='VOID'?Number(bet.stake_lei):state==='LOST'?0:Number(j.returned_lei);
  if(!Number.isFinite(returned)||returned<0||returned>1e8)return json({error:'Sumă primită invalidă'},400);
  await env.DB.prepare("UPDATE ghost_equal_bets SET status=?,returned_lei=?,settled_utc=? WHERE id=? AND device_id=? AND status='OPEN'").bind(state,returned,iso(),id,who.device_id).run();
  return json({ok:true});
 }
 return json({error:'Nu există această acțiune'},404);
}

export default {
 async scheduled(event,env,ctx){ctx.waitUntil((async()=>{const r=await scan(env);if(r.fixtures>0)await armFastLane(env)})().catch(async e=>{console.error('scan error',String(e));await env.DB.prepare('INSERT INTO ghost_equal_runs(checked_utc,fixtures,samples,eligible,alerts,error) VALUES(?,0,0,0,0,?)').bind(iso(),String(e).slice(0,350)).run()}))},
 async fetch(req,env){const url=new URL(req.url),path=url.pathname;
  try{
   if(path==='/app')return new Response(nativeAppHtml(),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",'X-Frame-Options':'DENY'}});
   if(path.startsWith('/api/mobile/'))return mobileApi(req,env,path);
   if(path==='/health')return json({service:'ghost-equal',status:'ok',version:'1.2.0'});
   if(path==='/manifest.webmanifest')return new Response(JSON.stringify({name:'GHOST EGAL Live',short_name:'GHOST EGAL',start_url:'/',scope:'/',display:'standalone',background_color:'#101719',theme_color:'#101719',icons:[{src:'/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any maskable'},{src:'/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]}),{headers:{'Content-Type':'application/manifest+json'}});
   if(path==='/icon-192.png'||path==='/icon-512.png')return new Response(await iconPng(path==='/icon-192.png'?192:512),{headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=86400'}});
   if(path==='/icon.svg')return new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="100" fill="#101719"/><circle cx="256" cy="256" r="155" fill="none" stroke="#f46757" stroke-width="35"/><text x="256" y="300" text-anchor="middle" fill="white" font-family="Arial" font-size="140" font-weight="bold">X</text></svg>',{headers:{'Content-Type':'image/svg+xml'}});
   if(path==='/sw.js')return new Response(sw,{headers:{'Content-Type':'application/javascript','Service-Worker-Allowed':'/','Cache-Control':'no-cache'}});
   if(path==='/')return new Response(html(),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer'}});
   if(path==='/api/pair'&&req.method==='POST'){const j=await req.json();if(!j.code||j.code!==env.PAIR_CODE)return json({error:'Cod incorect'},403);const t=b64(crypto.getRandomValues(new Uint8Array(32))),id=await hash(t);await env.DB.prepare('INSERT INTO ghost_equal_devices(token_hash,subscription,enabled,last_seen_utc) VALUES(?,NULL,1,?)').bind(id,iso()).run();return json({token:t})}
   if(path.startsWith('/api/')){
    if(!await authorize(req,env))return json({error:'401: dispozitiv neautorizat'},401);
    if(path==='/api/config')return json({vapidPublicKey:(await getVapid(env)).publicKey});
    if(path==='/api/subscribe'&&req.method==='POST'){const j=await req.json(),sub=j.subscription;if(!sub||typeof sub.endpoint!=='string'||!sub.keys?.p256dh||!sub.keys?.auth)return json({error:'Invalid subscription'},400);const endpoint=new URL(sub.endpoint);if(endpoint.protocol!=='https:'||sub.endpoint.length>1300)return json({error:'Invalid endpoint'},400);const token=(req.headers.get('Authorization')||'').slice(7);await env.DB.prepare('UPDATE ghost_equal_devices SET subscription=?,enabled=1,last_seen_utc=? WHERE token_hash=?').bind(JSON.stringify(sub),iso(),await hash(token)).run();return json({ok:true})}
    if(path==='/api/test'&&req.method==='POST'){const t=(req.headers.get('Authorization')||'').slice(7),d=await env.DB.prepare('SELECT subscription FROM ghost_equal_devices WHERE token_hash=?').bind(await hash(t)).first();if(!d?.subscription)return json({error:'Activează mai întâi notificările'},400);const r=await webpush(env,JSON.parse(d.subscription),{title:'GHOST EGAL — TEST',body:'Notificările sunt configurate. Nu este un semnal de pariere.',url:'/',stage:'TEST',tag:'test'});return r.ok?json({ok:true,status:r.status}):json({error:'Push respins de gateway: '+r.status},502)}
    if(path==='/api/scan'&&req.method==='POST'){const last=await env.DB.prepare('SELECT checked_utc FROM ghost_equal_runs ORDER BY id DESC LIMIT 1').first();if(last&&Date.now()-Date.parse(last.checked_utc)<45000)return json({skipped:true,reason:'recent scan'});const result=await scan(env);if(result.fixtures>0)await armFastLane(env);return json(result)}
    if(path==='/api/alerts'){const rows=(await env.DB.prepare("SELECT event_id,stage,triggered_utc,minute,fixture,home_score,away_score,dgh10,dga10,p1,px,p2 FROM ghost_equal_alerts WHERE triggered_utc>=datetime('now','-3 days') ORDER BY triggered_utc DESC LIMIT 60").all()).results||[];return json({alerts:rows})}
    if(path==='/api/status'){const r=await env.DB.prepare('SELECT checked_utc,fixtures,samples,eligible,alerts,error FROM ghost_equal_runs ORDER BY id DESC LIMIT 1').first();const audit=await env.DB.prepare("SELECT COUNT(*) signals,COALESCE(SUM(CASE WHEN final_1x2 IS NOT NULL THEN 1 ELSE 0 END),0) settled,COALESCE(SUM(CASE WHEN final_1x2='X' THEN 1 ELSE 0 END),0) wins,COALESCE(SUM(CASE WHEN final_1x2 IN('1','2') THEN 1 ELSE 0 END),0) losses,ROUND(COALESCE(SUM(simulated_net_lei),0),2) simulated_net_lei FROM v_ghost_equal_forward_audit").first();return json({lastScan:r?.checked_utc||null,fixtures:r?.fixtures||0,run:r||null,audit})}
   }
   return json({error:'Not found'},404);
  }catch(e){console.error('fetch error',String(e));return json({error:'Internal error'},500)}
 }
};
