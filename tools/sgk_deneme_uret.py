#!/usr/bin/env python3
"""SGK Görevde Yükselme (Şef / Memur) deneme sınavı üretici.

Kullanım:  python3 -I tools/sgk_deneme_uret.py <sgksorukesin.json> <cikti.json> [hafta]

Soruları 20.10.2026 tarihli SGK duyurusunun Ek-4 tablosundaki dağılıma göre seçer
(100 soru: 30 genel + 70 kurum konusu). Her konunun havuzu sabit tohumla karıştırılır ve
hafta N için N. dilim alınır; böylece farklı haftalarda aynı soru tekrar çıkmaz.
Yalnız 4 seçenekli, görselsiz, metni benzersiz sorular kullanılır.
"""
import json, random, re, sys

IMP = "sgk_import_"
GAP = "sgk_gap_"
G4483 = GAP + "4483_say_l_memurlar_ve_di_er_kamu_g_revlilerinin_yarg_lanmas_hakk_nda_kanun"
G4982 = GAP + "4982_say_l_bilgi_edinme_hakk_kanunu"
G6698 = GAP + "6698_say_l_ki_isel_verilerin_korunmas_kanunu"
G6183 = GAP + "6183_say_l_amme_alacaklar_n_n_tahsil_usul_hakk_nda_kanun"

# (etiket, bölüm, {unvan: [(konu_id, soru_sayısı), ...]})  — Ek-4 sırasıyla
GENEL, KURUM = "ortak", "gorev"
PLAN = [
    ("T.C. Anayasası", GENEL, {"sef": [(IMP + "15", 2)], "memur": [(IMP + "15", 5)]}),
    ("Atatürk ilkeleri ve inkılâp tarihi", GENEL, {"sef": [(IMP + "16", 2)], "memur": [(IMP + "16", 3)]}),
    ("Resmî yazışma kuralları", GENEL, {"sef": [(IMP + "17", 3)], "memur": [(IMP + "17", 5)]}),
    ("Genel kültür", GENEL, {"sef": [(IMP + "23", 1), (IMP + "24", 1)],
                              "memur": [(IMP + "23", 1), (IMP + "24", 1), (IMP + "25", 1)]}),
    ("657 sayılı Devlet Memurları Kanunu", GENEL, {"sef": [(IMP + "18", 5)], "memur": [(IMP + "18", 5)]}),
    ("4483 sayılı Memurlar ve Diğer Kamu Görevlilerinin Yargılanması Hakkında Kanun", GENEL, {"sef": [(G4483, 1)], "memur": [(G4483, 3)]}),
    ("5018 sayılı Kamu Mali Yönetimi ve Kontrol Kanunu", GENEL, {"sef": [(IMP + "19", 3)]}),
    ("6183 sayılı Amme Alacaklarının Tahsil Usulü Hakkında Kanun", GENEL, {"sef": [(G6183, 4)]}),
    ("4982 sayılı Bilgi Edinme Hakkı Kanunu", GENEL, {"sef": [(G4982, 1)], "memur": [(G4982, 3)]}),
    ("4734 sayılı Kamu İhale Kanunu", GENEL, {"sef": [(IMP + "20", 2)]}),
    ("6331 sayılı İş Sağlığı ve Güvenliği Kanunu", GENEL, {"sef": [(IMP + "21", 2)], "memur": [(IMP + "21", 3)]}),
    ("6698 sayılı Kişisel Verilerin Korunması Kanunu", GENEL, {"sef": [(G6698, 2)]}),
    ("7201 sayılı Tebligat Kanunu", GENEL, {"sef": [(IMP + "22", 1)]}),
    ("5510 sayılı Kanun ve Kurumun görev alanına giren diğer mevzuat (yönetmelik, tebliğ, genelge)", KURUM, {
        "sef": [("sgk_5510", 20), ("sgk_ssi̇y", 8), ("sgk_sut", 5), ("sgk_gssuy", 5), ("sgk_gen1838", 5),
                ("sgk_1479", 2), ("sgk_506", 1), ("sgk_2829", 1)],
        "memur": [("sgk_5510", 24), ("sgk_ssi̇y", 10), ("sgk_sut", 5), ("sgk_gssuy", 5), ("sgk_gen1838", 6),
                  ("sgk_1479", 3), ("sgk_506", 1), ("sgk_2829", 1)]}),
    ("3201 sayılı Yurt Dışında Geçen Sürelerin Sosyal Güvenlik Bakımından Değerlendirilmesi Hakkında Kanun", KURUM, {"sef": [("sgk_3201", 3)]}),
    ("2925 sayılı Tarım İşçileri Sosyal Sigortalar Kanunu (yürürlükteki hükümler)", KURUM, {"sef": [("sgk_2925", 2)]}),
    ("5434 sayılı T.C. Emekli Sandığı Kanunu (yürürlükteki hükümler)", KURUM, {"sef": [("sgk_5434", 5)]}),
    ("4 sayılı CBK Otuzuncu Bölüm ve 5502 sayılı SGK'ya İlişkin Bazı Düzenlemeler Hakkında Kanun", KURUM, {"sef": [("sgk_cbk", 7)], "memur": [("sgk_cbk", 10)]}),
    ("4857 sayılı İş Kanunu", KURUM, {"sef": [("sgk_4857", 4)], "memur": [("sgk_4857", 5)]}),
    ("4447 sayılı İşsizlik Sigortası Kanunu", KURUM, {"sef": [("sgk_4447", 2)]}),
]
TITLES = {"sef": ("sgk_sef", "Şef"), "memur": ("sgk_memur", "Memur")}


def usable(q):
    o = q["options"]
    if len(o) != 4 or q["answer"] not in o or len(set(o.values())) != 4:
        return False
    if re.search(r"(?i)\b(yukarıdaki|aşağıdaki)\s+(tablo|şekil|grafik|görsel)", q["text"]):
        return False
    return not q.get("visual")


def main(src, dst, week=1):
    data = json.load(open(src, encoding="utf-8"))
    pools = {}
    for q in data["questions"]:
        if usable(q):
            pools.setdefault(q["topicId"], []).append(q)
    seen_text, bank, exams = set(), {}, {}
    for key, (pid, label) in TITLES.items():
        ids, dist = [], []
        for name, section, per in PLAN:
            if key not in per:
                continue
            count = 0
            for tid, n in per[key]:
                pool = sorted(pools[tid], key=lambda q: q["id"])
                random.Random("sgk|" + tid).shuffle(pool)
                picked = []
                for q in pool[(week - 1) * n * 3:]:  # bol bol yedek: tekrar eden metinler atlanır
                    if len(picked) == n:
                        break
                    if q["text"] in seen_text and q["id"] not in bank:
                        continue
                    picked.append(q)
                if len(picked) < n:
                    raise SystemExit("Havuz yetersiz: " + tid)
                for q in picked:
                    seen_text.add(q["text"])
                    ids.append(q["id"])
                    bank[q["id"]] = {k: q[k] for k in ("topic", "topicId", "altKonu", "text", "options", "answer", "solution")}
                    bank[q["id"]]["correct_answer"] = q["answer"]
                count += n
            dist.append({"label": name, "count": count, "official": count, "section": section})
        assert len(ids) == len(set(ids)) == 100 == sum(d["count"] for d in dist), (key, len(ids))
        exams[pid] = {"label": label, "total": 100, "duration": 135, "officialTotal": 100,
                      "group": "Görevde Yükselme", "ids": ids, "dist": dist}
    json.dump({"bank": bank, "exams": exams}, open(dst, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("tamam:", {k: len(v["ids"]) for k, v in exams.items()}, "benzersiz soru:", len(bank))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 1)
