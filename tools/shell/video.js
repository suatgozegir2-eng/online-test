/* Video Çözümlü Sorular: seçili unvanın sorumlu olduğu konular; soru + video yan yana. Adres/geçmiş değiştirmez. */
(function () {
  'use strict';
  var META = window.QB_META, ACTIVE = window.QB_ACTIVE, CHOSEN = window.QB_CHOSEN;
  var DATA = [];
  try { DATA = JSON.parse(document.getElementById('qb-videos').textContent); } catch (e) { DATA = []; }
  var nf = new Intl.NumberFormat('tr-TR');
  var L = 'ABCDE';

  /* ---- unvana göre konular (unvanın konu sırası korunur) ---- */
  var byTopic = {};
  DATA.forEach(function (v) { (byTopic[v.t] = byTopic[v.t] || []).push(v); });
  var TOPICS = (CHOSEN ? ACTIVE.topicIds : []).filter(function (t) { return byTopic[t]; }).map(function (t) {
    return { id: t, name: META.topicNames[t], items: byTopic[t] };
  });
  var TOTAL = TOPICS.reduce(function (n, t) { return n + t.items.length; }, 0);
  var ALL = []; TOPICS.forEach(function (t) { t.items.forEach(function (v) { ALL.push(v); }); });

  /* ---- yerel kayıt (izlenenler, son konum, hız) ---- */
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var seen = lsGet('qb_vid_seen', {});
  var last = lsGet('qb_vid_last_' + ACTIVE.id, null);
  var rate = Number(lsGet('qb_vid_rate', 1)) || 1;

  var state = { ti: 0, i: 0, sel: {}, shown: {}, alt: false }, railTi = -1;
  var root = null, refs = {};

  function $(s, c) { return (c || root).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function topic() { return TOPICS[state.ti]; }
  function item() { return topic().items[state.i]; }
  function seenCount(t) { return t.items.filter(function (v) { return seen[v.id]; }).length; }
  function driveView(id) { return 'https://drive.google.com/file/d/' + id + '/view'; }
  function drivePrev(id) { return 'https://drive.google.com/file/d/' + id + '/preview'; }
  function isMobile() { return window.innerWidth <= 900; }

  /* ---- ana sayfa kartı ---- */
  function initCard() {
    var card = document.querySelector('.qb-card[data-mode="video"]');
    if (!card) return;
    var badge = document.getElementById('qbVidBadge');
    if (!CHOSEN) { if (badge) badge.textContent = ''; return; }
    if (!TOTAL) { card.hidden = true; return; }
    if (badge) badge.textContent = TOPICS.length + ' konu · ' + TOTAL + ' video';
  }

  /* ---- iskelet ---- */
  function build() {
    root = document.createElement('div');
    root.id = 'qvid'; root.className = 'qv'; root.hidden = true;
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Video çözümlü sorular');
    root.innerHTML =
      '<header class="qv-bar">' +
        '<button type="button" class="qv-back" data-a="close" aria-label="Kapat ve soru bankasına dön"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg><span>Soru bankası</span></button>' +
        '<div class="qv-title"><b>Video Çözümlü Sorular</b><small>' + esc(ACTIVE.name) + '</small></div>' +
        '<button type="button" class="qv-topicbtn" data-a="sheet" aria-haspopup="dialog"><span class="qv-tb-l">Konu</span><span class="qv-tb-v" id="qvTb"></span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>' +
      '</header>' +
      '<div class="qv-body">' +
        '<aside class="qv-rail" aria-label="Konular"><div class="qv-rail-h"><b>Konular</b><span>' + TOPICS.length + ' konu · ' + TOTAL + ' video</span></div><div class="qv-topics" id="qvTopics"></div></aside>' +
        '<main class="qv-main" id="qvMain"></main>' +
      '</div>' +
      '<nav class="qv-nav" id="qvNav" aria-label="Videolar arasında gezin"></nav>' +
      '<div class="qv-sheet" id="qvSheet" hidden><div class="qv-sheet-bg" data-a="sheetclose"></div><div class="qv-sheet-box" role="dialog" aria-label="Konu seçin"><div class="qv-sheet-h"><b>Konu seçin</b><button type="button" data-a="sheetclose" aria-label="Kapat">×</button></div><div class="qv-topics" id="qvSheetTopics"></div></div></div>';
    document.body.appendChild(root);
    root.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey, true); // yakalama aşaması: panelin eski tuş yutucularından bağımsız
    root.addEventListener('error', function (e) {
      var t = e.target;
      if (t && t.tagName === 'VIDEO') fallbackDrive();
    }, true);
  }

  /* ---- konu listesi (masaüstü rayı + mobil sayfa) ---- */
  function topicHtml() {
    return TOPICS.map(function (t, ti) {
      var n = t.items.length, k = seenCount(t), on = ti === state.ti;
      var list = '';
      if (on) {
        list = '<ol class="qv-vl">' + t.items.map(function (v, i) {
          return '<li><button type="button" class="qv-vi' + (i === state.i ? ' on' : '') + (seen[v.id] ? ' seen' : '') + '" data-a="go" data-i="' + i + '" aria-current="' + (i === state.i ? 'true' : 'false') + '">' +
            '<em>' + (i + 1) + '</em><span>' + esc(v.st || v.f.replace(/\.mp4$/i, '')) + '</span>' + (seen[v.id] ? '<i class="qv-ck" aria-label="İzlendi">✓</i>' : '') + '</button></li>';
        }).join('') + '</ol>';
      }
      return '<div class="qv-topic' + (on ? ' on' : '') + '">' +
        '<button type="button" class="qv-th" data-a="topic" data-ti="' + ti + '" aria-expanded="' + on + '">' +
          '<span class="qv-tn">' + esc(t.name) + '</span>' +
          '<span class="qv-tm">' + n + ' video' + (k ? ' · ' + k + ' izlendi' : '') + '</span>' +
          '<span class="qv-tp"><i style="width:' + Math.round(k / n * 100) + '%"></i></span>' +
        '</button>' + list + '</div>';
    }).join('');
  }
  function renderTopics() {
    $('#qvTopics').innerHTML = topicHtml();
    $('#qvSheetTopics').innerHTML = topicHtml().replace(/<ol class="qv-vl">[\s\S]*?<\/ol>/g, '');
    $('#qvTb').textContent = topic().name;
    if (!isMobile()) {
      var changed = railTi !== state.ti; railTi = state.ti;
      var el = changed ? $('#qvTopics .qv-topic.on') : $('#qvTopics .qv-vi.on');
      if (el && el.scrollIntoView) { try { el.scrollIntoView({ block: changed ? 'start' : 'nearest' }); } catch (e) {} }
    }
  }

  /* ---- oynatıcı ---- */
  function playerHtml(v) {
    if (state.alt && v.d) return '<iframe src="' + esc(drivePrev(v.d)) + '" title="Video çözümü" allow="autoplay; fullscreen" allowfullscreen></iframe>';
    if (v.m) return '<video src="' + esc(v.m) + '" controls playsinline webkit-playsinline preload="metadata" aria-label="Video çözümü">Tarayıcınız video oynatmayı desteklemiyor.</video>';
    if (v.d) return '<iframe src="' + esc(drivePrev(v.d)) + '" title="Video çözümü" allow="autoplay; fullscreen" allowfullscreen></iframe>';
    return '<div class="qv-novideo">Bu soru için video bağlantısı yok.</div>';
  }
  function fallbackDrive() {
    var v = item(); if (!v || !v.d || state.alt) return;
    state.alt = true; var box = $('.qv-frame'); if (!box) return;
    box.innerHTML = playerHtml(v); box.classList.add('is-drive');
    syncPlayerButtons();
  }
  function syncPlayerButtons() {
    var v = item(), sw = $('[data-a="alt"]'), sp = $('.qv-speed');
    var usingVideo = !!$('.qv-frame video');
    if (sw) { sw.hidden = !(v.m && v.d); sw.textContent = state.alt ? 'Hızlı oynatıcıya dön' : 'Alternatif oynatıcı'; }
    if (sp) sp.hidden = !usingVideo;
    var video = $('.qv-frame video');
    if (video) {
      try { video.playbackRate = rate; } catch (e) {}
      video.addEventListener('ratechange', function () { rate = video.playbackRate; lsSet('qb_vid_rate', rate); markSpeed(); });
      video.addEventListener('ended', function () { markSeen(v.id); });
    }
    markSpeed();
  }
  function markSpeed() {
    [].forEach.call(root.querySelectorAll('.qv-speed button'), function (b) { b.classList.toggle('on', Number(b.getAttribute('data-r')) === rate); });
  }
  function markSeen(id) {
    if (seen[id]) return; seen[id] = 1; lsSet('qb_vid_seen', seen); renderTopics(); renderChips();
  }

  /* ---- soru + video ---- */
  function renderMain() {
    var t = topic(), v = item(), sel = state.sel[v.id], shown = !!state.shown[v.id];
    var choices = v.o.map(function (o, i) {
      var cls = '';
      if (shown) cls = i === v.a ? ' correct' : (i === sel ? ' wrong' : '');
      else if (i === sel) cls = ' picked';
      return '<label class="qv-ch' + cls + '"><input type="radio" name="qvch" value="' + i + '"' + (sel === i ? ' checked' : '') + (shown ? ' disabled' : '') + '><b>' + L[i] + '</b><span>' + esc(o) + '</span></label>';
    }).join('');
    var status = '';
    if (shown) status = sel == null ? 'Doğru cevap: ' + L[v.a] : (sel === v.a ? 'Doğru ✓' : 'Yanlış · Doğru cevap: ' + L[v.a]);
    $('#qvMain').innerHTML =
      '<div class="qv-crumb"><span class="qv-c-t">' + esc(t.name) + '</span><span class="qv-c-n">Video <b>' + (state.i + 1) + '</b> / ' + t.items.length + '</span></div>' +
      '<div class="qv-chips" id="qvChips" role="tablist" aria-label="Videolar"></div>' +
      '<div class="qv-split">' +
        '<section class="qv-q" aria-label="Soru"><div class="qv-q-in">' +
          '<div class="qv-q-meta">' + esc(v.st || '') + '</div>' +
          '<div class="qv-q-text">' + esc(v.q) + '</div>' +
          (v.n ? '<div class="qv-note">' + esc(v.n) + '</div>' : '') +
          '<div class="qv-chs" role="radiogroup" aria-label="Seçenekler">' + choices + '</div>' +
          '<div class="qv-act"><button type="button" class="qv-btn" data-a="reveal"' + (shown ? ' disabled' : '') + '>Cevabı göster</button><strong class="qv-st' + (shown ? (sel === v.a ? ' ok' : (sel == null ? '' : ' no')) : '') + '" aria-live="polite">' + status + '</strong></div>' +
        '</div></section>' +
        '<section class="qv-v" aria-label="Video çözüm">' +
          '<div class="qv-v-top"><b>Video çözüm</b><span>' + esc(v.f) + '</span></div>' +
          '<div class="qv-frame' + ((state.alt || !v.m) && v.d ? ' is-drive' : '') + '">' + playerHtml(v) + '</div>' +
          '<div class="qv-tools">' +
            '<div class="qv-speed" aria-label="Oynatma hızı">' + [0.75, 1, 1.25, 1.5, 2].map(function (r) { return '<button type="button" data-a="rate" data-r="' + r + '">' + r + '×</button>'; }).join('') + '</div>' +
            '<button type="button" class="qv-link" data-a="alt" hidden></button>' +
            (v.d ? '<a class="qv-link" href="' + esc(driveView(v.d)) + '" target="_blank" rel="noopener noreferrer">Ayrı sekmede aç ↗</a>' : '') +
            (v.r && v.r.d ? '<a class="qv-link" href="' + esc(driveView(v.r.d)) + '" target="_blank" rel="noopener noreferrer">Aynı konudan ek video ↗</a>' : '') +
          '</div>' +
        '</section>' +
      '</div>';
    renderChips(); syncPlayerButtons();
    $('#qvNav').innerHTML =
      '<button type="button" class="qv-nb" data-a="prev"' + (state.i === 0 && state.ti === 0 ? ' disabled' : '') + '>← Önceki</button>' +
      '<span class="qv-np">' + (state.i + 1) + ' / ' + t.items.length + '</span>' +
      '<button type="button" class="qv-nb primary" data-a="next"' + (state.i === t.items.length - 1 && state.ti === TOPICS.length - 1 ? ' disabled' : '') + '>Sonraki →</button>';
    var main = $('#qvMain'); main.scrollTop = 0; var qin = $('.qv-q'); if (qin) qin.scrollTop = 0;
    lsSet('qb_vid_last_' + ACTIVE.id, { t: t.id, i: state.i });
  }
  function renderChips() {
    var c = $('#qvChips'); if (!c) return;
    c.innerHTML = topic().items.map(function (v, i) {
      return '<button type="button" role="tab" class="qv-chip' + (i === state.i ? ' on' : '') + (seen[v.id] ? ' seen' : '') + '" data-a="go" data-i="' + i + '" aria-selected="' + (i === state.i) + '" aria-label="Video ' + (i + 1) + (seen[v.id] ? ' (izlendi)' : '') + '">' + (i + 1) + '</button>';
    }).join('');
    var on = c.querySelector('.on'); if (on && on.scrollIntoView && isMobile()) { try { c.scrollLeft = on.offsetLeft - c.clientWidth / 2 + on.offsetWidth / 2; } catch (e) {} }
  }

  /* ---- hareketler ---- */
  function stopMedia() {
    var v = $('.qv-frame video'); if (v) { try { v.pause(); } catch (e) {} }
    var f = $('.qv-frame iframe'); if (f) f.src = 'about:blank';
  }
  function go(ti, i) {
    stopMedia(); state.alt = false; state.ti = ti; state.i = i;
    renderTopics(); renderMain();
  }
  function step(d) {
    var t = topic(), ni = state.i + d;
    if (ni >= 0 && ni < t.items.length) return go(state.ti, ni);
    var nt = state.ti + d; if (nt < 0 || nt >= TOPICS.length) return;
    go(nt, d > 0 ? 0 : TOPICS[nt].items.length - 1);
  }
  function onClick(e) {
    var a = e.target.closest && e.target.closest('[data-a]'); if (!a) return;
    var act = a.getAttribute('data-a');
    if (act === 'close') close();
    else if (act === 'sheet') { $('#qvSheet').hidden = false; }
    else if (act === 'sheetclose') { $('#qvSheet').hidden = true; }
    else if (act === 'topic') { var ti = +a.getAttribute('data-ti'); $('#qvSheet').hidden = true; if (ti !== state.ti) go(ti, 0); else if (!isMobile()) renderTopics(); }
    else if (act === 'go') go(state.ti, +a.getAttribute('data-i'));
    else if (act === 'prev') step(-1);
    else if (act === 'next') { markSeen(item().id); step(1); }
    else if (act === 'reveal') { var v = item(); state.shown[v.id] = true; markSeen(v.id); reveal(); }
    else if (act === 'alt') { state.alt = !state.alt; var box = $('.qv-frame'); stopMedia(); box.innerHTML = playerHtml(item()); box.classList.toggle('is-drive', state.alt || !item().m); syncPlayerButtons(); }
    else if (act === 'rate') { rate = +a.getAttribute('data-r'); lsSet('qb_vid_rate', rate); var vid = $('.qv-frame video'); if (vid) vid.playbackRate = rate; markSpeed(); }
  }
  function reveal() {
    var v = item(), sel = state.sel[v.id];
    [].forEach.call(root.querySelectorAll('.qv-ch'), function (c, i) {
      c.classList.remove('picked'); if (i === v.a) c.classList.add('correct'); else if (i === sel) c.classList.add('wrong');
      c.querySelector('input').disabled = true;
    });
    var b = $('[data-a="reveal"]'); if (b) b.disabled = true;
    var st = $('.qv-st'); st.textContent = sel == null ? 'Doğru cevap: ' + L[v.a] : (sel === v.a ? 'Doğru ✓' : 'Yanlış · Doğru cevap: ' + L[v.a]);
    st.className = 'qv-st' + (sel == null ? '' : (sel === v.a ? ' ok' : ' no'));
  }
  function onKey(e) {
    if (!root || root.hidden) return;
    var tg = e.target, tag = tg && tg.tagName;
    if (e.key === 'Escape') { if (!$('#qvSheet').hidden) $('#qvSheet').hidden = true; else close(); return; }
    if (/INPUT|SELECT|TEXTAREA|VIDEO/.test(tag)) return;
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  }

  /* ---- aç / kapat ---- */
  function open() {
    if (!CHOSEN) return;
    if (!TOTAL) return;
    if (!root) {
      build();
      root.addEventListener('change', function (e) {
        if (e.target.name === 'qvch') { var v = item(); state.sel[v.id] = +e.target.value; [].forEach.call(root.querySelectorAll('.qv-ch'), function (c, i) { c.classList.toggle('picked', i === state.sel[v.id]); }); }
      });
      var ti = 0, i = 0;
      if (last) { var k = TOPICS.findIndex(function (t) { return t.id === last.t; }); if (k >= 0) { ti = k; i = Math.min(Math.max(0, last.i | 0), TOPICS[k].items.length - 1); } }
      state.ti = ti; state.i = i; renderTopics(); renderMain();
    }
    root.hidden = false; document.documentElement.classList.add('qv-lock');
    var b = $('.qv-back'); if (b) b.focus();
  }
  function close() {
    if (!root) return; stopMedia(); root.hidden = true; document.documentElement.classList.remove('qv-lock');
    var sh = $('#qvSheet'); if (sh) sh.hidden = true;
    var c = document.querySelector('.qb-card[data-mode="video"]'); if (c) c.focus();
    // iframe kapatılmıştı: bir sonraki açılışta oynatıcıyı yeniden kur
    if (TOPICS.length) { var box = $('.qv-frame'); if (box) { state.alt = false; renderMain(); } }
  }

  window.QB_OPEN_VIDEOS = open;
  initCard();
})();
