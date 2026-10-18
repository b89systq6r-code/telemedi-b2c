/* Telemedi B2C · kokpit kohort i lejków. Vanilla JS. Wszystko liczone w przeglądarce z danych pacjent/sesja.    Autor: Sebastian Szablewski (fabest.pl), zbudowane z Claude Code. */
(async function(){
'use strict';
const T = window.TM_DATA, DIM = T.dims, LAST = T.ndays - 1; // dzień 729 = 2026-09-30
const $ = (s, r=document) => r.querySelector(s), $$ = (s, r=document) => [...r.querySelectorAll(s)];
const el = (tag, attrs={}, html) => { const e=document.createElement(tag); for(const k in attrs){ if(k==='class') e.className=attrs[k]; else e.setAttribute(k,attrs[k]); } if(html!=null) e.innerHTML=html; return e; };
const fmtInt = v => v==null||!isFinite(v) ? '–' : Math.round(v).toLocaleString('pl-PL');
const fmtPct = (v,d=1) => v==null||!isFinite(v) ? '–' : (v*100).toFixed(d).replace('.',',')+'%';
const fmtZl = (v,d=0) => v==null||!isFinite(v) ? '–' : v.toFixed(d).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,' ')+' zł';
const fmtNum = (v,d=1) => v==null||!isFinite(v) ? '–' : v.toFixed(d).replace('.',',');
const ROM = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
const D0 = new Date(T.D0+'T00:00:00Z');
const dayDate = d => new Date(D0.getTime()+d*864e5);
const dayStr = d => { const x=dayDate(d); return `${x.getUTCDate()} ${ROM[x.getUTCMonth()]} ${x.getUTCFullYear()}`; };
const dayISO = d => dayDate(d).toISOString().slice(0,10);
const isoDay = s => Math.round((new Date(s+'T00:00:00Z')-D0)/864e5);
const monthOfDay = new Uint8Array(T.ndays), monthStart=[];
for(let d=0; d<T.ndays; d++){ const x=dayDate(d); const m=(x.getUTCFullYear()-2024)*12+x.getUTCMonth()-9; monthOfDay[d]=m; if(monthStart[m]==null) monthStart[m]=d; }
const monthLabel = m => { const x=dayDate(monthStart[m]); return `${ROM[x.getUTCMonth()]} ${String(x.getUTCFullYear()).slice(2)}`; };
const SERIES = ['--s1','--s2','--s3','--s4','--s5','--s6','--s7','--s8'];
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

/* ---------- dekodowanie ---------- */
async function decode(meta, blob){
  const bin = Uint8Array.from(atob(blob), c=>c.charCodeAt(0));
  let buf;
  if('DecompressionStream' in window){ buf = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(); }
  else throw new Error('Przeglądarka nie obsługuje DecompressionStream');
  const out={}, C={u1:Uint8Array,u2:Uint16Array,i2:Int16Array};
  for(const k in meta){ const [dt,off,len]=meta[k]; out[k]=new C[dt](buf,off,len); }
  return out;
}
const P = await decode(T.pmeta, T.pblob), S = await decode(T.smeta, T.sblob);
const NP = T.npat, NE = T.nev, NS = T.nses;

/* ---------- wymiary ---------- */
const CH = DIM.CH;
const GRP = ['Kampanie L4 (Meta + TikTok)','Google Ads generic','Brand + direct','SEO','Meta (prospecting + retargeting)','Polecenia, afiliacja, CRM'];
const chToGrp = c => ({google_generic:1,google_brand:2,direct:2,seo:3,meta_prosp:4,meta_rmkt:4,meta_l4:0,tiktok_l4:0,affiliate:5,referral:5,crm:5,other:5})[CH[c]];
const CHLAB = {google_generic:'Google Ads generic',google_brand:'Google brand',seo:'SEO (Google/Bing)',direct:'Bezpośrednie',meta_prosp:'Meta prospecting',meta_rmkt:'Meta retargeting',meta_l4:'Meta „L4 szybko”',tiktok_l4:'TikTok „L4 w 15 min”',affiliate:'Afiliacja',referral:'Program poleceń',crm:'CRM (e-mail/SMS)',other:'Inne'};
const L4FLAG = ['Kampanie L4 (Meta + TikTok)','Pozostałe kanały'];
const PDIMS = {
  grp:{lab:'Grupa kanałów', vals:GRP, get:i=>chToGrp(P.ch[i])},
  l4:{lab:'Kampanie L4 vs reszta', vals:L4FLAG, get:i=>chToGrp(P.ch[i])===0?0:1},
  ch:{lab:'Kanał pozyskania', vals:CH.map(c=>CHLAB[c]), get:i=>P.ch[i]},
  pu:{lab:'Cel 1. wizyty', vals:['konsultacja','e-recepta','L4','skierowanie'], get:i=>P.pu[i]},
  sp:{lab:'Specjalizacja 1. wizyty', vals:DIM.SPEC, get:i=>P.sp[i]},
  di:{lab:'Rabat przy 1. zakupie', vals:['bez rabatu','TelemediGO','kod promo'], get:i=>P.di[i]},
  pc:{lab:'Kod promo', vals:DIM.PROMO, get:i=>P.pc[i]},
  st:{lab:'Status 1. wizyty', vals:['odbyta','odbyta, zwrot','anulowana','no-show'], get:i=>P.st[i]},
  dl:{lab:'Opóźnienie startu 1. wizyty', vals:DIM.DELAY, get:i=>P.dl[i]},
  mo:{lab:'Pora 1. wizyty', vals:['reszta dnia','rano 6–12'], get:i=>P.mo[i]},
  pf:{lab:'Platforma 1. zakupu', vals:DIM.PLAT, get:i=>P.pf[i]},
  gf:{lab:'GO przy 1. zakupie', vals:['bez GO','z GO'], get:i=>P.gf[i]},
  ag:{lab:'Wiek (z konta)', vals:DIM.AGE, get:i=>P.ag[i]},
  cs:{lab:'Miejscowość', vals:['wieś','miasto do 50k','miasto 50–200k','miasto 200k+'], get:i=>P.cs[i]},
  mc:{lab:'Zgoda marketingowa', vals:['brak','jest'], get:i=>P.mc[i]},
};
const SDIMS = {
  pf:{lab:'Platforma', vals:DIM.PLAT, get:i=>S.pf[i]},
  grp:{lab:'Grupa kanałów', vals:GRP, get:i=>chToGrp(S.ch[i])},
  ch:{lab:'Kanał', vals:CH.map(c=>CHLAB[c]), get:i=>S.ch[i]},
  dv:{lab:'Urządzenie', vals:['mobile','desktop','tablet'], get:i=>S.dv[i]},
  lp:{lab:'Strona wejścia', vals:DIM.LAND, get:i=>S.lp[i]},
  nr:{lab:'Nowy / powracający', vals:['nowy lub nierozpoznany','powracający pacjent'], get:i=>(S.m[i]>>6)&1},
};

/* ---------- prekalkulacje pacjentów ---------- */
const firstRep = new Uint16Array(NP).fill(65535);
for(let e=0;e<NE;e++){ if(P.et[e]===0){ const i=P.ei[e]; if(P.eo[e]<firstRep[i]) firstRep[i]=P.eo[e]; } }
const cmCache = new Map();
function cmWithin(N, withGo){
  const key=N+'|'+withGo; if(cmCache.has(key)) return cmCache.get(key);
  const a=new Float32Array(NP); for(let i=0;i<NP;i++) a[i]=P.cm0[i];
  for(let e=0;e<NE;e++){ if(P.eo[e]<=N && (P.et[e]===0 || withGo)) a[P.ei[e]]+=P.ecm[e]; }
  cmCache.set(key,a); return a;
}
const retWithin = (i,N) => firstRep[i]<=N;
function bucketOf(d,gran){ return gran==='day'?d : gran==='week'? Math.floor((d+1)/7) : monthOfDay[d]; }
function bucketStart(b,gran){ return gran==='day'?b : gran==='week'? Math.max(0,b*7-1) : monthStart[b]; }
function bucketEnd(b,gran){ return gran==='day'?b : gran==='week'? Math.min(LAST,b*7+5) : (monthStart[b+1]!=null?monthStart[b+1]-1:LAST); }
function nBuckets(gran){ return bucketOf(LAST,gran)+1; }

/* ---------- filtry (wspólny komponent) ---------- */
function makeFilters(host, dims, state, onChange){
  host.innerHTML='';
  for(const k in dims){
    const d=dims[k]; if(!state[k]) state[k]=new Set(d.vals.map((_,i)=>i));
    const det=el('details'); const sum=el('summary');
    const pop=el('div',{class:'pop'});
    const upd=()=>{ const n=state[k].size, all=d.vals.length; det.classList.toggle('on', n<all); sum.textContent = n<all ? `${d.lab}: ${n===1?d.vals[[...state[k]][0]]:n+' z '+all}` : d.lab; };
    d.vals.forEach((v,i)=>{ const id=`f-${host.id}-${k}-${i}`; const lab=el('label',{for:id}); const cb=el('input',{type:'checkbox',id}); cb.checked=state[k].has(i);
      cb.addEventListener('change',()=>{ cb.checked?state[k].add(i):state[k].delete(i); upd(); onChange(); }); lab.append(cb, document.createTextNode(v)); pop.append(lab); });
    const acts=el('div',{class:'acts'}); const ba=el('button',{class:'btn',type:'button'},'wszystkie'), bn=el('button',{class:'btn',type:'button'},'żadne');
    ba.onclick=()=>{ d.vals.forEach((_,i)=>state[k].add(i)); $$('input',pop).forEach(c=>c.checked=true); upd(); onChange(); };
    bn.onclick=()=>{ state[k].clear(); $$('input',pop).forEach(c=>c.checked=false); upd(); onChange(); };
    acts.append(ba,bn); pop.append(acts); det.append(sum,pop); host.append(det); upd();
  }
  document.addEventListener('click',e=>{ $$('details',host).forEach(d=>{ if(!d.contains(e.target)) d.open=false; }); });
}
const passP = (i,f) => { for(const k in f){ if(!f[k].has(PDIMS[k].get(i))) return false; } return true; };
const passS = (i,f) => { for(const k in f){ if(!f[k].has(SDIMS[k].get(i))) return false; } return true; };

/* ---------- wykres liniowy SVG ---------- */
const EVENTS = [
  {d:isoDay('2025-09-07'), t:'GO do kupienia osobno (e-mail crm_go_upsell)'},
  {d:isoDay('2025-11-03'), t:'Start Meta „L4 szybko” + kod L4SZYBKO20'},
  {d:isoDay('2025-12-01'), t:'Poranne opóźnienia internisty > 10 min'},
  {d:isoDay('2026-02-09'), t:'Start TikTok „L4 w 15 min” + kod TIKTOK25'},
  {d:isoDay('2026-03-17'), t:'iOS Safari: spada krok logowania/rejestracji'},
];
function lineChart(host, o){
  // o: {xs:[day], series:[{name,color,ys:[],ns:[]}], yFmt, yMin, yMax, censorFrom, events, height, xFmt}
  host.innerHTML=''; host.classList.add('chart');
  const W=Math.max(320, host.clientWidth||800), H=o.height||300, m={l:52,r:14,t:o.events?26:10,b:26};
  const iw=W-m.l-m.r, ih=H-m.t-m.b;
  const xs=o.xs; if(!xs.length){ host.innerHTML='<p class="note">Brak danych dla tego filtra.</p>'; return; }
  const x0=o.xMin??xs[0], x1=o.xMax??xs[xs.length-1];
  let lo=o.yMin, hi=o.yMax;
  if(lo==null||hi==null){ let a=Infinity,b=-Infinity; o.series.forEach(s=>s.ys.forEach(v=>{ if(v!=null&&isFinite(v)){ a=Math.min(a,v); b=Math.max(b,v);} }));
    if(!isFinite(a)){a=0;b=1;} if(lo==null) lo=Math.min(0,a); if(hi==null) hi=b+(b-lo)*0.08; }
  if(hi===lo) hi=lo+1;
  const X=v=>m.l+(x1===x0?iw/2:(v-x0)/(x1-x0)*iw), Y=v=>m.t+ih-(v-lo)/(hi-lo)*ih;
  const ns='http://www.w3.org/2000/svg', svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`); svg.setAttribute('height',H); svg.setAttribute('role','img'); svg.setAttribute('aria-label',o.label||'wykres');
  let s='';
  // ticks y
  const nt=5, step=niceStep((hi-lo)/nt); const t0=Math.ceil(lo/step)*step;
  s+='<g class="grid">'; for(let v=t0; v<=hi+1e-9; v+=step){ s+=`<line x1="${m.l}" x2="${W-m.r}" y1="${Y(v)}" y2="${Y(v)}"/>`; } s+='</g>';
  s+='<g class="axis">'; for(let v=t0; v<=hi+1e-9; v+=step){ s+=`<text x="${m.l-8}" y="${Y(v)+4}" text-anchor="end">${o.yFmt(v)}</text>`; }
  // ticks x: miesiące
  const mFirst=monthOfDay[Math.max(0,Math.min(LAST,Math.ceil(x0)))], mLast=monthOfDay[Math.max(0,Math.min(LAST,Math.floor(x1)))];
  const span=mLast-mFirst+1, every = W<560 ? (span>12?6:3) : (span>14?3:(span>6?2:1));
  for(let mm=mFirst; mm<=mLast; mm++){ const d=monthStart[mm]; if(d<x0||d>x1) continue; if((mm)%every) continue;
    s+=`<text x="${X(d)}" y="${H-6}" text-anchor="middle">${monthLabel(mm)}</text>`; }
  s+='</g>';
  // cenzura
  if(o.censorFrom!=null && o.censorFrom<x1){ const cx=X(Math.max(x0,o.censorFrom)); s+=`<rect class="cens" x="${cx}" y="${m.t}" width="${W-m.r-cx}" height="${ih}" opacity=".7"/>`;
    if(W-m.r-cx>70) s+=`<text class="cens-t" x="${W-m.r-6}" y="${m.t+14}" text-anchor="end">okno niepełne</text>`; }
  s+=`<line class="base" x1="${m.l}" x2="${W-m.r}" y1="${Y(Math.max(lo,0))}" y2="${Y(Math.max(lo,0))}"/>`;
  // zdarzenia
  if(o.events){ s+='<g class="ev">'; o.events.forEach((e,k)=>{ if(e.d<x0||e.d>x1) return; const ex=X(e.d);
    s+=`<line x1="${ex}" x2="${ex}" y1="${m.t}" y2="${m.t+ih}"/><circle cx="${ex}" cy="${m.t-11}" r="8"/><text x="${ex}" y="${m.t-7.5}" text-anchor="middle">${k+1}</text>`; }); s+='</g>'; }
  // serie
  o.series.forEach(se=>{ let d='', pen=false; se.ys.forEach((v,j)=>{ if(v==null||!isFinite(v)){pen=false;return;} d+=(pen?'L':'M')+X(xs[j]).toFixed(1)+' '+Y(v).toFixed(1); pen=true; });
    s+=`<path d="${d}" fill="none" stroke="${se.color}" stroke-width="${se.w||2}" stroke-linejoin="round" stroke-linecap="round" ${se.dash?'stroke-dasharray="5 4"':''}/>`;
    // punkt końcowy
    for(let j=se.ys.length-1;j>=0;j--){ const v=se.ys[j]; if(v!=null&&isFinite(v)){ s+=`<circle cx="${X(xs[j])}" cy="${Y(v)}" r="3.5" fill="${se.color}" stroke="var(--surface)" stroke-width="2"/>`; break; } }
  });
  s+=`<line class="xh" x1="0" x2="0" y1="${m.t}" y2="${m.t+ih}" visibility="hidden"/>`;
  svg.innerHTML=s; host.append(svg);
  const tip=el('div',{class:'tip'}); tip.hidden=true; host.append(tip);
  const xh=svg.querySelector('.xh');
  const move=ev=>{ const r=svg.getBoundingClientRect(); const px=(ev.clientX-r.left)*W/r.width; if(px<m.l||px>W-m.r){ leave(); return; }
    const xv=x0+(px-m.l)/iw*(x1-x0); let j=0,best=1e9; xs.forEach((xx,k)=>{ const dd=Math.abs(xx-xv); if(dd<best){best=dd;j=k;} });
    xh.setAttribute('x1',X(xs[j])); xh.setAttribute('x2',X(xs[j])); xh.setAttribute('visibility','visible');
    let h=`<div class="d">${(o.xFmt||dayStr)(xs[j])}</div>`;
    o.series.forEach(se=>{ const v=se.ys[j]; h+=`<div class="r"><span><i class="swatch" style="background:${se.color}"></i>${se.name}</span><span>${o.yFmt(v,true)}${se.ns&&se.ns[j]!=null?` <span class="muted">n=${fmtInt(se.ns[j])}</span>`:''}</span></div>`; });
    const ev2=(o.events||[]).filter(e=>Math.abs(e.d-xs[j])<=(o.evTol||3)); ev2.forEach(e=>h+=`<div class="note">● ${e.t}</div>`);
    tip.innerHTML=h; tip.hidden=false; const tw=tip.offsetWidth, hx=X(xs[j])*r.width/W; tip.style.left=Math.min(Math.max(0,hx+12), r.width-tw)+'px'; tip.style.top='8px'; };
  const leave=()=>{ tip.hidden=true; xh.setAttribute('visibility','hidden'); };
  svg.addEventListener('pointermove',move); svg.addEventListener('pointerleave',leave);
}
function niceStep(x){ const p=Math.pow(10,Math.floor(Math.log10(x))), f=x/p; return (f<1.5?1:f<3?2:f<7?5:10)*p; }
function legend(host, series){ host.innerHTML=series.map(s=>`<span><i class="swatch" style="background:${s.color}"></i>${s.name}</span>`).join(''); }
function evlist(host){ host.innerHTML=EVENTS.map((e,k)=>`<span><b>${k+1}</b>${dayStr(e.d)}: ${e.t}</span>`).join(''); }
function rolling(num,den,w,minDen=20){ const n=num.length, ys=new Array(n).fill(null); let a=0,b=0; for(let j=0;j<n;j++){ a+=num[j]; b+=den[j]; if(j>=w){ a-=num[j-w]; b-=den[j-w]; } if(j>=w-1 && b>=minDen) ys[j]=a/b; } return ys; }
const redraws=[]; let rT; new ResizeObserver(()=>{ clearTimeout(rT); rT=setTimeout(()=>redraws.forEach(f=>f()),120); }).observe(document.body);
const themeObs=new MutationObserver(()=>redraws.forEach(f=>f())); themeObs.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>redraws.forEach(f=>f()));

/* ---------- silnik kohort ---------- */
function cohortSeries({filter, split, gran, metric, N, withGo, smooth}){
  const nb=nBuckets(gran), dim=split?PDIMS[split]:null, nv=dim?dim.vals.length:1;
  const num=[...Array(nv)].map(()=>new Float64Array(nb)), den=[...Array(nv)].map(()=>new Float64Array(nb));
  const cm = (metric==='cm'||metric==='cmcac') ? cmWithin(N,withGo) : null;
  for(let i=0;i<NP;i++){ if(!passP(i,filter)) continue; const g=dim?dim.get(i):0, b=bucketOf(P.cd[i],gran);
    den[g][b]++;
    if(metric==='ret') num[g][b]+= retWithin(i,N)?1:0;
    else if(metric==='cm') num[g][b]+=cm[i];
    else if(metric==='cmcac') num[g][b]+=cm[i]-P.cac[i];
    else if(metric==='refund') num[g][b]+= P.st[i]===1?1:0;
  }
  const xs=[...Array(nb)].map((_,b)=>bucketStart(b,gran));
  const needsN = metric==='ret'||metric==='cm'||metric==='cmcac';
  const series=[];
  for(let g=0; g<nv; g++){
    let tot=0; for(let b=0;b<nb;b++) tot+=den[g][b]; if(!tot) continue;
    const ok=b=> !needsN || bucketEnd(b,gran)+N<=LAST;
    let ys, ns=[...den[g]];
    if(metric==='n'){ ys=[...den[g]]; if(gran==='day'&&smooth){ const one=new Array(nb).fill(1); ys=rolling(den[g],one,7,1); } }
    else if(gran==='day'&&smooth){ const nn=num[g].map((v,b)=>ok(b)?v:0), dd=den[g].map((v,b)=>ok(b)?v:0); ys=rolling(nn,dd,7).map((v,b)=>ok(b)?v:null); }
    else { const minN = gran==='day'?5:20; ys=[...Array(nb)].map((_,b)=> ok(b)&&den[g][b]>=minN ? num[g][b]/den[g][b] : null); }
    series.push({g, name:dim?dim.vals[g]:'Wszyscy pacjenci (filtr)', ys, ns, tot});
  }
  series.sort((a,b)=>b.tot-a.tot);
  const shown=series.slice(0,8); shown.forEach(s=>s.color=css(SERIES[s.g%8]));
  const censorFrom = needsN ? LAST-N : null;
  return {xs, series:shown, hidden:series.length-shown.length, censorFrom};
}
function segmentTable({filter, split, from, to}){
  const dim=split?PDIMS[split]:PDIMS.l4, nv=dim.vals.length;
  const W=[30,90,180,365], cmA={}; W.forEach(n=>cmA[n]=cmWithin(n,true));
  const R=[...Array(nv)].map(()=>({n:0, cac:0, refund:0, promo:0, el:{}, ret:{}, cm:{}}));
  for(let i=0;i<NP;i++){ const d=P.cd[i]; if(d<from||d>to||!passP(i,filter)) continue; const r=R[dim.get(i)];
    r.n++; r.cac+=P.cac[i]; r.refund+=P.st[i]===1?1:0; r.promo+=P.di[i]===2?1:0;
    W.forEach(n=>{ if(d+n<=LAST){ r.el[n]=(r.el[n]||0)+1; r.ret[n]=(r.ret[n]||0)+(retWithin(i,n)?1:0); r.cm[n]=(r.cm[n]||0)+cmA[n][i]; } }); }
  return R.map((r,g)=>({g, name:dim.vals[g], ...r})).filter(r=>r.n>0).sort((a,b)=>b.n-a.n);
}

/* ---------- ZAKŁADKA: KOHORTY ---------- */
const CS={split:'l4', gran:'week', metric:'ret', N:90, withGo:true, smooth:true, filter:{}, from:isoDay('2025-10-01'), to:isoDay('2026-06-30')};
function renderCohorts(){
  const r=cohortSeries(CS);
  const yFmt = CS.metric==='ret'||CS.metric==='refund' ? (v=>fmtPct(v, v!=null&&Math.abs(v)<0.1?1:0)) : CS.metric==='n' ? (v=>fmtInt(v)) : (v=>fmtZl(v));
  lineChart($('#c-chart'), {xs:r.xs, series:r.series, yFmt:(v,t)=> CS.metric==='ret'||CS.metric==='refund' ? fmtPct(v,1) : yFmt(v), censorFrom:r.censorFrom, events:EVENTS, height:320,
    xFmt: d => CS.gran==='day'? dayStr(d)+(CS.smooth?' (7 dni kroczące)':'') : CS.gran==='week' ? 'Tydzień od '+dayStr(d) : 'Kohorta '+monthLabel(monthOfDay[d]), evTol: CS.gran==='day'?3:CS.gran==='week'?6:20,
    yMin: CS.metric==='cmcac'?null:0, label:'Kohorty'});
  legend($('#c-legend'), r.series);
  const mlab={ret:`% pacjentów z kolejnym zamówieniem w ≤ ${CS.N} dni`, cm:`Marża na pacjenta w ${CS.N} dni${CS.withGo?' (z opłatą GO)':''}`, cmcac:`Marża minus CAC w ${CS.N} dni`, n:'Nowi pacjenci w kohorcie', refund:'% pierwszych wizyt zakończonych zwrotem'}[CS.metric];
  $('#c-title').textContent = mlab + (CS.split?` · podział: ${PDIMS[CS.split].lab.toLowerCase()}`:'');
  $('#c-hidden').textContent = r.hidden? `Pokazano 8 największych segmentów, ukryto ${r.hidden}.` : '';
  $('#c-N').disabled = !(CS.metric==='ret'||CS.metric==='cm'||CS.metric==='cmcac');
  renderHeat(); renderSegTable();
}
function renderHeat(){
  const gran = CS.gran==='day'?'week':CS.gran, wins=[7,14,30,60,90,120,180,270,365], nb=nBuckets(gran);
  const n=new Float64Array(nb), hit=wins.map(()=>new Float64Array(nb)), elig=wins.map(()=>new Float64Array(nb));
  for(let i=0;i<NP;i++){ if(!passP(i,CS.filter)) continue; const d=P.cd[i], b=bucketOf(d,gran); n[b]++;
    wins.forEach((w,k)=>{ if(bucketEnd(b,gran)+w<=LAST){ elig[k][b]++; if(retWithin(i,w)) hit[k][b]++; } }); }
  const seq=['--seq0','--seq1','--seq2','--seq3','--seq4','--seq5','--seq6'].map(css);
  let h='<thead><tr><th>Kohorta</th><th>n</th>'+wins.map(w=>`<th>≤${w} d</th>`).join('')+'</tr></thead><tbody>';
  const rows=[...Array(nb).keys()].filter(b=>n[b]>0);
  const pick = gran==='week' ? rows.filter((b,k)=> k%2===0 || k===rows.length-1) : rows;
  pick.forEach(b=>{ const lab = gran==='week' ? dayISO(bucketStart(b,gran)).slice(2) : monthLabel(b);
    h+=`<tr><th>${lab}</th><th>${fmtInt(n[b])}</th>`;
    wins.forEach((w,k)=>{ if(!elig[k][b]){ h+='<td class="na"></td>'; return; } const v=hit[k][b]/elig[k][b]; const lvl=Math.min(6,Math.floor(v/0.05)); const dark=lvl>=4;
      h+=`<td style="background:${seq[lvl]};color:${dark?'#fff':'var(--ink)'}" title="${fmtPct(v)} z ${fmtInt(elig[k][b])}">${(v*100).toFixed(0)}</td>`; });
    h+='</tr>'; });
  $('#c-heat').innerHTML=h+'</tbody>';
  $('#c-heat-gran').textContent = gran==='week' ? 'kohorty tygodniowe (co druga)' : 'kohorty miesięczne';
}
function renderSegTable(){
  const rows=segmentTable(CS);
  const best=(k)=>Math.max(...rows.map(r=>r[k]??-1e9));
  let h=`<thead><tr><th>${(CS.split?PDIMS[CS.split]:PDIMS.l4).lab}</th><th>Pacjenci</th><th>Ret. 30 d</th><th>Ret. 90 d</th><th>Ret. 180 d</th><th>Marża 90 d</th><th>Marża 180 d</th><th>Marża 365 d</th><th>CAC</th><th>Marża 180 d − CAC</th><th>Zwrot 1. wizyty</th><th>Kod promo</th></tr></thead><tbody>`;
  rows.forEach(r=>{ const R=n=>r.el[n]?r.ret[n]/r.el[n]:null, C=n=>r.el[n]?r.cm[n]/r.el[n]:null, cac=r.cac/r.n, net=C(180)!=null?C(180)-cac:null;
    h+=`<tr><td><i class="swatch" style="background:${css(SERIES[r.g%8])}"></i>${r.name}</td><td>${fmtInt(r.n)}</td><td>${fmtPct(R(30))}</td><td>${fmtPct(R(90))}</td><td>${fmtPct(R(180))}</td>
    <td>${fmtZl(C(90))}</td><td>${fmtZl(C(180))}</td><td>${C(365)==null?'–':fmtZl(C(365))+` <span class="muted">(n=${fmtInt(r.el[365])})</span>`}</td><td>${fmtZl(cac)}</td>
    <td class="${net==null?'':net<0?'cell-bad':''}">${fmtZl(net)}</td><td class="${r.refund/r.n>0.1?'cell-bad':''}">${fmtPct(r.refund/r.n)}</td><td>${fmtPct(r.promo/r.n,0)}</td></tr>`; });
  $('#c-seg').innerHTML=h+'</tbody>';
  $('#c-seg-range').textContent=`Kohorty od ${dayStr(CS.from)} do ${dayStr(CS.to)}. Retencja i marża liczone tylko dla pacjentów z pełnym oknem obserwacji. Marża = przychód netto po zwrotach − koszt lekarza + opłaty GO. CAC = wydatki kanału w miesiącu / nowi pacjenci kanału w miesiącu (afiliacja: 25 zł).`;
}
function initCohorts(){
  const sp=$('#c-split'); sp.innerHTML='<option value="">bez podziału</option>'+Object.entries(PDIMS).map(([k,d])=>`<option value="${k}">${d.lab}</option>`).join(''); sp.value=CS.split;
  sp.onchange=()=>{CS.split=sp.value; renderCohorts();};
  const me=$('#c-metric'); me.value=CS.metric; me.onchange=()=>{CS.metric=me.value; renderCohorts();};
  const nn=$('#c-N'); nn.value=CS.N; nn.onchange=()=>{CS.N=+nn.value; renderCohorts();};
  $$('#c-gran button').forEach(b=>{ b.setAttribute('aria-pressed',b.dataset.v===CS.gran); b.onclick=()=>{ CS.gran=b.dataset.v; $$('#c-gran button').forEach(x=>x.setAttribute('aria-pressed',x===b)); renderCohorts(); }; });
  const go=$('#c-go'); go.checked=CS.withGo; go.onchange=()=>{CS.withGo=go.checked; renderCohorts();};
  const sm=$('#c-smooth'); sm.checked=CS.smooth; sm.onchange=()=>{CS.smooth=sm.checked; renderCohorts();};
  const f=$('#c-from'), t=$('#c-to'); f.value=dayISO(CS.from); t.value=dayISO(CS.to);
  f.onchange=()=>{ CS.from=Math.max(0,isoDay(f.value)); renderSegTable(); }; t.onchange=()=>{ CS.to=Math.min(LAST,isoDay(t.value)); renderSegTable(); };
  const fd={}; ['grp','ch','pu','sp','di','pc','st','dl','mo','pf','gf','ag','cs'].forEach(k=>fd[k]=PDIMS[k]);
  makeFilters($('#c-filters'), fd, CS.filter, renderCohorts);
  $$('#tab-kohorty .presets button').forEach(b=>b.onclick=()=>applyCohortPreset(b.dataset.p));
  evlist($('#c-ev'));
  redraws.push(()=>{ if(!$('#tab-kohorty').hidden) renderCohorts(); });
}
function setFilter(state, dims, k, vals){ state[k]=new Set(vals); }
function applyCohortPreset(p){
  for(const k in CS.filter) CS.filter[k]=new Set(PDIMS[k].vals.map((_,i)=>i));
  if(p==='l4'){ Object.assign(CS,{split:'l4',metric:'ret',N:90,gran:'week'}); }
  if(p==='delay'){ Object.assign(CS,{split:'dl',metric:'ret',N:90,gran:'month'}); CS.filter.grp=new Set([1,2,3,4,5]); CS.filter.sp=new Set([0]); CS.filter.st=new Set([0]); }
  if(p==='morning'){ Object.assign(CS,{split:'mo',metric:'ret',N:90,gran:'week'}); CS.filter.grp=new Set([1,2,3,4,5]); CS.filter.sp=new Set([0]); }
  if(p==='promo'){ Object.assign(CS,{split:'pc',metric:'cmcac',N:180,gran:'month'}); }
  if(p==='go'){ Object.assign(CS,{split:'gf',metric:'cm',N:180,gran:'month',withGo:true}); }
  if(p==='daily'){ Object.assign(CS,{split:'grp',metric:'n',gran:'day',smooth:true}); }
  $('#c-split').value=CS.split; $('#c-metric').value=CS.metric; $('#c-N').value=CS.N; $('#c-go').checked=CS.withGo; $('#c-smooth').checked=CS.smooth;
  $$('#c-gran button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.v===CS.gran));
  const fd={}; ['grp','ch','pu','sp','di','pc','st','dl','mo','pf','gf','ag','cs'].forEach(k=>fd[k]=PDIMS[k]);
  makeFilters($('#c-filters'), fd, CS.filter, renderCohorts); renderCohorts();
}

/* ---------- ZAKŁADKA: LEJKI ---------- */
const STEPS=['Sesja','Wybór usługi','Wybór terminu','Logowanie / konto','Start płatności','Opłacona konsultacja'];
const STEPBIT=[0,1,2,4,8,16];
const RATIOS=[{k:'1/0',lab:'sesja → wybór usługi'},{k:'2/1',lab:'usługa → termin'},{k:'3/2',lab:'termin → logowanie/konto'},{k:'4/3',lab:'konto → start płatności'},{k:'5/4',lab:'start płatności → opłacone'},{k:'5/0',lab:'sesja → opłacone (całość)'}];
const FS={split:'pf', A:[isoDay('2025-10-01'),isoDay('2026-03-16')], B:[isoDay('2026-03-17'),LAST], ratio:'3/2', gran:'week', filter:{}};
const has=(m,k)=> k===0 ? true : (m & STEPBIT[k])!==0;
function funnelCounts(filter, split, ranges){
  const dim=split?SDIMS[split]:null, nv=dim?dim.vals.length:1;
  const C=ranges.map(()=>[...Array(nv)].map(()=>new Float64Array(6)));
  for(let i=0;i<NS;i++){ const m=S.m[i]; if(m&32) continue; const d=S.d[i];
    let ri=-1; for(let r=0;r<ranges.length;r++){ if(d>=ranges[r][0]&&d<=ranges[r][1]){ri=r;break;} } if(ri<0) continue;
    if(!passS(i,filter)) continue; const g=dim?dim.get(i):0, c=C[ri][g];
    c[0]++; if(m&1)c[1]++; if(m&2)c[2]++; if(m&4)c[3]++; if(m&8)c[4]++; if(m&16)c[5]++; }
  return C;
}
function renderFunnel(){
  const [A,B]=funnelCounts(FS.filter,null,[FS.A,FS.B]).map(x=>x[0]);
  const dA=FS.A[1]-FS.A[0]+1, dB=FS.B[1]-FS.B[0]+1;
  let h='';
  STEPS.forEach((s,k)=>{ const a=A[k]/A[0], b=B[k]/B[0]; const sa=k?A[k]/A[k-1]:null, sb=k?B[k]/B[k-1]:null; const dl=k?(sb-sa):null;
    h+=`<div class="row"><div>${s}${k?`<div class="note">krok: ${fmtPct(sa,0)} → <b class="${dl<-0.02?'neg':dl>0.02?'pos':''}">${fmtPct(sb,0)}</b></div>`:''}</div>
    <div class="bars"><div class="bar a" style="width:${(a*100).toFixed(2)}%"></div><div class="bar b" style="width:${(b*100).toFixed(2)}%"></div></div>
    <div class="v">${fmtPct(a,1)} · ${fmtInt(A[k]/dA)}/d<br><span style="color:var(--s2)">${fmtPct(b,1)} · ${fmtInt(B[k]/dB)}/d</span></div></div>`; });
  $('#f-funnel').innerHTML=h;
  $('#f-ab').innerHTML=`<span><i class="swatch" style="background:var(--seq3)"></i>A: ${dayStr(FS.A[0])} – ${dayStr(FS.A[1])}</span><span><i class="swatch" style="background:var(--s2)"></i>B: ${dayStr(FS.B[0])} – ${dayStr(FS.B[1])}</span><span class="muted">% sesji, które doszły do kroku · średnio dziennie</span>`;
  renderFunnelTable(); renderFunnelTS();
}
function renderFunnelTable(){
  const dim=SDIMS[FS.split]; const [CA,CB]=funnelCounts(FS.filter,FS.split,[FS.A,FS.B]);
  let rows=dim.vals.map((v,g)=>({g,name:v,A:CA[g],B:CB[g]})).filter(r=>r.B[0]+r.A[0]>0).sort((a,b)=>b.B[0]-a.B[0]);
  const dB=FS.B[1]-FS.B[0]+1;
  let h=`<thead><tr><th>${dim.lab}</th><th>Sesje B / dzień</th>`+RATIOS.slice(0,5).map(r=>`<th>${r.lab}<br>A → B</th>`).join('')+`<th>Sesja → opłacone<br>A → B</th><th>Utracone opłacone<br>/ mies. w B</th></tr></thead><tbody>`;
  rows.forEach(r=>{ const cells=[1,2,3,4,5].map(k=>{ const a=r.A[k-1]?r.A[k]/r.A[k-1]:null, b=r.B[k-1]?r.B[k]/r.B[k-1]:null; const d=(a!=null&&b!=null)?b-a:null; const big=d!=null&&d<-0.05&&r.B[k-1]>200;
      return `<td class="${big?'cell-bad':''}">${fmtPct(a,0)} → ${fmtPct(b,0)}${d!=null?` <span class="${d<-0.02?'neg':d>0.02?'pos':'muted'}">${d>0?'+':''}${(d*100).toFixed(0)}</span>`:''}</td>`; });
    const ca=r.A[0]?r.A[5]/r.A[0]:null, cb=r.B[0]?r.B[5]/r.B[0]:null, lost=(ca!=null&&cb!=null)?(ca-cb)*r.B[0]/dB*30.4:null;
    h+=`<tr><td><i class="swatch" style="background:${css(SERIES[r.g%8])}"></i>${r.name}</td><td>${fmtInt(r.B[0]/dB)}</td>${cells.join('')}<td>${fmtPct(ca,1)} → ${fmtPct(cb,1)}</td><td class="${lost>30?'cell-bad':''}">${lost==null?'–':fmtInt(lost)}</td></tr>`; });
  $('#f-table').innerHTML=h+'</tbody>';
}
function renderFunnelTS(){
  const dim=SDIMS[FS.split], gran=FS.gran, nb=nBuckets(gran), [nk,dk]=FS.ratio.split('/').map(Number);
  const num=dim.vals.map(()=>new Float64Array(nb)), den=dim.vals.map(()=>new Float64Array(nb)), vol=new Float64Array(dim.vals.length);
  for(let i=0;i<NS;i++){ const m=S.m[i]; if(m&32) continue; if(!passS(i,FS.filter)) continue; const g=dim.get(i), b=bucketOf(S.d[i],gran);
    if(has(m,dk)){ den[g][b]++; vol[g]++; if(has(m,nk)) num[g][b]++; } }
  let order=[...vol.keys()].filter(g=>vol[g]>0).sort((a,b)=>vol[b]-vol[a]).slice(0,7);
  const series=order.map(g=>({name:dim.vals[g], color:css(SERIES[g%8]), ys: gran==='day' ? rolling(num[g],den[g],7) : [...num[g]].map((v,b)=>den[g][b]>=40?v/den[g][b]:null), ns:[...den[g]]}));
  const xs=[...Array(nb)].map((_,b)=>bucketStart(b,gran));
  lineChart($('#f-ts'),{xs,series,yFmt:v=>fmtPct(v,0),events:EVENTS,height:300,xFmt:d=>gran==='day'?dayStr(d)+' (7 dni kroczące)':'Tydzień od '+dayStr(d),evTol:gran==='day'?3:6,label:'Konwersja kroku w czasie'});
  legend($('#f-legend'),series);
  $('#f-ts-title').textContent=`Konwersja kroku „${RATIOS.find(r=>r.k===FS.ratio).lab}” w czasie · podział: ${dim.lab.toLowerCase()}`;
}
function initFunnel(){
  const sp=$('#f-split'); sp.innerHTML=Object.entries(SDIMS).map(([k,d])=>`<option value="${k}">${d.lab}</option>`).join(''); sp.value=FS.split; sp.onchange=()=>{FS.split=sp.value; renderFunnelTable(); renderFunnelTS();};
  const ra=$('#f-ratio'); ra.innerHTML=RATIOS.map(r=>`<option value="${r.k}">${r.lab}</option>`).join(''); ra.value=FS.ratio; ra.onchange=()=>{FS.ratio=ra.value; renderFunnelTS();};
  $$('#f-gran button').forEach(b=>{ b.setAttribute('aria-pressed',b.dataset.v===FS.gran); b.onclick=()=>{ FS.gran=b.dataset.v; $$('#f-gran button').forEach(x=>x.setAttribute('aria-pressed',x===b)); renderFunnelTS(); }; });
  const ids=['#f-a0','#f-a1','#f-b0','#f-b1']; const sync=()=>{ $('#f-a0').value=dayISO(FS.A[0]); $('#f-a1').value=dayISO(FS.A[1]); $('#f-b0').value=dayISO(FS.B[0]); $('#f-b1').value=dayISO(FS.B[1]); };
  sync(); ids.forEach(id=>$(id).onchange=()=>{ FS.A=[isoDay($('#f-a0').value),isoDay($('#f-a1').value)]; FS.B=[isoDay($('#f-b0').value),isoDay($('#f-b1').value)]; renderFunnel(); });
  makeFilters($('#f-filters'), SDIMS, FS.filter, renderFunnel);
  const presets={ ios:{A:['2026-01-01','2026-03-16'],B:['2026-03-17','2026-09-30'],split:'pf',ratio:'3/2'},
    l4:{A:['2025-04-01','2025-09-30'],B:['2026-04-01','2026-09-30'],split:'grp',ratio:'5/0'},
    yoy:{A:['2024-10-01','2025-09-30'],B:['2025-10-01','2026-09-30'],split:'grp',ratio:'5/0'},
    land:{A:['2025-04-01','2025-09-30'],B:['2026-04-01','2026-09-30'],split:'lp',ratio:'1/0'} };
  $$('#tab-lejki .presets button').forEach(b=>b.onclick=()=>{ const p=presets[b.dataset.p]; FS.A=p.A.map(isoDay); FS.B=p.B.map(isoDay); FS.split=p.split; FS.ratio=p.ratio; sp.value=FS.split; ra.value=FS.ratio; sync();
    for(const k in FS.filter) FS.filter[k]=new Set(SDIMS[k].vals.map((_,i)=>i)); makeFilters($('#f-filters'), SDIMS, FS.filter, renderFunnel); renderFunnel(); });
  evlist($('#f-ev'));
  redraws.push(()=>{ if(!$('#tab-lejki').hidden) renderFunnelTS(); });
}

/* ---------- ZAKŁADKA: KANAŁY ---------- */
const KS={from:isoDay('2025-10-01'), to:isoDay('2026-06-30')};
function renderChannels(){
  const nCh=CH.length, R=[...Array(nCh)].map(()=>({n:0,el90:0,ret90:0,cm90:0,el180:0,cm180:0,el365:0,cm365:0,spend:0,refund:0}));
  const c90=cmWithin(90,true), c180=cmWithin(180,true), c365=cmWithin(365,true);
  for(let i=0;i<NP;i++){ const d=P.cd[i]; if(d<KS.from||d>KS.to) continue; const r=R[P.ch[i]]; r.n++; r.refund+=P.st[i]===1?1:0;
    if(d+90<=LAST){ r.el90++; r.ret90+=retWithin(i,90)?1:0; r.cm90+=c90[i]; } if(d+180<=LAST){ r.el180++; r.cm180+=c180[i]; } if(d+365<=LAST){ r.el365++; r.cm365+=c365[i]; } }
  CH.forEach((c,k)=>{ const s=T.spend[c]; if(s) for(let d=KS.from; d<=KS.to; d++) R[k].spend+=s[d]; if(c==='affiliate') R[k].spend+=R[k].n*25; });
  const rows=CH.map((c,k)=>({k,name:CHLAB[c],...R[k]})).filter(r=>r.n>0).sort((a,b)=>b.spend-a.spend||b.n-a.n);
  let h='<thead><tr><th>Kanał</th><th>Wydatki</th><th>Nowi pacjenci</th><th>CAC</th><th>Ret. 90 d</th><th>Marża 90 d</th><th>Marża 180 d</th><th>Marża 365 d</th><th>Marża 180 d − CAC</th><th>Zwrot 1. wizyty</th></tr></thead><tbody>';
  rows.forEach(r=>{ const cac=r.n?r.spend/r.n:0, m180=r.el180?r.cm180/r.el180:null, net=m180!=null?m180-cac:null;
    h+=`<tr><td>${r.name}</td><td>${fmtZl(r.spend)}</td><td>${fmtInt(r.n)}</td><td>${fmtZl(cac)}</td><td>${fmtPct(r.el90?r.ret90/r.el90:null)}</td><td>${fmtZl(r.el90?r.cm90/r.el90:null)}</td><td>${fmtZl(m180)}</td><td>${r.el365?fmtZl(r.cm365/r.el365)+` <span class="muted">(n=${fmtInt(r.el365)})</span>`:'–'}</td><td class="${net!=null&&net<0?'cell-bad':''}">${fmtZl(net)}</td><td class="${r.refund/r.n>0.1?'cell-bad':''}">${fmtPct(r.refund/r.n)}</td></tr>`; });
  $('#k-table').innerHTML=h+'</tbody>';
  // tygodniowi nowi pacjenci wg grupy
  const nb=nBuckets('week'), num=GRP.map(()=>new Float64Array(nb));
  for(let i=0;i<NP;i++) num[chToGrp(P.ch[i])][bucketOf(P.cd[i],'week')]++;
  const xs=[...Array(nb)].map((_,b)=>bucketStart(b,'week'));
  const series=GRP.map((g,k)=>({name:g,color:css(SERIES[k]),ys:[...num[k]].map((v,b)=>b===nb-1?null:v)}));
  lineChart($('#k-chart'),{xs,series,yFmt:v=>fmtInt(v),events:EVENTS,height:300,xFmt:d=>'Tydzień od '+dayStr(d),evTol:6,label:'Nowi pacjenci tygodniowo'});
  legend($('#k-legend'),series);
  // tygodniowe wydatki
  const sp=GRP.map(()=>new Float64Array(nb));
  CH.forEach((c,k)=>{ const s=T.spend[c]; if(!s) return; for(let d=0;d<=LAST;d++) sp[chToGrp(k)][bucketOf(d,'week')]+=s[d]; });
  const s2=GRP.map((g,k)=>({name:g,color:css(SERIES[k]),ys:[...sp[k]].map((v,b)=>b===nb-1?null:v)})).filter((s,k)=>sp[k].some(v=>v>0));
  lineChart($('#k-spend'),{xs,series:s2,yFmt:v=>fmtZl(v),events:EVENTS,height:240,xFmt:d=>'Tydzień od '+dayStr(d),evTol:6,label:'Wydatki tygodniowo'});
  legend($('#k-spend-legend'),s2);
}
function initChannels(){
  const f=$('#k-from'), t=$('#k-to'); f.value=dayISO(KS.from); t.value=dayISO(KS.to);
  f.onchange=()=>{KS.from=Math.max(0,isoDay(f.value)); renderChannels();}; t.onchange=()=>{KS.to=Math.min(LAST,isoDay(t.value)); renderChannels();};
  redraws.push(()=>{ if(!$('#tab-kanaly').hidden) renderChannels(); });
}

/* ---------- ZAKŁADKA: WERDYKT ---------- */
function renderVerdict(){
  const b=T.bridge, r1=b.raw.P1, r2=b.raw.P2, c1=b.clean.P1, c2=b.clean.P2;
  const g=(a,b)=>(b/a-1), cell=(v)=>`<td class="${v<0?'neg':''}">${v>0?'+':''}${(v*100).toFixed(0)}%</td>`;
  const cm2=c=>c.cm+c.go_rev-c.spend-c.aff;
  const rows=[
    ['Nowi pacjenci (1. opłacone zamówienie)', g(r1.pac,r2.pac), g(c1.pac,c2.pac), 'Konta QA prawie nie zmieniają liczby pacjentów.'],
    ['…bez kampanii L4 (Meta + TikTok)', null, g(c1.pac_core,c2.pac_core), `Kampanie L4 dały ${fmtInt(c2.pac-c2.pac_core)} z ${fmtInt(c2.pac-c1.pac)} przyrostu nowych pacjentów.`],
    ['Zamówienia', g(r1.zam,r2.zam), g(c1.zam,c2.zam), '604 zdublowane wiersze (10–24 VI 2026) i 2 102 zamówienia testowe QA.'],
    ['Przychód z konsultacji', g(r1.przych,r2.przych), g(c1.netto,c2.netto), 'Dashboard liczy kwotę brutto. Zwroty rosną szybciej niż sprzedaż.'],
    ['Sprzedane TelemediGO', g(r1.go,r2.go), g(r1.go,r2.go), 'Liczba się zgadza, ale członek GO dostaje średnio 111 zł rabatu przy opłacie 89 zł. Więcej GO nie znaczy więcej marży.'],
    ['Marża po lekarzu (bez mediów)', null, g(c1.cm,c2.cm), 'Netto − koszt lekarza.'],
    ['Wydatki na kampanie płatne', null, g(c1.spend,c2.spend), ''],
    ['Marża po lekarzu, GO i mediach', null, g(cm2(c1),cm2(c2)), `${fmtZl(cm2(c1)/1000)} tys. → ${fmtZl(cm2(c2)/1000)} tys.`],
  ];
  let h='<thead><tr><th>Miara (X 2025 – IX 2026 vs X 2024 – IX 2025)</th><th>Dashboard</th><th>Po czyszczeniu</th><th>Skąd różnica</th></tr></thead><tbody>';
  rows.forEach(r=>{ h+=`<tr${r[0].startsWith('Marża po lekarzu, GO')?' class="hl"':''}><td>${r[0]}</td>${r[1]==null?'<td class="muted">–</td>':cell(r[1])}${cell(r[2])}<td style="white-space:normal;font-family:var(--f-body);text-align:left;color:var(--ink-2);font-size:12.5px">${r[3]}</td></tr>`; });
  h+=`<tr><td>Retencja 90 d (kohorty X 24–VI 25 vs X 25–VI 26)</td><td class="muted">–</td><td class="neg">${fmtNum(c1.ret90)}% → ${fmtNum(c2.ret90)}%</td><td style="white-space:normal;font-family:var(--f-body);text-align:left;color:var(--ink-2);font-size:12.5px">Druga połowa definicji wzrostu (lepsza retencja) idzie w przeciwną stronę.</td></tr>`;
  $('#v-bridge').innerHTML=h+'</tbody>';
  // wykres: retencja 90 d wg kohort tygodniowych: L4 vs reszta
  const r=cohortSeries({filter:{},split:'l4',gran:'week',metric:'ret',N:90});
  lineChart($('#v-ret'),{xs:r.xs,series:r.series,yFmt:v=>fmtPct(v,0),censorFrom:r.censorFrom,events:EVENTS,height:260,xFmt:d=>'Kohorta z tygodnia od '+dayStr(d),evTol:6,yMin:0,label:'Retencja 90 dni'});
  legend($('#v-ret-legend'),r.series);
  // opóźnienie rano
  const o=T.ops.delay_month, xs=o.m.map((_,k)=>monthStart[k]);
  lineChart($('#v-delay'),{xs,series:[{name:'Internista rano (6–12)',color:css('--s2'),ys:o.rano},{name:'Internista reszta dnia',color:css('--s1'),ys:o.reszta}],yFmt:v=>fmtNum(v,0)+' min',events:EVENTS,height:220,yMin:0,xFmt:d=>monthLabel(monthOfDay[d]),evTol:20,label:'Opóźnienie startu wizyty'});
  const mm=T.ops.morning_mix;
  lineChart($('#v-mix'),{xs,series:[{name:'Udział pacjentów z kampanii L4 w porannych wizytach',color:css('--s8'),ys:mm.l4camp.map(v=>v/100)}],yFmt:v=>fmtPct(v,0),events:EVENTS,height:160,yMin:0,xFmt:d=>monthLabel(monthOfDay[d]),evTol:20,label:'Udział L4'});
  const rd0=T.ops.rating_delay, ord=['< 10 min','10–20 min','20+ min'].map(b=>rd0.b.indexOf(b)); const rd={b:ord.map(k=>rd0.b[k]),n:ord.map(k=>rd0.n[k]),r:ord.map(k=>rd0.r[k]),bad:ord.map(k=>rd0.bad[k])};
  $('#v-rating').innerHTML='<thead><tr><th>Opóźnienie startu</th><th>Ocen</th><th>Średnia ocena</th><th>Oceny 1–2</th></tr></thead><tbody>'+rd.b.map((b,k)=>`<tr><td>${b}</td><td>${fmtInt(rd.n[k])}</td><td>${fmtNum(rd.r[k],2)}</td><td class="${rd.bad[k]>10?'cell-bad':''}">${fmtNum(rd.bad[k])}%</td></tr>`).join('')+'</tbody>';
}

/* ---------- nawigacja ---------- */
const inited={};
function show(id){
  $$('nav.tabs button').forEach(b=>b.setAttribute('aria-selected', b.dataset.t===id));
  $$('section.tab').forEach(s=>s.hidden = s.id!=='tab-'+id);
  if(id==='kohorty'){ if(!inited.k){ initCohorts(); inited.k=1; } renderCohorts(); }
  if(id==='lejki'){ if(!inited.f){ initFunnel(); inited.f=1; } renderFunnel(); }
  if(id==='kanaly'){ if(!inited.c){ initChannels(); inited.c=1; } renderChannels(); }
  if(id==='werdykt'){ renderVerdict(); }
  try{ localStorage.setItem('tm-tab',id); }catch(e){}
  if(location.hash.slice(1)!==id) history.replaceState(null,'','#'+id);
}
$$('nav.tabs button').forEach(b=>b.onclick=()=>{ show(b.dataset.t); window.scrollTo({top:0}); });
document.addEventListener('click',e=>{ const a=e.target.closest('[data-goto]'); if(!a) return; e.preventDefault(); const [t,p]=a.dataset.goto.split(':'); show(t); if(p){ if(t==='kohorty') applyCohortPreset(p); if(t==='lejki') $(`#tab-lejki .presets button[data-p="${p}"]`).click(); } window.scrollTo({top:0}); });
redraws.push(()=>{ if(!$('#tab-werdykt').hidden) renderVerdict(); });
$('#loading').hidden=true;
let start='werdykt'; const hsh=location.hash.slice(1); if(hsh && $('#tab-'+hsh)) start=hsh; else { try{ const s=localStorage.getItem('tm-tab'); if(s && $('#tab-'+s)) start=s; }catch(e){} }
show(start);
})().catch(e=>{ const l=document.getElementById('loading'); if(l) l.textContent='Nie udało się wczytać danych: '+e.message; console.error(e); });
