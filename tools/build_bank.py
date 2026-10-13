#!/usr/bin/env python3
"""Referans VHKİ panelinden çok unvanlı "Online Soru Bankası" HTML'i üretir.

Kullanım:
  python3 -I tools/build_bank.py <referans_panel.html> <soru_bankasi.json> <cikti.html>

Yaptıkları:
  1. 20 unvanın tüm soruları kompakt gzip+base64 olarak HTML'e gömülür.
  2. Seçili unvan (?u=... ya da localStorage) çalışma anında panelin beklediği
     "master" biçimine dilimlenip panele verilir; ağ isteği çıkmaz.
  3. Panelde VHKİ'ye sabit yazılı yerler (profil, plan, süre, metinler) yapılandırmadan okunur.
  4. Eski kabuklar gizlenir, yerine tools/shell/ altındaki kurumsal ana sayfa konur.
"""
import base64, gzip, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ref_path, json_path, out_path = sys.argv[1:4]

d = json.load(open(json_path, encoding='utf-8'))
ref = open(ref_path, encoding='utf-8').read()

# ---------------------------------------------------------------- veri
pids = list(d['profiles'].keys())
pidx = {p: i for i, p in enumerate(pids)}
topic_name = {t['id']: t['name'] for t in d['topics']}

profiles = []
for pid in pids:
    p = d['profiles'][pid]
    av = d['availability']['profileTopicQuestionCounts'][pid]
    profiles.append({
        'id': pid, 'name': p['name'], 'key': p['shortKey'], 'type': p['examType'],
        'topicIds': p['topicIds'],
        'counts': p['officialQuestionCounts'],
        'total': p['officialTotalQuestions'],
        'avail': {t: av.get(t, 0) for t in p['topicIds']},
        'questions': d['stats']['profiles'][pid]['questions'],
    })

qs = []
for q in d['questions']:
    o = {
        'id': q['id'], 't': q['topicId'], 'a': q.get('altKonu') or '',
        'x': q['text'], 'o': [q['options'][k] for k in sorted(q['options'])],
        'c': q.get('correct_answer') or q['answer'], 's': q.get('solution') or '',
        'p': sorted(pidx[p] for p in q['profiles'] if p in pidx),
    }
    if q.get('visual'): o['v'] = q['visual']
    if q.get('optionVisuals'): o['ov'] = q['optionVisuals']
    if q.get('difficulty'): o['d'] = q['difficulty']
    qs.append(o)

bank = {'topics': topic_name, 'questions': qs}
raw = json.dumps(bank, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
b64 = base64.b64encode(gzip.compress(raw, 9)).decode('ascii')
meta = {'updatedAt': d['updatedAt'], 'profiles': profiles,
        'announcementDate': d['officialScope']['announcementDate'],
        'announcementUrl': d['officialScope']['announcementUrl'],
        'legislationCutoff': d['officialScope']['legislationCutoffDate'],
        'topicNames': topic_name}
print(f'{len(qs)} soru, {len(profiles)} unvan | json {len(raw)/1e6:.1f} MB -> gzip+b64 {len(b64)/1e6:.1f} MB')

# ------------------------------------------------------- erken yapılandırma + veri
CONFIG_JS = r'''<script id="qb-config">
(function(){
  'use strict';
  var META=%(meta)s;
  var by={}; META.profiles.forEach(function(p){by[p.id]=p; by[p.key]=p;});
  var wanted=null;
  try{ wanted=new URLSearchParams(location.search).get('u'); }catch(e){}
  try{ if(!wanted) wanted=localStorage.getItem('qb_unvan'); }catch(e){}
  var chosen=wanted&&by[wanted]?by[wanted]:null;
  var active=chosen||META.profiles[0];
  window.QB_META=META;
  window.QB_CHOSEN=!!chosen;                 // kullanıcı bir unvan seçti mi?
  window.QB_ACTIVE=active;
  window.AA_UNVAN_ID=active.id;
  window.QB_LABEL=active.key==='vhki'?'VHKİ':active.name;
  window.QB_SET_UNVAN=function(id){
    try{ localStorage.setItem('qb_unvan',id); }catch(e){}
    try{ var u=new URL(location.href); u.searchParams.delete('u'); location.href=u.toString(); }catch(e){ location.reload(); }
  };
})();
</script>
''' % {'meta': json.dumps(meta, ensure_ascii=False, separators=(',', ':'))}

LOADER_JS = r'''<script id="qb-data-loader">
(function(){
  'use strict';
  var nativeFetch=window.fetch.bind(window), bankP=null;
  function bank(){
    if(bankP) return bankP;
    bankP=(async function(){
      var el=document.getElementById('qb-bank');
      if(!el||typeof DecompressionStream==='undefined') throw new Error('Tarayıcı gömülü soru bankasını açamıyor (DecompressionStream yok).');
      var bin=atob(el.textContent.trim()), buf=new Uint8Array(bin.length);
      for(var i=0;i<bin.length;i++) buf[i]=bin.charCodeAt(i);
      var s=new Response(buf).body.pipeThrough(new DecompressionStream('gzip'));
      return JSON.parse(await new Response(s).text());
    })();
    bankP.catch(function(){ bankP=null; });
    return bankP;
  }
  window.QB_BANK_READY=bank;
  // seçili unvana ait dilim: panelin beklediği master biçimi
  async function slice(){
    var b=await bank(), P=window.QB_ACTIVE, idx=window.QB_META.profiles.indexOf(P);
    var tids={}; P.topicIds.forEach(function(t){tids[t]=1;});
    var topics=P.topicIds.map(function(t){return {id:t,name:b.topics[t],profiles:[P.id]};});
    var out=[];
    b.questions.forEach(function(q){
      if(q.p.indexOf(idx)<0||!tids[q.t]) return;
      var n=b.topics[q.t], o={id:q.id,topicId:q.t,konu:n,topic:n,altKonu:q.a,text:q.x,options:q.o,
        answer:q.c,correct_answer:q.c,solution:q.s,profiles:[P.id]};
      if(q.v) o.visual=q.v; if(q.ov) o.optionVisuals=q.ov; if(q.d) o.difficulty=q.d;
      out.push(o);
    });
    var prof={}; prof[P.id]={name:P.name,topicIds:P.topicIds,officialQuestionCounts:P.counts,officialTotalQuestions:P.total};
    return {topics:topics,profiles:prof,questions:out,contents:[]};
  }
  var EMPTY_CONTENT={topics:[],contents:[],cards:[],items:[],profiles:{}};
  function json(o){ return new Response(JSON.stringify(o),{status:200,headers:{'Content-Type':'application/json; charset=utf-8','X-QB-Embedded':'1'}}); }
  window.fetch=async function(input,init){
    var u=typeof input==='string'?input:(input&&input.url)||'';
    u=u.split('#')[0].split('?')[0];
    if(/sorularicislerixx\.json$/.test(u)) return json(await slice());
    // ders/ezber içerikleri bu üründe yok: ağa çıkma
    if(/icerikicislerixx\.json$|ezberkartlaricisleri\.json$/.test(u)) return json(EMPTY_CONTENT);
    return nativeFetch(input,init);
  };
})();
</script>
'''

# ------------------------------------------------------------ referansı yamala
html = ref
report = {}

def sub1(name, pat, repl, flags=0, count=1):
    global html
    html, n = re.subn(pat, repl, html, count=count, flags=flags)
    report[name] = n
    if n == 0:
        print('UYARI: yama uygulanmadı ->', name)

# profil sabitleri (head)
sub1('head fixedProfile', r'fixedProfile: "icisleri_vhki",', 'fixedProfile: window.AA_UNVAN_ID,')
sub1('head activeProfile', r'window\.AA_ACTIVE_PROFILE = "icisleri_vhki";', 'window.AA_ACTIVE_PROFILE = window.AA_UNVAN_ID;')
sub1('head panelName', r'panelName: "İçişleri Bakanlığı VHKİ Hazırlık Paneli",',
     'panelName: "İçişleri Bakanlığı " + window.QB_LABEL + " Online Soru Bankası",')
sub1('head exams', r'exams: \["VHKİ"\],', 'exams: [window.QB_LABEL],')

# tüm bloklardaki "fallback" profilleri çalışma anındakiyle değiştir
html = html.replace("'icisleri_vhki')", "window.AA_UNVAN_ID)")

# egm unvan görünüm yaması (21056)
sub1('egm display const',
     r'var UNVAN="VHKİ",PROFILE="icisleri_vhki",PANEL_NAME="İçişleri Bakanlığı VHKİ Hazırlık Paneli",',
     'var UNVAN=window.QB_LABEL,PROFILE=window.AA_UNVAN_ID,PANEL_NAME="İçişleri Bakanlığı "+window.QB_LABEL+" Online Soru Bankası",')

# deneme motoru (23555): unvan, plan, toplam soru, süre
sub1('deneme const',
     r'var UNVAN="VHKİ", PROFILE="icisleri_vhki", PANEL_NAME="İçişleri Bakanlığı VHKİ Hazırlık Paneli";',
     'var UNVAN=window.QB_LABEL, PROFILE=window.AA_UNVAN_ID, PANEL_NAME="İçişleri Bakanlığı "+window.QB_LABEL+" Online Soru Bankası";')
sub1('deneme total',
     r'var EXAM_TOTAL=80, DEFAULT_DURATION_MIN=120, PLAN_VERSION=PROFILE\+\'_resmi_duyuru_2026_v4\';',
     "var EXAM_TOTAL=window.QB_ACTIVE.total, DEFAULT_DURATION_MIN=Math.round(EXAM_TOTAL*1.5), PLAN_VERSION=PROFILE+'_resmi_duyuru_2026_v4';")
sub1('deneme plan', r'var PLAN=\[\{"no":1,"topicId":"gy_turkce".*?\}\];\n',
     "var PLAN=window.QB_ACTIVE.topicIds.map(function(id,i){var n=window.QB_META.topicNames[id];return {no:i+1,topicId:id,label:n,count:window.QB_ACTIVE.counts[id]||0,topics:[n]};});\n",
     flags=re.S)
sub1('deneme title2', r'Ek-5’teki 80 soruluk', 'Ek-5/Ek-6’daki \'+EXAM_TOTAL+\' soruluk')

# deneme motoru bloğunda sabit 80/120 -> EXAM_TOTAL / DEFAULT_DURATION_MIN
m = re.search(r'<script id="aa-egm-deneme-modulleri-final-v2">.*?</script>', html, flags=re.S)
blk = m.group(0)
nb = blk
nb = nb.replace("'Standart deneme: 80 soru · 120 dakika'", "'Standart deneme: '+EXAM_TOTAL+' soru · '+DEFAULT_DURATION_MIN+' dakika'")
nb = nb.replace("alert('Seçili kriterde 80 soru yok. 80 soruluk standart deneme için soru havuzu kriterini genişletin.')",
                "alert('Seçili kriterde '+EXAM_TOTAL+' soru yok. '+EXAM_TOTAL+' soruluk standart deneme için soru havuzu kriterini genişletin.')")
nb = nb.replace("md.value=120", "md.value=DEFAULT_DURATION_MIN")
nb = nb.replace("var mins=120;", "var mins=DEFAULT_DURATION_MIN;")
nb = nb.replace("durationMinutes:120", "durationMinutes:DEFAULT_DURATION_MIN")
nb = nb.replace("Sınav süresi panel standardı olarak 120 dakikadır.", "Sınav süresi panel standardı olarak '+DEFAULT_DURATION_MIN+' dakikadır.")
html = html.replace(blk, nb)
report['deneme 80/120 yamaları'] = len(re.findall(r'\b(?:80|120)\b', blk)) - len(re.findall(r'\b(?:80|120)\b', nb))

# deneme dağılımı: soru bankasında eksik konu varsa diğer konulardan tamamla
sub1('deneme eksik doldur',
     r"if\(out\.length<total\)\{window\.AA_DENEME_DAGILIM_EKSIK=\(window\.AA_DENEME_DAGILIM_EKSIK_KONULAR\|\|\[\]\);return\[\];\}",
     "if(out.length<total){window.AA_DENEME_DAGILIM_EKSIK=(window.AA_DENEME_DAGILIM_EKSIK_KONULAR||[]);var rest=shuffle(unusedPool(src,used)).slice(0,total-out.length);markUsed(rest,used);out=out.concat(rest);if(out.length<total)return[];}")

# çözüm metni zaten HTML ise formatSolution bozmasın
GUARD = 'if (/<(?:b|br|i|strong|em|ul|ol|li|p)\\b/i.test(text)) return text;'
pat = re.compile(r'(function formatSolution\(text\) \{\n\s*text = \(typeof aaSafeText === "function"\) \? aaSafeText\(text\) : \(text == null \? "" : String\(text\)\);\n\s*if \(!text\) return "";\n)')
html, n = pat.subn(lambda mm: mm.group(1) + '    ' + GUARD + '\n', html)
report['formatSolution'] = n

# eski mobil "karışık" tıklama yakalayıcısı: metni "karışık" içeren her butonu çalıp eski mk33 ekranını açar
sub1('mk33 yakalayıcı kapat',
     r"if\(e\.target && e\.target\.closest && e\.target\.closest\('#aaMobileApp'\)\) return;",
     "return; /* qb: eski karışık yakalayıcı devre dışı */")

# izleme betiğini çıkar (yeni ürün)
html, n = re.subn(r'<script>\s*window\.GA4_MEASUREMENT_ID.*?</script>', '', html, count=1, flags=re.S)
report['GA4 çıkarıldı'] = n

# ---------------------------------------------- kabuk: eski gizle, yenisi ekle
shell_dir = os.path.join(HERE, 'shell')
shell_css = open(os.path.join(shell_dir, 'shell.css'), encoding='utf-8').read()
shell_html = open(os.path.join(shell_dir, 'shell.html'), encoding='utf-8').read()
shell_js = open(os.path.join(shell_dir, 'shell.js'), encoding='utf-8').read()

head_inject = CONFIG_JS + LOADER_JS + '<script id="qb-bank" type="application/x-qb-gzip-base64">' + b64 + '</script>\n'
html = html.replace('<head>', '<head>\n' + head_inject, 1)
html = re.sub(r'<title>.*?</title>', '', html, flags=re.S)
html = html.replace('</head>', '<title>İçişleri Bakanlığı Online Soru Bankası</title>\n<style id="qb-shell-css">\n' + shell_css + '\n</style>\n</head>', 1)
html = html.replace('<body>', '<body>\n' + shell_html, 1)
idx = html.rindex('</body>')
html = html[:idx] + '<script id="qb-shell-js">\n' + shell_js + '\n</script>\n' + html[idx:]

open(out_path, 'w', encoding='utf-8').write(html)
print('yama raporu:', report)
print('yazıldı:', out_path, f'{len(html)/1e6:.1f} MB')
