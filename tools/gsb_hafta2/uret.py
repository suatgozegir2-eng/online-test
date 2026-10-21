#!/usr/bin/env python3
"""GSB mülakat denemesi 2. hafta soru bankasını üretir ve doğrular.

Kullanım:
  python3 -I tools/gsb_hafta2/uret.py <panel.html> <cikti_bank2.json> <kontrol.md>

1. denemedeki (GSB_BANK) her bankNumber yuvası için aynı konu, bölüm ve zorlukta yeni bir soru bulunur;
böylece 21 unvanın 1. denemedeki konu dağılımı ve zorluk dengesi aynen korunur.
Doğru şık konumları dengeli dağıtılır (sabit sıralı seçenekler hariç).
"""
import json, random, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genel import G
from bilgi1 import K1
from bilgi2 import K2
from bilgi3 import K3
from secenek_duzelt import OV

ALL = []
for (n, d, t, o, a, so, c) in G + K1 + K2 + K3:
    if n in OV:
        assert a is None, f'#{n}: sabit sıralı soru düzeltme listesinde olamaz'
        o = OV[n]
    ALL.append((n, d, t, o, a, so, c))


def week1_bank(html):
    s = open(html, encoding="utf-8").read()
    i = s.index("const GSB_BANK = ") + len("const GSB_BANK = ")
    return json.JSONDecoder().raw_decode(s[i:])[0]


def main(html, dst, report):
    w1 = {q["bankNumber"]: q for q in week1_bank(html)}
    nums = [q[0] for q in ALL]
    assert sorted(nums) == sorted(w1), ("Eksik/fazla bankNumber", sorted(set(w1) ^ set(nums)))
    rnd = random.Random("gsb-2026-hafta2")

    # Sabit sıralı sorulardaki doğru şık dağılımı
    fixed = {n: ans for (n, _, _, _, ans, _, _) in ALL if ans is not None}
    count = [0] * 5
    for a in fixed.values():
        count[a] += 1
    free = [n for (n, _, _, _, ans, _, _) in ALL if ans is None]
    target_total = len(ALL) / 5
    targets = []
    for pos in range(5):
        targets += [pos] * max(0, round(target_total) - count[pos])
    while len(targets) < len(free):
        targets.append(min(range(5), key=lambda p: count[p] + targets.count(p)))
    targets = targets[:len(free)]
    rnd.shuffle(targets)
    place = dict(zip(free, targets))

    bank, problems, review = [], [], []
    for (n, diff, text, opts, ans, sol, conf) in ALL:
        base = w1[n]
        if diff != base["difficulty"]:
            problems.append(f"#{n}: zorluk {diff} ≠ 1. deneme {base['difficulty']}")
        if len(opts) != 5 or len(set(opts)) != 5:
            problems.append(f"#{n}: 5 farklı seçenek gerekir")
        if ans is None:
            correct = opts[0]
            rest = opts[1:]
            rnd.shuffle(rest)
            new = rest[:place[n]] + [correct] + rest[place[n]:]
            ans = place[n]
            opts = new
        if not (0 <= ans < 5):
            problems.append(f"#{n}: geçersiz doğru indeks")
        words = len(sol.split())
        if not 15 <= words <= 90:
            problems.append(f"#{n}: çözüm {words} sözcük")
        q = {
            "id": f"GSB-MULAKAT-2-{n:03d}", "bankNumber": n, "section": base["section"], "topicId": base["topicId"],
            "officialTopicNumber": base["officialTopicNumber"], "topic": base["topic"], "text": text,
            "options": opts, "answer": ans, "solution": sol, "difficulty": diff, "week": 2,
            "sourceFile": "GSB_Mulakat_2_Hafta_2026-10-21", "sources": [], "verification": conf,
        }
        for k in ("coverageTopicNumbers", "additionalSource", "coverageNote"):
            if k in base:
                q[k] = base[k]
        bank.append(q)
        review.append((n, base["topic"], diff, conf, text, opts, ans))
    bank.sort(key=lambda q: q["bankNumber"])
    if problems:
        raise SystemExit("\n".join(problems))
    json.dump(bank, open(dst, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

    # --- Özet istatistikler ---
    from collections import Counter
    longest = sum(1 for q in bank if max(range(5), key=lambda i: len(q["options"][i])) == q["answer"])
    print("soru:", len(bank), "| bölüm:", dict(Counter(q["section"] for q in bank)))
    print("zorluk:", dict(Counter(q["difficulty"] for q in bank)))
    print("doğru şık dağılımı:", dict(sorted(Counter(q["answer"] for q in bank).items())))
    print("doğru şık en uzun olan:", longest, "/", len(bank))
    print("güven:", dict(Counter(q["verification"] for q in bank)))

    # --- Kontrol listesi (yayımdan önce doğrulama için) ---
    names = {"Y": "Yüksek", "O": "Orta", "D": "Düşük"}
    lines = ["# GSB Mülakat Denemesi — 2. Hafta Soru Kontrol Listesi", "",
             "Sorular, 1. denemedeki konu/zorluk yuvalarına göre yazılmıştır. Yazım sırasında internetteki güncel mevzuata erişilemedi; "
             "bu nedenle **Orta** ve **Düşük** güvenli sorular yayımdan önce güncel mevzuat metninden doğrulanmalıdır.", "",
             "| No | Konu | Zorluk | Güven | Doğru cevap |", "|---|---|---|---|---|"]
    for (n, topic, diff, conf, text, opts, ans) in sorted(review):
        lines.append(f"| {n} | {topic[:70]} | {diff} | {names[conf]} | {'ABCDE'[ans]}) {opts[ans][:70]} |")
    open(report, "w", encoding="utf-8").write("\n".join(lines) + "\n")


if __name__ == "__main__":
    main(*sys.argv[1:4])
