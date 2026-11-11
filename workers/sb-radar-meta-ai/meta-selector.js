// SB RADAR META AI — research-only ensemble controller v0.1
// This module DOES NOT train any models, place bets, send alerts, or write D1.
// Inputs must be produced through chronological walk-forward testing.
// Correlated algorithms count as one family, not 100 independent votes.
export const META_AI_VERSION='META_AI_RESEARCH_V0_1';
export const DEFAULT_POLICY=Object.freeze({
 minFamilies:2,minOos:200,minBrierImprovement:.002,maxCalibrationError:.065,
 maxDrift:.15,maxAgeSeconds:120,maxModelAgeDays:120,
 minLowerEV:.06,minLowerWinProb:.38,minHighWinProb:.62,oddsMin:1.05,oddsMax:12
});
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const validP=x=>finite(x)&&x>=0&&x<=1;
const millis=s=>{const x=Date.parse(s||'');return Number.isFinite(x)?x:null};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function validVector(v){return Array.isArray(v)&&v.length===3&&v.every(validP)&&Math.abs(v.reduce((s,x)=>s+x,0)-1)<.012}
function market(odds){
 if(!Array.isArray(odds)||odds.length!==3||odds.some(x=>!finite(x)||x<=1))return null;
 const inv=odds.map(x=>1/x),sum=inv.reduce((s,x)=>s+x,0);
 return inv.map(x=>x/sum);
}
function assess(model,asOf,policy){
 const v=model?.validation;
 if(!model?.id||!model.family||!validVector(model.probs)||!v)return {accepted:false,reason:'BAD_INPUT'};
 const train=millis(model.trainEndUtc),pred=millis(model.predictionUtc),test=millis(v.oosEndUtc);
 if(train===null||pred===null||test===null||train>=asOf||pred>asOf||test>asOf)
  return {accepted:false,reason:'LEAKAGE_OR_FUTURE_TIMESTAMP'};
 if(asOf-pred>policy.maxAgeSeconds*1000||asOf-train>policy.maxModelAgeDays*86400000)
  return {accepted:false,reason:'STALE_MODEL_OR_PREDICTION'};
 if(v.walkForward!==true||v.independentOos!==true||v.leakageAuditPassed!==true)
  return {accepted:false,reason:'UNVALIDATED'};
 if(!finite(v.n)||v.n<policy.minOos)return {accepted:false,reason:'SMALL_TEST_SET'};
 if(!finite(v.brier)||!finite(v.marketBrier)||v.marketBrier-v.brier<policy.minBrierImprovement)
  return {accepted:false,reason:'NO_VERIFIED_MARKET_ADVANTAGE'};
 if(!finite(v.calibrationError)||v.calibrationError<0||v.calibrationError>policy.maxCalibrationError)
  return {accepted:false,reason:'UNCALIBRATED'};
 if(!finite(v.drift)||v.drift<0||v.drift>policy.maxDrift)
  return {accepted:false,reason:'DRIFT'};
 const weight=clamp((v.marketBrier-v.brier)/.04,.1,1)*clamp(v.n/600,.2,1)*(1-v.drift);
 return {accepted:true,id:model.id,family:model.family,probs:model.probs,weight,validation:v};
}
export function evaluateMetaAI(snapshot,outputs=[],overrides={}){
 const p={...DEFAULT_POLICY,...overrides},now=millis(snapshot?.asOfUtc);
 if(now===null||!Number.isSafeInteger(snapshot?.eventId)||snapshot.eventId<=0)return {decision:'ABSTAIN',reason:'BAD_EVENT'};
 const prior=market(snapshot.odds);
 if(!prior||snapshot.odds.some(x=>x<p.oddsMin||x>p.oddsMax))return {decision:'ABSTAIN',reason:'BAD_MARKET'};
 if(snapshot.isLive!==true||!Number.isInteger(snapshot.minute)||snapshot.minute<0||snapshot.minute>120||
 !Number.isInteger(snapshot.homeScore)||!Number.isInteger(snapshot.awayScore))
  return {decision:'ABSTAIN',reason:'MISSING_LIVE_DATA'};
 if(!Array.isArray(outputs))return {decision:'ABSTAIN',reason:'NO_MODELS'};
 const inspected=outputs.map(m=>assess(m,now,p)),accepted=inspected.filter(x=>x.accepted);
 const grouped=new Map();
 for(const item of accepted)if(!grouped.has(item.family)||grouped.get(item.family).weight<item.weight)grouped.set(item.family,item);
 const unique=[...grouped.values()].sort((a,b)=>b.weight-a.weight).slice(0,8);
 const audit={version:META_AI_VERSION,eventId:snapshot.eventId,asOfUtc:snapshot.asOfUtc,
  testedModels:outputs.length,validatedModels:accepted.length,
  independentFamilies:unique.map(x=>x.family),rejections:inspected.filter(x=>!x.accepted).map(x=>x.reason)};
 if(unique.length<p.minFamilies)return {decision:'ABSTAIN',reason:'NOT_ENOUGH_INDEPENDENT_EVIDENCE',...audit};
 const w=unique.reduce((s,x)=>s+x.weight,0);
 if(w<=0)return {decision:'ABSTAIN',reason:'ZERO_RELIABILITY',...audit};
 const ensembled=[0,1,2].map(i=>unique.reduce((s,x)=>s+x.probs[i]*x.weight,0)/w);
 // Conservative market blend; heuristic haircut is NOT a confidence interval.
 const blended=ensembled.map((x,i)=>.7*x+.3*prior[i]);
 const haircut=clamp(unique.reduce((s,x)=>s+(x.validation.calibrationError+x.validation.drift*.1)*x.weight,0)/w,0,.2);
 const scenarios=snapshot.odds.map((odd,i)=>{
  const low=clamp(blended[i]-haircut,0,1);
  return {selection:['1','X','2'][i],odd,probability:blended[i],
   lowerProbabilityHeuristic:low,ev:blended[i]*odd-1,conservativeEv:low*odd-1};
 });
 const choices=scenarios.filter(x=>x.lowerProbabilityHeuristic>=p.minLowerWinProb&&x.conservativeEv>=p.minLowerEV)
   .sort((a,b)=>b.conservativeEv-a.conservativeEv);
 if(!choices.length)return {decision:'ABSTAIN',reason:'NO_CONSERVATIVE_EDGE',scenarios,...audit};
 const x=choices[0];
 return {decision:'RESEARCH_CANDIDATE',mode:x.lowerProbabilityHeuristic>=p.minHighWinProb?'HIGH_WIN_AND_VALUE':'VALUE_ONLY',
  selection:x.selection,probability:x.probability,conservativeEv:x.conservativeEv,
  scenarios,...audit,productionAlertEnabled:false,automaticBetting:false,
  warning:'Backtests cannot establish future ROI. Verify on untouched prospective data.'};
}
