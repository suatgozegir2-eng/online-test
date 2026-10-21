/**
 * "Sıralamalar" sayfası için Apps Script ek kodu.
 *
 * KURULUM
 * 1) Sonuçları kaydeden Google Apps Script projesini aç (script.google.com).
 * 2) Bu dosyadaki iki fonksiyonu projeye yapıştır.
 * 3) Mevcut doPost(e) fonksiyonunun EN BAŞINA şu satırı ekle:
 *      if (e && e.parameter && e.parameter.action === 'leaderboard') return leaderboardResponse_(e.parameter);
 * 4) Dağıt > Dağıtımları yönet > Düzenle > Sürüm: "Yeni sürüm" > Dağıt.
 *    (Web uygulaması URL'si aynı kalır.)
 *
 * Sayfa şu alanları gönderir: action=leaderboard, ministry, roleId, examId, province(isteğe bağlı).
 * Sayfanın kaydettiği sütunlar (başlık adları): bakanlik, ministry, unvan, roleId, examId, province,
 * hafta, ad, soyad, dogru, yanlis, bos, puan, total, durationSeconds. Başlıklar büyük/küçük harf ve
 * Türkçe karakterden bağımsız eşleştirilir (ör. "Doğru" = dogru, "Ad" = ad).
 *
 * GİZLİLİK: Adlar burada baş harfe indirilir; telefon ve tam ad tarayıcıya hiç gönderilmez.
 */
function leaderboardResponse_(p) {
  var out;
  try { out = leaderboard_(p); } catch (err) { out = { ok: false, error: String(err && err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function leaderboard_(p) {
  var norm = function (s) {
    return String(s == null ? '' : s).toLocaleLowerCase('tr-TR')
      .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/[^a-z0-9]/g, '');
  };
  var ini = function (s) { s = String(s == null ? '' : s).trim(); return s ? s.charAt(0).toLocaleUpperCase('tr-TR') + '.' : ''; };

  var sheet = null, idx = null, values = null;
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var i = 0; i < sheets.length && !sheet; i++) {
    var v = sheets[i].getDataRange().getValues();
    if (v.length < 2) continue;
    var h = {};
    v[0].forEach(function (c, j) { h[norm(c)] = j; });
    if (h.puan !== undefined && h.soyad !== undefined && (h.roleid !== undefined || h.unvan !== undefined)) { sheet = sheets[i]; idx = h; values = v; }
  }
  if (!sheet) return { ok: false, error: 'Sonuç sayfası bulunamadı (puan/ad/soyad/roleId sütunları yok).' };

  var wantRole = norm(p.roleId), wantExam = norm(p.examId);
  var get = function (row, key) { return idx[key] === undefined ? '' : row[idx[key]]; };
  var best = {};
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (idx.roleid !== undefined && norm(get(row, 'roleid')) !== wantRole) continue;
    if (idx.examid !== undefined && wantExam && norm(get(row, 'examid')) !== wantExam) continue;
    var key = norm(get(row, 'ad')) + '|' + norm(get(row, 'soyad')) + '|' + norm(get(row, 'province'));
    var rec = {
      ad: get(row, 'ad'), soyad: get(row, 'soyad'), province: String(get(row, 'province') || ''),
      puan: Number(get(row, 'puan')) || 0, dogru: Number(get(row, 'dogru')) || 0, yanlis: Number(get(row, 'yanlis')) || 0,
      bos: Number(get(row, 'bos')) || 0, sure: Number(get(row, 'durationseconds')) || 0
    };
    // aynı kişi tekrar çözdüyse en yüksek puanlı (eşitse en kısa süreli) kaydı say
    var old = best[key];
    if (!old || rec.puan > old.puan || (rec.puan === old.puan && rec.sure && rec.sure < old.sure)) best[key] = rec;
  }
  var list = Object.keys(best).map(function (k) { return best[k]; });
  list.sort(function (a, b) { return b.puan - a.puan || (a.sure || 1e9) - (b.sure || 1e9); });
  var limit = Math.min(Number(p.limit) || 500, 1000);
  var rows = list.slice(0, limit).map(function (x, i) {
    return { rank: i + 1, name: (ini(x.ad) + ' ' + ini(x.soyad)).trim(), province: x.province, puan: x.puan, dogru: x.dogru, yanlis: x.yanlis, bos: x.bos };
  });
  return { ok: true, participantCount: list.length, rows: rows };
}
