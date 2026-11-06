/* SB Radar Chrome Bridge — integrated admin dashboard. */
export function chromeBridgeDashboard(){
return '<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SB Radar • Executori Chrome</title><style>'+
':root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;padding:22px 15px 64px;background:#100c12;color:#f2edf2;font:14px system-ui,Arial}main{max-width:1080px;margin:auto}a{color:#fb839b;text-decoration:none}h1{margin:5px 0;font-size:26px}h2{font-size:17px;margin:0 0 12px}p{line-height:1.5}.muted{color:#b4aab6}.top{display:flex;justify-content:space-between;align-items:center;gap:15px;flex-wrap:wrap}.hero{border:1px solid #6e2b43;background:linear-gradient(130deg,#3b1025,#17101c);padding:22px;border-radius:18px;margin:12px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.tile,.device,.row{background:#201824;border:1px solid #493344;border-radius:14px;padding:14px}.tile b{font-size:27px;display:block;margin:5px 0}.pill{display:inline-flex;gap:7px;align-items:center;border:1px solid #604756;border-radius:99px;padding:5px 10px;font-weight:750;font-size:11px}.dot{display:inline-block;width:11px;height:11px;border-radius:50%;background:#f45163}.dot.green{background:#4bdc96;box-shadow:0 0 10px #3bcf8a99}.dot.amber{background:#f1b74b}.warn{color:#ffc28a}button{padding:9px 13px;border:0;background:#f31b48;border-radius:9px;color:white;cursor:pointer;font-weight:750}button:disabled{opacity:.5}.danger{background:#663042}input{background:#100e16;border:1px solid #69465e;color:white;border-radius:8px;padding:9px;width:120px;font-size:15px}.device{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin:8px 0}.device b{font-size:16px}.stack{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.list{margin-top:8px}section{margin:18px 0}.mini{font-size:12px;color:#afa3b0}code{font-size:11px}#message{min-height:22px;color:#e0c1ca}.logs{max-height:360px;overflow:auto} .row{margin-bottom:6px;padding:10px}hr{border:0;border-top:1px solid #513143;margin:18px 0}</style></head><body><main>'+
'<div class="top"><div><a href="/app">← SB Radar</a>　<a href="/admin">Cont Admin</a><h1>Chrome Bridge • Executori</h1><div class="muted">Conexiunea dintre extensiile Chrome și serverul SB Radar</div></div><span class="pill" id="global"><span class="dot"></span>Se verifică...</span></div>'+
'<div class="hero"><b>Stare centrală</b><p>Calculatoarele sunt înregistrate în Cloudflare D1. Verde = conectat la server în ultimele 50 de secunde; roșu = fără comunicare. Pregătirea și plasarea biletelor sunt operații distincte.</p><div class="grid"><div class="tile">Extensii înregistrate<b id="total">—</b></div><div class="tile">Conectate acum<b id="online">—</b></div><div class="tile">În așteptarea aprobării<b id="pending">—</b></div><div class="tile">Pariere automată<b id="execution">OPRITĂ</b></div></div></div>'+
'<section><h2>Calculatoare conectate</h2><div class="mini">La asociere, extensia cere utilizator și email. Confirmarea se face aici, pe contul Admin, introducând codul afișat de extensie.</div><div id="devices" class="list">Se încarcă...</div></section>'+
'<section><h2>Slip • Execuții Chrome</h2><p class="mini">Un bilet apare „plasat automat” numai după confirmarea de acceptare Superbet. O simplă apăsare pe buton nu constituie dovadă.</p><div id="claims">Nu există execuții încă.</div></section>'+
'<section><h2>Jurnal comunicații</h2><div id="logs" class="logs"></div></section>'+
'<div id="message"></div><p class="muted">Orice miză reală necesită activarea expresă a modulului, după verificarea sincronizării. Dispozitivele expirate ori revocate nu au acces la comenzi.</p>'+
'</main><script>'+
'const el=id=>document.getElementById(id);const txt=(id,s)=>el(id).textContent=String(s??"");'+
'const req=async(path,body)=>{const r=await fetch(path,{method:body?"POST":"GET",credentials:"same-origin",headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify(body):undefined});const j=await r.json();if(!r.ok)throw Error(j.error||"HTTP "+r.status);return j;};'+
'function since(ts){if(!ts)return "Niciodată";const t=Math.max(0,Math.round((Date.now()-Date.parse(ts))/1000));return t<60?t+" sec":Math.floor(t/60)+" min";}'+
'function node(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=String(text);return e;}'+
'function line(text){return node("div","mini",text);}'+
'function indicator(ok){const i=node("span","dot"+(ok?" green":""));return i;}'+
'async function approve(id,inp){try{const code=inp.value.trim();if(!/^\\d{6}$/.test(code))throw Error("Introdu codul de 6 cifre de pe calculator.");await req("/api/chrome/admin/approve",{device_id:id,code});txt("message","Dispozitiv aprobat.");await refresh();}catch(e){txt("message","Eroare asociere: "+e.message);}}'+
'async function revoke(id){if(!confirm("Revoci această extensie Chrome?"))return;try{await req("/api/chrome/admin/revoke",{device_id:id});txt("message","Dispozitiv revocat.");await refresh();}catch(e){txt("message",e.message);}}'+
'async function setPlan(id,plan,price,cycle){try{await req("/api/chrome/admin/license-plan",{device_id:id,plan_name:plan.value,price_lei:Number(price.value),billing_cycle:cycle.value});txt("message","Plan actualizat");await refresh()}catch(e){txt("message",e.message)}}'+
'async function payment(id,price){const v=prompt("Suma încasată în lei (0 doar pentru licență gratuită)",price.value||"0");if(v===null)return;const amount=Number(v.replace(",","."));if(!Number.isFinite(amount)||amount<0)return alert("Sumă invalidă");if(!confirm("Confirmi că această sumă a fost EFECTIV încasată? Nu este o debitare Stripe."))return;try{const ref="manual-"+crypto.randomUUID();const payload={device_id:id,amount_lei:amount,payment_reference:ref};if(amount===0)payload.free_days=30;const j=await req("/api/chrome/admin/license-payment",payload);txt("message","Licență extinsă cu "+j.days_added+" zile");await refresh()}catch(e){txt("message",e.message)}}'+
'async function revokeLicense(id){if(!confirm("Revoci licența acestui PC?"))return;try{await req("/api/chrome/admin/license-revoke",{device_id:id});await refresh()}catch(e){txt("message",e.message)}}'+
'function drawDevices(arr){const root=el("devices");root.replaceChildren();if(!arr.length){root.append(line("Nicio extensie asociată. Instalează Chrome Bridge pe calculator, apoi aprobă codul aici."));return;}for(const d of arr){const wrap=node("div","device");const a=node("div");const h=node("div","stack");h.append(indicator(d.online),node("b",null,d.display_name));h.append(node("span","pill",d.pairing_status==="active"?"ASOCIAT":d.pairing_status==="revoked"?"REVOCAT":"NEAPROBAT"));a.append(h,line(d.owner_username+" • v"+(d.install_version||"?")+" • Ultima comunicare: "+since(d.last_heartbeat_utc)),line("Superbet: "+(d.superbet_session_ok?"sesiune detectată":"neconfirmată")+" • "+d.device_id.slice(0,14)+"…"),line("Licență: "+(d.license_active?"ACTIVĂ":d.license_status||"NECONFIGURATĂ")+" • Expiră: "+(d.expires_utc||"—")+" • Încasat: "+(d.amount_paid_lei||0)+" lei"));if(d.last_error)a.append(line("Eroare: "+d.last_error));const side=node("div","stack");if(d.pairing_status==="pending"){const input=node("input");input.placeholder="Cod 6 cifre";input.inputMode="numeric";input.maxLength=6;const btn=node("button",null,"Aprobă");btn.addEventListener("click",()=>approve(d.device_id,input));side.append(input,btn);}if(d.pairing_status==="active"){const plan=node("input");plan.placeholder="Nume plan";plan.value=d.plan_name||"Personalizat";const price=node("input");price.placeholder="Lei/ciclu";price.value=String(d.monthly_price_lei??0);price.inputMode="decimal";const cycle=document.createElement("select");for(const [v,t] of [["monthly","Lunar"],["yearly","Anual"]]){const o=document.createElement("option");o.value=v;o.textContent=t;cycle.append(o);}cycle.value=d.billing_cycle||"monthly";const save=node("button",null,"Salvează plan");save.addEventListener("click",()=>setPlan(d.device_id,plan,price,cycle));const pay=node("button",null,"Înregistrează plata");pay.addEventListener("click",()=>payment(d.device_id,price));const rvL=node("button","danger","Revocă licența");rvL.addEventListener("click",()=>revokeLicense(d.device_id));const btn=node("button","danger","Revocă PC");btn.addEventListener("click",()=>revoke(d.device_id));side.append(plan,price,cycle,save,pay,rvL,btn);}wrap.append(a,side);root.append(wrap);}}'+
'function drawClaims(arr){const root=el("claims");root.replaceChildren();if(!arr.length){root.append(line("Niciun bilet automat confirmat sau în curs."));return;}for(const c of arr){const box=node("div","row");const h=node("div","stack");h.append(indicator(c.state==="placed"),node("b",null,c.fixture||c.event_id),node("span","pill",c.state==="placed"?"BILET PLASAT AUTOMAT":c.state.toUpperCase()));box.append(h,line((c.signal_category==="strong-silver"?"🟣":c.signal_category==="strong"?"🔴":"TEST")+" "+c.stake_lei+" lei • "+(c.device_id||"fără executor")+" • "+(c.bookmaker_ticket_id||"fără ID bilet")+" • "+since(c.updated_utc)));root.append(box);}}'+
'function drawEvents(arr){const root=el("logs");root.replaceChildren();for(const e of arr){root.append(node("div","row",e.logged_utc+" · "+e.kind+" · "+(e.description||"")+" · "+(e.device_id||"")));}}'+
'async function refresh(){try{const [d,c]=await Promise.all([req("/api/chrome/admin/devices"),req("/api/chrome/admin/claims")]);txt("total",d.total);txt("online",d.online);txt("pending",d.pending);txt("execution",d.execution_enabled?"ACTIVĂ":"OPRITĂ");el("global").replaceChildren(indicator(d.online>0),document.createTextNode(d.online+" / "+d.total+" online"));drawDevices(d.devices);drawClaims(c.claims);drawEvents(c.events);txt("message","Actualizat "+new Date().toLocaleTimeString("ro-RO"));}catch(e){txt("message","Conectează-te la /admin și revino: "+e.message);el("global").replaceChildren(indicator(false),document.createTextNode("NEAUTORIZAT"));}}'+
'refresh();setInterval(refresh,7000);'+
'</script></body></html>';
}
export function chromeBridgeRibbon(html){
 const snippet = `<script>(function(){
 let ready=false,lastAccepted=null;
 const em=(tag,cls,txt)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=txt;return x;};
 function initialize(){
  if(ready)return;const live=document.getElementById('live'),slip=document.getElementById('slip');
  if(!live||!slip)return;ready=true;
  const card=em('details','sbr-chrome-connect');
  card.style.cssText='background:linear-gradient(125deg,#251127,#11131e);border:1px solid #51314f;border-radius:14px;padding:10px 13px;margin:10px 0;color:#f3ebf1;font:12px system-ui';
  const summary=em('summary',null,'◉ Chrome Bridge • Se conectează...');
  summary.style.cssText='font-size:12px;font-weight:750;cursor:pointer;list-style:none';card.append(summary);
  const inner=em('div');inner.style.cssText='padding-top:10px;line-height:1.65;white-space:pre-line';inner.textContent='Verifică serverul…';card.append(inner);
  live.insertBefore(card,live.firstChild);
  const slipStatus=em('div',null,'◉ Chrome Bridge • nicio confirmare automată');
  slipStatus.style.cssText='background:#211524;padding:9px;border-radius:9px;margin:7px 0 14px;font:12px system-ui;color:#c5aeca';slip.insertBefore(slipStatus,slip.firstChild);
  async function poll(){
   if(document.hidden)return;
   try{
    const token=(window.DrixNative&&typeof DrixNative.getToken==='function')?DrixNative.getToken():'';
    if(!token){summary.textContent='◉ Chrome Bridge • Deschide în APK';return;}
    const r=await fetch('/api/mobile/chrome-overview',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
    if(!r.ok)throw Error('HTTP '+r.status);
    const data=await r.json(),devices=Array.isArray(data.devices)?data.devices:[],tickets=Array.isArray(data.tickets)?data.tickets:[];
    summary.textContent='◉ Chrome Bridge • '+data.online+'/'+data.total+' online • '+(data.execution_enabled?'EXECUȚIE ACTIVĂ':'AUTO OPRITĂ');
    inner.replaceChildren();
    const top=em('div',null,'EXECUTORI SB RADAR');top.style.fontWeight='700';inner.append(top);
    for(const d of devices){const on=!!d.online,mark=on?'🟢':'🔴';inner.append(em('div',null,mark+' '+d.display_name+' · '+(on?'Online':'Offline')+' · '+(d.license_active?'Licență activă':'Fără licență activă')));}
    if(!devices.length)inner.append(em('div',null,'Nu există extensii asociate. Admin → Chrome Bridge.'));
    const newTitle=em('div',null,'BILETE AUTOMATE — REZUMAT');newTitle.style.cssText='margin-top:9px;font-weight:700';inner.append(newTitle);
    for(const t of tickets.slice(0,8)){const placed=t.state==='placed';const item=em('div',null,(placed?'✅ BILET PLASAT AUTOMAT':'⏳ '+String(t.state||'').toUpperCase())+' • '+(t.fixture||'Meci')+' • '+t.stake_lei+' lei');inner.append(item);}
    if(!tickets.length)inner.append(em('div',null,'Niciun bilet automat confirmat.'));
    const confirmed=tickets.filter(x=>x.state==='placed');
    slipStatus.textContent='◉ Chrome Bridge • '+confirmed.length+' bilete confirmate în ultimele înregistrări; apasă Home → Chrome Bridge pentru detalii';
    if(confirmed.length){const newest=confirmed[0];const id=String(newest.bookmaker_ticket_id||newest.event_id);
     if(lastAccepted!==null&&id!==lastAccepted){
      const toast=em('div',null,'✅ BILET PLASAT AUTOMAT: '+newest.fixture+' · '+newest.stake_lei+' lei');
      toast.style.cssText='position:fixed;z-index:99999;top:58px;left:10px;right:10px;padding:13px;background:#173d31;border:1px solid #53df9c;border-radius:12px;color:#fff;font:700 13px system-ui;box-shadow:0 12px 26px #0008';
      document.body.append(toast);setTimeout(()=>toast.remove(),6500);
      try{if(window.DrixNative&&typeof DrixNative.autoTicketPlaced==='function')DrixNative.autoTicketPlaced(id,String(newest.fixture||''),Number(newest.stake_lei)||0);}catch(e){}
     }lastAccepted=id;
    }
   }catch(e){summary.textContent='◉ Chrome Bridge • Comunicare indisponibilă';inner.textContent='Nu se poate verifica statusul. '+String(e.message||'');}
  }
  poll();setInterval(poll,12000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
 })();</script>`;
 return html.includes('</body>')?html.replace('</body>',snippet+'</body>'):html;
}
