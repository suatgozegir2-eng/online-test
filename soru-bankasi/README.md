# Online Soru Bankası

`index.html` tek dosyadır; sunucu gerekmez. 20 unvanın 29.363 sorusu içine gömülüdür (gzip+base64) ve ağ isteği çıkmaz
(Font Awesome, Inter ve Chart.js yine CDN'den gelir; çevrimdışıyken ikonlar ve sonuç grafiği görünmez).
Sorular konuya göre parçalanıp ayrı ayrı sıkıştırılmıştır; yalnızca seçili unvanın konuları açılır (telefonda hızlı açılış).
`content://` gibi adreslerde localStorage kullanılamazsa yedek depolama devreye girer; seçim ve ilerleme sayfa yenilense de korunur
(sekme kapanınca silinir).

## Mimari (neden iç içe sayfa?)

`index.html` yalnızca bir kapsayıcıdır; soru bankası sayfası (panel + kabuk + veri) içinde metin olarak durur ve bir `iframe`
(`srcdoc`) içinde çalışır. Unvan değişince yalnızca iframe yeniden kurulur: **adres değişmez, sayfa yenilenmez, ağ isteği çıkmaz.**
Telefonda dosya `content://` ile açıldığında yenileme/adres değişikliği "content not found" hatasına yol açtığı için bu yapı seçildi.

- Ana sayfada unvan seçilir. Seçim `localStorage` (`qb_unvan`) içinde tutulur; `?u=<unvan_anahtarı>` ile de açılır
  (ör. `?u=vhki`, `?u=avukat`, `?u=sube_muduru`).
- Soru bankası yalnızca seçili unvanın resmî sınav konularından oluşur.
- Konu Bazlı Test, Karışık Test ve Deneme Oluştur, referans panelin aynı sihirbaz ve sınav ekranlarıdır.
- **Video Çözümlü Sorular:** seçili unvanın sorumlu olduğu konulardan, videosu olanlar listelenir (soru + video yan yana; masaüstünde
  konu/video rayı, mobilde konu seçici ve video çipleri). Hız seçimi, "izlendi" işareti ve kaldığı yerden devam vardır. Önce hızlı
  (mp4) oynatıcı, açılmazsa Drive önizlemesi kullanılır. 102 video / 16 konu; unvana göre 3-16 konu.
  Kaynak veri referans HTML'deki `AA_VIDEO_SOLUTION_QUESTIONS` dizisidir (`docs/soru-cozum-videolari.csv`); iki kayıt (`DMK_VIDEO_028`,
  `DMK_UPLOAD_VIDEO_011`) video bağlantısı olmadığı için listelenmez, ortak mp4 kullanan iki kayıt yalnızca kendi Drive bağlantısını kullanır.
- Deneme: unvanın resmî konu dağılımı ve soru sayısı (80 ya da 70) kullanılır; süre soru başına 1,5 dk. Soru bankası boş konular
  (İstatistikçi, Psikolog, Sosyal Çalışmacı, İlçe STİ Müdürü, Eğitim Uzmanı) diğer konulardan tamamlanır.

## Yeniden üretmek

```
python3 -I tools/build_bank.py <referans_panel.html> <soru_bankasi.json> soru-bankasi/index.html
```

Kurumsal ana sayfa: `tools/shell/shell.*`, video modülü: `tools/shell/video.*`, kapsayıcı: `tools/shell/host.html`. İç sayfayı ayrıca görmek için `QB_PAGE_OUT=iç.html` ortam değişkeni verilebilir. Test araçları: `docs/analiz-araclari/`.
