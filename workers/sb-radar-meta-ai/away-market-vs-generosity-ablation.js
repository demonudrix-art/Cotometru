// META AI: generosity incremental-value ablation, 2026-11-11.
// Train <=2026-11-04; compare to 05-07 and 08-10; same matches and quotes.
// Binary outcome final away victory (2). Never train on future match results.
// Separate market no-vig baseline, price/context calibration, and extra generosity.
// Do NOT infer true edge from retrospective virtual ROI.
export const VERSION='META_AWAY_MARKET_VS_GENEROSITY_OOT_V1';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const clamp=(x,a=.0001,b=.9999)=>Math.max(a,Math.min(b,x));
const sigmoid=x=>1/(1+Math.exp(-Math.max(-25,Math.min(25,x))));
const logit=x=>Math.log(clamp(x)/(1-clamp(x)));
function prep(x){
 const inv=[1/x.p1,1/x.px,1/x.p2],overround=inv.reduce((s,x)=>s+x,0);
 const q=inv.map(v=>v/overround);
 const same=x.pm>=30&&x.pm<=56&&x.ph===x.h&&x.pa===x.a;
 const goodPrior=same&&finite(x.pgh)&&finite(x.pga)&&x.pgh>=0&&x.pgh<=1&&x.pga>=0&&x.pga<=1;
 const shiftH=goodPrior?x.gh-x.pgh:0,shiftA=goodPrior?x.ga-x.pga:0;
 const price=[logit(q[2]),q[0],q[1],x.h-x.a,x.h+x.a,Math.log(overround)];
 const gen=[...price,x.gh,x.ga,x.ga-q[2],x.gh-q[0],shiftH,shiftA,Number(goodPrior)];
 return {id:x.event_id,date:x.captured_utc,y:+(x.fa>x.fh),q:q[2],odds:x.p2,h:x.h,a:x.a,price,gen,
   eligible:x.h===1&&x.a===1&&x.p2<x.p1&&x.p2>=1.85&&x.p2<=4};
}
function logistic(train,key,lambda=.10){
 const k=train[0][key].length,N=train.length;
 const mean=Array.from({length:k},(_,j)=>train.reduce((s,x)=>s+x[key][j],0)/N);
 const sd=mean.map((m,j)=>Math.max(.08,Math.sqrt(train.reduce((s,x)=>s+(x[key][j]-m)**2,0)/N)));
 const matrix=train.map(x=>({z:x[key].map((f,j)=>(f-mean[j])/sd[j]),y:x.y}));
 let b=logit(train.reduce((s,x)=>s+x.y,0)/N),w=Array(k).fill(0);
 for(let ep=0;ep<300;ep++){
  let g=0,gw=Array(k).fill(0);
  for(const x of matrix){const err=sigmoid(b+w.reduce((s,v,j)=>s+v*x.z[j],0))-x.y;g+=err;for(let j=0;j<k;j++)gw[j]+=err*x.z[j];}
  b-=.09*g/N;
  for(let j=0;j<k;j++)w[j]-=.09*(gw[j]/N+lambda*w[j]);
 }
 return x=>clamp(sigmoid(b+w.reduce((s,v,j)=>s+v*(x[key][j]-mean[j])/sd[j],0)));
}
function scored(rows,predict){
 let brier=0,logloss=0,cor=0,numberBets=0,wins=0,profit=0,avePred=0,meanY=0,eligible=0;
 for(const x of rows){
  const p=predict(x);brier+=(p-x.y)**2;logloss-=x.y*Math.log(p)+(1-x.y)*Math.log(1-p);
  cor+=+(p>=.5?x.y:1-x.y);meanY+=x.y;avePred+=p;eligible+=+x.eligible;
  if(x.eligible&&p*x.odds-1>=.05){numberBets++;wins+=x.y;profit+=x.y?x.odds-1:-1;}
 }
 const n=rows.length;if(!n)return {n};
 return {n,awayRatePct:+(100*meanY/n).toFixed(1),averageP:+(100*avePred/n).toFixed(1),
  brier:+(brier/n).toFixed(6),logloss:+(logloss/n).toFixed(6),
  correctPct:+(100*cor/n).toFixed(1),eligible,
  away57picks:{bets:numberBets,wins,losses:numberBets-wins,profitUnits:+profit.toFixed(2),ROI:numberBets?+(profit/numberBets*100).toFixed(2):null}};
}
export function testGenerosityAblation(raw){
 const rows=raw.filter(x=>[x.h,x.a,x.p1,x.px,x.p2,x.gh,x.ga,x.fh,x.fa].every(finite)&&
  x.p1>1.01&&x.px>1.01&&x.p2>1.01&&x.gh>=0&&x.gh<=1&&x.ga>=0&&x.ga<=1).map(prep).sort((a,b)=>a.date.localeCompare(b.date));
 const train=rows.filter(x=>x.date<'2026-11-05'),
 dev=rows.filter(x=>x.date>='2026-11-05'&&x.date<'2026-11-08'),
 later=rows.filter(x=>x.date>='2026-11-08'&&x.date<'2026-11-11');
 if(train.length<100||later.length<100)throw Error('NO_SUFFICIENT_DATA');
 const market=x=>x.q,price=logistic(train,'price'),gen=logistic(train,'gen');
 const summaries={};for(const [name,part] of [['development',dev],['later',later]]){
  summaries[name]={market:scored(part,market),price:scored(part,price),priceGen:scored(part,gen)};
 }
 return {version:VERSION,rows:rows.length,trainN:train.length,devN:dev.length,laterN:later.length,
  summaries,rule:'Away 2 priced 1.85-4 with 1-1@57 and odds EV>=5%',
  production:false,limitations:'Retrospective with reused calendar dates; win ROI at historical captures, not executable quotes.'};
}
