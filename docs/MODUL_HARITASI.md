# VHKİ Paneli — Aktif Modül Haritası

Kaynak dosya: `ICISLERI_VHKI_GUNCEL_REFERANS_V4.html` (32.032 satır, 3,7 MB, 127 `<script>` etiketi).
Satır numaraları bu dosyaya aittir.

## Nasıl tespit edildi?

Dosya Chromium'da (masaüstü 1440×900, mobil 390×844 dokunmatik) çalıştırıldı. Soru JSON'u, resmî deneme planındaki
konu kimlikleriyle uyumlu sahte veriyle (684 soru) değiştirildi. Üç modülün altı akışı da **başlat → cevapla → bitir → sonuç**
olarak gerçek tıklama/dokunmayla sürüldü (`docs/analiz-araclari/`). Çalışan JS, Chromium kapsamasıyla (coverage)
ölçüldü; yalnızca sayfa yüklenirken çalışanlar çıkarılarak **modül kullanılırken çalışan** kod ayrıldı.

Sonuç: **6/6 akış uçtan uca çalışıyor** (konu bazlı, karışık, denemelerim × masaüstü, mobil).

## Ortak mimari (en önemli bulgu)

- **Tek sayfa, iki arayüz.** Aynı HTML hem masaüstünü hem mobili sunar; ayrım genişliğe göre (`≤900px`) çalışma anında yapılır.
- **Tek sınav motoru.** Üç modül de aynı `#nativeExamScreen` (satır 7348) ekranını kullanır. İçinde masaüstü kabuğu
  (`.desktop-exam-only`) ve mobil kabuğu (`.mobile-exam-shell`) birlikte durur.
- **`startNativeExam` 16 yerde yeniden tanımlı/sarılı** (satır 8029, 11537, 11669, 13141, 13415, 15944, 16280, 18108,
  18498, 19537, 23421, 23592, 24984, 25156, 25994, 26001). Çalışma anında görünen en üst fonksiyon sadece sarmalayıcıdır
  (yardım, odak, preflight); gerçek iş zincirin altındadır. Aynısı `openKonuWizard`, `openKarisikWizard`,
  `openBenimDenemelerimWizard`, `ndsOpenScreen`, `aaDirectModule` için de geçerli.
- **Mobilde gerçek arayüz `#aaMobileApp`** (HTML ~25340–25420, JS satır 25425, `aa-stable-mobile-app-script`).
  Modülü `ndsOpenScreen('topic'|'mixed'|'myexams')` ile açar; bu da eski `m-screen-*` bölümlerini `#nds-lesson-overlay`
  içine taşır. Eski `#mobileApp` (satır 8700) ve `mobileNav()` kullanıcıya görünmez; **ölü sayılabilir**.

## Veri katmanı (3 modül de bunu kullanır)

| Parça | Satır |
|---|---|
| Veri kaynağı adresleri, `AA_PANEL_CONFIG` | 9–32 |
| `aa-master-data-router-v1` (fetch'i yakalar, profile göre filtreler) | 47–233 |
| `loadData()` (soruyu normalize eder: `konu`, `altKonu`, `text`, `options`, `answer`, `solution`) | 354–589 |

Beklenen soru şeması: `{id, topicId, konu, altKonu, text, options[], answer, solution}`;
ana JSON `{topics[], profiles{icisleri_vhki:{topicIds[]}}, questions[]}`.

## Modül 1 — Konu Bazlı Soru Çöz

| | Masaüstü | Mobil |
|---|---|---|
| Giriş | `aaDirectModule('topic')` → `openKonuWizard` | `#aaMobileApp` → `ndsOpenScreen('topic')` |
| Arayüz (HTML) | `#konuWizardOverlay` (7280–7312) | `#m-screen-topic` (8802–8829) |
| Arayüz (JS) | blok 7562: `openKonuWizard` 7678, `selectAnaKonu`, `renderAltCards`, `setQuickQuestionCount` | blok 21314 `aa-mimarlik-mobile-topic-stabilizer-final` (`mobileStartTopicExam`) |
| Havuz kurma | blok 13224 (`__aaBuildTopicExam`, `aaLaunchDesktopExam`) | aynı blok + 21314 |
| Başlatma zinciri | `startNativeExam` sarmalayıcıları: 24853 → 23552 → 19514 → 17874 → 16042 → 13224 | `mobileStartTopicExam` → preflight (25971) → `startMobileExamWithQuestions` |

## Modül 2 — Karışık Soru Çöz

| | Masaüstü | Mobil |
|---|---|---|
| Giriş | `aaDirectModule('mixed')` → `openKarisikWizard` | `ndsOpenScreen('mixed')` |
| Arayüz (HTML) | `#karisikWizardOverlay` (7313–7347), içini 24853 doldurur | `#m-screen-mixed` (8830–8869) |
| Motor | **blok 24853 `aa-mixed-lite-final-script-v1`** (`openKarisikWizard`, `buildExamFromPool`, `launchMixedExam`) | aynı blok (`mobileStartMixedExam`) |

Kaçınılacak: `adalet-mobile-mixed-mk33-v4` (19610–19898) ve `mk33Overlay`. Yalnızca eski `mobileNav('mixed')` yolundan
açılır; gerçek kullanıcı yolunda 24853 ve `m-screen-mixed` kazanır.

## Modül 3 — Benim Denemelerim

| | Masaüstü | Mobil |
|---|---|---|
| Giriş | `aaDirectModule('myexams')` → `openBenimDenemelerimWizard` | `ndsOpenScreen('myexams')` |
| Arayüz (HTML) | `#benimDenemelerimOverlay` (7230–7279) | `#m-screen-myexams` (8891–8924) |
| Arayüz (JS) | 26014 `aa-myexam-modern-v1`, 16042 `aa-denemelerim-tek-motor-v1` | 18649 `mobile-myexam-chip-fix-v16` |
| **Motor** | **blok 23552 `aa-egm-deneme-modulleri-final-v2`**: 19 satırlık resmî `PLAN` (toplam 80 soru, 120 dk), `pickDistributed`, `poolByCriteria` | aynı blok, `mobileStartMyExam` |
| Sonuç | `#denemeSonucOverlay` (7506), 26022 `aa-exam-result-layer-fix-v1` | aynı |

Önemli: Bu modül sorusu `topicId` ile resmî plana göre seçer. Plandaki konu kimlikleri soru havuzunda yoksa
"Resmî dağılım için yeterli soru bulunamadı" der ve **başlamaz** (eksik konu başka konudan doldurulmaz).

## Ortak sınav motoru (3 modül paylaşır)

| Görev | Blok |
|---|---|
| Sınav ekranı HTML | `#nativeExamScreen` 7348, `endConfirmModal` 7418, `reportCardModal` 7438 |
| Masaüstü soru çizimi | 11593 (`createQuestionOption`), 25834 `aahm-native-engine-v2`, 29726 `aa-exam-desktop-v13` |
| Mobil soru çizimi | 24406 `aa-mimarlik-mobile-exam-blank-final-fix` (`renderMobileExam`), 24643 `aa-mobile-exam-touch-clean-v3`, 29180 |
| Masaüstü başlatma | 12553 `aa-v15-exam-engine-unifier` (`__aaLaunchDesktopExam`), 13224 |
| Başlamadan önce seçim ("Yeni test / devam") | 25971 `aa-test-preflight-v2-script`, 25930 `aa-exclude-correct-v1` |
| Doğru/yanlış, favori kaydı | 10336, 25607 `aa-unified-favorites-wrongs-v5` |
| Sonuç kartı | `generateReportCard` (8546 + 26022 + 29726), Chart.js CDN'den |
| Yardımcı | 30070 odak, 26202 harf-jesti, 29259 görsel destek, 31693 hata bildirimi |

## Ölü / gereksiz kod

- 127 script etiketinden **73'ü** hiç çalışıyor; 63'ü bu üç akışa değiyor (çoğu yalnızca sarmalayıcı). Çok sayıda
  `AA CLEANUP: script #N removed` yer tutucusu var.
- Bu üç modülle ilgisiz büyük bloklar: `aa-turkiye-geneli-inline-script` (29153, **317 KB**), `aa-video-single-question-script`
  (31460, 157 KB), `ag-script` (26112, 41 KB), Mevzuat/DersTube/Podcast/Ezber/Sunum blokları, GİB/Gelir İdaresi/Adalet/Mimarlık
  adlı kalıntılar.
- CSS de aynı biçimde 40'tan fazla üst üste yama bloğu içeriyor (`aa-ui-refresh-v8/v9`, `glass-corporate-unify`,
  `mev-desktop-layout-tune*`, ...). Bunlar üç modül için ayrıştırılmadı.

## Doğrulama sınırları

- Gerçek JSON (adaletsenakademi.com) bu ortamdan erişilemedi; sahte veri kullanıldı. Gerçek veride davranış büyük
  ölçüde aynı olmalı, ama gerçek alan adları farklıysa `loadData` normalizasyonu devreye girer.
- Test ortamında CDN kapalıydı: Font Awesome ikonları görünmedi ve sonuç karnesinde `Chart is not defined` hatası
  çıktı. Bunlar ortamdan; canlıda Chart.js jsdelivr'den yüklenir.
- Yanlışlarımı çöz, Favorilerim, Akademi/Türkiye Geneli denemeleri ve "yarım kalan testi sürdür" akışı test edilmedi.

## Önerilen sonraki adım (soru bankası için)

Bu üç modülü temiz bir uygulamaya çıkarmak için: (1) veri katmanı + tek sınav motoru + üç sihirbaz yeniden yazılır,
masaüstü/mobil tek duyarlı arayüz olur; (2) CSS yalnızca bu modüllerin kullandığı kurallarla sıfırdan toplanır;
(3) soru kaynağı bu repodaki `sorularicislerixx.json` ile uyumlu tutulur.
