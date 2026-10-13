/* Matematik: sorulardaki \( ... \) ve \[ ... \] ifadeleri KaTeX ile (çevrimdışı) gösterilir. */
(function () {
  'use strict';
  if (!window.katex) return;
  var RE = /\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g, SKIP = /^(SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|NOSCRIPT)$/;
  var cache = {};
  // veri kaynağındaki bozuk komutlar (ör. \text -> \timesext)
  function fix(s) {
    return s.replace(/\\timesext\b/g, '\\text').replace(/\\timesriangle\b/g, '\\triangle')
      .replace(/\\(cap|cup)([A-Z])\b/g, '\\$1 $2');
  }
  function render(expr, display) {
    var k = (display ? 'D' : 'I') + expr;
    if (cache[k] !== undefined) return cache[k];
    var h;
    try { h = window.katex.renderToString(fix(expr), { throwOnError: false, output: 'html', displayMode: !!display, strict: 'ignore', trust: false }); }
    catch (e) { h = null; }
    return (cache[k] = h);
  }
  function convert(t) {
    var s = t.nodeValue;
    if (!s || s.indexOf('\\') < 0) return;
    RE.lastIndex = 0; if (!RE.test(s)) return; RE.lastIndex = 0;
    var frag = document.createDocumentFragment(), last = 0, m, any = false;
    while ((m = RE.exec(s))) {
      var expr = m[1] != null ? m[1] : m[2], html = render(expr, m[2] != null);
      if (html == null) continue;
      if (m.index > last) frag.appendChild(document.createTextNode(s.slice(last, m.index)));
      var sp = document.createElement('span'); sp.className = 'qb-math'; sp.innerHTML = html;
      sp.setAttribute('data-tex', expr);
      frag.appendChild(sp); last = m.index + m[0].length; any = true;
    }
    if (!any) return;
    if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
    if (t.parentNode) t.parentNode.replaceChild(frag, t);
  }
  function scan(node) {
    if (!node) return;
    if (node.nodeType === 3) { var p = node.parentNode; if (p && !SKIP.test(p.nodeName) && !(p.closest && p.closest('.qb-math'))) convert(node); return; }
    if (node.nodeType !== 1 || SKIP.test(node.nodeName) || (node.classList && node.classList.contains('qb-math'))) return;
    var w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null), n, list = [];
    while ((n = w.nextNode())) { var pp = n.parentNode; if (n.nodeValue.indexOf('\\') > -1 && !SKIP.test(pp.nodeName) && !(pp.closest && pp.closest('.qb-math'))) list.push(n); }
    list.forEach(convert);
  }
  var queue = [], pend = false;
  function flush() { pend = false; var q = queue; queue = []; q.forEach(scan); }
  new MutationObserver(function (ms) {
    ms.forEach(function (m) {
      if (m.type === 'characterData') queue.push(m.target);
      else m.addedNodes.forEach(function (a) { queue.push(a); });
    });
    if (queue.length && !pend) { pend = true; setTimeout(flush, 16); }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  window.QB_MATH_SCAN = function () { scan(document.body); };
  scan(document.body);
})();
