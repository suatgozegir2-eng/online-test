const L=require('./lib.js');const fs=require('fs');const html=fs.readFileSync('ref.html','utf8');
const names=['startNativeExam','openKonuWizard','openKarisikWizard','openBenimDenemelerimWizard','ndsOpenScreen','aaDirectModule','startMobileExamWithQuestions','mobileStartTopicExam','mobileStartMixedExam','mobileStartMyExam','generateReportCard','renderMobileExam','__aaLaunchDesktopExam','__aaBuildTopicExam','_openDenemeSonuc','openEndConfirm','goToBdStep2','setQuickQuestionCount'];
(async()=>{for(const dev of ['desk','mob']){const p=await L.open(dev);
 const src=await p.evaluate(n=>n.map(x=>[x,typeof window[x]==='function'?window[x].toString():null]),names);
 console.log('###',dev);
 for(const [n,s] of src){ if(!s){console.log(n.padEnd(30),'YOK');continue;}
  const idx=html.indexOf(s.slice(0,Math.min(s.length,300)));
  const line=idx<0?'(wrapper/derlenmiş)':html.slice(0,idx).split('\n').length;
  // enclosing script id
  let id='';if(idx>=0){const pre=html.slice(0,idx);const si=pre.lastIndexOf('<script');id=(pre.slice(si,si+200).match(/id="([^"]+)"/)||[])[1]||'';}
  console.log(n.padEnd(30),String(line).padEnd(8),id,'|',s.replace(/\s+/g,' ').slice(0,90));}
 await p.b.close();}})();
