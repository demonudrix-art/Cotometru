/* SB Radar • official Superbet structure metadata, isolated 15-minute cron.
 * Uses verified tournament/category IDs. Never changes scanner, odds, bets or FCM.
 */
const API='https://production-superbet-offer-ro.freetls.fastly.net/v2/ro-RO/struct';
const now=()=>new Date().toISOString();
const db=(env,sql,...p)=>env.DB.prepare(sql).bind(...p);
const id=x=>Number.isSafeInteger(Number(x))&&Number(x)>0?Number(x):null;
const name=x=>String(x?.localNames?.['ro-RO']||'').trim().slice(0,220);
async function bulkNames(env,table,col,rows,utc){
 let total=0;
 for(let i=0;i<rows.length;i+=240){
  const ops=[];
  for(const part of Array.from({length:Math.ceil(Math.min(240,rows.length-i)/20)},(_,k)=>rows.slice(i+20*k,i+20*(k+1))).filter(x=>x.length)){
   const sql='INSERT INTO '+table+'('+col+',name,synced_utc) VALUES '+part.map(()=>'(?,?,?)').join(',')+
    ' ON CONFLICT('+col+') DO UPDATE SET name=excluded.name,synced_utc=excluded.synced_utc WHERE name<>excluded.name';
   ops.push(db(env,sql,...part.flatMap(x=>[x.id,x.name,utc])));
  }
  const r=await env.DB.batch(ops);total+=r.reduce((s,x)=>s+Number(x.meta?.changes||0),0);
 }
 return total;
}
async function bulkLabels(env,rows,utc){
 let total=0;
 for(let i=0;i<rows.length;i+=200){
  const ops=[];
  for(let j=i;j<Math.min(i+200,rows.length);j+=20){
   const part=rows.slice(j,j+20);
   const sql="INSERT OR IGNORE INTO sb_radar_tournament_labels(tournament_id,country,league_name,division,source,confidence,updated_utc) VALUES "+
    part.map(()=>"(?,?,?,NULL,'SUPERBET_STRUCTURE_PREFIX_V1','RIDICATA',?)").join(',');
   ops.push(db(env,sql,...part.flatMap(x=>[x.id,x.country,x.league,utc])));
  }
  const r=await env.DB.batch(ops);total+=r.reduce((s,x)=>s+Number(x.meta?.changes||0),0);
 }
 return total;
}
const FROM_CATALOG="INSERT OR IGNORE INTO sb_radar_tournament_labels(tournament_id,country,league_name,division,source,confidence,updated_utc) SELECT e.tournament_id,cat.name,CASE WHEN substr(tour.name,1,length(cat.name)+3)=cat.name||' - ' THEN substr(tour.name,length(cat.name)+4) ELSE tour.name END,NULL,'SUPERBET_STRUCTURE_CATEGORY_V1','RIDICATA',? FROM (SELECT tournament_id,MIN(category_id) category_id FROM event_catalog WHERE sport_id=5 AND tournament_id IS NOT NULL AND category_id IS NOT NULL GROUP BY tournament_id HAVING COUNT(DISTINCT category_id)=1) e JOIN sb_radar_superbet_struct_tournaments_v1 tour ON tour.tournament_id=e.tournament_id JOIN sb_radar_superbet_struct_categories_v1 cat ON cat.category_id=e.category_id WHERE length(tour.name)>=3 AND length(cat.name)>=2";
const ADD_EVENTS="INSERT OR IGNORE INTO sb_radar_event_competition(event_id,kickoff_utc,fixture,tournament_id,category_id,country,league_name,division,source,confidence,updated_utc,match_type) SELECT e.event_id,e.kickoff_utc,e.fixture,e.tournament_id,e.category_id,t.country,t.league_name,t.division,'SUPERBET_STRUCTURE_V2','RIDICATA',?,NULL FROM event_catalog e JOIN sb_radar_tournament_labels t ON t.tournament_id=e.tournament_id WHERE e.sport_id=5 AND t.country<>'' AND t.league_name<>''";
const FILL_EVENTS="UPDATE sb_radar_event_competition SET country=(SELECT t.country FROM sb_radar_tournament_labels t WHERE t.tournament_id=sb_radar_event_competition.tournament_id),league_name=(SELECT t.league_name FROM sb_radar_tournament_labels t WHERE t.tournament_id=sb_radar_event_competition.tournament_id),division=COALESCE(division,(SELECT t.division FROM sb_radar_tournament_labels t WHERE t.tournament_id=sb_radar_event_competition.tournament_id)),source='SUPERBET_STRUCTURE_V2',confidence='RIDICATA',updated_utc=? WHERE (league_name='NECONFIRMATA' OR league_name='' OR league_name IS NULL) AND EXISTS(SELECT 1 FROM sb_radar_tournament_labels t WHERE t.tournament_id=sb_radar_event_competition.tournament_id AND t.country<>'' AND t.league_name<>'')";
const FILL_TYPES="UPDATE sb_radar_event_competition SET match_type=(SELECT CASE WHEN UPPER(tour.name) LIKE '%U17%' OR UPPER(tour.name) LIKE '%U18%' OR UPPER(tour.name) LIKE '%U19%' OR UPPER(tour.name) LIKE '%U20%' OR UPPER(tour.name) LIKE '%U21%' OR UPPER(tour.name) LIKE '%U23%' OR UPPER(tour.name) LIKE '%JEUNES%' OR UPPER(tour.name) LIKE '%PRIMAVERA%' THEN 'YOUTH' WHEN UPPER(tour.name) LIKE '%(F)%' OR UPPER(tour.name) LIKE '%WOMEN%' OR UPPER(tour.name) LIKE '%FEMIN%' THEN 'WOMEN' WHEN UPPER(tour.name) LIKE '%(R)%' OR UPPER(tour.name) LIKE '%RESERV%' OR UPPER(tour.name) LIKE '%REZERV%' THEN 'RESERVES' WHEN UPPER(tour.name) LIKE '%CUP%' OR UPPER(tour.name) LIKE '%CUPA%' THEN 'CUP' ELSE NULL END FROM sb_radar_superbet_struct_tournaments_v1 tour WHERE tour.tournament_id=sb_radar_event_competition.tournament_id),updated_utc=? WHERE (match_type IS NULL OR match_type='') AND EXISTS(SELECT 1 FROM sb_radar_superbet_struct_tournaments_v1 tour WHERE tour.tournament_id=sb_radar_event_competition.tournament_id AND (CASE WHEN UPPER(tour.name) LIKE '%U17%' OR UPPER(tour.name) LIKE '%U18%' OR UPPER(tour.name) LIKE '%U19%' OR UPPER(tour.name) LIKE '%U20%' OR UPPER(tour.name) LIKE '%U21%' OR UPPER(tour.name) LIKE '%U23%' OR UPPER(tour.name) LIKE '%JEUNES%' OR UPPER(tour.name) LIKE '%PRIMAVERA%' THEN 'YOUTH' WHEN UPPER(tour.name) LIKE '%(F)%' OR UPPER(tour.name) LIKE '%WOMEN%' OR UPPER(tour.name) LIKE '%FEMIN%' THEN 'WOMEN' WHEN UPPER(tour.name) LIKE '%(R)%' OR UPPER(tour.name) LIKE '%RESERV%' OR UPPER(tour.name) LIKE '%REZERV%' THEN 'RESERVES' WHEN UPPER(tour.name) LIKE '%CUP%' OR UPPER(tour.name) LIKE '%CUPA%' THEN 'CUP' ELSE NULL END) IS NOT NULL)";
async function sync(env){
 const started=Date.now(),utc=now(),owner=crypto.randomUUID();
 const rep={run_utc:utc,status:'RUNNING',changed:0,tournaments:0,categories:0,cache_updates:0,labels_added:0,events_added:0,events_filled:0};
 let locked=false,runId=null;
 try{
  const lock=await db(env,"UPDATE sb_radar_superbet_struct_control_v1 SET lock_owner=?,locked_until=?,latest_status='RUNNING' WHERE id=1 AND (locked_until IS NULL OR locked_until<?)",owner,new Date(Date.now()+180000).toISOString(),utc).run();
  if(Number(lock.meta?.changes)!==1)return {status:'SKIPPED',reason:'lease_held'};
  locked=true;
  const run=await db(env,"INSERT INTO sb_radar_superbet_struct_runs_v1(run_utc,status) VALUES(?,'RUNNING')",utc).run();
  runId=run.meta?.last_row_id;if(!runId)throw Error('RUN_ID_MISSING');
  const rsp=await fetch(API,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(14000)});
  if(!rsp.ok)throw Error('SUPERBET_HTTP_'+rsp.status);
  const payload=await rsp.json(),data=payload?.data;
  if(payload?.error!==false||!Array.isArray(data?.tournaments)||!Array.isArray(data?.categories))throw Error('STRUCT_SCHEMA_INVALID');
  const rows=(arr)=>{const unique=new Map();for(const x of arr){const k=id(x.id),n=name(x);if(k&&n.length>1&&!unique.has(k))unique.set(k,{id:k,name:n});}return [...unique.values()].sort((a,b)=>a.id-b.id)};
  const tournaments=rows(data.tournaments),categories=rows(data.categories);
  if(tournaments.length<1000||categories.length<150)throw Error('STRUCT_INCOMPLETE');
  rep.tournaments=tournaments.length;rep.categories=categories.length;
  const canonical=JSON.stringify([tournaments,categories]),hashBytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical));
  const checksum=Array.from(new Uint8Array(hashBytes)).map(x=>x.toString(16).padStart(2,'0')).join('');
  const prev=await db(env,"SELECT hash FROM sb_radar_superbet_struct_control_v1 WHERE id=1").first();
  const cached=await db(env,"SELECT (SELECT COUNT(*) FROM sb_radar_superbet_struct_tournaments_v1) tn,(SELECT COUNT(*) FROM sb_radar_superbet_struct_categories_v1) cn").first();
  const changed=checksum!==prev?.hash||Number(cached?.tn)<1000||Number(cached?.cn)<150;
  rep.changed=changed?1:0;
  if(changed){
   rep.cache_updates+=await bulkNames(env,'sb_radar_superbet_struct_categories_v1','category_id',categories,utc);
   rep.cache_updates+=await bulkNames(env,'sb_radar_superbet_struct_tournaments_v1','tournament_id',tournaments,utc);
   const footballCats=(await db(env,"SELECT DISTINCT category_id FROM event_catalog WHERE sport_id=5 AND category_id IS NOT NULL").all()).results||[];
   const categorySet=new Set(footballCats.map(x=>Number(x.category_id)));
   const knownNames=categories.filter(x=>categorySet.has(x.id)).map(x=>x.name).sort((a,b)=>b.length-a.length);
   const observed=(await db(env,"SELECT tournament_id,MIN(category_id) category_id FROM event_catalog WHERE sport_id=5 AND category_id IS NOT NULL AND tournament_id IS NOT NULL GROUP BY tournament_id HAVING COUNT(DISTINCT category_id)=1").all()).results||[];
   const names=new Map(categories.map(x=>[x.id,x.name]));
   const known=new Map(observed.map(x=>[Number(x.tournament_id),names.get(Number(x.category_id))]));
   const prefill=[];
   for(const t of tournaments){
    const country=knownNames.find(c=>t.name.startsWith(c+' - '));
    if(!country)continue;
    const league=t.name.slice(country.length+3).trim();
    if(league.length<2||(known.has(t.id)&&known.get(t.id)!==country))continue;
    prefill.push({id:t.id,country,league});
   }
   rep.labels_added+=await bulkLabels(env,prefill,utc);
  }
  rep.labels_added+=Number((await db(env,FROM_CATALOG,utc).run()).meta?.changes||0);
  rep.events_added=Number((await db(env,ADD_EVENTS,utc).run()).meta?.changes||0);
  rep.events_filled=Number((await db(env,FILL_EVENTS,utc).run()).meta?.changes||0);
  rep.typed_events=Number((await db(env,FILL_TYPES,utc).run()).meta?.changes||0);
  const coverage=await db(env,"SELECT COUNT(*) n FROM sb_radar_event_competition WHERE league_name='NECONFIRMATA' OR league_name IS NULL OR league_name=''").first();
  rep.remaining_unknown=Number(coverage?.n||0);
  await db(env,"UPDATE sb_radar_superbet_struct_control_v1 SET hash=?,last_success_utc=?,latest_status='OK',latest_error=NULL,lock_owner=NULL,locked_until=NULL,tournaments_count=?,categories_count=? WHERE id=1 AND lock_owner=?",checksum,utc,tournaments.length,categories.length,owner).run();
  locked=false;rep.status='OK';rep.elapsed_ms=Date.now()-started;
  await db(env,"UPDATE sb_radar_superbet_struct_runs_v1 SET status='OK',structure_changed=?,upsert_tournaments=?,upsert_categories=?,inserted_labels=?,inserted_events=?,filled_events=?,typed_events=?,elapsed_ms=? WHERE id=?",rep.changed,rep.cache_updates,rep.categories,rep.labels_added,rep.events_added,rep.events_filled,rep.typed_events,rep.elapsed_ms,runId).run();
 }catch(e){
  rep.status='ERROR';rep.error=String(e?.message||e).slice(0,500);rep.elapsed_ms=Date.now()-started;
  if(runId)try{await db(env,"UPDATE sb_radar_superbet_struct_runs_v1 SET status='ERROR',error=?,elapsed_ms=? WHERE id=?",rep.error,rep.elapsed_ms,runId).run()}catch(_){}
  if(locked)try{await db(env,"UPDATE sb_radar_superbet_struct_control_v1 SET latest_status='ERROR',latest_error=?,lock_owner=NULL,locked_until=NULL WHERE id=1 AND lock_owner=?",rep.error,owner).run()}catch(_){}
 }
 return rep;
}
export default {
 async scheduled(event,env,ctx){ctx.waitUntil(sync(env))},
 async fetch(req,env){
  if(req.method!=='GET'||new URL(req.url).pathname!=='/health')return new Response('Not found',{status:404});
  const [state,last,coverage,example]=await Promise.all([
   db(env,'SELECT last_success_utc,latest_status,latest_error,tournaments_count,categories_count FROM sb_radar_superbet_struct_control_v1 WHERE id=1').first(),
   db(env,'SELECT run_utc,status,structure_changed,inserted_labels,inserted_events,filled_events,typed_events,elapsed_ms,error FROM sb_radar_superbet_struct_runs_v1 ORDER BY id DESC LIMIT 1').first(),
   db(env,"SELECT COUNT(*) total,SUM(league_name='NECONFIRMATA') unknown FROM sb_radar_event_competition").first(),
   db(env,'SELECT country,league_name,source FROM sb_radar_tournament_labels WHERE tournament_id=64551').first()
  ]);
  return Response.json({service:'SB_Radar_Official_Superbet_Structure',upstream:'/v2/ro-RO/struct',cron:'*/15 * * * *',isolated_from_bets:true,fresh:!!(state?.last_success_utc&&Date.now()-Date.parse(state.last_success_utc)<45*60000),state,last,coverage,iraq_64551:example},{headers:{'cache-control':'no-store'}});
 }
};