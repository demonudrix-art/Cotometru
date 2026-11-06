/* Server-confirmed ticket notifications (FCM data-only).
 * A message is sent only for an actual recorded Superbet ticket ID.
 * Android owns quiet-hours channels, UI and dedupe.
 */
function sbQuiet(){const h=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Bucharest',hour:'2-digit',hourCycle:'h23'}).format(new Date()));return h>=22||h<5;}
export async function deliverAutoTicketPush(env,ticketId,parseServiceAccount,getAccessToken){
 const ticket=String(ticketId||'');
 if(!/^[A-Za-z0-9_-]{5,100}$/.test(ticket))return {ok:false,reason:'invalid_ticket'};
 const rows=(await env.DB.prepare("SELECT p.ticket_id,p.device_id,p.attempts,r.fcm_token,c.event_id,c.fixture,c.signal_category,c.stake_lei,c.odd_x FROM sb_radar_auto_ticket_push_v1 p JOIN sb_radar_fcm_registry r ON r.device_id=p.device_id JOIN sb_radar_chrome_execution_claims_v1 c ON c.bookmaker_ticket_id=p.ticket_id AND c.state='placed' WHERE p.ticket_id=? AND p.status IN ('PENDING','FAILED') AND p.attempts<3 LIMIT 20").bind(ticket).all()).results||[];
 if(!rows.length)return {ok:true,sent:0,reason:'no_pending_receipts'};
 if(!env.FIREBASE_SERVICE_ACCOUNT_JSON)return {ok:false,sent:0,reason:'firebase_unconfigured'};
 const service=parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT_JSON);
 const access=await getAccessToken(service);
 let sent=0,failed=0;
 for(const r of rows){
  const claim=await env.DB.prepare("UPDATE sb_radar_auto_ticket_push_v1 SET status='SENDING',attempts=attempts+1 WHERE ticket_id=? AND device_id=? AND status IN ('PENDING','FAILED') AND attempts<3").bind(ticket,r.device_id).run();
  if(!Number(claim.meta?.changes||0))continue;
  const label=r.signal_category==='strong-silver'?'🟣 STRONG + SILVER':r.signal_category==='strong'?'🔴 GOLDEN STRONG':'TEST';
  const message={stage:'AUTO_TICKET_PLACED',ticket_id:ticket,event_id:String(r.event_id),fixture:String(r.fixture||'Meci'),stake_lei:String(r.stake_lei),odds:String(r.odd_x||''),signal_type:String(r.signal_category),title:'✅ BILET PLASAT AUTOMAT',body:label+' · '+String(r.fixture||'Meci')+' · '+r.stake_lei+' lei',night_vibrate:String(sbQuiet()),url:'/app?tab=slip'};
  try{
   const response=await fetch('https://fcm.googleapis.com/v1/projects/'+service.project_id+'/messages:send',{method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},body:JSON.stringify({message:{token:r.fcm_token,android:{priority:'HIGH',ttl:'180s',collapse_key:'sb-auto-'+ticket},data:message}})});
   if(!response.ok)throw Error('FCM '+response.status+' '+(await response.text()).slice(0,120));
   await env.DB.prepare("UPDATE sb_radar_auto_ticket_push_v1 SET status='SENT',sent_utc=datetime('now'),last_error=NULL WHERE ticket_id=? AND device_id=?").bind(ticket,r.device_id).run();
   sent++;
  }catch(e){await env.DB.prepare("UPDATE sb_radar_auto_ticket_push_v1 SET status='FAILED',last_error=? WHERE ticket_id=? AND device_id=?").bind(String(e).slice(0,180),ticket,r.device_id).run();failed++;}
 }
 return {ok:failed===0,sent,failed};
}
export async function drainAutoTicketPush(env,parseServiceAccount,getAccessToken){
 const jobs=(await env.DB.prepare("SELECT ticket_id FROM sb_radar_auto_ticket_push_v1 WHERE status IN ('PENDING','FAILED') AND attempts<3 GROUP BY ticket_id ORDER BY MIN(created_utc) ASC LIMIT 7").all()).results||[];
 const results=[];for(const j of jobs)results.push(await deliverAutoTicketPush(env,j.ticket_id,parseServiceAccount,getAccessToken));
 return {processed:jobs.length,results};
}
