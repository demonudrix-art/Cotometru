// META AI CHALLENGERS v2 — pre-registered research experiment
// AVOID DATA SNOOPING: fixed 4 algorithms, fixed 5% EV, 1/X/2 away "2" choice.
// Two-week data Oct29-Nov11. Evaluated as expanding chronology, six-hour embargo.
// Winner must beat market Brier on same events, not just virtual ROI.
// Read-only: no DB writes, no alerts, no betting automation.
export const VERSION = 'META_AI_CHALLENGERS_V2_1_20261111';
const clamp=(x,a=.001,b=.999)=>Math.min(b,Math.max(a,x));
const logit=p=>Math.log(clamp(p)/(1-clamp(p)));
const sigmoid=x=>1/(1+Math.exp(-Math.min(24,Math.max(-24,x))));
const valid=x=>typeof x==='number'&&Number.isFinite(x);
const isEligible=x=>x.h===1&&x.a===1&&x.p2<x.p1&&x.p2>=1.85&&x.p2<=4;
function transform(x) {
 const a=[1/x.p1,1/x.px,1/x.p2],sm=a.reduce((s,v)=>s+v,0),q=a.map(v=>v/sm);
 const prior=x.pg_h!=null&&x.pg_a!=null&&x.pm!=null&&x.pg_h>=0&&x.pg_h<=1&&x.pg_a>=0&&x.pg_a<=1;
 const f=[+(x.h===1),x.gh,x.ga,x.ga-x.gh,prior?x.gh-x.pg_h:0,prior?x.ga-x.pg_a:0,+prior,Math.log(x.p2),q[1],q[0]];
 return {id:x.event_id,date:x.captured_utc,y:+(x.fa>x.fh),odd:x.p2,q:q[2],f,eligible:isEligible(x),score:x.h===1?'11':'00'};
}
function fitPlatt(train){
 let a=1,b=0;
 const arr=train.map(x=>({q:logit(x.q),y:x.y}));
 for(let ep=0;ep<600;ep++){
  let ga=0,gb=0;
  for(const row of arr){const e=sigmoid(a*row.q+b)-row.y;ga+=e*row.q;gb+=e}
  a-=.033*(ga/train.length+.035*(a-1));
  b-=.033*(gb/train.length+.035*b);
 }
 return x=>clamp(sigmoid(a*logit(x.q)+b));
}
function fitHistogram(train) {
 // Bayesian residual-rate lookup: score, home/away favoritism, market-probability quantile.
 const cells=new Map(),score=new Map();
 const key=x=>x.score+'|'+(x.q>=x.q1?'fav':'und')+'|'+Math.min(4,Math.floor(x.q*5));
 for(const x of train){
  for(const [map,k] of [[cells,key(x)],[score,x.score]]){
   const o=map.get(k)||{n:0,delta:0};
   o.n++;o.delta+=x.y-x.q;map.set(k,o);
  }
 }
 return x=>{
  const scoreBias=score.get(x.score)||{n:0,delta:0};
  const local=cells.get(key(x))||{n:0,delta:0};
  const coarse=scoreBias.delta/(scoreBias.n+150);
  const specific=local.delta/(local.n+80);
  return clamp(x.q+coarse*.5+specific*.5);
 };
}
function fitKnn(train){
 // Local residual model, not an outcome leakage: distances only on snapshot features.
 const m=train[0].f.map((_,j)=>train.reduce((s,x)=>s+x.f[j],0)/train.length);
 const sd=m.map((z,j)=>Math.max(.075,Math.sqrt(train.reduce((s,x)=>s+(x.f[j]-z)**2,0)/train.length)));
 const rows=train.map(x=>({z:x.f.map((v,j)=>(v-m[j])/sd[j]),res:x.y-x.q}));
 return x=>{
  const z=x.f.map((v,j)=>(v-m[j])/sd[j]);
  const d=rows.map(row=>{let s=0;for(let j=0;j<z.length;j++)s+=(z[j]-row.z[j])**2;return {d:s,res:row.res}});
  d.sort((a,b)=>a.d-b.d);
  let num=0,den=0;
  for(let i=0;i<Math.min(55,d.length);i++){const w=1/(.8+d[i].d);num+=w*d[i].res;den+=w}
  return clamp(x.q+num/(den+25));
 };
}
function fitBoosting(train) {
 // Squared-error residual gradient boosting with shallow regression stumps.
 const rows=train.map(x=>({f:x.f,y:x.y,q:x.q}));
 const trees=[];
 const predict=x=>{
  let p=x.q;for(const t of trees)p+=.13*(x.f[t.j]<=t.t?t.left:t.right);
  return clamp(p);
 };
 for(let epoch=0;epoch<40;epoch++){
  const residual=rows.map(row=>row.y-predict(row));
  let best=null,bestScore=0;
  for(let j=0;j<train[0].f.length;j++){
   const sorted=rows.map(row=>row.f[j]).sort((a,b)=>a-b);
   for(const quantile of [.15,.25,.4,.5,.6,.75,.85]){
    const t=sorted[Math.floor(quantile*(rows.length-1))];
    let nl=0,nr=0,sl=0,sr=0;
    for(let k=0;k<rows.length;k++)if(rows[k].f[j]<=t){nl++;sl+=residual[k]}else{nr++;sr+=residual[k]}
    if(nl<80||nr<80)continue;
    const vl=sl/(nl+90),vr=sr/(nr+90),gain=nl*vl*vl+nr*vr*vr;
    if(gain>bestScore){bestScore=gain;best={j,t,left:vl,right:vr}}
   }
  }
  if(!best)break;
  trees.push(best);
 }
 return predict;
}
const families={PLATT:fitPlatt,BAYES_BINS:fitHistogram,KNN_RESIDUAL:fitKnn,BOOSTED_STUMPS:fitBoosting};
function empty(){return {bets:0,wins:0,losses:0,profitUnits:0,roiPct:null}}
function add(a,x){a.bets++;a.wins+=x.y;a.losses+=1-x.y;a.profitUnits+=x.y?x.odd-1:-1}
function final(a){return {...a,profitUnits:+a.profitUnits.toFixed(3),roiPct:a.bets?+(100*a.profitUnits/a.bets).toFixed(2):null}}
export function researchChallengers(raw) {
 const data=raw.filter(x=>[x.h,x.a,x.p1,x.px,x.p2,x.gh,x.ga,x.fh,x.fa].every(valid)&&x.p1>1.01&&x.px>1.01&&x.p2>1.01)
 .map(transform).sort((a,b)=>a.date.localeCompare(b.date));
 const windows=[['2026-11-05T00:00:00Z','2026-11-07T00:00:00Z'],
 ['2026-11-07T00:00:00Z','2026-11-09T00:00:00Z'],
 ['2026-11-09T00:00:00Z','2026-11-11T00:00:00Z'],
 ['2026-11-11T00:00:00Z','2026-11-12T00:00:00Z']];
 const names=['MARKET',...Object.keys(families)];
 const overall=Object.fromEntries(names.map(n=>[n,{n:0,brierSum:0,logSum:0,eligible:empty(),probs:[]}]));
 const foldDetails=[],byScore={};
 for(const [start,end] of windows){
  const embargo=new Date(Date.parse(start)-6*3600000).toISOString();
  const train=data.filter(x=>x.date<embargo),test=data.filter(x=>x.date>=start&&x.date<end);
  if(train.length<150||!test.length)continue;
  const trained=Object.fromEntries(Object.entries(families).map(([name,fit])=>[name,fit(train)]));
  const foldResults={};
  for(const name of names)foldResults[name]={n:0,brierSum:0,eligible:empty()};
  for(const row of test){
   for(const name of names){
    const p=clamp(name==='MARKET'?row.q:trained[name](row));
    const b=(p-row.y)**2,log=-row.y*Math.log(p)-(1-row.y)*Math.log(1-p);
    const o=overall[name];o.n++;o.brierSum+=b;o.logSum+=log;
    foldResults[name].n++;foldResults[name].brierSum+=b;
    if(row.eligible){
     // Candidate rule fixed before test: 1-1, away favorite, odds 1.85–4.
     if(name==='MARKET'||p*row.odd-1>=.05){
      add(o.eligible,row);add(foldResults[name].eligible,row);
     }
    }
   }
  }
  foldDetails.push({from:start.slice(0,10),to:end.slice(0,10),
   trainN:train.length,testN:test.length,eligibleN:test.filter(x=>x.eligible).length,
   results:Object.fromEntries(names.map(n=>[n,{brier:+(foldResults[n].brierSum/foldResults[n].n).toFixed(6),bets:final(foldResults[n].eligible)}]))});
 }
 const rankings=Object.fromEntries(names.map(n=>{const o=overall[n];return [n,{n:o.n,brier:+(o.brierSum/o.n).toFixed(6),logloss:+(o.logSum/o.n).toFixed(6),bets:final(o.eligible)}]}));
 const marketBrier=rankings.MARKET.brier;
 const accepted=Object.entries(rankings).filter(([name,val])=>name!=='MARKET'&&val.brier<=marketBrier-.002)
   .map(([name])=>name);
 return {version:VERSION,dataN:data.length,testN:rankings.MARKET.n,modelFamilies:Object.keys(families),
  training:'expanding rolling chronology with 6h embargo',
  fixedThreshold:'EV>=5% on away 2, only 1-1@57 away favorite odds 1.85-4',
  foldDetails,rankings,brierBetterThanMarketBy2ppt:accepted,
  decision:accepted.length?'SHADOW_RESEARCH_ONLY':'ABSTAIN_ALL_MODELS',productionChanges:false,
  caveat:'Research uses the same historical span as prior experiments; later dates are NOT a pristine unseen test.'};
}
