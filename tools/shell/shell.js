/* Kurumsal kabuk: unvan seçimi, mod kartları, konu listesi, ilerleme. Modüller panelin kendisidir. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var META = window.QB_META, ACTIVE = window.QB_ACTIVE, CHOSEN = window.QB_CHOSEN;
  var TYPES = { gorevde_yukselme: 'Görevde Yükselme Sınavı', unvan_degisikligi: 'Unvan Değişikliği Sınavı' };
  var nf = new Intl.NumberFormat('tr-TR');
  var root = $('qb-app');
  var toastT;

  function toast(msg) {
    var t = $('qbToast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---- unvan seçici ---- */
  function buildSelect() {
    var sel = $('qbSelect'), html = '';
    if (!CHOSEN) html += '<option value="" selected disabled>Unvan seçin…</option>';
    Object.keys(TYPES).forEach(function (t) {
      var list = META.profiles.filter(function (p) { return p.type === t; });
      if (!list.length) return;
      html += '<optgroup label="' + esc(TYPES[t]) + '">' + list.map(function (p) {
        return '<option value="' + esc(p.id) + '"' + (CHOSEN && p.id === ACTIVE.id ? ' selected' : '') + '>' + esc(p.name) + '</option>';
      }).join('') + '</optgroup>';
    });
    sel.innerHTML = html;
    sel.addEventListener('change', function () { if (sel.value) window.QB_SET_UNVAN(sel.value); });
    $('qbWho').addEventListener('click', function () {
      sel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(function () { sel.focus(); }, 350);
    });
  }

  /* ---- özet + konu listesi ---- */
  function renderSummary() {
    $('qbWhoV').textContent = CHOSEN ? ACTIVE.name : 'Seçilmedi';
    root.classList.toggle('is-unchosen', !CHOSEN);
    if (!CHOSEN) return;
    $('qbSumType').textContent = TYPES[ACTIVE.type] || '';
    $('qbSumName').textContent = ACTIVE.name;
    $('qbSumQ').textContent = nf.format(ACTIVE.questions);
    $('qbSumT').textContent = ACTIVE.topicIds.length;
    $('qbSumE').textContent = ACTIVE.total;
    $('qbProg').hidden = false;
    $('qbModesNote').textContent = ACTIVE.name + ' için çalışma modunu seçin.';
    $('qbTopicsNote').textContent = ACTIVE.name + ' resmî sınavında yer alan konular ve soru bankasındaki soru sayıları.';
    $('qbSrc').innerHTML = 'Kaynak: <a href="' + esc(META.announcementUrl) + '" target="_blank" rel="noopener">İçişleri Bakanlığı sınav duyurusu</a> (' + esc(META.announcementDate) +
      ') · Mevzuat tarihi: ' + esc(META.legislationCutoff);
  }

  function renderTopics() {
    if (!CHOSEN) return;
    var rows = ACTIVE.topicIds.map(function (id, i) {
      var have = ACTIVE.avail[id] || 0, off = ACTIVE.counts[id] || 0;
      return '<tr><td class="n">' + (i + 1) + '</td><td>' + esc(META.topicNames[id]) + '</td>' +
        '<td class="r">' + (off ? '<b>' + off + '</b> soru' : '—') + '</td>' +
        (have ? '<td class="r">' + nf.format(have) + '</td>' : '<td class="r soon">Hazırlanıyor</td>') + '</tr>';
    }).join('');
    $('qbTopics').innerHTML = rows;
    var miss = ACTIVE.topicIds.filter(function (id) { return !(ACTIVE.avail[id] || 0); });
    var gap = $('qbGap');
    if (miss.length) {
      gap.hidden = false;
      gap.textContent = 'Bu unvanda ' + miss.length + ' konunun soru bankası henüz hazırlanıyor. Deneme oluştururken eksik konuların soruları, unvanın diğer konularından tamamlanır.';
    } else gap.hidden = true;
  }

  /* ---- ilerleme (yerel kayıt, yalnızca seçili unvanın soruları) ---- */
  function renderProgress() {
    if (!CHOSEN || typeof window.getUserData !== 'function' || !window.db || !window.db.sorular) return;
    var ans = window.getUserData().answers || {}, ok = 0, no = 0;
    window.db.sorular.forEach(function (q) { var a = ans[q.id]; if (a === 'correct') ok++; else if (a === 'wrong') no++; });
    var solved = ok + no, total = window.db.sorular.length || 1;
    $('qbPSolved').textContent = nf.format(solved) + ' / ' + nf.format(total);
    $('qbPOk').textContent = nf.format(ok); $('qbPNo').textContent = nf.format(no);
    $('qbPBar').style.width = Math.min(100, solved / total * 100).toFixed(1) + '%';
    $('qbPPct').textContent = solved ? '%' + Math.round(ok / solved * 100) + ' başarı' : '%0';
  }

  /* ---- modları aç: panelin kendi giriş fonksiyonları ---- */
  var READY = false;
  function setEnabled(on) {
    READY = on;
    [].forEach.call(root.querySelectorAll('.qb-card'), function (b) { b.disabled = !CHOSEN || (!on && b.getAttribute('data-mode') !== 'video'); });
  }
  function launch(mode) {
    if (!CHOSEN) { toast('Önce unvanınızı seçin.'); $('qbSelect').focus(); return; }
    if (mode === 'video') { if (window.QB_OPEN_VIDEOS) window.QB_OPEN_VIDEOS(); return; }
    if (!READY) { toast('Soru bankası yükleniyor, lütfen bekleyin.'); return; }
    var mobile = window.innerWidth <= 900;
    try {
      if (mode === 'topic') mobile ? window.ndsOpenScreen('topic') : window.openKonuWizard();
      else if (mode === 'mixed') mobile ? window.ndsOpenScreen('mixed') : window.openKarisikWizard();
      else if (mode === 'myexams') mobile ? window.ndsOpenScreen('myexams') : window.openBenimDenemelerimWizard();
    } catch (e) { console.error('Mod açılamadı', e); toast('Mod açılamadı. Sayfayı yenileyip tekrar deneyin.'); }
  }
  [].forEach.call(root.querySelectorAll('.qb-card'), function (b) {
    b.addEventListener('click', function () { launch(b.getAttribute('data-mode')); });
  });

  function hideSplash() {
    var sp = $('qb-splash'); if (!sp || sp.classList.contains('done')) return;
    sp.classList.add('done'); setTimeout(function () { if (sp.parentNode) sp.parentNode.removeChild(sp); }, 450);
  }
  function questionsReady() {
    var ok = !!(window.db && window.db.sorular && window.db.sorular.length && typeof window.openKonuWizard === 'function');
    setEnabled(ok); if (ok) { renderProgress(); hideSplash(); }
    return ok;
  }
  // yedek: bir şey ters giderse açılış ekranı sonsuza dek kalmasın, hata görünsün
  setTimeout(function () {
    if (!READY) { var m = $('qbSpMsg'); if (m) m.textContent = 'Yükleme beklenenden uzun sürüyor… Sayfayı yenileyin ya da farklı bir tarayıcıda (Chrome) açın.'; }
  }, 12000);
  window.addEventListener('aa:questions-loaded', function () { setTimeout(questionsReady, 50); });
  window.addEventListener('aa:questions-error', function () { toast('Soru bankası yüklenemedi.'); });
  var tries = 0, iv = setInterval(function () { if (questionsReady() || ++tries > 120) clearInterval(iv); }, 250);
  // sınavdan dönünce ilerlemeyi tazele
  setInterval(function () { if (!document.hidden) renderProgress(); }, 2000);
  document.addEventListener('visibilitychange', renderProgress);

  /* ---- panelin sabit "VHKİ" metinleri: seçili unvan adıyla değiştir (sabit + sonradan üretilen) ---- */
  if (window.QB_LABEL && window.QB_LABEL !== 'VHKİ') {
    var RE = /VHKİ/g, LABEL = window.QB_LABEL, pend = false;
    var sweep = function (node) {
      if (!node) return;
      if (node.nodeType === 3) { if (node.nodeValue.indexOf('VHKİ') > -1) node.nodeValue = node.nodeValue.replace(RE, LABEL); return; }
      if (node.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA)$/.test(node.tagName)) return;
      var w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null), n, list = [];
      while ((n = w.nextNode())) if (n.nodeValue.indexOf('VHKİ') > -1) list.push(n);
      list.forEach(function (t) { t.nodeValue = t.nodeValue.replace(RE, LABEL); });
    };
    var queue = [];
    new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        if (m.type === 'characterData') queue.push(m.target);
        else m.addedNodes.forEach(function (a) { queue.push(a); });
      });
      if (!pend) { pend = true; setTimeout(function () { pend = false; var q = queue; queue = []; q.forEach(sweep); }, 60); }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
    sweep(document.body);
  }

  buildSelect(); renderSummary(); renderTopics(); setEnabled(false);
  document.documentElement.lang = 'tr';
})();
