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

# konuya göre parçala: bir unvan yalnızca kendi konularının parçalarını açar (sorular konular arasında paylaşılmaz)
shards = {}
for q in qs:
    shards.setdefault(q['t'], []).append(q)
blobs = {}
raw_total = 0
for tid, items in shards.items():
    raw = json.dumps(items, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    raw_total += len(raw)
    blobs[tid] = base64.b64encode(gzip.compress(raw, 9)).decode('ascii')
b64 = json.dumps(blobs, separators=(',', ':'))
raw = b'x' * raw_total
meta = {'updatedAt': d['updatedAt'], 'profiles': profiles,
        'announcementDate': d['officialScope']['announcementDate'],
        'announcementUrl': d['officialScope']['announcementUrl'],
        'legislationCutoff': d['officialScope']['legislationCutoffDate'],
        'topicNames': topic_name}
print(f'{len(qs)} soru, {len(profiles)} unvan, {len(blobs)} konu parçası | json {len(raw)/1e6:.1f} MB -> gzip+b64 {len(b64)/1e6:.1f} MB')


# ------------------------------------------------------------ soru çözüm videoları
VIDEO_TOPIC_MAP = {
    '657 sayılı Devlet Memurları Kanunu': 'kanun_657_dmk', 'Anayasa': 'gk_anayasa', '1 sayılı CBK': 'cbk_1_bolum_9',
    'İçişleri Bakanlığı Personeli GYU Yönetmeliği': 'yonetmelik_icisleri_gorevde_yukselme_unvan',
    'İçişleri Bakanlığı Personeli Atama ve Yer Değiştirme Yönetmeliği': 'yonetmelik_icisleri_atama_yer_degistirme',
    'Bilgi Edinme Hakkı Kanunu': 'kanun_4982_bilgi_edinme',
    '3071 sayılı Dilekçe Hakkının Kullanılmasına Dair Kanun': 'kanun_3071_dilekce',
    '7315 sayılı Güvenlik Soruşturması ve Arşiv Araştırması Kanunu': 'kanun_7315_guvenlik_sorusturmasi',
    '5442 sayılı İl İdaresi Kanunu': 'kanun_5442_il_idaresi',
    '3628 sayılı Mal Bildiriminde Bulunulması, Rüşvet ve Yolsuzluklarla Mücadele Kanunu': 'kanun_3628_mal_bildirimi',
    '7201 sayılı Tebligat Kanunu': 'kanun_7201_tebligat',
    'Devlet Memurları Disiplin Yönetmeliği': 'yonetmelik_devlet_memurlari_disiplin',
    'Resmi Yazışmalarda Uygulanacak Usul ve Esaslar Hakkında Yönetmelik': 'yonetmelik_resmi_yazisma',
    'Valilik ve Kaymakamlık Birimleri Teşkilat, Görev ve Çalışma Yönetmeliği': 'yonetmelik_valilik_kaymakamlik',
    'İçişleri Bakanlığı Merkez ve Taşra Teşkilatı Arşiv Hizmetleri Yönetmeliği': 'yonetmelik_icisleri_arsiv_hizmetleri',
    'Mal Bildiriminde Bulunulması Hakkında Yönetmelik': 'yonetmelik_mal_bildirimi',
}

def extract_videos(src):
    key = 'window.AA_VIDEO_SOLUTION_QUESTIONS = '
    i = src.index(key) + len(key)
    depth, instr, esc = 0, False, False
    for k in range(i, len(src)):
        c = src[k]
        if instr:
            if esc: esc = False
            elif c == '\\': esc = True
            elif c == '"': instr = False
        elif c == '"': instr = True
        elif c == '[': depth += 1
        elif c == ']':
            depth -= 1
            if depth == 0: break
    return json.loads(src[i:k + 1])

def drive_id(url):
    m = re.search(r'/file/d/([A-Za-z0-9_-]+)', url or '')
    return m.group(1) if m else ''

raw_videos = extract_videos(ref)
mp4_count = {}
for v in raw_videos:
    if v.get('siteVideoUrl'): mp4_count[v['siteVideoUrl']] = mp4_count.get(v['siteVideoUrl'], 0) + 1
videos = []
skipped = []
for v in raw_videos:
    did = drive_id(v.get('videoUrl'))
    mp4 = v.get('siteVideoUrl') or ''
    if not did and not mp4:
        skipped.append(v['id']); continue
    # aynı mp4 iki farklı kayıtta kullanılmışsa hangisinin doğru olduğu belli değil: yalnızca kayda özgü Drive bağlantısı kullanılır
    if mp4 and mp4_count[mp4] > 1 and did: mp4 = ''
    assert v['topic'] in VIDEO_TOPIC_MAP, v['topic']
    opts = [o if isinstance(o, str) else (o.get('text') or '') for o in v['options']]
    rel = v.get('relatedVideo') or {}
    videos.append({
        'id': v['id'], 't': VIDEO_TOPIC_MAP[v['topic']], 'st': v.get('subtopic', ''),
        'q': (v.get('question') or '').replace('**', ''), 'o': opts, 'a': int(v['answer']),
        'f': v.get('videoFile', ''), 'd': did, 'm': mp4,
        'r': {'t': rel.get('title', ''), 'd': drive_id(rel.get('url'))} if rel.get('url') else None,
        'n': v.get('sourceNote', ''),
    })
unknown = [v['t'] for v in videos if v['t'] not in topic_name]
assert not unknown, unknown
print(f'{len(videos)} video kaydı gömülecek (bağlantısız atlanan: {skipped}), 2 kayıtta ortak mp4 yerine Drive kullanılır')
VIDEOS_JSON = json.dumps(videos, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')

# ------------------------------------------------------- erken yapılandırma + veri
CONFIG_JS = r'''<script id="qb-config">
(function(){
  'use strict';
  /* content:// / bazı gömülü tarayıcılarda localStorage/sessionStorage SecurityError fırlatır; panel kodu bunlara korumasız yazar.
     Kullanılamıyorsa bellek içi yedek depolama kur; localStorage yedeği window.name içinde sayfa yenilemesinden sağ çıkar. */
  function usable(n){ try{ var s=window[n]; s.setItem('__qb','1'); s.removeItem('__qb'); return true; }catch(e){ return false; } }
  function shim(persist){
    var d={};
    if(persist){ try{ if(/^qbls:/.test(window.name)) d=JSON.parse(window.name.slice(5))||{}; }catch(e){} }
    function save(){ if(persist){ try{ window.name='qbls:'+JSON.stringify(d); }catch(e){} } }
    var api={
      getItem:function(k){ return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null; },
      setItem:function(k,v){ d[k]=String(v); save(); },
      removeItem:function(k){ delete d[k]; save(); },
      clear:function(){ d={}; save(); },
      key:function(i){ return Object.keys(d)[i]||null; }
    };
    Object.defineProperty(api,'length',{get:function(){ return Object.keys(d).length; }});
    return api;
  }
  window.QB_STORAGE_SHIM=[];
  var HOST=null; try{ if(window.parent&&window.parent!==window&&window.parent.QB_SWITCH) HOST=window.parent; }catch(e){}
  function hostStore(n){ try{ return HOST&&HOST[n]; }catch(e){ return null; } }
  if(!usable('localStorage')){ try{ Object.defineProperty(window,'localStorage',{value:hostStore('__QB_LS')||shim(true),configurable:true}); window.QB_STORAGE_SHIM.push('local'); }catch(e){} }
  if(!usable('sessionStorage')){ try{ Object.defineProperty(window,'sessionStorage',{value:hostStore('__QB_SS')||shim(false),configurable:true}); window.QB_STORAGE_SHIM.push('session'); }catch(e){} }

  var META=%(meta)s;
  var by={}; META.profiles.forEach(function(p){by[p.id]=p; by[p.key]=p;});
  var wanted=null;
  // öncelik: adres parçası (yedek yolda yeni seçim) > üst belgenin ilettiği seçim > ?u > kayıtlı seçim
  try{ var hm=/[#&]u=([^&]+)/.exec(location.hash); if(hm) wanted=decodeURIComponent(hm[1]); }catch(e){}
  if(!wanted&&window.QB_BOOT) wanted=window.QB_BOOT;
  try{ if(!wanted) wanted=new URLSearchParams(location.search).get('u'); }catch(e){}
  try{ if(!wanted) wanted=localStorage.getItem('qb_unvan'); }catch(e){}
  var chosen=wanted&&by[wanted]?by[wanted]:null;
  var active=chosen||META.profiles[0];
  window.QB_META=META;
  window.QB_CHOSEN=!!chosen;                 // kullanıcı bir unvan seçti mi?
  window.QB_ACTIVE=active;
  window.AA_UNVAN_ID=active.id;
  window.QB_LABEL=active.key==='vhki'?'VHKİ':active.name;
  // iframe içindeysek üst belge çerçeveyi yeniden kurar (adres/yenileme yok); tek başına açıldıysa eski yol
  window.QB_SET_UNVAN=function(id){
    try{ localStorage.setItem('qb_unvan',id); }catch(e){}
    if(HOST){ try{ HOST.QB_SWITCH(id); return; }catch(e){} }
    var p=by[id]; var key=p?p.key:id;
    try{ location.hash='u='+encodeURIComponent(key); }catch(e){}
    location.reload();
  };
})();
</script>
''' % {'meta': json.dumps(meta, ensure_ascii=False, separators=(',', ':'))}

LOADER_JS = r'''<script id="qb-data-loader">
(function(){
  'use strict';
  var nativeFetch=window.fetch.bind(window);
  // gömülü veri: { konuId: gzip+base64 parça }. Yalnızca seçili unvanın konuları paralel açılır.
  var shardsP=null;
  function shards(){
    if(shardsP) return shardsP;
    shardsP=(async function(){
      var el=document.getElementById('qb-bank');
      if(!el){ // veri sayfa sonunda: ayrıştırma bitene kadar bekle
        await new Promise(function(res){
          function chk(){ el=document.getElementById('qb-bank'); if(el) res(); }
          if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',chk,{once:true}); else chk();
        });
      }
      if(typeof DecompressionStream==='undefined') throw new Error('Tarayıcı gömülü soru bankasını açamıyor (DecompressionStream yok).');
      return JSON.parse(el.textContent);
    })();
    shardsP.catch(function(){ shardsP=null; });
    return shardsP;
  }
  async function gunzipJson(b64){
    var bin=atob(b64), buf=new Uint8Array(bin.length);
    for(var i=0;i<bin.length;i++) buf[i]=bin.charCodeAt(i);
    var s=new Response(buf).body.pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(s).text());
  }
  window.QB_BANK_READY=shards;
  var sliceP=null;
  function slice(){ return sliceP||(sliceP=slice0()); }
  async function slice0(){
    var all=await shards(), P=window.QB_ACTIVE, idx=window.QB_META.profiles.indexOf(P), names=window.QB_META.topicNames;
    var parts=await Promise.all(P.topicIds.map(function(t){ return all[t]?gunzipJson(all[t]):[]; }));
    var topics=P.topicIds.map(function(t){return {id:t,name:names[t],profiles:[P.id]};});
    var out=[];
    parts.forEach(function(list){
      list.forEach(function(q){
        if(q.p.indexOf(idx)<0) return;
        var n=names[q.t], o={id:q.id,topicId:q.t,konu:n,topic:n,altKonu:q.a,text:q.x,options:q.o,
          answer:q.c,correct_answer:q.c,solution:q.s,profiles:[P.id]};
        if(q.v) o.visual=q.v; if(q.ov) o.optionVisuals=q.ov; if(q.d) o.difficulty=q.d;
        out.push(o);
      });
    });
    var prof={}; prof[P.id]={name:P.name,topicIds:P.topicIds,officialQuestionCounts:P.counts,officialTotalQuestions:P.total};
    return {topics:topics,profiles:prof,questions:out,contents:[]};
  }
  window.QB_SLICE=slice;
  var EMPTY_CONTENT={topics:[],contents:[],cards:[],items:[],profiles:{}};
  // JSON.stringify + parse maliyetini atla: json() doğrudan nesne döndürür
  function json(o){
    return {ok:true,status:200,statusText:'OK',url:'',redirected:false,type:'basic',bodyUsed:false,
      headers:new Headers({'Content-Type':'application/json; charset=utf-8','X-QB-Embedded':'1'}),
      json:function(){return Promise.resolve(o);},
      text:function(){return Promise.resolve(JSON.stringify(o));},
      clone:function(){return json(o);}};
  }
  window.QB_JSON=json;
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
     'panelName: "AdaletSen Akademi Online Çözümlü Soru Bankası",')
sub1('head exams', r'exams: \["VHKİ"\],', 'exams: [window.QB_LABEL],')

# tüm bloklardaki "fallback" profilleri çalışma anındakiyle değiştir
html = html.replace("'icisleri_vhki')", "window.AA_UNVAN_ID)")

# egm unvan görünüm yaması (21056)
sub1('egm display const',
     r'var UNVAN="VHKİ",PROFILE="icisleri_vhki",PANEL_NAME="İçişleri Bakanlığı VHKİ Hazırlık Paneli",',
     'var UNVAN=window.QB_LABEL,PROFILE=window.AA_UNVAN_ID,PANEL_NAME="AdaletSen Akademi Online Çözümlü Soru Bankası",')

# deneme motoru (23555): unvan, plan, toplam soru, süre
sub1('deneme const',
     r'var UNVAN="VHKİ", PROFILE="icisleri_vhki", PANEL_NAME="İçişleri Bakanlığı VHKİ Hazırlık Paneli";',
     'var UNVAN=window.QB_LABEL, PROFILE=window.AA_UNVAN_ID, PANEL_NAME="AdaletSen Akademi Online Çözümlü Soru Bankası";')
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

# Mevzuat/Sunum/ders içerikleri bu üründe yok; bu betikler her soruda yinelemeli norm() çağırıp açılışı dondurur
DEAD_SCRIPTS = ['aa-alt-konu-baslik-duzeltme-v1', 'aa-alt-konu-baslik-final-v2', 'aa-sunum-json-only-v1', 'aa-template-engine-v9', 'ag-script', 'aa-video-single-question-script']
removed = 0
for sid in DEAD_SCRIPTS:
    html, n = re.subn(r'<script id="%s">.*?</script>' % re.escape(sid), '', html, count=1, flags=re.S)
    removed += n
    if n == 0: print('UYARI: betik bulunamadı ->', sid)
report['işlevsiz betik kaldırıldı'] = removed

# bu üründe işlevsiz dış bağımlılıklar: pdf.js (Mevzuat PDF görüntüleyici) ve oyun merkezi liderlik tablosu (WordPress'e bağlanır)
html, n1 = re.subn(r'<script src="https://cdnjs\.cloudflare\.com/ajax/libs/pdf\.js/[^"]*"></script>\s*', '', html, count=1)
html, n2 = re.subn(r'<script>\s*\(function\(\)\{\s*var W=\{cdnjs:.*?</script>\s*', '', html, count=1, flags=re.S)
html, n3 = re.subn(r'<script>\(\(\)=>\{\s*const names=\{all:\'Genel Türkiye Sıralaması\'.*?</script>\s*', '', html, count=1, flags=re.S)
report['pdf.js + liderlik tablosu kaldırıldı'] = (n1, n2, n3)
if (n1, n2, n3) != (1, 1, 1): print('UYARI: dış bağımlılık yamaları tam uygulanmadı', (n1, n2, n3))

# izleme betiğini çıkar (yeni ürün)
html, n = re.subn(r'<script>\s*window\.GA4_MEASUREMENT_ID.*?</script>', '', html, count=1, flags=re.S)
report['GA4 çıkarıldı'] = n

# ---------------------------------------------- kabuk: eski gizle, yenisi ekle
shell_dir = os.path.join(HERE, 'shell')
shell_css = open(os.path.join(shell_dir, 'shell.css'), encoding='utf-8').read()
shell_html = open(os.path.join(shell_dir, 'shell.html'), encoding='utf-8').read()
shell_js = open(os.path.join(shell_dir, 'shell.js'), encoding='utf-8').read()
video_css = open(os.path.join(shell_dir, 'video.css'), encoding='utf-8').read()
video_js = open(os.path.join(shell_dir, 'video.js'), encoding='utf-8').read()

# charset ilk 1024 bayt içinde olmalı (content:// ile açılan dosyalarda kodlama tahmini bozulmasın)
head_inject = '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + CONFIG_JS + LOADER_JS
html = html.replace('<head>', '<head>\n' + head_inject, 1)

# panelin eski açılış ekranını kaldır (betikleri eleman yoksa sessizce çıkar)
html, n = re.subn(r'<div id="aaStartupLoader".*?<!-- /aaStartupLoader -->', '', html, count=1, flags=re.S)
report['eski açılış ekranı kaldırıldı'] = n
html = html.replace("document.title=PANEL_NAME+' | AdaletSen Akademi';", "document.title=PANEL_NAME;")
html = re.sub(r'<title>.*?</title>', '', html, flags=re.S)
html = html.replace('</head>', '<title>AdaletSen Akademi · Online Çözümlü Soru Bankası</title>\n<style id="qb-shell-css">\n' + shell_css + '\n' + video_css + '\n</style>\n</head>', 1)
html = html.replace('<body>', '<body>\n' + shell_html, 1)
idx = html.rindex('</body>')
FAST_JS = '<script id="qb-fast-fetch">\n/* Panelin veri yönlendiricisi (aa-master-data-router) her açılışta tüm soruyu tekrar süzüp JSON\'a çevirir.\n   Dilim zaten unvana göre hazır olduğundan, soru isteğini yönlendiriciden önce karşılar; sıralama bilgisini aynen yayınlar. */\n(function(){\n  \'use strict\';\n  var routerFetch=window.fetch;\n  function normName(v){\n    return String(v||\'\').replace(/İ/g,\'i\').replace(/I/g,\'i\').toLocaleLowerCase(\'tr\').normalize(\'NFD\').replace(/[̀-ͯ]/g,\'\')\n      .replace(/ğ/g,\'g\').replace(/ü/g,\'u\').replace(/ş/g,\'s\').replace(/ı/g,\'i\').replace(/ö/g,\'o\').replace(/ç/g,\'c\').replace(/[^a-z0-9]+/g,\' \').replace(/\\s+/g,\' \').trim();\n  }\n  function publishOrder(P){\n    var labels=P.topicIds.map(function(id){return window.QB_META.topicNames[id];});\n    window.AA_MASTER_TOPIC_ORDER_IDS=P.topicIds.slice();\n    window.AA_MASTER_TOPIC_ORDER=labels;\n    window.AA_MASTER_TOPIC_ORDER_SOURCE=\'question\';\n    var rank={}; labels.forEach(function(l,i){rank[normName(l)]=i;});\n    window.AA_SORT_TOPIC_LABELS=function(inp){\n      return (Array.isArray(inp)?inp.slice():[]).sort(function(a,b){\n        var ra=rank[normName(a)], rb=rank[normName(b)];\n        if(ra===undefined&&rb===undefined) return 0; if(ra===undefined) return 1; if(rb===undefined) return -1; return ra-rb;\n      });\n    };\n    window.AA_SORT_TOPICS=window.AA_SORT_TOPIC_LABELS;\n  }\n  window.fetch=async function(input,init){\n    var u=typeof input===\'string\'?input:(input&&input.url)||\'\';\n    if(/sorularicislerixx\\.json$/.test(u.split(\'#\')[0].split(\'?\')[0])){\n      var m=await window.QB_SLICE(), P=window.QB_ACTIVE;\n      publishOrder(P);\n      window.AA_MASTER_LAST_QUESTION_STATS={profile:P.id,total:m.questions.length,filtered:m.questions.length};\n      return window.QB_JSON(m.questions);\n    }\n    return routerFetch.apply(this,arguments);\n  };\n})();\n</script>\n'
html = html[:idx] + FAST_JS + '<script id="qb-bank" type="application/x-qb-gzip-base64">' + b64 + '</script>\n<script id="qb-videos" type="application/json">' + VIDEOS_JSON + '</script>\n<script id="qb-shell-js">\n' + shell_js + '\n' + video_js + '\n</script>\n' + html[idx:]

# iç sayfa (tek başına da açılır; testler için isteğe bağlı kaydedilir)
if os.environ.get('QB_PAGE_OUT'):
    open(os.environ['QB_PAGE_OUT'], 'w', encoding='utf-8').write(html)

# kapsayıcı: iç sayfa metin olarak saklanır, iframe(srcdoc) içinde çalışır
assert '\ue000' not in html, 'kaçış belirteci sayfada zaten var'
page_txt = html.replace('</script', '</scr\ue000ipt').replace('<!--', '<!\ue000--')
host = open(os.path.join(shell_dir, 'host.html'), encoding='utf-8').read()
plist = json.dumps([{'id': p['id'], 'key': p['key']} for p in profiles], ensure_ascii=False, separators=(',', ':'))
host = host.replace('/*PROFILES*/[]/*END*/', plist)
host = host.replace('/*PAGE*/', page_txt)
open(out_path, 'w', encoding='utf-8').write(host)
print('yama raporu:', report)
print('yazıldı:', out_path, f'{len(host)/1e6:.1f} MB')
