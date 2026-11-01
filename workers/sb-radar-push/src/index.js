// SB Radar FCM companion; separate from login, slip and settlement handlers.
const DB_NAME="DB";
const SOURCE_MAP={"SB_RADAR_GOLDEN_V2":"GOLDEN TICKET","SB_RADAR_ML_LOGREG_V1":"ML"};
const cors={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const respond=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:cors});
const b64url=(input)=>btoa(String.fromCharCode(...new Uint8Array(input))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
const encoded=(text)=>b64url(new TextEncoder().encode(text));
const shaToken=async(token)=>b64url(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token)));
async function authenticatedDevice(req,env,deviceId){
  const bearer=req.headers.get("authorization")||"";
  if(!bearer.startsWith("Bearer ")||!deviceId||deviceId.length>128)return false;
  const hash=await shaToken(bearer.slice(7));
  const row=await env.DB.prepare("SELECT device_id FROM ghost_equal_mobile_devices WHERE device_id=? AND token_hash=? AND COALESCE(blocked,0)=0").bind(deviceId,hash).first();
  return !!row;
}
async function getAccessToken(serviceAccount){
  const now=Math.floor(Date.now()/1000);
  const header=encoded(JSON.stringify({alg:"RS256",typ:"JWT"}));
  const claims=encoded(JSON.stringify({iss:serviceAccount.client_email,scope:"https://www.googleapis.com/auth/firebase.messaging",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3300}));
  const text=header+"."+claims;
  const pem=serviceAccount.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,"");
  const bytes=Uint8Array.from(atob(pem),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey("pkcs8",bytes,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
  const sign=b64url(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,new TextEncoder().encode(text)));
  const payload=new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:text+"."+sign});
  const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",body:payload,headers:{"content-type":"application/x-www-form-urlencoded"}});
  if(!response.ok)throw new Error("oauth_http_"+response.status);
  const result=await response.json();
  if(!result.access_token)throw new Error("missing_oauth_token");
  return result.access_token;
}
async function sendFcm(env,serviceAccount,accessToken,device,data){
  const project=serviceAccount.project_id;
  if(!/^[a-zA-Z0-9-]+$/.test(project))throw new Error("invalid_project");
  const response=await fetch("https://fcm.googleapis.com/v1/projects/"+project+"/messages:send",{
    method:"POST",
    headers:{"authorization":"Bearer "+accessToken,"content-type":"application/json"},
    body:JSON.stringify({message:{
      token:device.fcm_token,
      android:{priority:"HIGH",ttl:"60s"},
      data:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,String(v??"")]))
    }})
  });
  const text=await response.text();
  if(!response.ok)throw new Error("fcm_http_"+response.status+":"+text.slice(0,120));
  return true;
}
async function tick(env){
  if(!env.FIREBASE_SERVICE_ACCOUNT_JSON)return {ready:false,reason:"firebase_service_account_missing"};
  const serviceAccount=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const devices=await env.DB.prepare("SELECT device_id,fcm_token FROM sb_radar_fcm_registry WHERE updated_utc >= datetime('now','-21 days') LIMIT 50").all();
  if(!devices.results.length)return {ready:true,devices:0,sent:0};
  const alerts=await env.DB.prepare(
    "SELECT event_id,source,fixture,minute,home_score,away_score,px,triggered_utc FROM ghost_equal_alerts WHERE stage='BET_NOW' AND source IN ('SB_RADAR_GOLDEN_V2','SB_RADAR_ML_LOGREG_V1') AND julianday(triggered_utc) >= julianday('now','-3 minutes') ORDER BY triggered_utc DESC LIMIT 100"
  ).all();
  if(!alerts.results.length)return {ready:true,devices:devices.results.length,events:0};
  const accessToken=await getAccessToken(serviceAccount);
  let sent=0,failed=0;
  for(const a of alerts.results)for(const d of devices.results){
    const previous=await env.DB.prepare("SELECT status FROM sb_radar_fcm_sent WHERE device_id=? AND event_id=? AND stage='BET_NOW'").bind(d.device_id,a.event_id).first();
    if(previous&&previous.status==="sent")continue;
    const data={event_id:a.event_id,stage:"BET_NOW",signal_label:SOURCE_MAP[a.source],fixture:a.fixture||"Meci",minute:a.minute||0,home_score:a.home_score??"-",away_score:a.away_score??"-",px:a.px??0,triggered_utc:a.triggered_utc};
    try{
      await sendFcm(env,serviceAccount,accessToken,d,data);
      await env.DB.prepare("INSERT INTO sb_radar_fcm_sent(device_id,event_id,stage,source,status,attempts,updated_utc) VALUES (?,?,?,?,?,1,datetime('now')) ON CONFLICT(device_id,event_id,stage) DO UPDATE SET status='sent',attempts=attempts+1,updated_utc=datetime('now')")
        .bind(d.device_id,a.event_id,"BET_NOW",a.source,"sent").run();sent++;
    }catch(error){
      await env.DB.prepare("INSERT INTO sb_radar_fcm_sent(device_id,event_id,stage,source,status,attempts,updated_utc) VALUES (?,?,?,?,?,1,datetime('now')) ON CONFLICT(device_id,event_id,stage) DO UPDATE SET status='failed',attempts=attempts+1,updated_utc=datetime('now')")
        .bind(d.device_id,a.event_id,"BET_NOW",a.source,"failed").run();
      failed++;
    }
  }
  return {ready:true,devices:devices.results.length,events:alerts.results.length,sent,failed};
}
export default {
 async fetch(req,env){
   const url=new URL(req.url);
   if(url.pathname==="/v1/config"&&req.method==="GET"){
     if(!env.FIREBASE_CLIENT_CONFIG_JSON)return respond({enabled:false},503);
     try{
       const j=JSON.parse(env.FIREBASE_CLIENT_CONFIG_JSON);
       return respond({enabled:true,project_id:j.project_id,application_id:j.application_id,api_key:j.api_key,sender_id:j.sender_id});
     }catch{return respond({enabled:false},503);}
   }
   if(url.pathname==="/v1/register"&&req.method==="POST"){
     let body;try{body=await req.json();}catch{return respond({error:"bad_json"},400);}
     if(typeof body?.device_id!=="string"||typeof body?.fcm_token!=="string"||body.fcm_token.length>4096||body.fcm_token.length<20)return respond({error:"bad_token"},400);
     if(!await authenticatedDevice(req,env,body.device_id))return respond({error:"unauthorized"},401);
     await env.DB.prepare("INSERT INTO sb_radar_fcm_registry(device_id,fcm_token,updated_utc) VALUES (?,?,datetime('now')) ON CONFLICT(device_id) DO UPDATE SET fcm_token=excluded.fcm_token,updated_utc=excluded.updated_utc")
       .bind(body.device_id,body.fcm_token).run();
     return respond({ok:true});
   }
   if(url.pathname==="/v1/health"&&req.method==="GET")return respond({ok:true,fcm_configured:!!(env.FIREBASE_SERVICE_ACCOUNT_JSON&&env.FIREBASE_CLIENT_CONFIG_JSON),dispatch:"scheduled"});
   return respond({error:"not_found"},404);
 },
 async scheduled(event,env,ctx){ctx.waitUntil(tick(env).catch(e=>console.log("fcm_tick",String(e).slice(0,100))));}
};