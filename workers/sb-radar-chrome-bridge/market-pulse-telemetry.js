/* SB Radar Market Pulse — allowlisted, authenticated, privacy-minimized telemetry.
   Only aggregated counters + publicly visible match ID / Final-X odd.
   This endpoint never performs navigation or gambling actions. */
const NAMES=['fetch_requests','xhr_requests','http_errors','http_4xx','http_5xx','market_requests','other_requests','ws_open','ws_messages','ws_closed','ws_errors','sse_open','sse_messages','sse_errors','app_ping_like','bytes_approx','http_ms_sum','http_ms_max','http_ms_count','fetch_market','xhr_market','http_market_errors','http_market_ms_sum','http_market_ms_count','http_market_ms_max','sse_market_open','sse_market_messages','sse_site_messages','sse_market_errors','sse_site_errors','sse_reconnecting','sse_closed','sse_gap_max_ms','ws_market_messages','ws_site_messages'];
const PAGES=new Set(['football_event','football_live','sports','other']);
const bounded=(v,max=999999)=>Number.isSafeInteger(Number(v))&&Number(v)>=0?Math.min(Number(v),max):0;
export async function marketPulseEndpoint(req,env,path,{validDevice,licenseValid,reply,err,read,now}){
 const d=await validDevice(req,env);
 if(!d||d.pairing_status!=='active'||!d.enabled||!licenseValid(d))return err('Extensie neautorizată',403,true);
 if(path==='/api/chrome/market-pulse/status'&&req.method==='GET'){
  const rows=await env.DB.prepare("SELECT COUNT(*) AS reports,MAX(received_utc) AS latest,COALESCE(SUM(CAST(json_extract(counters_json,'$.fetch_requests') AS INTEGER)),0) AS fetch_requests,COALESCE(SUM(CAST(json_extract(counters_json,'$.xhr_requests') AS INTEGER)),0) AS xhr_requests,COALESCE(SUM(CAST(json_extract(counters_json,'$.ws_messages') AS INTEGER)),0) AS ws_messages,COALESCE(SUM(CAST(json_extract(counters_json,'$.sse_messages') AS INTEGER)),0) AS sse_messages,COALESCE(SUM(CAST(json_extract(counters_json,'$.app_ping_like') AS INTEGER)),0) AS app_ping_like,COALESCE(SUM(CAST(json_extract(counters_json,'$.http_errors') AS INTEGER)),0) AS http_errors,COALESCE(SUM(CAST(json_extract(counters_json,'$.sse_market_messages') AS INTEGER)),0) AS sse_market_messages,COALESCE(SUM(CAST(json_extract(counters_json,'$.sse_site_messages') AS INTEGER)),0) AS sse_site_messages,COALESCE(SUM(CAST(json_extract(counters_json,'$.sse_reconnecting') AS INTEGER)),0) AS sse_reconnecting,COALESCE(SUM(CAST(json_extract(counters_json,'$.sse_closed') AS INTEGER)),0) AS sse_closed,COALESCE(SUM(CAST(json_extract(counters_json,'$.fetch_market') AS INTEGER)),0) AS fetch_market,COALESCE(SUM(CAST(json_extract(counters_json,'$.xhr_market') AS INTEGER)),0) AS xhr_market,COALESCE(SUM(CAST(json_extract(counters_json,'$.http_market_errors') AS INTEGER)),0) AS market_errors,COALESCE(SUM(CAST(json_extract(counters_json,'$.http_market_ms_count') AS INTEGER)),0) AS market_latency_count,COALESCE(SUM(CAST(json_extract(counters_json,'$.http_market_ms_sum') AS INTEGER)),0) AS market_latency_sum FROM sb_radar_market_pulse_reports_v1 WHERE device_id=? AND datetime(received_utc)>=datetime('now','-30 minutes')").bind(d.device_id).first();
  const last=await env.DB.prepare('SELECT received_utc,page_kind,visible_event_id,visible_odds_x,client_version FROM sb_radar_market_pulse_reports_v1 WHERE device_id=? ORDER BY received_utc DESC LIMIT 1').bind(d.device_id).first();
  return reply({ok:true,window_minutes:30,summary:rows||{},latest:last||null},200,true);
 }
 if(path==='/api/chrome/market-pulse/correlation'&&req.method==='GET'){
  // Window alignment: same clock, separate feeds. Overlap is correlation, not causal proof.
  // Only a limited recent window is returned, with public football market information.
  const sql="SELECT r.received_utc,r.window_start_utc,r.page_kind,r.visible_event_id,r.visible_odds_x,"+
   "COALESCE(json_extract(r.counters_json,'$.market_requests'),0) market_requests,"+
   "COALESCE(json_extract(r.counters_json,'$.sse_messages'),0) sse_messages,"+
   "COALESCE(json_extract(r.counters_json,'$.sse_market_messages'),0) sse_market_messages,"+
   "COALESCE(json_extract(r.counters_json,'$.sse_site_messages'),0) sse_site_messages,"+
   "COALESCE(json_extract(r.counters_json,'$.sse_reconnecting'),0) sse_reconnecting,"+
   "COALESCE(json_extract(r.counters_json,'$.http_market_errors'),0) http_market_errors,"+
   "(SELECT COUNT(*) FROM ghost_equal_samples s WHERE s.captured_utc>=r.window_start_utc AND s.captured_utc<r.received_utc) scanner_samples,"+
   "(SELECT COUNT(*) FROM live_snapshots l WHERE l.captured_utc>=r.window_start_utc AND l.captured_utc<r.received_utc) changed_live_snapshots,"+
   "(SELECT s.px FROM ghost_equal_samples s WHERE s.event_id=r.visible_event_id AND s.captured_utc<=r.received_utc ORDER BY s.captured_utc DESC LIMIT 1) scanner_x,"+
   "(SELECT s.captured_utc FROM ghost_equal_samples s WHERE s.event_id=r.visible_event_id AND s.captured_utc<=r.received_utc ORDER BY s.captured_utc DESC LIMIT 1) scanner_x_utc "+
   "FROM (SELECT * FROM sb_radar_market_pulse_reports_v1 WHERE device_id=? AND received_utc>=? ORDER BY id DESC LIMIT 20) r ORDER BY r.received_utc DESC";
  const windowStart=new Date(Date.now()-60*60000).toISOString();
  const rows=(await env.DB.prepare(sql).bind(d.device_id,windowStart).all()).results||[];
  return reply({ok:true,window_minutes:60,causality_established:false,records:rows},200,true);
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
 for(const k of NAMES)counters[k]=bounded(j.counters?.[k],k==='bytes_approx'?20000000:['http_ms_sum','http_market_ms_sum'].includes(k)?50000000:k==='sse_gap_max_ms'?600000:999999);
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
