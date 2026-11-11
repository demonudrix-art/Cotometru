// SB Radar META AI: no-goal survival, research-only, 2026-11-11.
// Predict P(final 0-0 | 0-0 at first archive 57-min snapshot).
// Same chronological split; compare constant, price-only, and price+Generosity-dynamics.
// No 0-0 correct-score betting odds: no ROI is claimed.
export const VERSION='GOALLESS57_OUT_OF_TIME_V1';
const clamp=(x,a=.001,b=.999)=>Math.max(a,Math.min(b,x));
const sigmoid=x=>1/(1+Math.exp(-Math.max(-25,Math.min(25,x))));
const finite=x=>typeof x==='number'&&Number.isFinite(x);
function make(x){
 const margin=(1/x.p1+1/x.px+1/x.p2),n1=(1/x.p1)/margin,nx=(1/x.px)/margin,n2=(1/x.p2)/margin;
 const prior=finite(x.pgh)&&finite(x.pga)&&x.pgh>=0&&x.pgh<=1&&x.pga>=0&&x.pga<=1&&x.pm>=30&&x.pm<=56&&x.ph===0&&x.pa===0;
 const deltaH=prior?x.gh-x.pgh:0,deltaA=prior?x.ga-x.pga:0;
 const price=[nx,n1,n2,Math.log(x.px),Math.log(margin)];
 const dynamics=[...price,x.gh,x.ga,x.gh-x.ga,deltaH,deltaA,Math.abs(deltaH)+Math.abs(deltaA),Number(prior)];
 return {date:x.captured_utc,y:+(x.fh===0&&x.fa===0),id:x.event_id,p:price,d:dynamics,fixture:x.fixture};
}
function logistic(train,features){
 const k=train[0][features].length,N=train.length;
 const means=Array.from({length:k},(_,j)=>train.reduce((s,x)=>s+x[features][j],0)/N);
 const scales=means.map((m,j)=>Math.max(.07,Math.sqrt(train.reduce((s,x)=>s+(x[features][j]-m)**2,0)/N)));
 const x=train.map(row=>({z:row[features].map((v,j)=>(v-means[j])/scales[j]),y:row.y}));
 let b=Math.log(clamp(train.reduce((s,x)=>s+x.y,0)/N)/(1-clamp(train.reduce((s,x)=>s+x.y,0)/N)));
 const w=Array(k).fill(0),lr=.11,reg=.12;
 for(let it=0;it<300;it++){
  let gb=0;const gw=Array(k).fill(0);
  for(const row of x){
   const q=sigmoid(b+row.z.reduce((s,z,j)=>s+z*w[j],0)),e=q-row.y;gb+=e;
   for(let j=0;j<k;j++)gw[j]+=e*row.z[j];
  }
  b-=lr*gb/N;
  for(let j=0;j<k;j++)w[j]-=lr*(gw[j]/N+reg*w[j]);
 }
 return row=>clamp(sigmoid(b+row[features].reduce((s,v,j)=>s+(v-means[j])/scales[j]*w[j],0)));
}
function evaluate(rows,fn){
 const n=rows.length;if(!n)return {n};
 let brier=0,loss=0,correct=0,observed=0,predMean=0;
 const data=rows.map(r=>({p:fn(r),y:r.y})).sort((a,b)=>b.p-a.p);
 for(const r of data){brier+=(r.p-r.y)**2;loss-=r.y*Math.log(r.p)+(1-r.y)*Math.log(1-r.p);
 correct+=+(r.p>=.5?!!r.y:!r.y);observed+=r.y;predMean+=r.p;}
 const top=Math.max(1,Math.floor(n*.2));const high=data.slice(0,top),low=data.slice(-top);
 return {n,actualRatePct:+(100*observed/n).toFixed(1),predictedRatePct:+(100*predMean/n).toFixed(1),
  brier:+(brier/n).toFixed(6),logloss:+(loss/n).toFixed(6),accuracyPct:+(100*correct/n).toFixed(2),
  top20ObservedPct:+(100*high.reduce((s,x)=>s+x.y,0)/top).toFixed(1),
  bottom20ObservedPct:+(100*low.reduce((s,x)=>s+x.y,0)/top).toFixed(1),
  top20N:top};
}
export function testGoalless57(raw){
 const rows=raw.filter(x=>x.h===0&&x.a===0&&x.fh>=0&&x.fa>=0&&[x.p1,x.px,x.p2,x.gh,x.ga].every(finite)&&x.p1>1.01&&x.px>1.01&&x.p2>1.01&&x.gh>=0&&x.gh<=1&&x.ga>=0&&x.ga<=1).map(make).sort((a,b)=>a.date.localeCompare(b.date));
 const train=rows.filter(x=>x.date<'2026-11-05'),development=rows.filter(x=>x.date>='2026-11-05'&&x.date<'2026-11-08'),holdout=rows.filter(x=>x.date>='2026-11-08'&&x.date<'2026-11-11');
 const pBase=clamp(train.reduce((s,x)=>s+x.y,0)/train.length);
 const price=logistic(train,'p'),dynamics=logistic(train,'d');
 // Train only through Nov 04; Nov 05-07 validation and Nov 08-10 later observation.
 const tests={development:{constant:evaluate(development,()=>pBase),price:evaluate(development,price),dynamic:evaluate(development,dynamics)},
  later:{constant:evaluate(holdout,()=>pBase),price:evaluate(holdout,price),dynamic:evaluate(holdout,dynamics)}};
 return {version:VERSION,rows:rows.length,trainN:train.length,devN:development.length,laterN:holdout.length,
  trainRatePct:+(100*pBase).toFixed(1),tests,
  selection:'0-0 first archived minute 57 and actual full time 0-0',liveAlerts:false,goallessMarketOddsAvailable:false,
  riskModelCandidate:tests.later.dynamic.brier<tests.later.price.brier,
  note:'Brier here is binary P(0-0 final), NOT 1/X/2 Brier; no corresponding bet price or demonstrated ROI.'};
}
