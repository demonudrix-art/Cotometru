// SB Radar — competition metadata enrichment (background only).
// Never invoked by /app, the BET NOW scanner, the odds feed, or the FCM dispatcher.
// Unknown information is NOT guessed. Verified source/date/team matching is required.
const API='https://www.thesportsdb.com/api/v1/json/123/searchevents.php?e=';
const now=()=>new Date().toISOString();
const words=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(' ').filter(w=>w&&!['fc','fk','cf','ac','sc','the','club'].includes(w));
const score=(a,b)=>{const x=new Set(words(a)),y=new Set(words(b));let c=0;for(const z of x)if(y.has(z))c++;return (x.size+y.size)?2*c/(x.size+y.size):0};
function parse(e){const v=String(e.fixture||'').split('·').map(x=>x.trim());return v.length===2&&v.every(x=>x.length>2)?v:null}
function accept(e,x){
 if(x.strSport!=='Soccer'||!x.strLeague||!x.idEvent||!x.strHomeTeam||!x.strAwayTeam)return null;
 const pair=parse(e);if(!pair)return null;
 const h=score(pair[0],x.strHomeTeam),a=score(pair[1],x.strAwayTeam);
 const ts=Date.parse((x.strTimestamp||x.dateEvent||'')+'Z'),ko=Date.parse(e.kickoff_utc),delta=Math.abs(ts-ko)/60000;
 if(h<.62||a<.62||(h+a)/2<.70||!Number.isFinite(delta)||delta>120)return null;
 return {country:x.strCountry||e.country,league:x.strLeague,source_url:'https://www.thesportsdb.com/event/'+x.idEvent,confidence:delta<=30&&h>=.7&&a>=.7?.98:.92,delta};
}
async function search(e){
 const pair=parse(e);if(!pair)return null;
 const unprefix=s=>s.replace(/^(?:FC|FK|CF|SC|AC)\s+/i,'').trim();
 const q=[pair.join(' vs '),pair.map(unprefix).join(' vs ')];
 for(const term of new Set(q)){
  try{
   const r=await fetch(API+encodeURIComponent(term),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(4500)});
   if(!r.ok)continue;
   const v=(await r.json()).event||[];
   const candidates=v.map(x=>accept(e,x)).filter(Boolean).sort((a,b)=>b.confidence-a.confidence||a.delta-b.delta);
   if(candidates.length && !candidates.some(x=>x.league!==candidates[0].league))return candidates[0];
  }catch(_){}
 }
 return null;
}
const division=league=>String(league).match(/\b(?:Liga|Division|Divizia|Serie)\s*(?:[1-9]|A|B|C)\b/i)?.[0]||null;
async function stamp(db,e,status,v){
 const sql="INSERT INTO sb_radar_competition_resolution_v1(event_id,tournament_id,category_id,fixture,kickoff_utc,country,league_name,division,source,source_url,confidence,status,attempts,last_attempt_utc,verified_utc,detail,updated_utc) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?) ON CONFLICT(event_id) DO UPDATE SET country=excluded.country,league_name=excluded.league_name,division=excluded.division,source=excluded.source,source_url=excluded.source_url,confidence=excluded.confidence,status=excluded.status,attempts=sb_radar_competition_resolution_v1.attempts+1,last_attempt_utc=excluded.last_attempt_utc,verified_utc=excluded.verified_utc,detail=excluded.detail,updated_utc=excluded.updated_utc";
 const tm=now(),yes=status==='VERIFIED';
 await db.prepare(sql).bind(e.event_id,e.tournament_id,e.category_id,e.fixture,e.kickoff_utc,v?.country||e.country||null,yes?v.league:null,yes?division(v.league):null,yes?'THESPORTSDB_EXACT_MATCH':'THESPORTSDB_LOOKUP',yes?v.source_url:null,yes?v.confidence:0,status,tm,yes?tm:null,yes?'two teams + kickoff time verified':'no verified match in provider',tm).run();
}
async function cycle(env){
 const start=Date.now();let count=0,verified=0,unresolved=0,errors=[];
 const mlSql="SELECT e.event_id,e.fixture,e.kickoff_utc,e.tournament_id,e.category_id,NULLIF(c.country,'NECONFIRMATA') country FROM sb_radar_ml_decisions d JOIN event_catalog e ON e.event_id=d.event_id LEFT JOIN sb_radar_event_competition c ON c.event_id=e.event_id LEFT JOIN sb_radar_competition_resolution_v1 r ON r.event_id=e.event_id WHERE d.model_version='SB_RADAR_ML_LOGREG_V1' AND e.sport_id=5 AND e.tournament_id IS NOT NULL AND (c.league_name IS NULL OR c.league_name='NECONFIRMATA') AND (r.event_id IS NULL OR (r.status IN ('NOT_FOUND','COUNTRY_ONLY','ERROR') AND r.last_attempt_utc<strftime('%Y-%m-%dT%H:%M:%SZ','now','-3 days'))) ORDER BY d.evaluated_utc DESC LIMIT 1";
 const sql="SELECT e.event_id,e.fixture,e.kickoff_utc,e.tournament_id,e.category_id,NULLIF(c.country,'NECONFIRMATA') country FROM event_catalog e INDEXED BY ix_sb_catalog_kickoff_resolver LEFT JOIN sb_radar_event_competition c ON c.event_id=e.event_id LEFT JOIN sb_radar_competition_resolution_v1 r ON r.event_id=e.event_id WHERE e.sport_id=5 AND e.tournament_id IS NOT NULL AND (c.league_name IS NULL OR c.league_name='NECONFIRMATA') AND (r.event_id IS NULL OR (r.status IN ('NOT_FOUND','COUNTRY_ONLY','ERROR') AND r.last_attempt_utc<strftime('%Y-%m-%dT%H:%M:%SZ','now','-3 days'))) AND e.event_id<>? ORDER BY e.kickoff_utc DESC LIMIT 2";
 try{
 const first=(await env.DB.prepare(mlSql).all()).results||[];
 const rest=(await env.DB.prepare(sql).bind(first[0]?.event_id||-1).all()).results||[];
 const rows=[...first,...rest].slice(0,2);
 for(const e of rows){
  count++;
  try{
   const v=await search(e),existing=v?await env.DB.prepare('SELECT league_name FROM sb_radar_tournament_labels WHERE tournament_id=?').bind(e.tournament_id).first():null;
   const conflict=Boolean(v&&existing&&String(existing.league_name).toLowerCase()!==String(v.league).toLowerCase());
   if(v&&v.country&&!conflict){
    const tm=now();
    await env.DB.prepare('INSERT OR IGNORE INTO sb_radar_tournament_labels(tournament_id,country,league_name,division,source,confidence,updated_utc) VALUES(?,?,?,?,?,?,?)').bind(e.tournament_id,v.country,v.league,division(v.league),'THESPORTSDB_EXACT_MATCH','RIDICATA',tm).run();
    await env.DB.prepare("UPDATE sb_radar_event_competition SET country=?,league_name=?,division=?,source='THESPORTSDB_EXACT_MATCH',confidence='RIDICATA',updated_utc=? WHERE tournament_id=? AND league_name='NECONFIRMATA'").bind(v.country,v.league,division(v.league),tm,e.tournament_id).run();
    await stamp(env.DB,e,'VERIFIED',v);verified++;
   }else{await stamp(env.DB,e,conflict?'REVIEW':e.country?'COUNTRY_ONLY':'NOT_FOUND',null);unresolved++}
  }catch(err){errors.push(String(err?.message||err).slice(0,160))}
 }
 }catch(err){errors.push('SELECT '+String(err?.message||err).slice(0,160))}
 await env.DB.prepare('INSERT INTO sb_radar_competition_resolver_runs_v1(run_utc,mode,attempted,verified,country_only,unresolved,errors,elapsed_ms) VALUES(?,?,?,?,?,?,?,?)').bind(now(),'CRON',count,verified,0,unresolved,errors.join(' | ').slice(0,500)||null,Date.now()-start).run();
}
export default {
 async scheduled(evt,env,ctx){ctx.waitUntil(cycle(env))},
 async fetch(req,env){
  if(req.method!=='GET'||new URL(req.url).pathname!=='/health')return new Response('Not Found',{status:404});
  const last=await env.DB.prepare('SELECT * FROM sb_radar_competition_resolver_runs_v1 ORDER BY id DESC LIMIT 1').first();
  const coverage=await env.DB.prepare("SELECT COUNT(*) total,SUM(country!='NECONFIRMATA') countries,SUM(league_name!='NECONFIRMATA') leagues FROM sb_radar_event_competition").first();
  return Response.json({service:'sb-radar-competition-resolver-v1',mode:'background-only',provider:'TheSportsDB',last,coverage},{headers:{'cache-control':'no-store'}});
 }
};