// Safe EPL-Pulse pre-trained Poisson numerical adapter, no pickle execution.
export const EXPERT_ID='EPL_PULSE_POISSON_PRETRAINED_SAFE_V1';
export const FEATURES=Object.freeze(['EloDiff','Home_GF','Home_GA','Away_GF','Away_GA']);
const HOME=[.2338013694871308,.0018652694572331436,.06195435916880972,.013494682237010846,.00645985472133854,.02093595950809463];
const AWAY=[-.08102754008002411,-.0019719126270980976,.0235491230800741,.05769557966483417,.056437186274383516,.004689756350863565];
const finite=x=>typeof x==='number'&&Number.isFinite(x);
function poisson(l,n=18){const a=[Math.exp(-l)];for(let i=1;i<=n;i++)a[i]=a[i-1]*l/i;return a;}
export function predictEplPulsePretrained(features,context={}){
 const x=FEATURES.map(k=>features?.[k]);
 if(x.some(v=>!finite(v)))return {ok:false,reason:'MISSING_REAL_FEATURES',expert:EXPERT_ID};
 if(x.slice(1).some(v=>v<0||v>20)||Math.abs(x[0])>1800)return {ok:false,reason:'BAD_FEATURE_RANGES',expert:EXPERT_ID};
 const asOf=Date.parse(context.asOfUtc||'');
 if(!Number.isFinite(asOf))return {ok:false,reason:'NO_ASOF_TIMESTAMP',expert:EXPERT_ID};
 if(context.kickoffUtc){
  const kickoff=Date.parse(context.kickoffUtc);
  if(!Number.isFinite(kickoff)||asOf>kickoff)return {ok:false,reason:'POST_KICKOFF_INPUT',expert:EXPERT_ID};
 }
 const v=[1,...x],lambda=coefs=>Math.exp(Math.max(-10,Math.min(10,coefs.reduce((s,c,i)=>s+c*v[i],0))));
 const lh=lambda(HOME),la=lambda(AWAY),home=poisson(lh),away=poisson(la),p=[0,0,0];
 for(let i=0;i<home.length;i++)for(let j=0;j<away.length;j++)p[i>j?0:i===j?1:2]+=home[i]*away[j];
 const z=p.reduce((s,x)=>s+x,0);
 const featuresVerified=context.stateProvenance==='AUTHOR_TEAM_STATE_VERIFIED';
 return {ok:true,expert:EXPERT_ID,probabilities:p.map(x=>x/z),
  expectedGoals:{home:lh,away:la},asOfUtc:context.asOfUtc,
  faithfulToOriginalFeatures:featuresVerified,
  researchOnly:true,liveNotificationsAllowed:false,autoBetAllowed:false,
  decision:'EXPERT_FORECAST_ONLY',reason:featuresVerified?'NEEDS_FORWARD_VALIDATION':'ORIGINAL_TEAM_STATE_MISSING',
  note:'No Generosity input. No direct 57-minute model; not a qualified betting signal.'};
}