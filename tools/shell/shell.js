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
  }
  function focusUnvan() {
    closeDrawer(); goHome();
    var sel = $('qbSelect');
    setTimeout(function () { try { sel.focus(); } catch (e) {} }, 120);
  }

  /* ---- özet + konu listesi ---- */
  var TOPICS_OPEN = false, vidInfo = null;
  function renderSummary() {
    $('qbWhoV').textContent = CHOSEN ? ACTIVE.name : 'Seçilmedi';
    $('qbDUnvanV').textContent = CHOSEN ? ACTIVE.name : 'Seçilmedi';
    root.classList.toggle('is-unchosen', !CHOSEN);
    if (!CHOSEN) return;
    $('qbHeroMeta').textContent = (TYPES[ACTIVE.type] || '') + ' · ' + ACTIVE.total + ' soruluk deneme';
    $('qbSumQ').textContent = nf.format(ACTIVE.questions);
    $('qbSumT').textContent = ACTIVE.topicIds.length;
    $('qbSumE').textContent = ACTIVE.total;
    $('qbProg').hidden = false; renderExam();
    $('qbModesNote').textContent = 'Çalışma modunu seçin.';
    $('qbTopicsNote').textContent = 'Resmî sınavda yer alan ' + ACTIVE.topicIds.length + ' konu ve soru bankasındaki soru sayıları.';
    $('qbSrc').innerHTML = 'Kaynak: <a href="' + esc(META.announcementUrl) + '" target="_blank" rel="noopener">İçişleri Bakanlığı sınav duyurusu</a> (' + esc(META.announcementDate) + ')';
  }
  function renderVideoInfo() {
    vidInfo = typeof window.QB_VIDEO_INFO === 'function' ? window.QB_VIDEO_INFO() : null;
    var n = vidInfo ? vidInfo.total : 0;
    $('qbSumV').textContent = CHOSEN ? n : '—';
    $('qbDVid').textContent = n ? String(n) : '';
    var cont = $('qbCont');
    if (vidInfo && vidInfo.resume) { cont.hidden = false; $('qbContT').textContent = vidInfo.resume.topic + ' · Video ' + vidInfo.resume.n + '/' + vidInfo.resume.of; }
    else cont.hidden = true;
    [].forEach.call(root.querySelectorAll('[data-mode="video"]'), function (b) { b.hidden = !!(CHOSEN && !n); });
  }

  function renderTopics() {
    var list = $('qbTopics'), more = $('qbMore');
    if (!CHOSEN) return;
    var rows = ACTIVE.topicIds.map(function (id, i) {
      var have = ACTIVE.avail[id] || 0, off = ACTIVE.counts[id] || 0;
      return '<li><span class="qb-tn">' + (i + 1) + '</span><span class="qb-tt">' + esc(META.topicNames[id]) + '</span><span class="qb-tm">' +
        (have ? '<b>' + nf.format(have) + '</b> soru' : '<span class="soon">Hazırlanıyor</span>') + (off ? '<span>sınavda ' + off + '</span>' : '') + '</span></li>';
    });
    list.innerHTML = rows.join('');
    var LIM = 6, mobile = window.innerWidth <= 900;
    if (mobile && rows.length > LIM && !TOPICS_OPEN) {
      [].forEach.call(list.children, function (li, i) { li.hidden = i >= LIM; });
      more.hidden = false; more.textContent = 'Tüm konuları göster (' + rows.length + ')';
    } else {
      more.hidden = !(mobile && rows.length > LIM); more.textContent = 'Daha az göster';
    }
    var miss = ACTIVE.topicIds.filter(function (id) { return !(ACTIVE.avail[id] || 0); });
    var gap = $('qbGap');
    if (miss.length) {
      gap.hidden = false;
      gap.textContent = 'Bu unvanda ' + miss.length + ' konunun soru bankası henüz hazırlanıyor. Deneme oluştururken eksik konuların soruları, unvanın diğer konularından tamamlanır.';
    } else gap.hidden = true;
  }
  $('qbMore').addEventListener('click', function () { TOPICS_OPEN = !TOPICS_OPEN; renderTopics(); });
  window.addEventListener('resize', function () { renderTopics(); });

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
    var w = 0, f = 0;
    try { w = window.getWrongQuestions(window.db.sorular).length; f = window.getFavoriteQuestions(window.db.sorular).length; } catch (e) {}
    $('qbWrongN').textContent = w ? w + ' soru' : 'Henüz yok'; $('qbFavN').textContent = f ? f + ' soru' : 'Henüz yok';
    $('qbDWrong').textContent = w ? String(w) : ''; $('qbDFav').textContent = f ? String(f) : '';
    renderGoal();
  }

  /* ---- günlük hedef: bugün yanıtlanan soru sayısı (bu cihazda) ---- */
  var GOALS = [10, 20, 30, 50, 100];
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function dayCount() { var r = lsGet('qb_daily', null); return r && r.d === today() ? (r.n | 0) : 0; }
  function goalN() { var g = Number(lsGet('qb_goal', 20)); return GOALS.indexOf(g) > -1 ? g : 20; }
  function renderGoal() {
    var n = dayCount(), g = goalN();
    $('qbGoalV').textContent = n + ' / ' + g; $('qbGoalN').textContent = g;
    $('qbGoalBar').style.width = Math.min(100, n / g * 100) + '%';
    $('qbGoal').classList.toggle('done', n >= g);
  }
  $('qbGoalEdit').addEventListener('click', function () {
    var g = goalN(); lsSet('qb_goal', GOALS[(GOALS.indexOf(g) + 1) % GOALS.length]); renderGoal();
  });
  (function () {
    var old = window.recordQuestionResult;
    if (typeof old !== 'function') return;
    window.recordQuestionResult = function (id, result) {
      var r = old.apply(this, arguments);
      if (id && (result === 'correct' || result === 'wrong')) { lsSet('qb_daily', { d: today(), n: dayCount() + 1 }); renderGoal(); }
      return r;
    };
  })();

  /* ---- sınav tarihi (küçük bilgi) ---- */
  var EXAM_DATE = { y: 2026, m: 11, d: 28 }, EXAM_TIME = { gorevde_yukselme: '10.00', unvan_degisikligi: '14.00' };
  function renderExam() {
    var el = $('qbExam'); if (!CHOSEN) { el.hidden = true; return; }
    var t0 = new Date(); t0.setHours(0, 0, 0, 0);
    var days = Math.round((new Date(EXAM_DATE.y, EXAM_DATE.m - 1, EXAM_DATE.d) - t0) / 86400000);
    if (days < 0) { el.hidden = true; return; }
    el.hidden = false;
    el.textContent = (days === 0 ? 'Sınav bugün' : days === 1 ? 'Sınava 1 gün kaldı' : 'Sınava ' + days + ' gün kaldı') + ' · 28 Kasım 2026' + (EXAM_TIME[ACTIVE.type] ? ', ' + EXAM_TIME[ACTIVE.type] : '');
  }

  /* ---- çekmece menü ---- */
  var drawerOpen = false, drawerOpener = null;
  function openDrawer() {
    drawerOpen = true; drawerOpener = document.activeElement;
    var d = $('qbDrawer'); d.classList.add('open'); d.setAttribute('aria-hidden', 'false');
    $('qbScrim').classList.add('open'); $('qbBurger').setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('qb-drawer-open');
    setTimeout(function () { var c = d.querySelector('[data-a="drawer-close"]'); if (c) c.focus(); }, 60);
  }
  function closeDrawer(noFocus) {
    if (!drawerOpen) return; drawerOpen = false;
    var d = $('qbDrawer'); d.classList.remove('open'); d.setAttribute('aria-hidden', 'true');
    $('qbScrim').classList.remove('open'); $('qbBurger').setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('qb-drawer-open');
    if (!noFocus && drawerOpener && drawerOpener.focus) { try { drawerOpener.focus(); } catch (e) {} }
  }
  $('qbBurger').addEventListener('click', openDrawer);
  $('qbScrim').addEventListener('click', function () { closeDrawer(); });

  /* ---- sayfa içi gezinme (adres/geçmiş değişmez) ---- */
  function setActive(name) {
    [].forEach.call(root.querySelectorAll('[data-go]'), function (b) {
      if (b.classList.contains('qb-brand') || b.classList.contains('qb-dunvan')) return;
      var on = b.getAttribute('data-go') === name && (name === 'home' || name === 'progress' || name === 'topics');
      if (b.classList.contains('qb-di') || b.classList.contains('qb-tab') || b.parentNode.classList.contains('qb-dnav')) b.classList.toggle('on', on && (name === 'home' ? true : b.classList.contains('qb-di')));
    });
  }
  function scrollToEl(el) {
    if (!el) return;
    var bar = root.querySelector('.qb-bar'), off = (bar ? bar.offsetHeight : 0) + 10;
    var y = el.getBoundingClientRect().top + window.pageYOffset - off;
    try { window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' }); } catch (e) { window.scrollTo(0, Math.max(0, y)); }
  }
  function goHome() { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); } setActive('home'); }
  function aboutOpen() {
    var s = [], bd = $('qbAboutBody');
    s.push('<dl>');
    s.push('<dt>Uygulama</dt><dd>AdaletSen Akademi<br>Çözümlü Videolu Online Soru Bankası</dd>');
    if (CHOSEN) s.push('<dt>Unvan</dt><dd>' + esc(ACTIVE.name) + '</dd>');
    var allQ = META.profiles.reduce(function (n, p) { return n + (p.questions || 0); }, 0);
    s.push('<dt>Soru bankası</dt><dd>' + META.profiles.length + ' unvan' + (allQ ? ' · toplam ' + nf.format(allQ) + ' soru kaydı' : '') + '</dd>');
    s.push('<dt>Sınav tarihi</dt><dd>28 Kasım 2026 (yazılı). Görevde Yükselme 10.00, Unvan Değişikliği 14.00. Kesin bilgi için resmî duyuruya bakın.</dd>');
    if (META.updatedAt) s.push('<dt>Güncelleme</dt><dd>' + esc(META.updatedAt) + '</dd>');
    if (META.legislationCutoff) s.push('<dt>Mevzuat tarihi</dt><dd>' + esc(META.legislationCutoff) + '</dd>');
    if (META.announcementUrl) s.push('<dt>Kaynak</dt><dd><a href="' + esc(META.announcementUrl) + '" target="_blank" rel="noopener">İçişleri Bakanlığı sınav duyurusu</a>' + (META.announcementDate ? ' (' + esc(META.announcementDate) + ')' : '') + '</dd>');
    s.push('</dl><p style="margin:14px 0 0;color:#7a8394;font-size:12.5px">İlerlemeniz yalnızca bu cihazda saklanır.</p>');
    bd.innerHTML = s.join('');
    $('qbAbout').hidden = false;
    var c = $('qbAbout').querySelector('.qb-sheet-h .qb-ib'); if (c) c.focus();
  }
  function aboutClose() { $('qbAbout').hidden = true; }

  function act(name) {
    closeDrawer(true);
    if (name === 'home') goHome();
    else if (name === 'progress') { if (!CHOSEN) return toast('Önce unvanınızı seçin.'); scrollToEl($('qbSummary')); }
    else if (name === 'topics') { if (!CHOSEN) return toast('Önce unvanınızı seçin.'); scrollToEl($('qbTopicsSec')); }
    else if (name === 'unvan') { focusUnvan(); }
    else if (name === 'about') aboutOpen();
  }

  /* ---- modları aç: panelin kendi giriş fonksiyonları ---- */
  var READY = false;
  function setEnabled(on) {
    READY = on;
    [].forEach.call(root.querySelectorAll('.qb-card, .qb-qk'), function (b) { b.disabled = !CHOSEN || (!on && b.getAttribute('data-mode') !== 'video'); });
  }
  function launch(mode) {
    closeDrawer(true);
    if (!CHOSEN) { toast('Önce unvanınızı seçin.'); focusUnvan(); return; }
    if (mode === 'video') { if (window.QB_OPEN_VIDEOS) window.QB_OPEN_VIDEOS(); return; }
    if (!READY) { toast('Soru bankası yükleniyor, lütfen bekleyin.'); return; }
    var mobile = window.innerWidth <= 900;
    if (mode === 'wrong' || mode === 'fav') {
      var list = [];
      try { list = (mode === 'wrong' ? window.getWrongQuestions : window.getFavoriteQuestions)(window.db.sorular); } catch (e) {}
      if (!list.length) { toast(mode === 'wrong' ? 'Henüz yanlış çözdüğünüz soru yok.' : 'Henüz favorilere eklediğiniz soru yok.'); return; }
      try {
        if (mobile) window.ndsOpenScreen(mode === 'wrong' ? 'wrong' : 'favorites');
        else (mode === 'wrong' ? window.startWrongQuestionsExam : window.startFavoriteQuestionsExam)();
      } catch (e) { console.error('Mod açılamadı', e); toast('Mod açılamadı. Sayfayı yenileyip tekrar deneyin.'); }
      return;
    }
    try {
      if (mode === 'topic') mobile ? window.ndsOpenScreen('topic') : window.openKonuWizard();
      else if (mode === 'mixed') mobile ? window.ndsOpenScreen('mixed') : window.openKarisikWizard();
      else if (mode === 'myexams') mobile ? window.ndsOpenScreen('myexams') : window.openBenimDenemelerimWizard();
    } catch (e) { console.error('Mod açılamadı', e); toast('Mod açılamadı. Sayfayı yenileyip tekrar deneyin.'); }
  }
  root.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-mode],[data-go],[data-a]') : null;
    if (!t || !root.contains(t) || t.id === 'qbCont') return;
    var m = t.getAttribute('data-mode'), g = t.getAttribute('data-go'), a = t.getAttribute('data-a');
    if (m) { e.preventDefault(); launch(m); }
    else if (g) { e.preventDefault(); act(g); }
    else if (a === 'drawer-close') closeDrawer();
    else if (a === 'about-close') aboutClose();
  });
  $('qbWho').addEventListener('click', focusUnvan);
  $('qbCont').addEventListener('click', function () { launch('video'); });
  window.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!$('qbAbout').hidden) { aboutClose(); e.stopPropagation(); }
    else if (drawerOpen) { closeDrawer(); e.stopPropagation(); }
  }, true);
  window.addEventListener('qb:video-changed', renderVideoInfo);

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

  /* ---- mobil sihirbazlardaki "Geri" eski paneldeki ana ekrana dönmeye çalışır; bizde ana sayfaya dönmek = üstteki katmanı kapatmak ---- */
  (function () {
    var old = window.mobileNav;
    window.mobileNav = function (screen) {
      if (screen === 'topic' || screen === 'mixed' || screen === 'myexams') return typeof old === 'function' ? old.apply(this, arguments) : undefined;
      if (typeof window.ndsCloseScreen === 'function') { try { window.ndsCloseScreen(); return; } catch (e) {} }
      return typeof old === 'function' ? old.apply(this, arguments) : undefined;
    };
  })();

  /* ---- bir katman (sınav, sihirbaz, sonuç...) açıkken arkadaki ana sayfa kaymasın; kapanınca kaydırma geri gelir ---- */
  (function () {
    var IDS = ['nativeExamScreen', 'konuWizardOverlay', 'karisikWizardOverlay', 'benimDenemelerimOverlay', 'nds-lesson-overlay', 'reportCardModal',
      'denemeSonucOverlay', 'aaDenemeDagilimOverlay', 'endConfirmModal', 'exitConfirmModal', 'aaTestPreflight', 'mobileSolutionModal'];
    var tm = null;
    function check() {
      var open = IDS.some(function (id) {
        var e = document.getElementById(id); if (!e) return false;
        if (id === 'aaTestPreflight') return e.classList.contains('open');
        var cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden';
      });
      document.documentElement.classList.toggle('qb-ovl', open);
    }
    new MutationObserver(function () { clearTimeout(tm); tm = setTimeout(check, 60); })
      .observe(document.body, { attributes: true, attributeFilter: ['style', 'class'], subtree: true });
    check();
  })();

  buildSelect(); renderSummary(); renderTopics(); renderVideoInfo(); setEnabled(false);
  window.addEventListener('load', renderVideoInfo);
  document.documentElement.lang = 'tr';
})();
