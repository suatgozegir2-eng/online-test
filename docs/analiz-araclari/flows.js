const L=require('./lib.js');
const fs=require('fs');
const cov={};   // key: source -> Set of executed function-range [start,end]
function addCov(entries){for(const e of entries){ if(!e.source)continue; const k=e.source.length+':'+e.source.slice(0,120);
  cov[k]=cov[k]||{src:e.source,ranges:[]};
  for(const f of e.functions)for(const r of f.ranges)if(r.count>0)cov[k].ranges.push([r.startOffset,r.endOffset,f.functionName]);}}
async function answer(p,n,mobile){
  for(let i=0;i<n;i++){
    const sel=mobile?'#mobileQuestionContainer .aa-answer-letter':'#questionContainer .q-card.aa-cur .aa-answer-letter';
    const els=await p.$$(sel);
    if(els.length){ try{await els[i%Math.min(5,els.length)].click({timeout:2000});}catch(e){console.log(' ans click fail',e.message.slice(0,60));}}
    await p.waitForTimeout(250);
    const nx=mobile?await p.$('#mobileQuestionContainer >> text=Sonraki'):await p.$('text=Sonraki');
    if(nx){try{await nx.click({timeout:1500});}catch(e){}}
    await p.waitForTimeout(250);
  }
}
async function finish(p,mobile,tag){
  const fin=mobile?'.mexam-icon-finish':'.exam-btn.finish';
  await p.click(fin).catch(e=>console.log(' finish click fail',e.message.slice(0,80)));await p.waitForTimeout(500);
  await p.click('#endConfirmModal >> text=/Evet|Sonuçlarımı Göster/').catch(e=>console.log(' confirm fail',e.message.slice(0,80)));await p.waitForTimeout(1500);
  console.log(' result:',await L.vis(p));
  await p.screenshot({path:`f_${tag}_result.png`});
}
exports.run=async function(){
 const results={};
 for(const dev of ['desk','mob']){
  const mobile=dev==='mob';
  for(const mod of (process.env.MODS||'topic,mixed,myexams').split(',')){
   const tag=dev+'_'+mod;console.log('==',tag);
   const p=await L.open(dev);
   await p.coverage.startJSCoverage({resetOnNavigation:false});
   try{
    if(!mobile){
      await p.evaluate(m=>aaDirectModule(m),mod);await p.waitForTimeout(1000);
      if(mod==='topic'){await p.click('#konuList >> text=İdare Hukuku');await p.waitForTimeout(300);await p.evaluate(()=>setQuickQuestionCount(10));await p.click('#startExamBtn');}
      if(mod==='mixed'){await p.click('#karisikWizardOverlay .aa-mixed-topic-btn >> nth=0');await p.waitForTimeout(300);await p.click('#karisikWizardOverlay >> text=Karışık Testi Başlat');}
      if(mod==='myexams'){await p.evaluate(()=>{});await p.click('#benimDenemelerimOverlay >> text=Sınavı Başlat');}
    } else {
      const sec=mod==='myexams'?'exam':'test';
      await p.tap('#aaMobileApp .aa-tab[data-aa-section="'+sec+'"]');await p.waitForTimeout(400);
      await p.tap('#aaMobileApp .aa-module-card[data-aa-route="'+mod+'"]');await p.waitForTimeout(1200);
      if(mod==='topic'){await p.tap('#m-screen-topic .altkonu-item, #m-screen-topic [class*=alt] >> nth=0').catch(()=>{});await p.tap('#m-screen-topic >> text=Başlat');}
      if(mod==='mixed'){await p.tap('#m-screen-mixed >> text=Anayasa Hukuku');await p.waitForTimeout(300);await p.tap('#m-screen-mixed >> text=Başlat');}
      if(mod==='myexams'){await p.tap('#m-screen-myexams >> text=Denemeyi Başlat');}
    }
    await p.waitForTimeout(1200);
    console.log(' after start:',await L.vis(p));
    // preflight?
    const pre=await p.$('#aaTestPreflight.open');
    if(pre){console.log(' preflight open');await p.screenshot({path:`f_${tag}_pre.png`});
      const b=await p.$('#aaTestPreflight >> text=/Başlat/');if(b){await b.click().catch(e=>console.log(' pre click fail'));await p.waitForTimeout(1500);}}
    console.log(' exam:',await L.vis(p));
    await p.screenshot({path:`f_${tag}_exam.png`});
    await answer(p,4,mobile);
    await p.screenshot({path:`f_${tag}_exam2.png`});
    await finish(p,mobile,tag);
   }catch(e){console.log(' FLOW ERR',e.message.slice(0,200));try{await p.screenshot({path:`f_${tag}_err.png`})}catch(_){}}
   console.log(' pageerrors:',p.errs);
   addCov(await p.coverage.stopJSCoverage());
   await p.b.close();
  }}
 fs.writeFileSync('cov_'+(process.env.MODS||'all')+'.json',JSON.stringify(Object.values(cov)));
};
if(require.main===module)exports.run();
