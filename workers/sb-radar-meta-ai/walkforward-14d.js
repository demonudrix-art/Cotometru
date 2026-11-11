// META AI RESEARCH — experimental retrospective walk-forward, 2026-11-11.
// Fit only on earlier matches; use 6h embargo after minute-57 snapshot.
// Models: bookmaker no-vig, L2 logistic residual correction, bagged shallow forest.
// NO betting, NO notifications, NO production model changes.
export const META_BACKTEST_VERSION='META_BACKTEST_OOS_V1';
const CANDIDATE = x=>x.h===1&&x.a===1&&x.p2<x.p1&&x.p2>=1.85&&x.p2<=4;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const sigmoid=x=>1/(1+Math.exp(-Math.max(-25,Math.min(25,x))));
const logit=p=>Math.log(Math.max(1e-6,Math.min(.999999,p))/(1-Math.max(1e-6,Math.min(.999999,p))));
const clamp=x=>Math.min(.999,Math.max(.001,x));
function transform(x){
 const m=[1/x.p1,1/x.px,1/x.p2],z=m[0]+m[1]+m[2],q=m.map(v=>v/z);
 const valid=x.pg_h!=null&&x.pg_a!=null&&x.pm!=null&&x.pg_h>=0&&x.pg_h<=1&&x.pg_a>=0&&x.pg_a<=1;
 const f=[Number(x.h===1),x.gh,x.ga,x.ga-x.gh,valid?x.gh-x.pg_h:0,valid?x.ga-x.pg_a:0,
    Number(valid),Math.log(x.p2),q[1],q[0]];
 return {id:x.event_id,date:x.captured_utc,score:x.h===1?'1-1':'0-0',
  y:Number(x.fa>x.fh),q:q[2],q1:q[0],qX:q[1],odd:x.p2,features:f,eligible:CANDIDATE(x)};
}
function norm(train){
 const k=train[0].features.length;
 const mean=Array.from({length:k},(_,j)=>train.reduce((s,x)=>s+x.features[j],0)/train.length);
 const sd=mean.map((m,j)=>Math.max(.08,Math.sqrt(train.reduce((s,x)=>s+(x.features[j]-m)**2,0)/train.length)));
 return {mean,sd,vec:x=>x.features.map((v,j)=>(v-mean[j])/sd[j])};
}
function fitLogistic(train,policy){
 const stats=norm(train),N=train.length,k=stats.mean.length,lambda=.038,lr=.09;
 const w=Array(k).fill(0);let bias=0;
 const x=train.map(v=>({y:v.y,offset:logit(v.q),z:stats.vec(v)}));
 for(let epoch=0;epoch<240;epoch++){
  let bgrad=0;const grad=Array(k).fill(0);
  for(const row of x){
   let z=bias+row.offset;for(let j=0;j<k;j++)z+=w[j]*row.z[j];
   const err=sigmoid(z)-row.y;bgrad+=err;
   for(let j=0;j<k;j++)grad[j]+=err*row.z[j];
  }
  const factor=lr*(1-.50*epoch/240);
  bias-=factor*bgrad/N;
  for(let j=0;j<k;j++)w[j]-=factor*(grad[j]/N+lambda*w[j]);
 }
 return x=>clamp(sigmoid(logit(x.q)+bias+stats.vec(x).reduce((s,f,j)=>s+f*w[j],0)));
}
function forest(train,seed=47){
 let state=seed>>>0;
 const random=()=>{state=(1664525*state+1013904223)>>>0;return state/4294967296};
 const k=train[0].features.length,trees=[];
 const meanY=a=>a.reduce((s,x)=>s+x.y,0)/a.length;
 const split=(rows,depth)=>{
  const n=rows.length,p=(rows.reduce((s,x)=>s+x.y,0)+25*rows.reduce((s,x)=>s+x.q,0)/n)/(n+25);
  if(depth>=3||n<40)return {p};
  const pos=meanY(rows),imp=pos*(1-pos);
  let best=null,bestGain=0;
  for(let iter=0;iter<6;iter++){
   const j=Math.floor(random()*k);
   const sorted=rows.map(r=>r.features[j]).sort((a,b)=>a-b);
   for(const quantile of [.2,.35,.5,.65,.8]){
    const threshold=sorted[Math.min(n-1,Math.floor((n-1)*quantile))];
    let nl=0,wl=0,nr=0,wr=0;
    for(const row of rows)if(row.features[j]<=threshold){nl++;wl+=row.y}else{nr++;wr+=row.y}
    if(Math.min(nl,nr)<20)continue;
    const g=imp-(nl/n)*(wl/nl)*(1-wl/nl)-(nr/n)*(wr/nr)*(1-wr/nr);
    if(g>bestGain+1e-7){bestGain=g;best={j,threshold}}
   }
  }
  if(!best)return {p};
  return {p,j:best.j,t:best.threshold,
   left:split(rows.filter(x=>x.features[best.j]<=best.threshold),depth+1),
   right:split(rows.filter(x=>x.features[best.j]>best.threshold),depth+1)};
 };
 for(let t=0;t<28;t++){
  const sample=Array.from({length:train.length},()=>train[Math.floor(random()*train.length)]);
  trees.push(split(sample,0));
 }
 return x=>{
  const rates=trees.map(t=>{let node=t;while(node.j!==undefined)node=x.features[node.j]<=node.t?node.left:node.right;return node.p});
  return clamp(.5*x.q+.5*rates.reduce((s,x)=>s+x,0)/rates.length);
 };
}
function classify(rows,fn){
 let sumSq=0,sumLog=0,seen=0;
 const results=[];
 for(const x of rows){
  const p=clamp(fn(x)),ev=p*x.odd-1;
  sumSq+=(p-x.y)**2;
  sumLog+=-x.y*Math.log(p)-(1-x.y)*Math.log(1-p);
  seen++;
  results.push({p,ev});
 }
 return {brier:sumSq/seen,logloss:sumLog/seen,preds:results};
}
function stats(){
 return {bets:0,wins:0,losses:0,stake_units:0,profit_units:0,mean_odds:0,roi_pct:null};
}
function countBet(acc,x){
 acc.bets++;acc.wins+=x.y;acc.losses+=1-x.y;
 acc.profit_units+=(x.y?x.odd-1:-1);acc.stake_units++;
 acc.mean_odds+=x.odd;
}
function finalize(x){
 x.roi_pct=x.bets?+(100*x.profit_units/x.stake_units).toFixed(2):null;
 x.mean_odds=x.bets?+(x.mean_odds/x.bets).toFixed(3):null;
 x.profit_units=+x.profit_units.toFixed(3);return x;
}
export function trainAndEvaluateMetaBacktest(raw){
 const data=raw.filter(x=>Number.isFinite(x.h)&&Number.isFinite(x.a)&&
   [x.p1,x.px,x.p2,x.gh,x.ga,x.fh,x.fa].every(finite))
   .map(transform).sort((a,b)=>a.date.localeCompare(b.date));
 const boundaries=['2026-11-05T00:00:00Z','2026-11-07T00:00:00Z','2026-11-09T00:00:00Z','2026-11-11T00:00:00Z','2026-11-12T00:00:00Z'];
 const accum={market:[],logistic:[],forest:[],ensemble:[]},picks={rule:stats(),logistic:stats(),forest:stats(),consensus:stats()};
 const foldResults=[],coverage={trainMin:null,test:0,trainUnique:0,testUnique:0,score_11:0,score_00:0,eligible:0};
 for(let i=0;i<boundaries.length-1;i++){
  const start=boundaries[i],end=boundaries[i+1];
  const embargo=new Date(Date.parse(start)-6*3600000).toISOString();
  const train=data.filter(x=>x.date<embargo),test=data.filter(x=>x.date>=start&&x.date<end);
  if(train.length<200||test.length<1)continue;
  const predictL=fitLogistic(train),predictF=forest(train,73+i*101);
  const marketPred=classify(test,x=>x.q),logistic=classify(test,predictL),trees=classify(test,predictF);
  const ensemble=classify(test,(x)=>.5*predictL(x)+.5*predictF(x));
  const entries={market:marketPred,logistic,forest:trees,ensemble};
  for(const [key,val] of Object.entries(entries)){
   for(let j=0;j<test.length;j++)accum[key].push({y:test[j].y,...val.preds[j]});
  }
  const foldPicks={rule:stats(),logistic:stats(),forest:stats(),consensus:stats()};
  for(let j=0;j<test.length;j++){
   const x=test[j];if(!x.eligible)continue;
   countBet(picks.rule,x);countBet(foldPicks.rule,x);
   if(logistic.preds[j].ev>=.05){countBet(picks.logistic,x);countBet(foldPicks.logistic,x)}
   if(trees.preds[j].ev>=.05){countBet(picks.forest,x);countBet(foldPicks.forest,x)}
   if(logistic.preds[j].ev>=.05&&trees.preds[j].ev>=.05){countBet(picks.consensus,x);countBet(foldPicks.consensus,x)}
  }
  foldResults.push({fold:i+1,train_from:train[0].date.slice(0,10),train_through_utc:embargo,
   test_from:start.slice(0,10),test_until:end.slice(0,10),train_n:train.length,test_n:test.length,
   eligible:test.filter(x=>x.eligible).length,
   brier:{market:+marketPred.brier.toFixed(5),logistic:+logistic.brier.toFixed(5),forest:+trees.brier.toFixed(5),ensemble:+ensemble.brier.toFixed(5)},
   stakes:Object.fromEntries(Object.entries(foldPicks).map(([key,value])=>[key,finalize(value)]))});
  coverage.trainUnique=Math.max(coverage.trainUnique,train.length);coverage.test+=test.length;
  coverage.score_11+=test.filter(x=>x.score==='1-1').length;
  coverage.score_00+=test.filter(x=>x.score==='0-0').length;
  coverage.eligible+=test.filter(x=>x.eligible).length;
 }
 const evaluation=Object.fromEntries(Object.entries(accum).map(([name,items])=>{
  const n=items.length,brier=items.reduce((s,x)=>s+(x.p-x.y)**2,0)/n;
  const logloss=items.reduce((s,x)=>s-(x.y*Math.log(clamp(x.p))+(1-x.y)*Math.log(1-clamp(x.p))),0)/n;
  return [name,{n,brier:+brier.toFixed(6),logloss:+logloss.toFixed(6)}];
 }));
 return {model_version:META_BACKTEST_VERSION,scope:'first-minute-57 snapshots, 0-0 and 1-1, final verified only',
  data_total:data.length,coverage,algorithms_trained:['L2_LOGISTIC_MARKET_OFFSET','BAGGED_CART_28_TREES_DEPTH_3'],
  test_period:'2026-11-05 to 2026-11-11',validation:'4 expanding forward folds, 6-hour embargo',
  evaluation,betting:Object.fromEntries(Object.entries(picks).map(([name,entry])=>[name,finalize(entry)])),
  foldResults,disclaimers:['research only, no transaction costs, virtual odds are capture-time quotes','selection thresholds fixed at 5% expected edge on 1-1 away favorite with 1.85-4 odds','this is retrospective out-of-sample simulation, not live prospective evidence']};
}
