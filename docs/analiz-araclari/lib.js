const {chromium}=require('playwright');
exports.open=async function(name){
 const vp=name==='mob'?{width:390,height:844}:{width:1440,height:900};
 const b=await chromium.launch();
 const ctx=await b.newContext({viewport:vp,isMobile:name==='mob',hasTouch:name==='mob'});
 const p=await ctx.newPage();
 p.errs=[];p.on('pageerror',e=>p.errs.push(e.message.slice(0,200)));
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('sorularicislerixx'))return r.fulfill({path:'q.json',contentType:'application/json',headers:{'access-control-allow-origin':'*'}});
  if(u.includes('icerikicislerixx')||u.includes('ezberkartlar'))return r.fulfill({body:'{"topics":[],"contents":[],"profiles":{"icisleri_vhki":{"topicIds":[]}}}',contentType:'application/json',headers:{'access-control-allow-origin':'*'}});
  if(u.startsWith('file:'))return r.continue(); return r.abort();});
 p.on('dialog',d=>{console.log('DIALOG',d.message().slice(0,100));d.dismiss()});
 await p.goto('file://'+process.cwd()+'/ref.html');
 await p.waitForTimeout(4500);
 p.b=b;return p;
};
// görünür, ekranı kaplayan katmanlar
exports.vis=async function(p){return p.evaluate(()=>{
 const out=[];document.querySelectorAll('body *').forEach(el=>{
  const cs=getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0)return;
  const r=el.getBoundingClientRect();
  if((cs.position==='fixed'||/screen|overlay|wizard/i.test(el.id+el.className))&&r.width>innerWidth*0.5&&r.height>innerHeight*0.4&&el.id)out.push(el.id+'['+cs.position+' z'+cs.zIndex+']');});
 return out.join(' | ');});};
