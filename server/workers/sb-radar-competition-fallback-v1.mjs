/* SB Radar competition fallback v1 - read enrichment, background only.
 * Sources: ESPN public scoreboard + match summary; SportEvents24 public fixtures.
 * Never called on quote/scanner/alert critical path; false positive < missing data.
 */
const ESPN='https://site.api.espn.com/apis/site/v2/sports/soccer/all/';
const S24='https://sportsevents24.com/api/v1/events';
const stamp=()=>new Date().toISOString();
const text=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&amp;/g,'and').replace(/[^a-z0-9]+/g,' ').trim();
const ban=new Set(['fc','fk','sc','cf','ac','afc','football','club','the','de','cd','of','clubul','sportiv','futbol']);
function tokens(s){return text(s).split(' ').filter(x=>x&&!ban.has(x))}
function similarity(a,b){const aa=new Set(tokens(a)),bb=new Set(tokens(b));if(!aa.size||!bb.size)return 0;let n=0;for(const k of aa)if(bb.has(k))n++;return 2*n/(aa.size+bb.size)}
function teams(f){const s=String(f||'').split('·').map(x=>x.trim());return s.length===2&&s.every(x=>x.length>=3)?s:null}
const isoCountries={
 'Romania':'RO','Polonia':'PL','Brazilia':'BR','Turcia':'TR','Georgia':'GE',
 'Spania':'ES','Italia':'IT','Germania':'DE','Franta':'FR','Anglia':'GB','Scotia':'GB',
 'Belgia':'BE','Portugalia':'PT','Olanda':'NL','Cehia':'CZ','Slovacia':'SK','Ungaria':'HU','Serbia':'RS',
 'Rusia':'RU','Ucraina':'UA','Austria':'AT','Elvetia':'CH','Suedia':'SE','Norvegia':'NO','Danemarca':'DK',
 'Grecia':'GR','Argentina':'AR','Mexic':'MX','China':'CN','Japonia':'JP','Israel':'IL','SUA':'US',
 'Egipt':'EG','Africa de Sud':'ZA','Tanzania':'TZ','Nigeria':'NG','India':'IN','Croatia':'HR',
 'Kosovo':'XK','Belarus':'BY','Turcia':'TR','Zambia':'ZM','Tunisia':'TN','Algeria':'DZ','Uganda':'UG','Liberia':'LR'
};
const isInternational=(league,cat)=>/\b(uefa|concacaf|conmebol|fifa|caf|afc|ofc|nations league|world cup|international|champions league|europa league|olympic)\b/i.test(league)||[26,31,102].includes(Number(cat));
function countryFor(e,league){
 if(isInternational(league,e.category_id))return 'Internațional';
 if(e.country&&e.country!=='NECONFIRMATA')return e.country;
 const rules=[[/\benglish|\bengland|premier league/i,'Anglia'],[/\bfrench|\bfrance|\bligue [12]/i,'Franta'],[/\bitalian|\bserie [ab]\b/i,'Italia'],[/\bgerman|\bbundesliga/i,'Germania'],[/\bspanish|\bla liga\b/i,'Spania'],[/\bportuguese|\bprimeira liga/i,'Portugalia'],[/\bromanian|\bromania/i,'Romania'],[/\bbrazilian|\bbrasileiro/i,'Brazilia'],[/\bargentine|\bargentina/i,'Argentina']];
 const found=rules.filter(x=>x[0].test(league));return found.length===1?found[0][1]:null;
}
function matchType(league,fixture){
 const s=String(league||'')+' '+String(fixture||'');
 if(/\b(women|woman|female|feminin|fem\.|frauen|femmes|ladies)\b|\(F\)/i.test(s))return 'WOMEN';
 if(/\b(U[- ]?(?:15|16|17|18|19|20|21|22|23)|under[- ]?\d{2}|junior|youth|academy|primavera)\b/i.test(s))return 'YOUTH';
 if(/\b(reserves|reserve|B team|second team)\b/i.test(s))return 'RESERVES';
 if(/\b(cup|copa|cupa|pokal|coppa|trophy)\b/i.test(league))return 'CUP';
 return 'SENIOR_OR_OTHER';
}
function division(league){
 const s=String(league||'');
 return s.match(/\b(?:liga|division|divizia|serie|league)\s*(?:[1-9]|[ABCD])\b/i)?.[0]||
 s.match(/\b[1-4]\.?\s*(?:bundesliga|liga)\b/i)?.[0]||null;
}
function evaluate(e,home,away,utc){
 const pair=teams(e.fixture),t=Date.parse(utc),ko=Date.parse(e.kickoff_utc);
 if(!pair||!Number.isFinite(t)||!Number.isFinite(ko))return null;
 const h=similarity(pair[0],home),a=similarity(pair[1],away),delta=Math.abs(t-ko)/60000;
 if(h<.72||a<.72||(h+a)/2<.82||delta>90)return null;
 return {score:+((h+a)/2).toFixed(4),delta_minutes:Math.round(delta)};
}
async function jsonFetch(url,timeout=7000){
 const resp=await fetch(url,{headers:{Accept:'application/json','User-Agent':'SB-Radar-Competition-Fallback/1.0'},signal:AbortSignal.timeout(timeout)});
 if(!resp.ok)throw Error('HTTP_'+resp.status+' '+new URL(url).hostname);
 return await resp.json();
}
function dayOf(dt){return String(dt).slice(0,10)}
function dayFormat(d){return d.replace(/-/g,'')}
function previousDay(d){const v=new Date(d+'T00:00:00Z');v.setUTCDate(v.getUTCDate()-1);return v.toISOString().slice(0,10)}
function nextDay(d){const v=new Date(d+'T00:00:00Z');v.setUTCDate(v.getUTCDate()+1);return v.toISOString().slice(0,10)}
async function espnDaily(env,day,ctx){
 let cached=await env.DB.prepare('SELECT events_json,fetched_utc FROM sb_radar_competition_espn_cache_v1 WHERE day_utc=?').bind(day).first();
 if(cached){
   const age=Date.now()-Date.parse(cached.fetched_utc),old=day<dayOf(stamp());
   if(old||age<6*3600000)return JSON.parse(cached.events_json);
 }
 if(ctx.espnFetches>=2)return null;
 ctx.espnFetches++;
 let events=[];
 try{
  const data=await jsonFetch(ESPN+'scoreboard?dates='+dayFormat(day)+'&limit=300',9500);
  events=(data.events||[]).map(x=>{
    const co=x.competitions?.[0]?.competitors||[],home=co.find(t=>t.homeAway==='home'),away=co.find(t=>t.homeAway==='away');
    return {id:String(x.id||''),utc:x.date,h:home?.team?.displayName,a:away?.team?.displayName};
  }).filter(x=>x.id&&x.h&&x.a&&x.utc);
 }catch(err){ctx.errors.push('ESPN_DAY '+day+' '+String(err?.message||err).slice(0,65));return null}
 await env.DB.prepare("INSERT INTO sb_radar_competition_espn_cache_v1(day_utc,events_json,events_count,fetched_utc) VALUES(?,?,?,?) ON CONFLICT(day_utc) DO UPDATE SET events_json=excluded.events_json,events_count=excluded.events_count,fetched_utc=excluded.fetched_utc").bind(day,JSON.stringify(events),events.length,stamp()).run();
 return events;
}
async function findEspn(env,e,ctx){
 const d=dayOf(e.kickoff_utc),hour=Number(e.kickoff_utc.slice(11,13)),days=hour<8?[previousDay(d),d]:[d];
 for(const day of days){
  const events=await espnDaily(env,day,ctx);if(!events)continue;
  const candidates=events.map(x=>({x,m:evaluate(e,x.h,x.a,x.utc)})).filter(z=>z.m).sort((a,b)=>b.m.score-a.m.score||a.m.delta_minutes-b.m.delta_minutes);
  if(!candidates.length)continue;
  if(candidates.length>1&&candidates[1].m.score>candidates[0].m.score-.035){ctx.errors.push('ESPN_AMBIGUOUS '+e.event_id);return null}
  const hit=candidates[0];
  try{
   const v=await jsonFetch(ESPN+'summary?event='+encodeURIComponent(hit.x.id),7600);
   const lg=String(v.header?.league?.name||'').trim();
   if(!lg)return null;
   const cn=countryFor(e,lg);
   if(!cn)return null;
   return {source:'ESPN_MATCH_SUMMARY',league:lg,country:cn,division:division(lg),match_type:matchType(lg,e.fixture),external_id:hit.x.id,source_url:'https://www.espn.com/soccer/match/_/gameId/'+hit.x.id,...hit.m};
  }catch(err){ctx.errors.push('ESPN_SUMMARY '+String(err?.message||err).slice(0,65))}
 }
 return null;
}
async function reserveS24(env,ctx){
 if(ctx.s24Fetches>=1)return false;
 const d=dayOf(stamp()),month=d.slice(0,7);
 const budget=await env.DB.prepare('SELECT COALESCE(SUM(rows),0) rows FROM sb_radar_competition_provider_usage_v1 WHERE provider=? AND day_utc LIKE ?').bind('SPORTSEVENTS24',month+'%').first();
 if((budget?.rows||0)>=3800)return false;
 const q="INSERT INTO sb_radar_competition_provider_usage_v1(provider,day_utc,requests,rows,updated_utc) VALUES(?,?,1,0,?) ON CONFLICT(provider,day_utc) DO UPDATE SET requests=requests+1,updated_utc=excluded.updated_utc WHERE requests<2";
 const result=await env.DB.prepare(q).bind('SPORTSEVENTS24',d,stamp()).run();
 if(!result.meta?.changes)return false;
 ctx.s24Fetches++;
 return true;
}
async function s24Daily(env,country,day,ctx){
 const old=await env.DB.prepare('SELECT events_json FROM sb_radar_competition_s24_cache_v1 WHERE country_iso=? AND day_utc=?').bind(country,day).first();
 if(old)return JSON.parse(old.events_json);
 if(!await reserveS24(env,ctx))return null;
 let v=null;
 try{
  const u=S24+'?country='+encodeURIComponent(country)+'&sport_id=1&from='+day+'&to='+nextDay(day)+'&limit=80';
  const result=await jsonFetch(u,8000);
  const arr=Array.isArray(result.data)?result.data:[];
  v={events:arr.map(x=>({id:String(x.id||''),h:x.teamHome,a:x.teamAway,utc:x.startsAt,league:x.tournament,country:x.country})).filter(x=>x.id&&x.h&&x.a&&x.utc&&x.league),partial:Boolean(result.nextCursor),url:u};
  if(result.usage?.requestsRemaining===0)ctx.errors.push('SPORTSEVENTS24_DAILY_PROVIDER_LIMIT');
  await env.DB.prepare("INSERT OR REPLACE INTO sb_radar_competition_s24_cache_v1(country_iso,day_utc,events_json,events_count,partial,fetched_utc) VALUES(?,?,?,?,?,?)").bind(country,day,JSON.stringify(v),v.events.length,+v.partial,stamp()).run();
  await env.DB.prepare('UPDATE sb_radar_competition_provider_usage_v1 SET rows=rows+?,updated_utc=? WHERE provider=? AND day_utc=?').bind(arr.length,stamp(),'SPORTSEVENTS24',dayOf(stamp())).run();
 }catch(err){ctx.errors.push('SPORTSEVENTS24 '+String(err?.message||err).slice(0,80))}
 return v;
}
async function findS24(env,e,ctx){
 const cn=isoCountries[e.country];if(!cn)return null;
 const day=dayOf(e.kickoff_utc),v=await s24Daily(env,cn,day,ctx);if(!v)return null;
 const candidates=v.events.map(x=>({x,m:evaluate(e,x.h,x.a,x.utc)})).filter(z=>z.m&&z.x.country===cn).sort((a,b)=>b.m.score-a.m.score||a.m.delta_minutes-b.m.delta_minutes);
 if(!candidates.length)return null;
 if(candidates.length>1&&candidates[1].m.score>candidates[0].m.score-.035){ctx.errors.push('S24_AMBIGUOUS '+e.event_id);return null}
 const hit=candidates[0],league=String(hit.x.league).trim();
 if(!league)return null;
 return {source:'SPORTSEVENTS24_MATCH',league,country:e.country,division:division(league),match_type:matchType(league,e.fixture),external_id:hit.x.id,source_url:v.url,...hit.m};
}
async function saveEvidence(env,e,h){
 const now=stamp();
 const existing=e.tournament_id?await env.DB.prepare('SELECT league_name,country FROM sb_radar_tournament_labels WHERE tournament_id=?').bind(e.tournament_id).first():null;
 if(existing&&text(existing.league_name)!==text(h.league))return 'REVIEW_TOURNAMENT_CONFLICT';
 if(e.country&&e.country!=='NECONFIRMATA'&&e.country!=='International'&&h.country!=='Internațional'&&text(e.country)!==text(h.country))return 'REVIEW_COUNTRY_CONFLICT';
 if(e.tournament_id){
  await env.DB.prepare("INSERT OR IGNORE INTO sb_radar_tournament_labels(tournament_id,country,league_name,division,source,confidence,updated_utc) VALUES(?,?,?,?,?,'RIDICATA',?)").bind(e.tournament_id,h.country,h.league,h.division,h.source,now).run();
  await env.DB.prepare("UPDATE sb_radar_event_competition SET country=?,league_name=?,division=COALESCE(division,?),match_type=COALESCE(match_type,?),source=?,confidence='RIDICATA',updated_utc=? WHERE tournament_id=? AND (league_name='NECONFIRMATA' OR league_name IS NULL)").bind(h.country,h.league,h.division,h.match_type,h.source,now,e.tournament_id).run();
 }
 await env.DB.prepare("INSERT OR IGNORE INTO sb_radar_event_competition(event_id,kickoff_utc,fixture,tournament_id,category_id,country,league_name,division,source,confidence,updated_utc,match_type) VALUES(?,?,?,?,?,?,?,?,?,'RIDICATA',?,?)").bind(e.event_id,e.kickoff_utc,e.fixture,e.tournament_id,e.category_id,h.country,h.league,h.division,h.source,now,h.match_type).run();
 await env.DB.prepare("UPDATE sb_radar_event_competition SET country=?,league_name=?,division=COALESCE(division,?),match_type=COALESCE(match_type,?),source=?,confidence='RIDICATA',updated_utc=? WHERE event_id=? AND (league_name='NECONFIRMATA' OR league_name IS NULL)").bind(h.country,h.league,h.division,h.match_type,h.source,now,e.event_id).run();
 const sq="INSERT INTO sb_radar_competition_resolution_v1(event_id,tournament_id,category_id,fixture,kickoff_utc,country,league_name,division,match_type,source,source_url,confidence,status,attempts,last_attempt_utc,verified_utc,detail,updated_utc) VALUES(?,?,?,?,?,?,?,?,?,?,?,?, 'VERIFIED',1,?,?,?,?) ON CONFLICT(event_id) DO UPDATE SET country=excluded.country,league_name=excluded.league_name,division=excluded.division,match_type=excluded.match_type,source=excluded.source,source_url=excluded.source_url,confidence=excluded.confidence,status='VERIFIED',verified_utc=excluded.verified_utc,detail=excluded.detail,updated_utc=excluded.updated_utc";
 await env.DB.prepare(sq).bind(e.event_id,e.tournament_id,e.category_id,e.fixture,e.kickoff_utc,h.country,h.league,h.division,h.match_type,h.source,h.source_url,h.score,now,now,JSON.stringify({external_id:h.external_id,time_delta:h.delta_minutes,team_similarity:h.score}),now).run();
 await env.DB.prepare("INSERT OR REPLACE INTO sb_radar_competition_provenance_v1(event_id,provider,external_event_id,match_score,delta_minutes,source_url,verified_utc) VALUES(?,?,?,?,?,?,?)").bind(e.event_id,h.source,h.external_id,h.score,h.delta_minutes,h.source_url,now).run();
 return 'VERIFIED';
}
async function run(env){
 const started=Date.now(),ctx={espnFetches:0,s24Fetches:0,errors:[]},report={examined:0,verified:0,unconfirmed:0};
 try{
  const base="e.sport_id=5 AND (c.league_name IS NULL OR c.league_name='NECONFIRMATA') AND (a.event_id IS NULL OR a.last_utc<strftime('%Y-%m-%dT%H:%M:%SZ','now','-5 days'))";
  const cols="e.event_id,e.fixture,e.kickoff_utc,e.tournament_id,e.category_id,COALESCE(NULLIF(c.country,'NECONFIRMATA'),cat.country) country";
  const joins=" LEFT JOIN sb_radar_event_competition c ON c.event_id=e.event_id LEFT JOIN sb_radar_category_countries cat ON cat.category_id=e.category_id LEFT JOIN sb_radar_competition_fallback_attempts_v1 a ON a.event_id=e.event_id";
  const hot=(await env.DB.prepare("SELECT "+cols+" FROM sb_radar_ml_decisions d JOIN event_catalog e ON e.event_id=d.event_id"+joins+" WHERE d.model_version='SB_RADAR_ML_LOGREG_V1' AND "+base+" ORDER BY d.evaluated_utc DESC LIMIT 2").all()).results||[];
  const rest=(await env.DB.prepare("SELECT "+cols+" FROM event_catalog e INDEXED BY ix_sb_catalog_kickoff_resolver"+joins+" WHERE "+base+" AND e.event_id<>? ORDER BY e.kickoff_utc DESC LIMIT 5").bind(hot[0]?.event_id||-1).all()).results||[];
  const events=[...new Map([...hot,...rest].map(e=>[e.event_id,e])).values()].slice(0,6);
  for(const e of events){
   report.examined++;
   try{
    let hit=await findEspn(env,e,ctx);
    if(!hit)hit=await findS24(env,e,ctx);
    const status=hit?await saveEvidence(env,e,hit):'NOT_FOUND';
    if(status==='VERIFIED')report.verified++;else report.unconfirmed++;
    await env.DB.prepare("INSERT INTO sb_radar_competition_fallback_attempts_v1(event_id,provider,status,attempts,last_utc,detail) VALUES(?,?,?,1,?,?) ON CONFLICT(event_id) DO UPDATE SET provider=excluded.provider,status=excluded.status,attempts=attempts+1,last_utc=excluded.last_utc,detail=excluded.detail").bind(e.event_id,hit?.source||'ESPN+SPORTSEVENTS24',status,stamp(),hit?hit.source_url:ctx.errors.slice(-1)[0]||'No strict two-team/time match').run();
   }catch(err){report.unconfirmed++;ctx.errors.push('EVENT_'+e.event_id+' '+String(err?.message||err).slice(0,90))}
  }
 }catch(err){ctx.errors.push('SELECT '+String(err?.message||err).slice(0,160))}
 await env.DB.prepare("INSERT INTO sb_radar_competition_fallback_runs_v1(run_utc,examined,verified,unconfirmed,provider_errors,espn_fetches,s24_fetches,elapsed_ms) VALUES(?,?,?,?,?,?,?,?)").bind(stamp(),report.examined,report.verified,report.unconfirmed,ctx.errors.join(' | ').slice(0,1600)||null,ctx.espnFetches,ctx.s24Fetches,Date.now()-started).run();
 return {...report,espn_fetches:ctx.espnFetches,s24_fetches:ctx.s24Fetches,errors:ctx.errors};
}
export default {
 async scheduled(event,env,ctx){ctx.waitUntil(run(env))},
 async fetch(req,env){
  if(req.method!=='GET'||new URL(req.url).pathname!=='/health')return new Response('Not found',{status:404});
  const [last,coverage,budget]=await Promise.all([
   env.DB.prepare('SELECT * FROM sb_radar_competition_fallback_runs_v1 ORDER BY id DESC LIMIT 1').first(),
   env.DB.prepare("SELECT COUNT(*) total,SUM(country!='NECONFIRMATA') countries,SUM(league_name!='NECONFIRMATA') leagues FROM sb_radar_event_competition").first(),
   env.DB.prepare('SELECT SUM(requests) requests,SUM(rows) rows FROM sb_radar_competition_provider_usage_v1 WHERE provider=? AND day_utc LIKE ?').bind('SPORTSEVENTS24',dayOf(stamp()).slice(0,7)+'%').first()
  ]);
  return Response.json({ok:!last?.provider_errors,service:'sb-radar-competition-fallback-v1',mode:'isolated-background-enrichment',providers:['ESPN','SportEvents24'],last,coverage,monthly_budget:budget},{headers:{'cache-control':'no-store'}});
 }
};