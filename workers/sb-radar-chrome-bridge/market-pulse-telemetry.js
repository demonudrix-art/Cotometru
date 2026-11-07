/* SB Radar Market Pulse — allowlisted, authenticated, privacy-minimized telemetry.
   Only aggregated counters + publicly visible match ID / Final-X odd.
   This endpoint never performs navigation or gambling actions. */
const NAMES=['fetch_requests','xhr_requests','http_errors','http_4xx','http_5xx','market_requests','other_requests','ws_open','ws_messages','ws_closed','ws_errors','sse_open','sse_messages','sse_errors','app_ping_like','bytes_approx','http_ms_sum','http_ms_max','http_ms_count'];
const PAGES=new Set(['football_event','football_live','sports','other']);
const bounded=(v,max=999999)=>Number.isSafeInteger(Number(v))&&Number(v)>=0?Math.min(Number(v),max):0;
export async function marketPulseEndpoint(req,env,path,{validDevice,licenseValid,reply,err,read,now}){
 const d=await validDevice(req,env);
 if(!d||d.pairing_status!=='active'||!d.enabled||!licenseValid(d))return err('Extensie neautorizată',403,true);
 if(path==='/api/chrome/market-pulse/status'&&req.method==='GET'){
  const rows=await env.DB.prepare("SELECT COUNT(*) AS reports,MAX(received_utc) AS latest,COALESCE(SUM(CAST(json_extract(counters_json,'$.fetch_requests') AS INTEGER)),0) AS fetch_requests,COALESCE(SUM(CAST(json_extract(counters_json,'$.xhr_requests') AS INTEGER)),0) AS xhr_requests,COALESCE(SUM(CAST(json_extract(counters_json,'$.ws_messages') AS INTEGER)),0) AS ws_messages,COALESCE(SUM(CAST(json_extract(counters_json,'$.sse_messages') AS INTEGER)),0) AS sse_messages,COALESCE(SUM(CAST(json_extract(counters_json,'$.app_ping_like') AS INTEGER)),0) AS app_ping_like,COALESCE(SUM(CAST(json_extract(counters_json,'$.http_errors') AS INTEGER)),0) AS http_errors FROM sb_radar_market_pulse_reports_v1 WHERE device_id=? AND datetime(received_utc)>=datetime('now','-30 minutes')").bind(d.device_id).first();
  const last=await env.DB.prepare('SELECT received_utc,page_kind,visible_event_id,visible_odds_x,client_version FROM sb_radar_market_pulse_reports_v1 WHERE device_id=? ORDER BY received_utc DESC LIMIT 1').bind(d.device_id).first();
  return reply({ok:true,window_minutes:30,summary:rows||{},latest:last||null},200,true);
 }
 if(path!=='/api/chrome/market-pulse'||req.method!=='POST')return err('Method not allowed',405,true);
 const j=await read(req);
 if(JSON.stringify(j||{}).length>8500)return err('Telemetrie prea mare',413,true);
 const bid=String(j.batch_id||'');
 if(!/^[a-f0-9-]{36}$/i.test(bid)||!Number.isSafeInteger(Number(j.tab_id))||j.tab_id<0)return err('Identificator invalid',400,true);
 const page=PAGES.has(j.page_kind)?j.page_kind:'other';
 const at=String(j.window_start_utc||'');
 const ms=Date.parse(at),age=Date.now()-ms;
 if(!Number.isFinite(ms)||age< -120000||age>6*3600000)return err('Fereastră expirată',400,true);
 const counters={};
 for(const k of NAMES)counters[k]=bounded(j.counters?.[k],k==='bytes_approx'?20000000:k==='http_ms_sum'?50000000:999999);
 if(counters.market_requests>counters.fetch_requests+counters.xhr_requests+10 ||
    counters.other_requests>counters.fetch_requests+counters.xhr_requests+10)return err('Contorizare invalidă',400,true);
 const visible=j.visible&&typeof j.visible==='object'?j.visible:null;
 const event=visible&&Number.isSafeInteger(Number(visible.event_id))&&Number(visible.event_id)>0&&Number(visible.event_id)<10000000000?Number(visible.event_id):null;
 const odd=event!==null&&Number.isFinite(Number(visible.odds_x))&&Number(visible.odds_x)>1.001&&Number(visible.odds_x)<1000?Math.round(Number(visible.odds_x)*1000)/1000:null;
 const sql='INSERT OR IGNORE INTO sb_radar_market_pulse_reports_v1 (device_id,batch_id,received_utc,window_start_utc,tab_id,page_kind,counters_json,visible_event_id,visible_odds_x,client_version) VALUES (?,?,?,?,?,?,?,?,?,?)';
 const result=await env.DB.prepare(sql).bind(d.device_id,bid,now(),at,Number(j.tab_id),page,JSON.stringify(counters),event,odd,String(j.version||'').slice(0,22)).run();
 // Retain only recent telemetry. This archive intentionally contains no raw traffic.
 await env.DB.prepare("DELETE FROM sb_radar_market_pulse_reports_v1 WHERE datetime(received_utc)<datetime('now','-48 hours')").run();
 return reply({ok:true,accepted:Number(result.meta?.changes||0),server_utc:now(),privacy:'aggregates_only'},200,true);
}
