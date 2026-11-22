/* Regista Goals Market Quotes — read-only, fail-closed, <=2 Superbet events per 20-minute sync.
   Important: no market ID is guessed, no bookmaker price is inferred from 1X2,
   and no BET NOW/notification can be created from this collector. */
const BASE='https://production-superbet-offer-ro.freetls.fastly.net/v3/ro-RO/events';
const iso=()=>new Date().toISOString();
const normalized=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const pct=x=>Number.isFinite(Number(x))?Number(x):null;

function parseGoalPrices(event){
 const results=[],ms=Array.isArray(event?.markets)?event.markets:[];
 for(const m of ms){
  const title=normalized(m?.metadata?.name||m?.name||'');
  if(!title||/(first half|1st half|prima repriza|reprising|corners|corner|cards|cartonase|players|player)/.test(title))continue;
  const goalMarket=/(total.{0,30}(goals?|goluri)|(?:goals?|goluri).{0,30}total|over.{0,5}under|peste.{0,5}sub)/.test(title);
  const ggMarket=/(both teams to score|both teams score|ambele echipe.{0,12}marc|gg.?ng|goal.?no.goal|gol.?no.gol)/.test(title);
  if(!goalMarket&&!ggMarket)continue;
  const title25=/(^|[^0-9])2[.,]5([^0-9]|$)/.test(title),odds=Array.isArray(m.odds)?m.odds:[];
  for(const o of odds){
   if(o?.available===false||o?.active===false||o?.suspended===true)continue;
   const price=pct(o.price);
   if(!(price>1&&price<100))continue;
   const label=normalized(o.metadata?.name||o.name||'');
   let key=null;
   if(goalMarket&&(title25||/(^|[^0-9])2[.,]5([^0-9]|$)/.test(label))){
    if(/(^|[^a-z])(over|peste|mai mult)([^a-z]|$)/.test(label))key='OVER25';
    else if(/(^|[^a-z])(under|sub|mai putin)([^a-z]|$)/.test(label))key='UNDER25';
   }else if(ggMarket){
    if(/^(yes|da|gol|gg|both|ambele)$/.test(label))key='BTTS';
    else if(/^(no|nu|no goal|no gol|ng|no btts)$/.test(label))key='NO_BTTS';
   }
   if(!key)continue;
   results.push({market:key,price,marketId:String(m.id??''),selectionId:String(o.id??''),sourceName:(title+' · '+label).slice(0,200)});
  }
 }
 // Duplicate goal lines across specialized markets are ambiguous: reject rather than guess.
 const grouped=new Map();for(const r of results){const list=grouped.get(r.market)||[];list.push(r);grouped.set(r.market,list);}
 return [...grouped.entries()].flatMap(([_,rows])=>rows.length===1&&rows[0].marketId&&rows[0].selectionId?rows:[]);
}
async function audit(env,checked,requested,status,count,verdict,error){
 await env.DB.prepare('INSERT INTO sb_regista_goal_quote_audit_v1(checked_utc,requested_events,source_http_status,stored_quotes,verdict,error) VALUES(?,?,?,?,?,?)')
  .bind(checked,requested,status,count,verdict,String(error||'').slice(0,240)||null).run();
}
export async function collectGoalMarketQuotes(env){
 const checked=iso(),now=Date.now();
 const previous=await env.DB.prepare('SELECT checked_utc,source_http_status,verdict FROM sb_regista_goal_quote_audit_v1 ORDER BY id DESC LIMIT 1').first();
 if(previous){
  const age=now-Date.parse(previous.checked_utc);
  if(age>=0&&age<24*3600000&&(previous.source_http_status===401||previous.source_http_status===403))return {status:'BLOCKED_24H_BACKOFF'};
  if(age>=0&&age<18*60000)return {status:'THROTTLED'};
 }
 const from=new Date(now+10*60000).toISOString(),to=new Date(now+90*60000).toISOString();
 const picks=await env.DB.prepare("SELECT DISTINCT event_id,kickoff_utc FROM sb_regista_signals_v1 WHERE market IN ('OVER25','UNDER25','BTTS','NO_BTTS') AND event_id>0 AND match_confidence>=0.98 AND source_first_seen_utc < kickoff_utc AND kickoff_utc BETWEEN ? AND ? ORDER BY kickoff_utc ASC LIMIT 2").bind(from,to).all();
 const list=picks.results||[];
 if(!list.length)return {status:'NO_UPCOMING_GOALS'};
 let saved=0,status=null,error=null,verdict='NO_VERIFIED_MARKET';
 try{
  // The existing SB Radar uses this Superbet v3 offer feed for market 547 (1X2).
  // Market discovery is attempted without an undocumented / guessed goals market id.
  const url=new URL(BASE);url.searchParams.set('events',list.map(x=>x.event_id).join(','));
  url.searchParams.set('includeOnly','fixture,markets');
  const res=await fetch(url.toString(),{headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(6000)});
  status=res.status;
  if(!res.ok){verdict='SOURCE_UNAVAILABLE';error='Superbet returned '+status;return {status:verdict,http_status:status};}
  const doc=await res.json();const events=Array.isArray(doc?.events)?doc.events:[];
  for(const p of list){
   const e=events.find(x=>Number(x.event_id)===Number(p.event_id));if(!e)continue;
   const picks=parseGoalPrices(e),kick=Date.parse(p.kickoff_utc);
   if(!(now<kick-300000))continue;
   for(const x of picks){
    const q=await env.DB.prepare("INSERT OR IGNORE INTO sb_regista_goal_prices_v1(event_id,market,captured_utc,kickoff_utc,price,source_market_id,source_selection_id,provider,source_name) VALUES(?,?,?,?,?,?,?,'SUPERBET_V3',?)")
     .bind(Number(p.event_id),x.market,checked,p.kickoff_utc,x.price,x.marketId,x.selectionId,x.sourceName).run();
    saved+=q.meta?.changes||0;
   }
  }
  verdict=saved?'CAPTURED_MARKET_ODDS':'NO_UNAMBIGUOUS_GOALS_MARKETS';
 }catch(e){verdict='FETCH_OR_PARSE_ERROR';error=String(e).slice(0,230);}
 finally{await audit(env,checked,list.length,status,saved,verdict,error).catch(e=>console.warn('GOALS_MARKET_AUDIT',String(e).slice(0,110)));}
 return {status:verdict,http_status:status,requested:list.length,quotes:saved};
}
export {parseGoalPrices};
