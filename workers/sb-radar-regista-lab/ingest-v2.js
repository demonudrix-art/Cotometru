/* Regista live public-pick parser, no private API or betting actions. */
const URL='https://www.registacalcio.it/en/schedina';
const MON={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
function plain(v){return String(v||'').replace(/<!--[\s\S]*?-->/g,'').replace(/<[^>]+>/g,' ').replace(/&#(?:x27|39);/gi,"'").replace(/&amp;/gi,'&').replace(/&nbsp;/gi,' ').replace(/\s+/g,' ').trim();}
function localUtc(s){
 const m=String(s||'').match(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4}),\s*(\d{1,2}):(\d{2})/);
 if(!m)return null;
 const wall=Date.UTC(+m[3],MON[m[2]],+m[1],+m[4],+m[5]);
 const label=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',timeZoneName:'shortOffset'}).formatToParts(new Date(wall)).find(x=>x.type==='timeZoneName')?.value||'GMT+1';
 const o=label.match(/GMT([+-])(\d+)(?::(\d+))?/),mins=o?(o[1]==='-'?-1:1)*((+o[2])*60+(+o[3]||0)):60;
 return new Date(wall-mins*60000).toISOString();
}
function norm(s){
 let a=plain(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const m={'paris':'paris fc','paris fc':'paris fc','paris saint germain':'psg','psg':'psg',
 'angers sco':'angers','fc augsburg':'augsburg','fsv mainz 05':'mainz','mainz 05':'mainz',
 'fc barcelona':'barcelona','fc bayern munchen':'bayern munchen','bayern munchen':'bayern munchen',
 'fc koln':'koln','koln':'koln','torino fc':'torino','roma':'as roma','as roma':'as roma',
 'inter':'inter milan','internazionale':'inter milan','inter milan':'inter milan','ac milan':'ac milan',
 'paris sg':'psg','monchengladbach':'borussia monchengladbach','dortmund':'borussia dortmund','leipzig':'rb leipzig',
 'leverkusen':'bayer leverkusen','freiburg':'freiburg','sc freiburg':'freiburg','vfb stuttgart':'stuttgart',
 'fc paderborn':'paderborn','tottenham hotspur':'tottenham','angers':'angers','olympique lyonnais':'olympique lyon',
 'as monaco':'monaco','villarreal cf':'villarreal','atletico de madrid':'atletico madrid','atletico madrid':'atletico madrid'};
 return m[a]||a.replace(/^(?:fc|ssc|cf|afc) /,'').replace(/ (?:fc|cf)$/,'');
}
function market(x){
 const p=plain(x).toLowerCase();if(['1','x','2'].includes(p))return p.toUpperCase();
 if(p==='btts'||p==='both teams to score')return 'BTTS';
 if(p==='no btts'||p==='no goal')return 'NO_BTTS';
 if(/^over 2[.,]5/.test(p))return 'OVER25';if(/^under 2[.,]5/.test(p))return 'UNDER25';return null;
}
function picksFromHtml(html){
 const parts=[['FULL','schedina-full','schedina-league'],['LEAGUE','schedina-league','schedina-top10'],['TOP10','schedina-top10',null]],out=[];
 for(const [list,key,next] of parts){
  const i=html.indexOf('id="'+key+'"'),j=next?html.indexOf('id="'+next+'"',i+5):-1;
  if(i<0)continue;
  const segment=html.slice(i,j>i?j:undefined);
  const ol=segment.match(/<ol class="slip">([\s\S]*?)<\/ol>/i)?.[1];if(!ol)continue;
  for(const r of ol.split(/<li class="slip__row">/i).slice(1)){
   const a=r.match(/href="(\/en\/partite\/(\d+))"[^>]*>([\s\S]*?)<\/a>/i),
    pick=r.match(/<div class="slip__pick">\s*<strong>([\s\S]*?)<\/strong>/i),
    prob=r.match(/<div class="slip__pick">[\s\S]*?probability\s*(\d{1,3})%/i),
    meta=r.match(/<div class="slip__meta">([\s\S]*?)<\/div>/i),
    upd=r.match(/<div class="slip__meta slip__upd">([\s\S]*?)<\/div>/i);
   if(!a||!pick||!prob||!meta)continue;
   const teams=plain(a[3]).split(/\s+[–—]\s+/),kind=market(pick[1]),kickoff=localUtc(plain(meta[1])),pct=+prob[1];
   if(teams.length!==2||!kind||!kickoff||pct<1||pct>100)continue;
   out.push({list,match_id:a[2],url:'https://www.registacalcio.it'+a[1],teams,
   fixture:teams.join(' – '),market:kind,pct,kickoff,source_updated:upd?localUtc(plain(upd[1])):null});
  }
 }
 return [...new Map(out.map(x=>[x.list+':'+x.match_id+':'+x.market,x])).values()];
}
async function findEvent(env,p){
 const t=Date.parse(p.kickoff),lo=new Date(t-20*60000).toISOString(),hi=new Date(t+20*60000).toISOString();
 const q=await env.DB.prepare('SELECT event_id,fixture,kickoff_utc FROM event_catalog WHERE kickoff_utc>=? AND kickoff_utc<=? LIMIT 140').bind(lo,hi).all();
 const hits=(q.results||[]).filter(x=>{
  const f=String(x.fixture||'').split(/[·•]/);
  return f.length===2&&norm(f[0])===norm(p.teams[0])&&norm(f[1])===norm(p.teams[1])&&Math.abs(Date.parse(x.kickoff_utc)-t)<=20*60000;
 });return hits.length===1?hits[0]:null;
}
const UPSERT=[
 'INSERT INTO sb_regista_signals_v1 (signal_id,list_code,source_url,source_match_id,fixture,market,probability_pct,source_first_seen_utc,source_last_seen_utc,source_published_utc,kickoff_utc,event_id,match_confidence,quote_captured_utc,odds_at_signal,signal_utc,status,updated_utc)',
 'VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
 'ON CONFLICT(signal_id) DO UPDATE SET source_last_seen_utc=excluded.source_last_seen_utc,probability_pct=excluded.probability_pct,',
 'source_published_utc=excluded.source_published_utc,kickoff_utc=excluded.kickoff_utc,event_id=COALESCE(excluded.event_id,sb_regista_signals_v1.event_id),',
 'match_confidence=COALESCE(excluded.match_confidence,sb_regista_signals_v1.match_confidence),',
 "quote_captured_utc=COALESCE(excluded.quote_captured_utc,sb_regista_signals_v1.quote_captured_utc),",
 "odds_at_signal=COALESCE(excluded.odds_at_signal,sb_regista_signals_v1.odds_at_signal),",
 "signal_utc=CASE WHEN excluded.status='BET_NOW' AND sb_regista_signals_v1.signal_utc IS NULL THEN excluded.signal_utc ELSE sb_regista_signals_v1.signal_utc END,",
 'status=excluded.status,updated_utc=excluded.updated_utc'
].join(' ');
export async function syncRegistaV2(env){
 let code=0,count=0,error=null;const now=new Date().toISOString(),nowMs=Date.parse(now);
 try{
  const response=await fetch(URL,{headers:{Accept:'text/html','User-Agent':'SB-Radar-Regista-Lab/2.0'},signal:AbortSignal.timeout(12000)});
  code=response.status;if(!response.ok)throw Error('SOURCE_HTTP_'+code);
  const html=await response.text();if(html.length<4000)throw Error('SOURCE_TOO_SHORT');
  const picks=picksFromHtml(html);if(picks.length<3||picks.length>100)throw Error('PARSER_INVALID_COUNT_'+picks.length);
  for(const p of picks){
   const e=await findEvent(env,p),eventId=e?Number(e.event_id):null;
   const kick=Date.parse(p.kickoff),sourceOk=!!p.source_updated&&Date.parse(p.source_updated)<=kick-300000;
   let quote=null,odds=NaN;
   if(e&&['1','X','2'].includes(p.market)){
    quote=await env.DB.prepare('SELECT captured_utc,p1,px,p2 FROM quote_snapshots WHERE event_id=? AND captured_utc<=? AND captured_utc<? ORDER BY captured_utc DESC LIMIT 1').bind(eventId,now,p.kickoff).first();
    if(quote)odds=Number(p.market==='1'?quote.p1:p.market==='X'?quote.px:quote.p2);
   }
   const quoteOk=quote&&Number.isFinite(odds)&&odds>1&&nowMs-Date.parse(quote.captured_utc)<=20*60000;
   let status=nowMs>=kick?'HISTORICAL_IMPORT':!e?'UNMATCHED':!sourceOk?'SOURCE_TIME_UNVERIFIED':'MATCHED';
   const pModel=p.pct/100,breakEven=quoteOk?1/odds:NaN,edgePP=100*(pModel-breakEven),evPct=100*(pModel*odds-1);
   // Experimental VALUE gate. The Regista estimate is not calibrated to actual Superbet returns.
   // 1X2 only: X has no verified Regista sample, while O/U and BTTS have no market-specific odds here.
   const valueCandidate=['1','2'].includes(p.market)&&quoteOk&&edgePP>=5-1e-8&&evPct>=8-1e-8;
   if(e&&sourceOk&&nowMs<=kick-300000&&kick-nowMs<=45*60000&&valueCandidate)status='BET_NOW';
   const signalId='regista:'+p.list+':'+p.match_id+':'+p.market;
   await env.DB.prepare(UPSERT).bind(signalId,p.list,p.url,p.match_id,p.fixture,p.market,p.pct,now,now,p.source_updated,p.kickoff,eventId,e?1:null,quoteOk&&sourceOk?quote.captured_utc:null,quoteOk&&sourceOk?odds:null,status==='BET_NOW'?now:null,status,now).run();
   count++;
  }
 }catch(e){error=String(e).slice(0,300);console.error('REGISTA_PARSE',error);}
 await env.DB.prepare('INSERT INTO sb_regista_sync_runs_v1(started_utc,source_status,stored_rows,error) VALUES(?,?,?,?)').bind(now,code,count,error).run();
 return {status:code,count,error};
}
