#!/usr/bin/env python3
"""Referans panel HTML'ine soru bankası JSON'unu (gzip+base64) gömer.

Kullanım:
  python3 -I tools/embed_bank.py <panel.html> <soru_bankasi.json> <cikti.html> [profil]
Varsayılan profil: icisleri_vhki
"""
import base64, gzip, json, re, sys

html_path, json_path, out_path = sys.argv[1:4]
PROFILE = sys.argv[4] if len(sys.argv) > 4 else 'icisleri_vhki'

d = json.load(open(json_path, encoding='utf-8'))
prof = d['profiles'][PROFILE]
tids = set(prof['topicIds'])

KEEP = ['id', 'topicId', 'konu', 'topic', 'altKonu', 'text', 'options', 'answer',
        'correct_answer', 'solution', 'visual', 'optionVisuals', 'visualPresentation',
        'difficulty', 'questionType', 'sourceArticle']
qs = []
for q in d['questions']:
    if PROFILE in q.get('profiles', []) and q['topicId'] in tids:
        o = {k: q[k] for k in KEEP if k in q}
        o['profiles'] = [PROFILE]
        qs.append(o)

topics = []
for t in d['topics']:
    if t['id'] in tids:
        topics.append({'id': t['id'], 'name': t['name'], 'profiles': [PROFILE]})
order = {t: i for i, t in enumerate(prof['topicIds'])}
topics.sort(key=lambda t: order[t['id']])

master = {
    'schemaVersion': d['schemaVersion'], 'updatedAt': d['updatedAt'],
    'topics': topics,
    'profiles': {PROFILE: {k: prof[k] for k in ('name', 'topicIds', 'officialQuestionCounts', 'officialTotalQuestions') if k in prof}},
    'questions': qs,
}
raw = json.dumps(master, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
b64 = base64.b64encode(gzip.compress(raw, 9)).decode('ascii')
print(f'{PROFILE}: {len(qs)} soru, {len(topics)} konu, json {len(raw)/1e6:.1f} MB, gzip+b64 {len(b64)/1e6:.1f} MB')

LOADER = r'''<!-- AA GÖMÜLÜ SORU BANKASI: %(n)d soru, profil=%(p)s, kaynak güncelleme=%(u)s -->
<script id="aa-embedded-bank-loader">
(function(){
  'use strict';
  var KEY='sorularicislerixx.json';
  var promise=null, nativeFetch=window.fetch.bind(window);
  function decode(){
    if(promise) return promise;
    promise=(async function(){
      var el=document.getElementById('aa-embedded-bank');
      if(!el||typeof DecompressionStream==='undefined') throw new Error('gömülü veri çözülemedi');
      var bin=atob(el.textContent.trim()), buf=new Uint8Array(bin.length);
      for(var i=0;i<bin.length;i++) buf[i]=bin.charCodeAt(i);
      var stream=new Response(buf).body.pipeThrough(new DecompressionStream('gzip'));
      return JSON.parse(await new Response(stream).text());
    })();
    promise.catch(function(){ promise=null; });
    return promise;
  }
  window.AA_EMBEDDED_BANK_READY=decode;
  window.fetch=async function(input,init){
    var u=typeof input==='string'?input:(input&&input.url)||'';
    if(u.split('#')[0].split('?')[0].slice(-KEY.length)===KEY){
      try{
        var data=await decode();
        return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json; charset=utf-8','X-AA-Embedded':'1'}});
      }catch(e){ console.warn('[AA] Gömülü soru bankası kullanılamadı, ağdan çekiliyor:',e); }
    }
    return nativeFetch(input,init);
  };
})();
</script>
''' % {'n': len(qs), 'p': PROFILE, 'u': d['updatedAt']}

html = open(html_path, encoding='utf-8').read()
html = re.sub(r'<script id="aa-embedded-bank[^>]*>.*?</script>\s*', '', html, flags=re.S)
html = re.sub(r'<!-- AA GÖMÜLÜ SORU BANKASI[^\n]*\n<script id="aa-embedded-bank-loader">.*?</script>\n', '', html, flags=re.S)

# yükleyici ve veri <head>'in hemen başına (panel soruyu head ayrıştırılırken ister)
m = re.search(r'<head>', html)
assert m, '<head> bulunamadı'
data_tag = '<script id="aa-embedded-bank" type="application/x-aa-gzip-base64">' + b64 + '</script>\n'
html = html[:m.end()] + '\n' + LOADER + data_tag + html[m.end():]

# çözüm metni zaten HTML ise formatSolution bozmasın (iki tanım var)
GUARD = 'if (/<(?:b|br|i|strong|em|ul|ol|li|p)\\b/i.test(text)) return text;'
pat = re.compile(r'(function formatSolution\(text\) \{\n\s*text = \(typeof aaSafeText === "function"\) \? aaSafeText\(text\) : \(text == null \? "" : String\(text\)\);\n\s*if \(!text\) return "";\n)')
html, n = pat.subn(lambda mm: mm.group(1) + '    ' + GUARD + '\n', html)
print('formatSolution koruması eklendi:', n)

open(out_path, 'w', encoding='utf-8').write(html)
print('yazıldı:', out_path, f'{len(html)/1e6:.1f} MB')
