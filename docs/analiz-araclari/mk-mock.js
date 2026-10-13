// Referans HTML'deki resmî deneme planından (PLAN) sahte soru havuzu üretir -> q.json
// Kullanım: node mk-mock.js ref.html
const fs=require('fs');const h=fs.readFileSync(process.argv[2]||'ref.html','utf8');
const i=h.indexOf('var PLAN=[')+9;let d=0,k=i;for(;k<h.length;k++){if(h[k]=='[')d++;if(h[k]==']'){d--;if(!d)break;}}
const PLAN=JSON.parse(h.slice(i,k+1));const topics=[],qs=[];
PLAN.forEach(r=>{topics.push({id:r.topicId,name:r.label,profiles:['icisleri_vhki']});
 for(let a=0;a<3;a++)for(let n=0;n<12;n++)qs.push({id:r.topicId+'_'+a+'_'+n,topicId:r.topicId,konu:r.label,altKonu:r.label+' Alt '+(a+1),text:r.label+' alt '+(a+1)+' soru '+(n+1),options:['A1','B2','C3','D4','E5'],answer:n%5,solution:'Doğru Cevap: '+'ABCDE'[n%5]});});
fs.writeFileSync('q.json',JSON.stringify({topics,profiles:{icisleri_vhki:{name:'VHKİ',topicIds:topics.map(t=>t.id)}},questions:qs,contents:[]}));
