// GOAL WATCH 57+ SHADOW | research-only frozen price model.
// No database writes, no production integration, no betting, no notifications.
// Uses scores and 1/X/2 odds at exactly 57' only; no final-result access.
export const MODEL_VERSION='GOALWATCH57_PRICE_SHADOW_FROZEN_V1';
export const MODEL=Object.freeze({"parameters":{"bias":-0.6926140351346187,"weights":[0.1424063383992918,-0.0421928140950811,-0.05100514806438517,-0.19112297981282206,0.04245527591253694],"means":[0.4004563616001257,0.3330118290975822,0.2665318093022917,0.8136589351235272,0.11032265514668889],"scales":[0.07,0.11339522958393168,0.10163640423713029,0.13838681762391397,0.07]},"thresholdForGoalCandidate":0.2908125236491297});
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const sigmoid=x=>1/(1+Math.exp(-Math.max(-25,Math.min(25,x))));
const clamp=(v,a=.001,b=.999)=>Math.max(a,Math.min(b,v));
export function predictGoalWatch57(frame){
 if(!Number.isSafeInteger(frame?.event_id)||frame.event_id<1||frame.minute!==57||frame.home_score!==0||frame.away_score!==0)
  return {decision:'ABSTAIN',reason:'NOT_00_AT_57'};
 const odds=[frame.p1,frame.px,frame.p2];
 if(odds.some(x=>!finite(x)||x<=1.01))return {decision:'ABSTAIN',reason:'MISSING_1X2_ODDS'};
 const asOf=Date.parse(frame.captured_utc||'');
 if(!Number.isFinite(asOf))return {decision:'ABSTAIN',reason:'MISSING_TIMESTAMP'};
 const inverse=odds.map(x=>1/x),overround=inverse.reduce((s,x)=>s+x,0);
 const f=[inverse[1]/overround,inverse[0]/overround,inverse[2]/overround,Math.log(frame.px),Math.log(overround)];
 const p=MODEL.parameters;
 const z=p.bias+p.weights.reduce((s,w,i)=>s+w*(f[i]-p.means[i])/p.scales[i],0);
 const p00=clamp(sigmoid(z));
 const qualifies=p00<=MODEL.thresholdForGoalCandidate;
 return {version:MODEL_VERSION,event_id:frame.event_id,asOfUtc:frame.captured_utc,scoreAt57:'0-0',
  pFinal00:p00,pGoalAfter57:1-p00,decision:qualifies?'SHADOW_CANDIDATE':'ABSTAIN',
  reason:qualifies?'LOW_ESTIMATED_P00':'ABOVE_FROZEN_TRAINING_THRESHOLD',
  productionAlertEnabled:false,automaticBetting:false,
  note:'No corresponding Over 0.5 quote verified; percentage is not proof of positive betting EV.'};
}
