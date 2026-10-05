#!/usr/bin/env python3
"""İçişleri soru masterından (sorularicislerixx.json) unvan başına haftalık deneme sınavı dosyaları üretir.

Kullanım: python3 tools/build_exams.py <master.json> [çıktı_klasörü=data] [hafta_sayısı=4]

- Her unvanın resmî konu dağılımı (profiles.<id>.officialQuestionCounts) birebir uygulanır.
- Her hafta kendi içinde ve haftalar arasında tekrar eden soru çıkmaz (havuz yetiyorsa).
- Seçim sabit tohumla yapılır: aynı master -> aynı sınav (sıralama herkes için aynı kalır).
- Soru bankası eksik konusu olan unvanlar atlanır (tam sınav kurulamaz).
"""
import json, random, sys, os, hashlib

master, out, weeks = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "data"), int(sys.argv[3]) if len(sys.argv) > 3 else 4
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
    short = [t for t, n in counts.items() if len(by.get((pid, t), [])) < n * weeks]
    empty = [t for t, n in counts.items() if not by.get((pid, t))]
    if empty:
        print("ATLANDI (eksik soru bankası):", pid, len(empty), "konu")
        continue
    wk = {str(w): [] for w in range(1, weeks + 1)}
    for t, n in counts.items():
        pool = sorted(by[(pid, t)], key=lambda q: q["id"])
        random.Random(hashlib.sha256(f"{pid}|{t}".encode()).hexdigest()).shuffle(pool)
        for w in range(1, weeks + 1):
            # hafta w: havuzun w. dilimi; havuz yetmezse başa sararak devam eder
            pick = [pool[((w - 1) * n + i) % len(pool)] for i in range(n)]
            for q in pick:
                o = {k: q[k] for k in KEEP if k in q}
                o["topic"] = topic_name.get(t, q.get("topic", ""))
                wk[str(w)].append(o)
    total = prof["officialTotalQuestions"]
    assert all(len(v) == total for v in wk.values()), pid
    for w, qs in wk.items():
        assert len({q["id"] for q in qs}) == len(qs), (pid, w)
    json.dump({"profile": pid, "name": prof["name"], "duration": total, "total": total, "weeks": wk},
              open(os.path.join(out, pid + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    index.append({"id": pid, "name": prof["name"], "total": total, "weeks": weeks, "overlap": short})
    print("OK", pid, total, "soru x", weeks, "hafta", "(tekrar var: %s)" % short if short else "")
json.dump(index, open(os.path.join(out, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
