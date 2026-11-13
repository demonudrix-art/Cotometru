/* SB Radar v413 • ML risk research strip. OWNER-only Audit component. */
function sbMlRiskStyles(){
 if(document.getElementById('sb-risk-audit-v413'))return;
 const style=document.createElement('style');style.id='sb-risk-audit-v413';
 style.textContent=[
 '.sb-risk-audit{position:relative;overflow:hidden;isolation:isolate;border:1px solid rgba(100,203,225,.45);border-radius:16px;padding:12px 13px;background:radial-gradient(ellipse at 12% 0,rgba(46,153,183,.2),transparent 65%),linear-gradient(130deg,#0d2836,#151c31);color:#eafffb;margin:8px 0 12px;box-shadow:inset 0 1px 0 rgba(221,255,249,.10),0 10px 24px rgba(0,0,0,.16);font-size:11px}',
 '.sb-risk-audit:after{content:"";position:absolute;top:-30%;left:-85%;height:160%;width:25%;pointer-events:none;background:linear-gradient(90deg,transparent,rgba(223,255,255,.085),transparent);transform:rotate(19deg);animation:sb-risk-sweep 10s ease-in-out infinite}',
 '.sb-risk-audit *, .sb-risk-audit *:before{box-sizing:border-box}',
 '.sb-risk-top{display:flex;align-items:center;justify-content:space-between;gap:9px;flex-wrap:wrap}',
 '.sb-risk-top strong{font-size:13px;letter-spacing:.5px}',
 '.sb-risk-dot{display:inline-flex;align-items:center;gap:5px;color:#b9f8de;font-size:9px;white-space:nowrap}',
 '.sb-risk-dot:before{content:"";width:6px;height:6px;border-radius:50%;background:#83e7be;box-shadow:0 0 8px #58e4b6;animation:sb-risk-pulse 2s infinite}',
 '.sb-risk-context{font-size:10px;color:#a6c9d6;margin-top:5px}',
 '.sb-risk-signal{margin:9px 0;padding:8px;background:rgba(8,22,35,.46);border-radius:10px;border:1px solid rgba(162,226,244,.13);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}',
 '.sb-risk-kpi{min-width:0}.sb-risk-kpi small{display:block;font-size:9px;color:#a9c7cc}.sb-risk-kpi strong{font-size:14px;font-weight:800;white-space:normal;word-break:break-word}',
 '.sb-risk-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:8px}',
 '.sb-risk-seg{border:1px solid rgba(145,227,239,.15);border-radius:10px;padding:9px;background:rgba(6,21,32,.54);min-width:0}',
 '.sb-risk-seg.emphasis{grid-column:1/-1;border-color:rgba(112,222,205,.42);background:linear-gradient(120deg,rgba(13,65,61,.63),rgba(13,36,55,.62))}',
 '.sb-risk-name{font-size:10px;font-weight:700;color:#cff7f2}',
 '.sb-risk-bins{font-size:9px;color:#a1bcc7;overflow-wrap:anywhere;padding-top:3px}',
 '.sb-risk-vs{display:flex;justify-content:space-between;gap:5px;margin:6px 0;font-size:10px;align-items:center}',
 '.sb-risk-win{color:#75edb7}.sb-risk-loss{color:#ff99aa}',
 '.sb-risk-bars{height:5px;background:rgba(237,106,127,.5);border-radius:99px;overflow:hidden;margin:5px 0}',
 '.sb-risk-fill{height:100%;background:linear-gradient(90deg,#159d7e,#9ff5c7);box-shadow:0 0 8px rgba(106,244,182,.3);transition:width .7s ease}',
 '.sb-risk-archive{font-size:9px;color:#aac5ce;margin-top:6px}',
 '.sb-risk-mini{font-size:10px;margin-top:7px;color:#d1e9e4}',
 '.sb-risk-flag{font-size:10px;margin-top:7px;padding:7px 8px;background:rgba(101,64,26,.3);border:1px solid rgba(242,181,100,.3);border-radius:8px;color:#ffdfad}',
 '.sb-risk-flag.danger{background:rgba(95,35,48,.35);border-color:rgba(255,130,145,.38);color:#ffc2cb}',
 '.sb-risk-details{border-top:1px solid rgba(178,225,232,.13);padding:7px 0 0;margin-top:10px;font-size:10px;line-height:1.55;color:#aecaD3}',
 '.sb-risk-details summary{cursor:pointer;color:#d9f3ed;font-weight:700;margin-bottom:5px}',
 '.sb-risk-row{display:flex;justify-content:space-between;gap:7px;padding:4px 0;border-bottom:1px solid rgba(190,235,229,.065)}',
 '.sb-risk-row strong{color:#f2fff9;text-align:right}',
 '@keyframes sb-risk-sweep{0%,20%{left:-85%}65%,100%{left:165%}}@keyframes sb-risk-pulse{50%{opacity:.45}}',
 '@media(max-width:340px){.sb-risk-signal{grid-template-columns:1fr 1fr}.sb-risk-grid{gap:5px}.sb-risk-seg{padding:7px}}',
 '@media(prefers-reduced-motion:reduce){.sb-risk-audit:after,.sb-risk-dot:before{animation:none!important}.sb-risk-fill{transition:none!important}}'
 ].join('');
 document.head.append(style);
}
function sbMlRiskAuditPanel(d){
 const r=d?.ml_risk;if(!r||r.status==='NO_CATALOG')return null;
 sbMlRiskStyles();
 if(r.status==='TEMPORARILY_UNAVAILABLE'){
  const notice=text('section','','sb-risk-audit');
  notice.append(text('strong','🧠 ANALIZĂ RISC ML'));
  notice.append(text('div','⚠️ Datele analizei sunt temporar indisponibile. Harta de bază și Auditul rămân funcționale; nu afișăm cifre presupuse.','sb-risk-flag'));
  return notice;
 }
 const root=text('section','','sb-risk-audit');
 const header=text('div','','sb-risk-top');
 header.append(text('strong','🧠 ANALIZĂ RISC ML · LogReg V1'));
 header.append(text('span','● CONTEXT INFORMATIV','sb-risk-dot'));root.append(header);
 const golden=r.context==='GOLDEN_ML_CONTEXT_ONLY';
 const mlAlert=r.context==='ML_PRODUCTION_ALERT';
 const context=golden?'👑 Golden Classic a emis alerta. Comparațiile de mai jos aparțin exclusiv ML și NU validează Golden.':
  mlAlert?'📡 Alertă BET NOW ML confirmată în jurnalul serverului.':
  r.context==='ML_REJECTED_OR_UNCONFIRMED'?'Scor ML necalificat sau alertă ML neconfirmată. Analiza este doar cercetare.':'Scor ML calculat. Nu presupune că a fost emisă o alertă.';
 root.append(text('div',context,'sb-risk-context'));
 const sig=r.signal||{},bits=r.bins||{};
 const kpis=text('div','','sb-risk-signal');
 const k=[
  ['ORĂ ROMÂNIA',bits.hour?bits.hour.replace('-','–'):'Nedisponibil'],
  ['SCOR ML',sig.model_score===null?'—':Number(sig.model_score).toFixed(4)],
  ['COTĂ X',sig.odds_x===null?'—':Number(sig.odds_x).toFixed(2)]
 ];
 for(const [label,value] of k){const cell=text('div','','sb-risk-kpi');cell.append(text('small',label),text('strong',value));kpis.append(cell)}root.append(kpis);
 if(sig.model_score!==null){
  root.append(text('div','Prag ML '+Number(sig.cutoff||.55172).toFixed(5)+' · '+(sig.accepted?'scor acceptat de model':'scor sub prag / neacceptat')+' · scorul NU este probabilitate de egal.','sb-risk-context'));
 }else root.append(text('div','Lipsește evaluarea ML pentru acest meci; nu estimăm un scor.','sb-risk-flag'));
 const rolling=new Map((r.rolling?.segments||[]).map(x=>[x.dimension,x]));
 const baseline=new Map((r.baseline?.segments||[]).map(x=>[x.dimension,x]));
 const labels=[['HOUR_GROUP','⏱ Ore'],['ML_SCORE','🧠 Interval ML'],['ODDS_X','📊 Cota X'],['HOUR_SCORE','⏳ Oră + ML'],['SCORE_ODDS','🧮 ML + cote'],['HOUR_SCORE_ODDS','⚡ COMBINAȚIE COMPLETĂ'],['TYPE','🏆 Tip competiție'],['HOUR_TYPE','🏆 Oră + tip']];
 const grid=text('div','','sb-risk-grid');
 for(const [dim,label] of labels){
  const seg=rolling.get(dim),b=baseline.get(dim);
  if(!seg&&!b)continue;
  const cell=text('div','','sb-risk-seg'+(dim==='HOUR_SCORE_ODDS'?' emphasis':''));
  cell.append(text('div',label,'sb-risk-name'));
  cell.append(text('div',(seg?.key||b?.key||'').replaceAll('GE_','≥').replaceAll('LT_','<').replaceAll('2.00_TO_2.14','2,00–2,14').replaceAll('0.60','0,60').replaceAll('_',' '),'sb-risk-bins'));
  const cur=seg?.stat;
  if(cur&&Number(cur.n)>0){
   const n=Number(cur.n),w=Number(cur.w),l=Number(cur.l);
   const row=text('div','','sb-risk-vs');row.append(text('span',w+' WIN','sb-risk-win'),text('span',l+' LOSS','sb-risk-loss'));cell.append(row);
   const track=text('div','','sb-risk-bars'),fill=text('div','','sb-risk-fill');fill.style.width=(100*w/n).toFixed(1)+'%';track.append(fill);cell.append(track);
   cell.append(text('div',n+' selecții · '+(100*w/n).toFixed(0)+'% WIN · ROI simulat '+(cur.roi_pct>=0?'+':'')+Number(cur.roi_pct||0).toFixed(1)+'%','sb-risk-mini'));
   if(n<10)cell.append(text('div','⚠️ Eșantion foarte mic; concluzie nevalidată.','sb-risk-archive'));
   else if(n<30)cell.append(text('div','⚠️ Eșantion redus.','sb-risk-archive'));
  }else cell.append(text('div','Fără selecții ML decontate în ultimele 7 zile.','sb-risk-mini'));
  const old=b?.stat;
  if(old)cell.append(text('div','Arhivă 6–13 nov.: '+old.w+' WIN / '+old.l+' LOSS ('+old.n+') · ROI '+Number(old.roi_pct||0).toFixed(1)+'%','sb-risk-archive'));
  grid.append(cell);
 }
 if(grid.children.length)root.append(grid);
 else root.append(text('div','Nu există încă date statistice comparabile pentru acest profil.','sb-risk-flag'));
 if(r.caution==='INSUFFICIENT_COMBINATION_N')root.append(text('div','⚠️ Combinația exactă oră + ML + cotă are sub 10 selecții sau nu are rezultate. Nu o considera avantaj confirmat.','sb-risk-flag danger'));
 if(r.metadata?.type==='YOUTH')root.append(text('div','⚠️ JUNIORI: verifică separat eșantionul, rezultatele și ligile; risc istoric observat, nu interdicție automată.','sb-risk-flag danger'));
 const detail=document.createElement('details');detail.className='sb-risk-details';
 const summary=document.createElement('summary');summary.textContent='Walk-forward · Slip · surse și comparații';
 detail.append(summary);
 function pair(label,value){
  const row=text('div','','sb-risk-row');row.append(text('span',label),text('strong',value));detail.append(row);
 }
 pair('Ultimul recontrol al balanței',r.rolling?.asof_utc?sbWlTime(r.rolling.asof_utc):'Neconfirmat');
 pair('Fotografie inițială',r.baseline?.period_label||'6–13 nov. 2026');
 const walk=r.retrospective_walkforward?.rows||[];
 const chosen=walk.find(x=>x.scope!=='ALL'),all=walk.find(x=>x.scope==='ALL');
 if(chosen)pair('Walk-forward retrospectiv (profil)',chosen.test_w+'W / '+chosen.test_l+'L · '+chosen.test_n+' teste, '+chosen.eligible_days+' zile eligibile');
 else pair('Walk-forward retrospectiv (profil)','Eșantion anterior insuficient');
 if(all)pair('Walk-forward retrospectiv (total ML)',all.test_w+'W / '+all.test_l+'L în '+all.test_n+' teste');
 const forward=r.prospective_walkforward?.rows||[];
 const valid=forward.filter(x=>x.valid_on_time===1&&x.min_sample_pass===1);
 if(valid.length){
  const w=valid.reduce((a,x)=>a+Number(x.test_w||0),0),l=valid.reduce((a,x)=>a+Number(x.test_l||0),0),pending=valid.reduce((a,x)=>a+Number(x.test_pending||0),0);
  pair('Test prospectiv eligibil',w+'W / '+l+'L'+(pending?' · '+pending+' de verificat':''));
 }else pair('Test prospectiv','Încă fără zi validă și eșantion suficient');
 const own=r.slip?.event_bets||[];
 if(own.length)for(const b of own)pair('Slip acest meci · '+b.selection,b.n+' × '+b.status+(b.settled_net_lei===null?'':' · net '+b.settled_net_lei+' lei'));
 else pair('Slip acest meci','Niciun bilet înregistrat');
 const history=r.slip?.x_last_7d_by_alert||[];
 const modelRows=history.filter(x=>x.linked_model==='SB_RADAR_ML_LOGREG_V1');
 if(modelRows.length){
  const w=modelRows.filter(x=>x.status==='WON').reduce((a,x)=>a+Number(x.n),0);
  const l=modelRows.filter(x=>x.status==='LOST').reduce((a,x)=>a+Number(x.n),0);
  const p=modelRows.filter(x=>x.status==='OPEN').reduce((a,x)=>a+Number(x.n),0);
  pair('Slip X cu alertă ML (7 zile)',w+' WON / '+l+' LOST'+(p?' · '+p+' OPEN':''));
 }else pair('Slip X cu alertă ML (7 zile)','Niciun bilet asociat înregistrat');
 pair('Surse','Superbet ligă/divizie + replay ML + jurnal BET NOW + Slip');
 detail.append(text('div','Arhiva 6–13 nov. și intervalul mobil se pot suprapune. Walk-forward-ul istoric este retrospectiv. Statisticile nu justifică o miză sau o recomandare automată. Golden Classic are criterii separate.','sb-risk-context'));
 root.append(detail);
 return root;
}