const ORIGIN='https://production-superbet-offer-ro.freetls.fastly.net/v3/ro-RO/events';
function iso(t){return new Date(t).toISOString()}
function number(x){let n=Number(x);return Number.isFinite(n)?n:null}
function groups(xs,n){const out=[];for(let i=0;i<xs.length;i+=n)out.push(xs.slice(i,i+n));return out}
async function scan(env){
 const now=Date.now(),timestamp=iso(now);
 const result=(await env.DB.prepare("SELECT event_id,fixture,kickoff_utc FROM quote_state WHERE settled=0 AND kickoff_utc<=? AND kickoff_utc>=? ORDER BY kickoff_utc DESC LIMIT 180").bind(timestamp,iso(now-5*3600000)).all()).results||[];
 // Keep each D1 query below the 100-parameter limit even when 180 events are active.
 const previous=[];
 for(const batch of groups(result,50)){
  const placeholders=batch.map(()=>'?').join(',');
  const rows=(await env.DB.prepare("SELECT event_id,last_json,captured_utc FROM live_state WHERE event_id IN ("+placeholders+")").bind(...batch.map(x=>x.event_id)).all()).results||[];
  previous.push(...rows);
 }
 const prev=new Map(previous.map(x=>[Number(x.event_id),x]));
 const newRows=[];
 for(const pack of groups(result,16)){
  const url=new URL(ORIGIN);url.searchParams.set('events',pack.map(x=>Number(x.event_id)).sort((a,b)=>a-b).join(','));
  url.searchParams.set('includeOnly','fixture,inPlayStats,inPlayStatsMetadata,markets');
  url.searchParams.set('markets','547');
  const response=await fetch(url.toString(),{headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(14000)});
  if(!response.ok)continue;
  const d=await response.json();
  for(const e of d.events||[]){
   const st=e.inplay_stats,meta=e.inplay_stats_metadata;
   if(!st||!(meta?.status==='STARTED'||st.minutes!==undefined))continue;
   const market=(e.markets||[]).find(m=>m.id===547);
   const o=Object.fromEntries((market?.odds||[]).filter(x=>['1','X','2'].includes(x.metadata?.name)).map(x=>[x.metadata.name,x]));
   const fixture=pack.find(x=>Number(x.event_id)===Number(e.event_id));
   if(!fixture)continue;
   const fields={minute:number(st.minutes),h:number(st.home_team_score),a:number(st.away_team_score),hc:number(st.home_team_corners),ac:number(st.away_team_corners),period:meta?.period_status||meta?.event_status_label||'LIVE',p1:number(o['1']?.price),px:number(o.X?.price),p2:number(o['2']?.price),gh:number(o['1']?.metadata?.extra?.generosity_prob_home),ga:number(o['2']?.metadata?.extra?.generosity_prob_away),increment:number(e.increment_id)};
   const smallStats=JSON.stringify({stats:st,metadata:meta});
   const signature=JSON.stringify([fields,smallStats]);
   const prior=prev.get(Number(e.event_id));
   if(prior?.last_json===signature)continue;
   newRows.push({id:Number(e.event_id),fixture:fixture.fixture,ko:fixture.kickoff_utc,...fields,smallStats,signature});
  }
 }
 const stmts=[];
 for(const part of groups(newRows,5)){
  const cols=18,p='('+Array(cols).fill('?').join(',')+')';
  stmts.push(env.DB.prepare('INSERT OR IGNORE INTO live_snapshots(event_id,captured_utc,kickoff_utc,fixture,period,minute,home_score,away_score,home_corners,away_corners,p1,px,p2,generosity_home,generosity_away,increment_id,stats_json) VALUES '+part.map(()=> '('+Array(17).fill('?').join(',')+')').join(',')).bind(...part.flatMap(r=>[r.id,timestamp,r.ko,r.fixture,r.period,r.minute,r.h,r.a,r.hc,r.ac,r.p1,r.px,r.p2,r.gh,r.ga,r.increment,r.smallStats])));
  stmts.push(env.DB.prepare('INSERT INTO live_state(event_id,last_json,captured_utc) VALUES '+part.map(()=> '(?,?,?)').join(',')+' ON CONFLICT(event_id) DO UPDATE SET last_json=excluded.last_json,captured_utc=excluded.captured_utc').bind(...part.flatMap(r=>[r.id,r.signature,timestamp])));
 }
 if(stmts.length)await env.DB.batch(stmts);
 return {checked:result.length,saved:newRows.length};
}
export default {async scheduled(e,env,ctx){ctx.waitUntil((async()=>{const started=new Date().toISOString();let saved=0,error=null;try{const result=await scan(env);saved=result.saved}catch(e){error=String(e).slice(0,400)}await env.DB.prepare('INSERT INTO live_runs(started_utc,saved,error) VALUES(?,?,?)').bind(started,saved,error).run();if(error)throw new Error(error)})())},async fetch(req){return new Response('Not found',{status:404})}};