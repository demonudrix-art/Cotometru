/* SB Radar • cinematic Win/Loss map v2; context only, no filter changes */
const sbWlSeen=new Set();
function sbWlStyles(){
 if(document.getElementById('sb-wl-visual-v2'))return;
 const style=document.createElement('style');style.id='sb-wl-visual-v2';
 style.textContent=[
 '.sb-winloss-map.sb-wl-cine{position:relative;isolation:isolate;overflow:hidden;border-radius:16px;border:1px solid rgba(109,224,197,.36);padding:12px 13px;margin:9px 0;color:#ecfff9;font-size:11px;background:radial-gradient(ellipse at 8% 2%,rgba(20,143,112,.24),transparent 58%),linear-gradient(125deg,#102f31,#121a2c);box-shadow:inset 0 1px 0 rgba(220,255,240,.1),0 12px 30px rgba(0,0,0,.16)}',
 '.sb-wl-cine:after{content:"";pointer-events:none;position:absolute;top:-50%;left:-90%;width:28%;height:200%;transform:rotate(23deg);background:linear-gradient(90deg,transparent,rgba(222,255,249,.09),transparent);animation:sb-wl-scan 10s ease-in-out infinite}',
 '.sb-wl-enter{animation:sb-wl-entrance .6s cubic-bezier(.2,1,.25,1) both}',
 '.sb-wl-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px;position:relative;z-index:1}',
 '.sb-wl-head strong{font-size:12px;letter-spacing:.75px}',
 '.sb-wl-live{font-size:9px;letter-spacing:.4px;border-radius:30px;border:1px solid rgba(93,215,178,.4);background:rgba(19,89,72,.28);color:#95f8cf;padding:4px 8px;animation:sb-wl-breathe 3s ease-in-out infinite}',
 '.sb-wl-live.stale{color:#ffca98;border-color:rgba(250,180,117,.42);background:rgba(96,54,30,.35);animation:none}',
 '.sb-wl-switch{display:flex;align-items:center;gap:3px;padding:3px;border-radius:11px;border:1px solid rgba(155,240,221,.15);background:rgba(5,16,27,.5)}',
 '.sb-wl-switch button{border:0;background:transparent;color:#adc7c7;font-size:10px;padding:5px 10px;border-radius:8px;cursor:pointer;transition:background .2s,color .2s}',
 '.sb-wl-switch button[aria-pressed=true]{background:linear-gradient(135deg,rgba(46,177,136,.5),rgba(32,110,120,.5));color:white;box-shadow:0 0 13px rgba(72,219,171,.15)}',
 '.sb-wl-bars{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:7px 0}',
 '.sb-wl-half{padding:8px 9px;border-radius:10px;background:rgba(5,20,28,.43);border:1px solid rgba(209,255,243,.09);min-width:0}',
 '.sb-wl-label{display:flex;justify-content:space-between;gap:4px;align-items:center;font-size:10px;font-weight:700}',
 '.sb-wl-label strong{font-size:14px;font-variant-numeric:tabular-nums}',
 '.sb-wl-track{height:9px;margin-top:7px;background:#294147;overflow:hidden;border-radius:99px;position:relative}',
 '.sb-wl-track:after{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(90deg,transparent 0,transparent 19px,rgba(255,255,255,.055) 20px)}',
 '.sb-wl-fill{position:relative;height:100%;border-radius:99px;transform-origin:left;transition:width .7s cubic-bezier(.19,1,.22,1)}',
 '.sb-wl-fill.win{background:linear-gradient(90deg,#168b70,#8bf2c1);box-shadow:0 0 12px rgba(85,239,180,.4)}',
 '.sb-wl-fill.loss{background:linear-gradient(90deg,#a93d55,#ff7e98);box-shadow:0 0 12px rgba(255,104,131,.4)}',
 '.sb-wl-enter .sb-wl-fill{animation:sb-wl-grow 1s cubic-bezier(.2,.9,.2,1) both}',
 '.sb-wl-fill:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.2),transparent);transform:translateX(-120%);animation:sb-wl-shine 7s infinite}',
 '.sb-wl-muted{font-size:10px;color:#a6c8bf;line-height:1.5}',
 '.sb-wl-note{margin-top:7px;padding:7px 9px;border-radius:9px;background:rgba(17,88,65,.32);border:1px solid rgba(102,219,173,.17);color:#ceffe6}',
 '.sb-wl-note.risk{background:rgba(108,42,49,.38);border-color:rgba(240,129,141,.3);color:#ffd3d5}',
 '.sb-wl-note.low{background:rgba(93,62,29,.37);border-color:rgba(254,192,96,.28);color:#ffdfab}',
 '.sb-wl-actual{margin-top:7px;padding:7px 9px;border-radius:9px;background:rgba(19,48,70,.56);border:1px solid rgba(100,178,226,.18);color:#bddff2;font-size:10px}',
 '.sb-wl-warning{margin-top:8px;padding:9px 10px;border-radius:10px;background:linear-gradient(105deg,rgba(135,54,47,.58),rgba(94,42,58,.4));border:1px solid rgba(248,143,114,.5);color:#ffe0bf}',
 '.sb-wl-explain{font-size:10px;color:#afcac5;margin-top:7px}.sb-wl-explain summary{cursor:pointer}',
 '@keyframes sb-wl-entrance{from{opacity:.15;transform:translateY(11px) scale(.984)}to{opacity:1;transform:none}}',
 '@keyframes sb-wl-grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}',
 '@keyframes sb-wl-shine{0%,15%{transform:translateX(-120%)}70%,100%{transform:translateX(160%)}}',
 '@keyframes sb-wl-scan{0%,20%{left:-90%}70%,100%{left:160%}}',
 '@keyframes sb-wl-breathe{50%{box-shadow:0 0 13px rgba(102,245,187,.18)}}',
 '@media(prefers-reduced-motion:reduce){.sb-wl-cine,.sb-wl-cine:after,.sb-wl-cine .sb-wl-fill,.sb-wl-cine .sb-wl-fill:after,.sb-wl-cine .sb-wl-live{animation:none!important;transition:none!important}}'
 ].join('');
 document.head.append(style);
}
function sbWlFlag(country){
 const a={Italia:'🇮🇹',Spania:'🇪🇸',Japonia:'🇯🇵',Anglia:'🏴',Romania:'🇷🇴',Franta:'🇫🇷',Germania:'🇩🇪',Portugalia:'🇵🇹',Argentina:'🇦🇷',Brazilia:'🇧🇷',Turcia:'🇹🇷',Grecia:'🇬🇷',Egipt:'🇪🇬',Mexic:'🇲🇽',Olanda:'🇳🇱',Belgia:'🇧🇪',Israel:'🇮🇱'};
 return a[country]||'🌍';
}
function sbWlData(raw){if(!raw)return null;try{const o=typeof raw==='string'?JSON.parse(raw):raw;return o&&Number(o.n)>0?o:null}catch(_){return null}}
function sbWlActual(raw){if(!raw)return null;try{const o=typeof raw==='string'?JSON.parse(raw):raw;return o&&Number(o.signals)>0?o:null}catch(_){return null}}
function sbWlTime(utc){const d=new Date(utc);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('ro-RO',{timeZone:'Europe/Bucharest',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(d):'neconfirmat'}
function sbWinlossGuide(v,x){
 if(!v)return null;
 const model=String(x?.model_version||x?.ml_model_version||x?.signal?.model_version||'');
 const source=String(x?.signal_source||x?.source||'');
 if((model==='SB_GOLDEN_CLASSIC_00_M57_1PP_V1'||source==='SB_RADAR_GOLDEN_V2')&&(x?.stage==='BET_NOW'||x?.signal?.stage==='BET_NOW'))return null;
 const country=String(v.oddalerts_country||'').trim(),mt=String(v.oddalerts_match_type||'').trim();
 const co=sbWlData(v.ml_winloss_country),lg=sbWlData(v.ml_winloss_league),typ=sbWlData(v.ml_winloss_type);
 const coBase=sbWlData(v.ml_winloss_country_baseline),lgBase=sbWlData(v.ml_winloss_league_baseline);
 const coActual=sbWlActual(v.ml_winloss_country_actual),lgActual=sbWlActual(v.ml_winloss_league_actual);
 const youth=mt==='YOUTH'||(!mt&&/\bU(?:17|18|19|20|21|23)\b|junior/i.test(String(x?.fixture||'')));
 if(!co&&!lg&&!coBase&&!lgBase&&!youth)return null;
 sbWlStyles();
 const key=String(x?.event_id||0)+':'+(lg?.w??co?.w??0)+':'+(lg?.l??co?.l??0);
 const first=!sbWlSeen.has(key);sbWlSeen.add(key);if(sbWlSeen.size>1000)sbWlSeen.clear();
 const card=text('section','','sb-winloss-map sb-wl-cine'+(first?' sb-wl-enter':''));
 const head=text('div','','sb-wl-head');head.append(text('strong',sbWlFlag(country)+' HARTA WIN / LOSS · ML'));
 const status=String(v.ml_winloss_sync_status||''),stamp=String(v.ml_winloss_sync_utc||'');
 const fresh=status==='OK'&&Number.isFinite(Date.parse(stamp))&&Date.now()-Date.parse(stamp)<9000000;
 head.append(text('span',fresh?'● RECONTROL ORAR':'● RECONTROL ÎNTÂRZIAT','sb-wl-live'+(fresh?'':' stale')));
 card.append(head);card.append(text('div','Verificat '+sbWlTime(stamp)+' · actualizare din oră în oră · interval mobil 7 zile','sb-wl-muted'));
 const row=text('div','','');row.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-top:9px';
 const name=text('strong','','');row.append(name);
 const controls=text('div','','sb-wl-switch');row.append(controls);card.append(row);
 const body=text('div','','');card.append(body);
 const modes=[];
 if(lg||lgBase)modes.push({code:'LEAGUE',label:'Ligă',fresh:lg,base:lgBase,actual:lgActual,name:String(v.oddalerts_league||lg?.league||lgBase?.league||'Liga')});
 if(co||coBase)modes.push({code:'COUNTRY',label:'Țară',fresh:co,base:coBase,actual:coActual,name:country+' · toate ligile'});
 let selected=modes[0]?.code||'COUNTRY';
 const buttons=new Map();
 for(const mode of modes){const button=document.createElement('button');button.type='button';button.textContent=mode.label;button.setAttribute('aria-pressed',String(mode.code===selected));button.onclick=()=>{selected=mode.code;render()};buttons.set(mode.code,button);controls.append(button)}
 function drawBar(holder,label,amount,total,win){
  const cell=text('div','','sb-wl-half');const title=text('div','','sb-wl-label');
  const color=win?'#94f9ce':'#ffadbc';title.style.color=color;
  title.append(text('span',label),text('strong',amount+' / '+total));
  cell.append(title);
  const track=text('div','','sb-wl-track'),fill=text('div','','sb-wl-fill '+(win?'win':'loss'));
  fill.style.width=(total?100*amount/total:0).toFixed(1)+'%';track.append(fill);cell.append(track);holder.append(cell);
 }
 function render(){
  body.replaceChildren();
  for(const [code,btn] of buttons)btn.setAttribute('aria-pressed',String(code===selected));
  const mode=modes.find(z=>z.code===selected);if(!mode)return;
  const stat=mode.fresh||mode.base,archived=!mode.fresh;
  name.textContent=(selected==='COUNTRY'?'🌍 ':sbWlFlag(country)+' ')+mode.name;
  if(!stat){body.append(text('div','Nu sunt rezultate comparabile.','sb-wl-note low'));return}
  const n=Number(stat.n),w=Number(stat.w),l=Number(stat.l);
  const bars=text('div','','sb-wl-bars');drawBar(bars,'🟢 HARTA WIN',w,n,true);drawBar(bars,'🔴 HARTA LOSS',l,n,false);body.append(bars);
  const sample=n<10?'EȘANTION FOARTE MIC':n<30?'EȘANTION REDUS':'ISTORIC MAI AMPLU';
  body.append(text('div',(100*w/n).toFixed(0)+'% WIN · '+(100*l/n).toFixed(0)+'% LOSS · '+n+' selecții · '+sample+(archived?' · ARHIVĂ 6–13 NOV.':''),'sb-wl-muted'));
  const message=text('div',archived?'📁 Reper istoric 6–13 nov.; nu sunt încă rezultate comparabile recente.':w>l?'↗ Balanță istorică favorabilă; avantaj viitor neconfirmat.':l>w?'↘ Balanță istorică nefavorabilă; verifică liga înainte de decizie.':'◌ Balanță istorică echilibrată.','sb-wl-note'+(archived||n<10?' low':l>w?' risk':''));body.append(message);
  if(mode.base&&mode.fresh){
   const base=mode.base,pp=100*w/n-100*Number(base.w)/Number(base.n);
   body.append(text('div','Reper 6–13 nov.: '+base.w+' WIN / '+base.l+' LOSS ('+base.n+')'+(n>=10&&Number(base.n)>=10?' · variație '+(pp>=0?'+':'')+pp.toFixed(1)+' pp':'')+' · perioade posibil suprapuse.','sb-wl-muted'));
  }
  const actual=mode.actual,act=text('div',actual?'📡 BET NOW reale, 7 zile: '+actual.w+' WIN / '+actual.l+' LOSS'+(Number(actual.pending)>0?' · '+actual.pending+' în așteptare':'')+' ('+actual.signals+' semnale).':'📡 BET NOW reale: încă fără semnale pentru această ligă/țară în 7 zile.','sb-wl-actual');
  body.append(act);
 }
 render();
 if(youth){const warn=text('div','','sb-wl-warning');warn.append(text('strong','⚠️ JUNIORI / U19 / U21 · RISC ISTORIC'));
 const y=typ||sbWlData(v.ml_winloss_type_baseline);warn.append(text('div',y?'ML juniori: '+y.w+' WIN / '+y.l+' LOSS ('+y.n+' meciuri).':'Fără eșantion suficient pentru juniori.'));card.append(warn)}
 const detail=document.createElement('details');detail.className='sb-wl-explain';const summary=document.createElement('summary');summary.textContent='Cum se calculează?';detail.append(summary);
 detail.append(text('div','Recontrol orar al selecțiilor ML LogReg V1 în ultimele 7 zile, separat de Golden Classic. 📡 numără doar alertele BET NOW trimise efectiv, fără a le amesteca în replay. Reperul 6–13 noiembrie rămâne arhivat. Procentele nu sunt probabilitatea următorului meci, o notă de siguranță sau o recomandare de miză.',''));
 card.append(detail);return card;
}