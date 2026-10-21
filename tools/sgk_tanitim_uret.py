#!/usr/bin/env python3
"""SGK paket tanıtımı verisi: soru havuzundan unvan istatistikleri + içerik JSON'undan örnek bağlantılar.

Kullanım:  python3 -I tools/sgk_tanitim_uret.py <sgksorukesin.json> <sgkicerikkesin.json> <cikti.json>
"""
import json, sys
from collections import Counter


def first(v):
    return (v[0] if isinstance(v, list) and v else v) or None


def main(qpath, cpath, dst):
    q = json.load(open(qpath, encoding="utf-8"))
    c = json.load(open(cpath, encoding="utf-8"))
    names = {t["id"]: t["name"] for t in q["topics"]}
    stats = {}
    for pid, prof in q["profiles"].items():
        cnt = Counter(x["topicId"] for x in q["questions"] if pid in x["profiles"])
        top = [{"ad": names[t], "soru": n} for t, n in cnt.most_common(6)]
        stats[pid] = {"total": sum(cnt.values()), "topicCount": len(cnt), "top": top}
    content = {}
    for t in c["topics"]:
        items = []
        for it in t["items"]:
            e = {"altKonu": it["label"]}
            for k in ("pdf", "sunum", "video", "podcast"):
                if first(it.get(k)):
                    e[k] = first(it[k])
            if len(e) > 1:
                items.append(e)
        if items:
            content[t["id"]] = {"konu": t["label"], "items": items}
    json.dump({"stats": stats, "content": content, "topics": {p: v["topicIds"] for p, v in q["profiles"].items()}},
              open(dst, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print({k: (v["total"], v["topicCount"]) for k, v in stats.items()}, "içerik konusu:", len(content))


if __name__ == "__main__":
    main(*sys.argv[1:4])
