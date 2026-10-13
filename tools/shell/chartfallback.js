/* Chart.js CDN'den yüklenemezse (çevrimdışı, engelli ağ) sonuç ekranlarındaki halka grafikler için küçük yedek.
   Panel yalnızca `type:'doughnut'` kullanır. Chart.js yüklüyse hiçbir şey yapmaz. */
(function () {
  'use strict';
  if (typeof window.Chart !== 'undefined') return;
  function Chart(ctx, cfg) {
    var canvas = ctx && ctx.canvas ? ctx.canvas : ctx;
    this.canvas = canvas; this.config = cfg; this.data = cfg.data;
    this.draw();
  }
  Chart.prototype.draw = function () {
    var c = this.canvas, cfg = this.config, ds = (cfg.data.datasets || [])[0] || { data: [] };
    var box = c.parentNode, w = Math.max(120, box.clientWidth || 240), h = Math.max(120, box.clientHeight || 240);
    var dpr = window.devicePixelRatio || 1;
    c.style.width = w + 'px'; c.style.height = h + 'px'; c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    var g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    var opt = cfg.options || {}, leg = ((opt.plugins || {}).legend || {}), legendBottom = leg.display !== false;
    var labels = cfg.data.labels || [], colors = ds.backgroundColor || [], vals = (ds.data || []).map(Number);
    var legendH = legendBottom ? 30 : 0, size = Math.min(w, h - legendH) - 8, cx = w / 2, cy = (h - legendH) / 2, R = size / 2;
    var cut = parseFloat(String(opt.cutout || '60%')) / 100, r = R * (isNaN(cut) ? 0.6 : cut);
    var total = vals.reduce(function (a, b) { return a + b; }, 0), a0 = -Math.PI / 2;
    g.lineWidth = 0;
    if (!total) { g.beginPath(); g.arc(cx, cy, R, 0, 2 * Math.PI); g.arc(cx, cy, r, 2 * Math.PI, 0, true); g.fillStyle = '#e2e8f0'; g.fill(); }
    else vals.forEach(function (v, i) {
      if (v <= 0) return; var a1 = a0 + v / total * 2 * Math.PI;
      g.beginPath(); g.arc(cx, cy, R, a0, a1); g.arc(cx, cy, r, a1, a0, true); g.closePath();
      g.fillStyle = Array.isArray(colors) ? colors[i] : colors; g.fill(); a0 = a1;
    });
    if (legendBottom) {
      var col = (leg.labels && leg.labels.color) || '#475569';
      g.font = '600 12px Inter, system-ui, sans-serif'; g.textBaseline = 'middle';
      var items = labels.map(function (l, i) { return { t: l, c: Array.isArray(colors) ? colors[i] : colors, w: g.measureText(l).width + 24 }; });
      var tw = items.reduce(function (s, it) { return s + it.w + 10; }, -10), x = (w - tw) / 2, y = h - 12;
      items.forEach(function (it) { g.fillStyle = it.c; g.fillRect(x, y - 5, 14, 10); g.fillStyle = col; g.fillText(it.t, x + 20, y); x += it.w + 10; });
    }
  };
  Chart.prototype.update = function () { this.draw(); };
  Chart.prototype.destroy = function () { var c = this.canvas; if (c && c.getContext) c.getContext('2d').clearRect(0, 0, c.width, c.height); };
  window.Chart = Chart; window.QB_CHART_FALLBACK = true;
})();
