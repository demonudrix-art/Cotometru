// SB Radar System Pulse: passive read-only diagnostics. Never creates or retries bets.
const ORIGIN = 'https://ghost-equal-alert-v1.drix-beast-xray.workers.dev';
const HEADERS = {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const json = (body,status=200,origin=false) => new Response(JSON.stringify(body),{status,headers:{...HEADERS,...(origin?{'access-control-allow-origin':ORIGIN,'vary':'Origin'}:{})}});
const seconds = value => {
  if(!value) return Infinity;
  let v=String(value).trim().replace(' ','T');
  if(!/[zZ]$|[+-]\d\d:\d\d$/.test(v)) v+='Z';
  const n=Date.parse(v);
  return Number.isFinite(n)?Math.max(0,Math.floor((Date.now()-n)/1000)):Infinity;
};
const phase=(status,detail,metric={})=>({status,detail:String(detail||'').slice(0,240),metric});
const read=async(db,sql)=> {
  try{return {row:await db.prepare(sql).first()};}
  catch(e){return {error:String(e).slice(0,150)};}
};
async function ownerDevice(req,env){
  const t=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
  if(!/^[A-Za-z0-9_-]{40,128}$/.test(t))return null;
  const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));
  const hash=btoa(String.fromCharCode(...new Uint8Array(h))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  return env.DB.prepare('SELECT d.device_id FROM ghost_equal_mobile_devices d JOIN sb_owner_authorized_devices o ON o.device_id=d.device_id WHERE d.token_hash=? AND d.blocked=0 LIMIT 1').bind(hash).first();
}
async function evaluate(env){
  const queries={
    db:"SELECT 1 AS ok",
    scanner:"SELECT * FROM sb_radar_scan_health WHERE id=1",
    // The 57-minute scanner samples are the authoritative live-price observations.
    // quote_state is the independently refreshed event catalog, not the live feed.
    samples:"SELECT captured_utc AS last_sample FROM ghost_equal_samples ORDER BY captured_utc DESC LIMIT 1",
    quotes:"SELECT MAX(captured_utc) AS last_quote FROM quote_state",
    latestLive:"SELECT id,started_utc,saved,error FROM live_runs ORDER BY id DESC LIMIT 1",
    lastGoodLive:"SELECT id,started_utc,saved FROM live_runs WHERE error IS NULL ORDER BY id DESC LIMIT 1",
    snapshot:"SELECT captured_utc FROM live_snapshots ORDER BY captured_utc DESC LIMIT 1",
    devices:"SELECT COALESCE(SUM(CASE WHEN enabled=1 AND pairing_status='active' THEN 1 ELSE 0 END),0) enabled,COALESCE(SUM(CASE WHEN enabled=1 AND pairing_status='active' AND datetime(last_heartbeat_utc)>=datetime('now','-50 seconds') THEN 1 ELSE 0 END),0) online,COALESCE(SUM(CASE WHEN enabled=1 AND pairing_status='active' AND datetime(last_heartbeat_utc)>=datetime('now','-50 seconds') AND superbet_session_ok=1 THEN 1 ELSE 0 END),0) ready FROM sb_radar_chrome_devices_v1",
    lastChrome:"SELECT display_name,device_kind,last_heartbeat_utc,superbet_session_ok,last_error,install_version FROM sb_radar_chrome_devices_v1 WHERE enabled=1 AND pairing_status='active' ORDER BY last_heartbeat_utc DESC LIMIT 1",
    poll:"SELECT logged_utc,device_id,description FROM sb_radar_chrome_events_v1 WHERE kind='JOB_POLL_AUDIT' ORDER BY id DESC LIMIT 1",
    transport:"SELECT MAX(received_utc) last_market_report,COALESCE(SUM(CAST(json_extract(counters_json,'$.fetch_requests') AS INTEGER)),0) fetch_count,COALESCE(SUM(CAST(json_extract(counters_json,'$.xhr_requests') AS INTEGER)),0) xhr_count,COALESCE(SUM(CAST(json_extract(counters_json,'$.ws_messages') AS INTEGER)),0) ws_count,COALESCE(SUM(CAST(json_extract(counters_json,'$.sse_messages') AS INTEGER)),0) sse_count,COALESCE(SUM(CAST(json_extract(counters_json,'$.sse_market_messages') AS INTEGER)),0) sse_market_count,COALESCE(SUM(CAST(json_extract(counters_json,'$.sse_site_messages') AS INTEGER)),0) sse_site_count,COALESCE(SUM(CAST(json_extract(counters_json,'$.sse_reconnecting') AS INTEGER)),0) sse_reconnect_count,COUNT(visible_event_id) linked_events,COALESCE(SUM(CAST(json_extract(counters_json,'$.http_market_errors') AS INTEGER)),0) market_http_errors,COALESCE(SUM(CAST(json_extract(counters_json,'$.app_ping_like') AS INTEGER)),0) ping_count FROM sb_radar_market_pulse_reports_v1 WHERE datetime(received_utc)>=datetime('now','-10 minutes')",
    alerts:"SELECT triggered_utc,event_id FROM ghost_equal_alerts WHERE stage='BET_NOW' ORDER BY triggered_utc DESC LIMIT 1",
    fcm:"SELECT updated_utc,status FROM sb_radar_fcm_sent ORDER BY updated_utc DESC LIMIT 1",
    claims:"SELECT state,updated_utc,event_id,substr(failure_reason,1,120) failure_reason FROM sb_radar_chrome_execution_claims_v1 WHERE state IN ('failed','unknown') AND datetime(updated_utc)>=datetime('now','-60 minutes') ORDER BY updated_utc DESC LIMIT 1",
    dialogs:"SELECT COUNT(*) n FROM sb_radar_chrome_dialog_requests_v1 WHERE status='pending' AND datetime(expires_utc)>datetime('now')",
    gaps:"SELECT COUNT(*) n FROM sb_radar_scan_gaps WHERE datetime(detected_utc)>=datetime('now','-15 minutes')",
    mobile:"SELECT foreground,app_version,last_heartbeat_utc FROM sb_radar_pulse_mobile_v1 ORDER BY last_heartbeat_utc DESC LIMIT 1"
  };
  const keys=Object.keys(queries);
  const values=await Promise.all(keys.map(k=>read(env.DB,queries[k])));
  const q=Object.fromEntries(keys.map((k,i)=>[k,values[i]]));
  const got=k=>q[k].row||{};
  const bad=k=>!!q[k].error;
  const state={};
  state.cloudflare=phase('ok','Worker System Pulse execută diagnosticul');
  state.database=bad('db')?phase('down','Citirea D1 a eșuat: '+q.db.error):phase('ok','Cloudflare D1 răspunde');
  const scan=got('scanner'),sa=seconds(scan.updated_utc);
  state.scanner=bad('scanner')?phase('down','Nu pot citi jurnalul scannerului'):sa>150?phase('down','Scanner fără procesare confirmată de '+sa+'s',{age_sec:sa}):sa>75||Number(scan.error_count)>0?phase('warn','Scanner degradat; ultima actualizare '+sa+'s',{age_sec:sa,errors:scan.error_count}):phase('ok','Scanner activ; '+Number(scan.scanned_candidates||0)+' candidați verificați, '+Number(scan.skipped_candidates||0)+' omiși',{age_sec:sa,scanned:scan.scanned_candidates,skipped:scan.skipped_candidates,alerts:scan.alerts});
  const live=got('latestLive'),good=got('lastGoodLive'),snapshot=got('snapshot');
  const la=seconds(live.started_utc),ga=seconds(good.started_utc),sn=seconds(snapshot.captured_utc);
  const liveSample=got('samples'),quote=got('quotes');
  const saLive=seconds(liveSample.last_sample),catalogAge=seconds(quote.last_quote);
  const sampleAge=Number.isFinite(saLive)?saLive:null;
  const quoteAge=Number.isFinite(catalogAge)?catalogAge:null;
  const feedMetrics={sample_age_sec:sampleAge,catalog_age_sec:quoteAge,source:'ghost_equal_samples'};
  if(bad('samples'))state.feed=phase('down','Nu pot citi cotele live ale scannerului',{...feedMetrics,error:q.samples.error});
  else if(!Number.isFinite(saLive))state.feed=phase('warn','Nu există încă mostre live confirmate de scanner',feedMetrics);
  else if(saLive>180)state.feed=phase('down','Cotele live ale scannerului au '+saLive+'s întârziere',feedMetrics);
  else if(saLive>75)state.feed=phase('warn','Cotele live ale scannerului au '+saLive+'s întârziere',feedMetrics);
  else state.feed=phase('ok','Cote live verificate în scanner acum '+saLive+'s'
    +(quoteAge!==null&&quoteAge>180?' · catalog separat: '+quoteAge+'s':''),
    feedMetrics);
  if(bad('latestLive')||bad('lastGoodLive')||bad('snapshot'))state.history=phase('down','Nu pot citi ingestia de instantanee live');
  else if(live.error){
    const detail='Instantanee istorice: '+String(live.error).slice(0,145)+' · ultimul succes '+(Number.isFinite(ga)?ga+'s':'necunoscut');
    state.history=phase(ga>900?'down':'warn',detail,{age_sec:la,last_success_age_sec:Number.isFinite(ga)?ga:null});
  }else if(la>900) state.history=phase('down','Instantanee istorice blocate de '+la+'s',{age_sec:la});
  else if(la>420) state.history=phase('warn','Instantanee istorice întârziate '+la+'s',{age_sec:la});
  else state.history=phase('ok','Arhivare instantanee: ultima rulare '+la+'s, '+Number(live.saved||0)+' salvări',{age_sec:la,snapshot_age_sec:Number.isFinite(sn)?sn:null});
  const ds=got('devices'),top=got('lastChrome'),poll=got('poll');
  const online=Number(ds.online||0),ready=Number(ds.ready||0),enabled=Number(ds.enabled||0);
  const pa=seconds(poll.logged_utc),cha=seconds(top.last_heartbeat_utc);
  if(bad('devices')||bad('lastChrome')||bad('poll'))state.chrome=phase('down','Jurnal Chrome inaccesibil');
  else if(!enabled)state.chrome=phase('warn','Nu există Chrome Slaves aprobate');
  else if(!online)state.chrome=phase('down','Niciun Chrome Slave conectat',{online,enabled});
  else if(!ready)state.chrome=phase('warn',online+'/'+enabled+' online; sesiune Superbet neverificată',{online,ready,enabled});
  else if(pa>150)state.chrome=phase('warn',ready+' slave pregătit(e), dar fără audit job de '+pa+'s',{online,ready,enabled,poll_age_sec:pa});
  else state.chrome=phase('ok',ready+' slave pregătit(e) / '+enabled+' configurate · ultimul job poll '+pa+'s',{online,ready,enabled,poll_age_sec:pa,last_device:top.display_name});
  // Enrich the existing Chrome heartbeat, but never mark it unhealthy when
  // Market Pulse is not yet installed or the page has no network activity.
  const transport=got('transport'),marketAge=seconds(transport.last_market_report);
  if(!bad('transport')&&Number.isFinite(marketAge)&&state.chrome){
    state.chrome.metric={...state.chrome.metric,market_pulse:{
      last_report_age_sec:marketAge,fetch_10m:Number(transport.fetch_count||0),
      xhr_10m:Number(transport.xhr_count||0),ws_messages_10m:Number(transport.ws_count||0),
      sse_messages_10m:Number(transport.sse_count||0),sse_market_messages_10m:Number(transport.sse_market_count||0),sse_site_messages_10m:Number(transport.sse_site_count||0),sse_reconnects_10m:Number(transport.sse_reconnect_count||0),matched_windows_10m:Number(transport.linked_events||0),market_http_errors_10m:Number(transport.market_http_errors||0),app_ping_like_10m:Number(transport.ping_count||0)
    }};
    if(marketAge<180)state.chrome.detail+=' · Market Pulse: Fetch '+Number(transport.fetch_count||0)+', WS '+Number(transport.ws_count||0)+', SSE '+Number(transport.sse_count||0);
  }
  const signal=got('alerts'),fcm=got('fcm'),aa=seconds(signal.triggered_utc),fa=seconds(fcm.updated_utc);
  if(bad('alerts')||bad('fcm'))state.notifications=phase('warn','Istoricul FCM nu poate fi citit');
  else if(aa>900)state.notifications=phase('ok','Fără semnale recente de livrat (nu este eroare)',{latest_signal_age_sec:Number.isFinite(aa)?aa:null});
  else if(fa>aa+120)state.notifications=phase('warn','Există semnal recent fără confirmarea trimiterii FCM',{latest_signal_age_sec:aa,fcm_age_sec:fa});
  else state.notifications=phase('ok','FCM: trimitere înregistrată; nu garantează afișarea pe telefon',{latest_signal_age_sec:aa,fcm_age_sec:fa});
  const failed=got('claims'),gaps=got('gaps'),dialogs=got('dialogs');
  const problems=Number(gaps.n||0);
  if(bad('gaps')||bad('claims')||bad('dialogs'))state.pipeline=phase('warn','Auditul etapelor pipeline este incomplet');
  else if(problems)state.pipeline=phase('warn',problems+' goluri de scanare în ultimele 15 minute',{gaps:problems,failed_job:failed.state||null,pending_dialogs:dialogs.n||0});
  else if(failed.state)state.pipeline=phase('warn','Ultimul job Chrome: '+failed.state+'; verifică incidentul',{failed_job:failed.state,failed_event:failed.event_id,pending_dialogs:dialogs.n||0});
  else state.pipeline=phase('ok','Fără goluri de scanner sau joburi eșuate în fereastra de audit',{pending_dialogs:dialogs.n||0});
  const mob=got('mobile'),ma=seconds(mob.last_heartbeat_utc);
  state.android=bad('mobile')?phase('warn','Nu pot citi heartbeat Android'):!Number.isFinite(ma)?phase('warn','APK fără heartbeat nou; necesită versiune cu System Pulse'):ma>160?phase('warn','APK fără heartbeat de '+ma+'s (poate fi în fundal)',{age_sec:ma,foreground:!!mob.foreground}):!mob.foreground?phase('ok','APK în fundal; ultima comunicare '+ma+'s',{age_sec:ma,foreground:false}):phase('ok','APK activ; ultima comunicare '+ma+'s',{age_sec:ma,foreground:true,app_version:mob.app_version});
  return state;
}
async function record(env,states){
  const now=new Date().toISOString();
  for(const [name,s] of Object.entries(states)){
    const old=await env.DB.prepare('SELECT status FROM sb_radar_pulse_state_v1 WHERE component=?').bind(name).first();
    if(old&&old.status!==s.status)await env.DB.prepare('INSERT INTO sb_radar_pulse_incidents_v1(component,previous_status,new_status,detail,observed_utc) VALUES(?,?,?,?,?)').bind(name,old.status,s.status,s.detail,now).run();
    await env.DB.prepare("INSERT INTO sb_radar_pulse_state_v1(component,status,detail,metric_json,observed_utc) VALUES(?,?,?,?,?) ON CONFLICT(component) DO UPDATE SET status=excluded.status,detail=excluded.detail,metric_json=excluded.metric_json,observed_utc=excluded.observed_utc").bind(name,s.status,s.detail,JSON.stringify(s.metric),now).run();
  }
}
export default {
 async fetch(req,env){
  const p=new URL(req.url).pathname;
  if(p==='/health'&&req.method==='GET')return json({ok:true,service:'sb-radar-system-pulse',version:'1.0.0'});
  const cors=req.headers.get('origin')===ORIGIN;
  if(req.method==='OPTIONS'&&cors)return new Response(null,{status:204,headers:{'access-control-allow-origin':ORIGIN,'access-control-allow-headers':'Authorization, Content-Type','access-control-allow-methods':'GET,POST,OPTIONS','access-control-max-age':'600'}});
  if(p!=='/v1/pulse'&&p!=='/v1/mobile/heartbeat')return json({error:'not_found'},404,cors);
  const who=await ownerDevice(req,env);
  if(!who)return json({error:'owner_authorization_required'},401,cors);
  if(p==='/v1/mobile/heartbeat'&&req.method==='POST'){
   const j=await req.json().catch(()=>({}));
   await env.DB.prepare("INSERT INTO sb_radar_pulse_mobile_v1(device_id,foreground,app_version,last_heartbeat_utc) VALUES(?,?,?,?) ON CONFLICT(device_id) DO UPDATE SET foreground=excluded.foreground,app_version=excluded.app_version,last_heartbeat_utc=excluded.last_heartbeat_utc").bind(who.device_id,j.foreground===true?1:0,String(j.app_version||'').slice(0,25),new Date().toISOString()).run();
   return json({ok:true,interval_sec:30},200,cors);
  }
  if(p==='/v1/pulse'&&req.method==='GET'){
   let rows=(await env.DB.prepare('SELECT component,status,detail,metric_json,observed_utc FROM sb_radar_pulse_state_v1 ORDER BY component').all()).results||[];
   // Cron changes can take time to propagate. A privileged Admin read bootstraps
   // the pulse and refreshes stale data, never touching the betting pipeline.
   if(!rows.length || seconds(rows[0].observed_utc)>140){
     await record(env,await evaluate(env));
     rows=(await env.DB.prepare('SELECT component,status,detail,metric_json,observed_utc FROM sb_radar_pulse_state_v1 ORDER BY component').all()).results||[];
   }
   const incidents=(await env.DB.prepare('SELECT component,previous_status,new_status,detail,observed_utc FROM sb_radar_pulse_incidents_v1 ORDER BY id DESC LIMIT 20').all()).results||[];
   const generated=rows[0]?.observed_utc||null;
   return json({ok:true,generated_utc:generated,age_sec:Number.isFinite(seconds(generated))?seconds(generated):null,stale:seconds(generated)>140,components:rows.map(r=>({component:r.component,status:r.status,detail:r.detail,metrics:JSON.parse(r.metric_json||'{}'),observed_utc:r.observed_utc})),incidents},200,cors);
  }
  return json({error:'method_not_allowed'},405,cors);
 },
 async scheduled(event,env,ctx){ctx.waitUntil((async()=>{await record(env,await evaluate(env))})().catch(e=>console.error('system_pulse_tick',String(e).slice(0,300))));}
};