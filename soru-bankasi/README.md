# Online Soru Bankası

`index.html` tek dosyadır; sunucu gerekmez. 20 unvanın 29.363 sorusu içine gömülüdür (gzip+base64) ve ağ isteği çıkmaz
(Font Awesome, Inter ve Chart.js yine CDN'den gelir; çevrimdışıyken ikonlar ve sonuç grafiği görünmez).
Sorular konuya göre parçalanıp ayrı ayrı sıkıştırılmıştır; yalnızca seçili unvanın konuları açılır (telefonda hızlı açılış).
`content://` gibi adreslerde localStorage kullanılamazsa yedek depolama devreye girer; seçim ve ilerleme sayfa yenilense de korunur
(sekme kapanınca silinir).

- Ana sayfada unvan seçilir. Seçim `localStorage` (`qb_unvan`) içinde tutulur; `?u=<unvan_anahtarı>` ile de açılır
  (ör. `?u=vhki`, `?u=avukat`, `?u=sube_muduru`).
- Soru bankası yalnızca seçili unvanın resmî sınav konularından oluşur.
- Konu Bazlı Test, Karışık Test ve Deneme Oluştur, referans panelin aynı sihirbaz ve sınav ekranlarıdır.
- Deneme: unvanın resmî konu dağılımı ve soru sayısı (80 ya da 70) kullanılır; süre soru başına 1,5 dk. Soru bankası boş konular
  (İstatistikçi, Psikolog, Sosyal Çalışmacı, İlçe STİ Müdürü, Eğitim Uzmanı) diğer konulardan tamamlanır.

## Yeniden üretmek

```
python3 -I tools/build_bank.py <referans_panel.html> <soru_bankasi.json> soru-bankasi/index.html
```

Kurumsal ana sayfa: `tools/shell/` (HTML, CSS, JS). Test araçları: `docs/analiz-araclari/`.
