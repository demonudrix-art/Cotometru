/* SB Radar 2026 Chrome bridge <-> Android integration.
   One canonical D1 slip guard prevents a duplicate manually logged bet.
   Logs are never evidence of bookmaker acceptance. */
const j=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store'}});
const compact=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export async function chromeMobileOverview(env,deviceId,isOwner){
 if(!await isOwner(env,deviceId))return j({error:'Doar administratorul poate vedea Chrome Bridge'},403);
 const user=(await env.DB.prepare('SELECT username FROM sb_admin WHERE id=1').first())?.username||'';
 const devices=(await env.DB.prepare("SELECT d.device_id,d.display_name,d.device_kind,d.pairing_status,d.enabled,d.last_heartbeat_utc,d.superbet_session_ok,d.last_error,l.status license_status,CASE WHEN l.parent_license_device_id IS NOT NULL THEN pl.expires_utc ELSE l.expires_utc END expires_utc,l.parent_license_device_id,pl.status parent_license_status,pl.expires_utc parent_license_expires_utc FROM sb_radar_chrome_devices_v1 d LEFT JOIN sb_radar_chrome_licenses_v1 l ON l.device_id=d.device_id LEFT JOIN sb_licenses pl ON pl.device_id=l.parent_license_device_id WHERE d.owner_username=? ORDER BY d.registered_utc DESC LIMIT 100").bind(user).all()).results||[];
 const tickets=(await env.DB.prepare("SELECT event_id,fixture,signal_category,stake_lei,state,device_id,bookmaker_ticket_id,bookmaker_accepted_utc,created_utc,updated_utc FROM sb_radar_chrome_execution_claims_v1 WHERE owner_username=? ORDER BY updated_utc DESC LIMIT 35").bind(user).all()).results||[];
 const f=await env.DB.prepare("SELECT value FROM sb_radar_chrome_bridge_settings_v1 WHERE key='execution_enabled'").first();
 const at=Date.now(),mapped=devices.map(d=>({device_id:d.device_id,display_name:d.display_name,online:d.pairing_status==='active'&&Number(d.enabled)===1&&!!d.last_heartbeat_utc&&at-Date.parse(d.last_heartbeat_utc)<50000,license_active:String(d.license_status||'').toLowerCase()==='active'&&(!d.parent_license_device_id?(!!d.expires_utc&&Date.parse(d.expires_utc)>at):(d.parent_license_status==='ACTIVE'&&!!d.parent_license_expires_utc&&Date.parse(d.parent_license_expires_utc)>at)),superbet_session_ok:Number(d.superbet_session_ok)===1,last_error:d.last_error||null}));
 return j({ok:true,online:mapped.filter(x=>x.online).length,total:mapped.length,execution_enabled:f?.value==='true',devices:mapped,tickets});
}
export async function safeManualBet(req,env,who,slipDeviceFor,isOwner){
 let stage='request';
 try{
 let d;try{d=await req.json()}catch{return j({error:'JSON invalid'},400)}
 const ref=String(d.client_ref||''),fixture=String(d.fixture||'').trim(),eventId=d.event_id==null?null:Number(d.event_id),stake=Number(d.stake_lei),odds=Number(d.odds),selection=String(d.selection||'X').trim(),boost=Number(d.boost_lei||0),placed=d.placed_utc?String(d.placed_utc):new Date().toISOString();
 if(!/^[0-9a-f-]{36}$/.test(ref)||fixture.length<3||fixture.length>180||!Number.isFinite(stake)||stake<.01||stake>1000000||!Number.isFinite(odds)||odds<1.001||odds>10000||!Number.isFinite(boost)||boost<0||boost>1e6||!Number.isFinite(Date.parse(placed))||Date.parse(placed)>Date.now()+300000||Date.parse(placed)<Date.now()-365*86400000||!['X','GG - Nu','GG - Da','Peste 1.5','Sub 2.5','Alta selectie'].includes(selection)||(eventId!==null&&(!Number.isSafeInteger(eventId)||eventId<1)))return j({error:'Date pariului invalide'},400);
 stage='device';
 const device=await slipDeviceFor(env,who.device_id);
 const previously=await env.DB.prepare("SELECT id,status,placed_utc FROM ghost_equal_bets WHERE client_ref=? AND device_id=?").bind(ref,device).first();
 if(previously)return j({ok:true,bet:previously,already_saved:true});
 stage='lookup';
 const old=(await env.DB.prepare("SELECT id,event_id,fixture,status FROM ghost_equal_bets WHERE device_id=? ORDER BY placed_utc DESC LIMIT 1200").bind(device).all()).results||[];
 const oldBet=old.find(x=>eventId!==null&&x.event_id!==null&&Number(x.event_id)===eventId||compact(x.fixture)===compact(fixture));
 if(oldBet)return j({error:'Meciul există deja în Slip (bilet #'+oldBet.id+', '+oldBet.status+'). Nu îl adaug din nou.',duplicate:true,existing_bet_id:oldBet.id},409);
 stage='identify';
 const own=(await isOwner(env,who.device_id))?(await env.DB.prepare('SELECT username FROM sb_admin WHERE id=1').first()):(await env.DB.prepare('SELECT username FROM sb_auth_devices WHERE device_id=?').bind(who.device_id).first());
 const owner=String(own?.username||who.device_id);
 const key=eventId===null?'fixture:'+compact(fixture):'event:'+eventId;
 stage='reservations';
 const chrome=await env.DB.prepare("SELECT event_id,state FROM sb_radar_chrome_execution_claims_v1 WHERE owner_username=? AND (event_id=? OR fixture=?) AND state NOT IN ('failed','cancelled') LIMIT 1").bind(owner,String(eventId??''),fixture).first();
 if(chrome)return j({error:'Meciul este rezervat sau deja plasat prin extensia Chrome. Verifică Slip.',duplicate:true},409);
 try{
  const at=new Date(placed).toISOString(),amount=Math.round(stake*100)/100,potential=boost>0?Math.round((stake*odds+boost)*100)/100:null;
  stage='write-batch';
  const result=await env.DB.batch([
   env.DB.prepare("INSERT OR IGNORE INTO sb_radar_slip_guard_v1(owner_username,event_key,market,selection,client_ref,source,device_id) VALUES(?,?,'MATCH','ANY',?,'manual',?)").bind(owner,key,ref,device),
   env.DB.prepare("INSERT OR IGNORE INTO ghost_equal_bets(client_ref,device_id,event_id,fixture,selection,stake_lei,odds,placed_utc,status,boost_lei,potential_return_lei) SELECT ?,?,?,?,?,?,?,?,'OPEN',?,? WHERE EXISTS(SELECT 1 FROM sb_radar_slip_guard_v1 WHERE client_ref=?)").bind(ref,device,selection==='X'?eventId:null,fixture,selection,amount,odds,at,boost,potential,ref)
  ]);
  if(Number(result[0]?.meta?.changes||0)!==1||Number(result[1]?.meta?.changes||0)!==1)return j({error:'Bilet duplicat; celălalt dispozitiv a rezervat primul.',duplicate:true},409);
  stage='read-confirmation';
  const bet=await env.DB.prepare('SELECT id,status,placed_utc FROM ghost_equal_bets WHERE client_ref=? AND device_id=?').bind(ref,device).first();
  return bet?j({ok:true,bet}):j({error:'Înregistrare incompletă; nu reîncerca automat'},503);
 }catch(e){throw e;}
 }catch(e){
  const detail=String(e?.message||e||'unknown').slice(0,300);
  let diagId=null;
  try{
   const diagnostic=await env.DB.prepare("INSERT INTO sb_radar_slip_errors_v1(device_id,stage,code,detail) VALUES(?,?,?,?)").bind(who?.device_id||'unknown',stage,'SLIP_SAVE',detail).run();
   diagId=diagnostic.meta?.last_row_id??null;
  }catch(_){}
  console.error('SLIP_SAVE',stage,detail);
  return j({error:'Salvarea biletului a eșuat ('+stage+'). Nu plasa alt bilet până verificăm înregistrarea.',error_code:'SLIP_SAVE',diagnostic_id:diagId},503);
 }
}
