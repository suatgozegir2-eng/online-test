const L=require('./lib.js');const fs=require('fs');
(async()=>{const out=[];
for(const dev of ['desk','mob']){
 const p=await L.open(dev); // lib.open loads page already; need coverage from start -> reimplement quick
 await p.b.close();
}
const {chromium}=require('playwright');
for(const dev of ['desk','mob']){
 const b=await chromium.launch();const m=dev==='mob';
 const ctx=await b.newContext({viewport:m?{width:390,height:844}:{width:1440,height:900},isMobile:m,hasTouch:m});
 const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('sorularicislerixx'))return r.fulfill({path:'q.json',contentType:'application/json',headers:{'access-control-allow-origin':'*'}});
  if(u.includes('icerikicislerixx')||u.includes('ezberkartlar'))return r.fulfill({body:'{"topics":[],"contents":[],"profiles":{"icisleri_vhki":{"topicIds":[]}}}',contentType:'application/json',headers:{'access-control-allow-origin':'*'}});
  if(u.startsWith('file:'))return r.continue(); return r.abort();});
 p.on('dialog',d=>d.dismiss());
 await p.coverage.startJSCoverage({resetOnNavigation:false});
 await p.goto('file://'+process.cwd()+'/ref.html');await p.waitForTimeout(4500);
 const c=await p.coverage.stopJSCoverage();
 for(const e of c){if(!e.source)continue;const r=[];for(const f of e.functions)for(const x of f.ranges)if(x.count>0)r.push([x.startOffset,x.endOffset,f.functionName]);out.push({dev,src:e.source,ranges:r});}
 await b.close();}
fs.writeFileSync('base.json',JSON.stringify(out));})();
