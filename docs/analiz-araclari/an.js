const fs=require('fs');const html=fs.readFileSync('ref.html','utf8');
const key=s=>s.length+':'+s.slice(0,120);
const base={};for(const e of JSON.parse(fs.readFileSync('base.json')))(base[key(e.src)]=base[key(e.src)]||new Set()),e.ranges.forEach(r=>base[key(e.src)].add(r[0]+'-'+r[1]));
const flow={};
for(const f of ['cov.json','cov_myexams.json'])for(const e of JSON.parse(fs.readFileSync(f))){const k=key(e.src);flow[k]=flow[k]||{src:e.src,set:new Map()};e.ranges.forEach(r=>flow[k].set.set(r[0]+'-'+r[1],r[2]));}
const rows=[];
for(const k in flow){const {src,set}=flow[k];const b=base[k]||new Set();
 const names=new Set();let nb=0;for(const [rk,fn] of set){if(!b.has(rk)){nb++;if(fn)names.add(fn);}}
 const idx=html.indexOf(src);const line=idx<0?-1:html.slice(0,idx).split('\n').length;
 const id=(html.slice(Math.max(0,idx-200),idx).match(/<script[^>]*id="([^"]+)"[^>]*>\s*$/)||[])[1]||'';
 rows.push({line,len:src.length,newRanges:nb,names:[...names].slice(0,14),id});}
rows.sort((a,b)=>a.line-b.line);
fs.writeFileSync('rows.json',JSON.stringify(rows,null,1));
for(const r of rows)if(r.newRanges>0)console.log(r.line,r.id||'-',`len=${r.len}`,`new=${r.newRanges}`,r.names.join(','));
console.log('total scripts',rows.length,'used in flows',rows.filter(r=>r.newRanges>0).length);
