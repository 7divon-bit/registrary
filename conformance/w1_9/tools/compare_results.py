#!/usr/bin/env python3
import json, sys
from pathlib import Path

if len(sys.argv) != 3:
    raise SystemExit("usage: compare_results.py GO.json RUST.json")

def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))

def input_map(doc):
    return {(x["fixture_id"], x["label"]): x for x in doc.get("input_results", [])}

def semantic_map(doc):
    return {(x["fixture_id"], x["rule_id"], x["assertion_target"]): x for x in doc.get("semantic_results", [])}

g, r = load(sys.argv[1]), load(sys.argv[2])
diffs=[]

gm, rm = input_map(g), input_map(r)
for key in sorted(set(gm) | set(rm)):
    if key not in gm or key not in rm:
        diffs.append({"kind":"missing_input","key":key})
        continue
    for field in ["schema_valid","normalized","jcs_hex","sha256","self_hash_stored","self_hash_calculated","self_hash_match"]:
        if gm[key].get(field) != rm[key].get(field):
            diffs.append({"kind":"input","key":key,"field":field,"go":gm[key].get(field),"rust":rm[key].get(field)})

gs, rs = semantic_map(g), semantic_map(r)
for key in sorted(set(gs) | set(rs)):
    if key not in gs or key not in rs:
        diffs.append({"kind":"missing_semantic","key":key})
        continue
    for field in ["actual_outcome","evaluable","match","trace"]:
        if gs[key].get(field) != rs[key].get(field):
            diffs.append({"kind":"semantic","key":key,"field":field,"go":gs[key].get(field),"rust":rs[key].get(field)})

print(json.dumps({"equivalent": not diffs, "diff_count": len(diffs), "diffs": diffs}, indent=2, ensure_ascii=False))
raise SystemExit(0 if not diffs else 1)
