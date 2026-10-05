#!/usr/bin/env python3
"""İçişleri soru masterından (sorularicislerixx.json) unvan başına haftalık deneme sınavı dosyaları üretir.

Kullanım: python3 tools/build_exams.py <master.json> <hafta_no> [çıktı_klasörü=data]

Her Pazartesi yayınlanacak sınav için: hafta_no'yu 1 artırıp çalıştırın, data/ klasörünü yükleyin.
Çıktı yalnızca o haftanın sınavıdır (data/<unvan>.json + data/index.json).

- Her unvanın resmî konu dağılımı (profiles.<id>.officialQuestionCounts) birebir uygulanır.
- Hafta N sınavı havuzun N. diliminden seçilir; önceki haftalarla aynı soru çıkmaz (havuz yetiyorsa).
- Seçim sabit tohumla yapılır: aynı master -> aynı sınav (sıralama herkes için aynı kalır).
- Soru bankası eksik konusu olan unvanlar atlanır (tam sınav kurulamaz).
"""
import json, random, sys, os, hashlib

master, week, out = sys.argv[1], int(sys.argv[2]), (sys.argv[3] if len(sys.argv) > 3 else "data")
d = json.load(open(master, encoding="utf-8"))
os.makedirs(out, exist_ok=True)
KEEP = ("id", "topicId", "topic", "altKonu", "text", "options", "answer", "solution", "visual", "optionVisuals")

by = {}
for q in d["questions"]:
    for p in q["profiles"]:
        by.setdefault((p, q["topicId"]), []).append(q)

topic_name = {t["id"]: t["name"] for t in d["topics"]}
index = []
for pid, prof in d["profiles"].items():
    counts = prof["officialQuestionCounts"]
    short = [t for t, n in counts.items() if len(by.get((pid, t), [])) < n * week]
    empty = [t for t, n in counts.items() if not by.get((pid, t))]
    if empty:
        print("ATLANDI (eksik soru bankası):", pid, len(empty), "konu")
        continue
    qs = []
    for t, n in counts.items():
        pool = sorted(by[(pid, t)], key=lambda q: q["id"])
        random.Random(hashlib.sha256(f"{pid}|{t}".encode()).hexdigest()).shuffle(pool)
        # hafta N: havuzun N. dilimi; havuz yetmezse başa sararak devam eder
        for i in range(n):
            q = pool[((week - 1) * n + i) % len(pool)]
            o = {k: q[k] for k in KEEP if k in q}
            o["topic"] = topic_name.get(t, q.get("topic", ""))
            qs.append(o)
    total = prof["officialTotalQuestions"]
    assert len(qs) == total and len({q["id"] for q in qs}) == total, pid
    json.dump({"profile": pid, "name": prof["name"], "week": week, "duration": total, "total": total, "questions": qs},
              open(os.path.join(out, pid + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    index.append({"id": pid, "name": prof["name"], "total": total, "duration": total, "overlap": short})
    print("OK", pid, total, "soru,", str(week) + ". hafta", "(tekrar var: %s)" % short if short else "")
json.dump({"week": week, "profiles": index}, open(os.path.join(out, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
