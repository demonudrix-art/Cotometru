// META AI: test if 47'->57' SCORE TRANSITION adds independent predictive info to AWAY57.
export const VERSION='AWAY57_TRANSITION_EXPERT_OOT_V1';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const clamp=(x,a=.0001,b=.9999)=>Math.max(a,Math.min(b,x));
const sigmoid=x=>1/(1+Math.exp(-Math.max(-25,Math.min(25,x))));
const logit=x=>Math.log(clamp(x)/(1-clamp(x)));
function features(x){
 const inv=[1/x.p1,1/x.px,1/x.p2],sm=inv.reduce((s,v)=>s+v,0),q=inv.map(v=>v/sm);
 const prior=x.pm>=30&&x.pm<=56&&x.ph!==null&&x.pa!==null;
 const stable=prior&&x.ph===1&&x.pa===1;
 const awayEq=prior&&x.ph===1&&x.pa===0;
 const homeEq=prior&&x.ph===0&&x.pa===1;
 const twoGoal=prior&&x.ph===0&&x.pa===0;
 const same=stable&&finite(x.pgh)&&finite(x.pga)&&x.pgh>=0&&x.pgh<=1&&x.pga>=0&&x.pga<=1;
 const base=[logit(q[2]),q[0],q[1],x.ga,x.gh,Number(same),same?x.ga-x.pga:0,same?x.gh-x.pgh:0];
 const transition=[...base,+stable,+awayEq,+homeEq,+twoGoal,+(!prior)];
 return {id:x.event_id,date:x.captured_utc,y:+(x.fa>x.fh),q:q[2],odd:x.p2,
  fav:x.p2<x.p1&&x.p2>=1.85&&x.p2<=4,base,transition};
}
function fit(train,key,l=.12){
 const n=train.length,k=train[0][key].length;
 const means=Array.from({length:k},(_,j)=>train.reduce((s,x)=>s+x[key][j],0)/n),
 sd=means.map((m,j)=>Math.max(.08,Math.sqrt(train.reduce((s,x)=>s+(x[key][j]-m)**2,0)/n)));
 let b=logit(train.reduce((s,x)=>s+x.y,0)/n),w=Array(k).fill(0);
 const obs=train.map(x=>({z:x[key].map((v,j)=>(v-means[j])/sd[j]),y:x.y}));
 for(let epoch=0;epoch<400;epoch++){
  let gb=0;const gw=Array(k).fill(0);
  for(const row of obs){const err=sigmoid(b+row.z.reduce((s,v,j)=>s+v*w[j],0))-row.y;gb+=err;for(let j=0;j<k;j++)gw[j]+=err*row.z[j];}
  b-=.06*gb/n;
  for(let j=0;j<k;j++)w[j]-=.06*(gw[j]/n+l*w[j]);
 }
 return row=>clamp(sigmoid(b+row[key].reduce((s,v,j)=>s+(v-means[j])/sd[j]*w[j],0)));
}
function score(rows,predict){
 const n=rows.length;if(!n)return {n:0};let brier=0,logloss=0,pnl=0,win=0,bets=0,eligible=0;
 for(const r of rows){const p=predict(r);brier+=(p-r.y)**2;logloss-=r.y*Math.log(p)+(1-r.y)*Math.log(1-p);
 if(r.fav){eligible++;if(p*r.odd-1>=.05){bets++;win+=r.y;pnl+=r.y?r.odd-1:-1}}}
 return {n,brier:+(brier/n).toFixed(6),logloss:+(logloss/n).toFixed(6),eligible,
  bets,wins:win,losses:bets-win,roiPct:bets?+(100*pnl/bets).toFixed(2):null};
}
export function testTransition(raw){
 const rows=raw.filter(x=>x.h===1&&x.a===1&&[x.p1,x.px,x.p2,x.gh,x.ga,x.fh,x.fa].every(finite)&&x.p1>1.01&&x.px>1.01&&x.p2>1.01&&x.gh>=0&&x.gh<=1&&x.ga>=0&&x.ga<=1).map(features).sort((a,b)=>a.date.localeCompare(b.date));
 const train=rows.filter(x=>x.date<'2026-11-05'),dev=rows.filter(x=>x.date>='2026-11-05'&&x.date<'2026-11-08'),holdout=rows.filter(x=>x.date>='2026-11-08'&&x.date<'2026-11-11');
 if(train.length<100)return {status:'INSUFFICIENT_DATA'};
 const base=fit(train,'base'),transition=fit(train,'transition');
 const calc=rs=>({market:score(rs,x=>x.q),base:score(rs,base),transition:score(rs,transition)});
 return {version:VERSION,trained:train.length,development:dev.length,later:holdout.length,
  dev:calc(dev),laterMetrics:calc(holdout),production:false,
  caveat:'Prior score is observed at 47. A score change may occur any time 47-57, not an exact goal timestamp.'};
}
