// SB Radar feed resilience: transport retries + validated independent live-collector snapshots.
// All odds and generosity remain Superbet-origin. No synthetic values or prematch prices.
const no = x => x===null||x===undefined||x===''?NaN:Number(x);
export function usable(ev){
 const s=ev?.inplay_stats,m=ev?.inplay_stats_metadata;
 if(!s||m?.status!=='STARTED'||!Number.isInteger(no(s.minutes))||!Number.isInteger(no(s.home_team_score))||!Number.isInteger(no(s.away_team_score)))return false;
 const market=(ev.markets||[]).find(x=>Number(x.id)===547);
 const odds=Object.fromEntries((market?.odds||[]).filter(x=>['1','X','2'].includes(x.metadata?.name)).map(x=>[x.metadata.name,x]));
 const prices=[odds['1']?.price,odds.X?.price,odds['2']?.price].map(no);
 const generosity=[odds['1']?.metadata?.extra?.generosity_prob_home,odds['2']?.metadata?.extra?.generosity_prob_away].map(no);
 return prices.every(x=>Number.isFinite(x)&&x>1)&&generosity.every(x=>Number.isFinite(x)&&x>=0&&x<=1);
}
export async function repair(env,batch,input,metrics,endpoint){
 const ids=new Set(batch.map(x=>Number(x.event_id)));
 const frames=new Map((Array.isArray(input?.events)?input.events:[]).filter(x=>ids.has(Number(x.event_id))).map(x=>[Number(x.event_id),x]));
 let missing=batch.filter(x=>!usable(frames.get(Number(x.event_id))));
 metrics.primary_missing+=missing.length;
 if(!missing.length)return {events:[...frames.values()]};
 const urgency=f=>{const m=no(frames.get(Number(f.event_id))?.inplay_stats?.minutes);if(m>=53&&m<=59)return 0;const age=(Date.now()-Date.parse(f.kickoff_utc))/60000;return age>=45&&age<=95?1:2};
 missing.sort((a,b)=>urgency(a)-urgency(b));
 const singles=missing.slice(0,Math.max(0,Math.min(2,12-metrics.singleton_attempts)));
 metrics.singleton_attempts+=singles.length;
 await Promise.all(singles.map(async f=>{
  const id=Number(f.event_id),url=new URL(endpoint);
  url.searchParams.set('events',String(id));
  url.searchParams.set('includeOnly','fixture,inPlayStats,inPlayStatsMetadata,markets');
  url.searchParams.set('markets','547');
  try{
   const res=await fetch(url.toString(),{headers:{Accept:'application/json','Cache-Control':'no-cache'},cache:'no-store',signal:AbortSignal.timeout(4500)});
   if(!res.ok)return;
   const body=await res.json(),ev=(body.events||[]).find(x=>Number(x.event_id)===id);
   if(usable(ev)){frames.set(id,ev);metrics.singleton_recovered++}
  }catch(e){/* Do not manufacture a replacement for unavailable offers. */}
 }));
 missing=missing.filter(x=>!usable(frames.get(Number(x.event_id))));
 if(!missing.length)return {events:[...frames.values()]};
 // The collector is another *process*, not another upstream bookmaker.
 // Only use complete snapshots. Minute 57 expires after 12 seconds, other near-57 after 22.
 try{
  const list=missing.map(x=>Number(x.event_id));
  const sql='SELECT event_id,captured_utc,period,minute,home_score,away_score,p1,px,p2,generosity_home,generosity_away,stats_json FROM live_snapshots WHERE captured_utc>=? AND event_id IN ('+list.map(()=>'?').join(',')+') ORDER BY captured_utc DESC LIMIT 120';
  const captures=(await env.DB.prepare(sql).bind(new Date(Date.now()-48000).toISOString(),...list).all()).results||[];
  const seen=new Set();
  for(const q of captures){
   const id=Number(q.event_id);if(seen.has(id))continue;seen.add(id);
   let payload;try{payload=JSON.parse(q.stats_json||'{}')}catch{metrics.stale_rejected++;continue}
   const age=Date.now()-Date.parse(q.captured_utc),minute=no(q.minute),h=no(q.home_score),a=no(q.away_score);
   const ttl=minute===57?12000:minute>=53&&minute<=59?22000:45000;
   const prices=[q.p1,q.px,q.p2].map(no),g=[q.generosity_home,q.generosity_away].map(no);
   if(!Number.isFinite(age)||age<0||age>ttl||!Number.isInteger(minute)||minute<0||minute>78||!Number.isInteger(h)||!Number.isInteger(a)||payload.metadata?.status!=='STARTED'||(minute===57&&q.period!=='R2')||prices.some(x=>!Number.isFinite(x)||x<=1)||g.some(x=>!Number.isFinite(x)||x<0||x>1)){metrics.stale_rejected++;continue}
   const original=frames.get(id)?.inplay_stats;
   if(original&&original.minutes!==undefined&&(no(original.minutes)!==minute||no(original.home_team_score)!==h||no(original.away_team_score)!==a)){metrics.stale_rejected++;continue}
   const st=payload.stats||{};if(no(st.home_team_red_cards||0)>0||no(st.away_team_red_cards||0)>0){metrics.stale_rejected++;continue}
   const ev={event_id:id,inplay_stats:{...st,minutes:minute,home_team_score:h,away_team_score:a},inplay_stats_metadata:payload.metadata,markets:[{id:547,odds:[
    {price:prices[0],metadata:{name:'1',extra:{generosity_prob_home:g[0]}}},
    {price:prices[1],metadata:{name:'X'}},
    {price:prices[2],metadata:{name:'2',extra:{generosity_prob_away:g[1]}}}
   ]}],_feed_backup:'LIVE_COLLECTOR',_feed_captured_utc:q.captured_utc};
   if(usable(ev)){frames.set(id,ev);metrics.snapshot_recovered++}
  }
 }catch(e){console.warn('RADAR_FRESH_SNAPSHOT_FALLBACK',String(e).slice(0,160))}
 metrics.unresolved+=missing.filter(x=>!usable(frames.get(Number(x.event_id)))).length;
 return {events:[...frames.values()]};
}
