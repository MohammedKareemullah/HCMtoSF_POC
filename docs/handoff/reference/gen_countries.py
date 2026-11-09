import json
import re
import sys

src, out = sys.argv[1], sys.argv[2]

entries = {}
for raw in open(src, encoding="utf-8"):
    line = raw.rstrip("\n")
    if not line.strip():
        continue
    s = line.strip()
    if s.startswith("C ") and "Country" in s:  # repeated table header
        continue
    if s.startswith("Sun "):
        # printed page footer that overlaps one real row: "Sun Nov 8 22:42:15 2026CA   Canada   1/6"
        m = re.search(r"\d{4}([A-Z]{2})\s+(.+?)\s{2,}\d+/\d+\s*$", s)
        if m:
            entries[m.group(1)] = m.group(2).strip()
        continue
    m = re.match(r"^([A-Z]{2})\s+(.+)$", s)
    if m:
        entries[m.group(1)] = m.group(2).strip()
    else:
        print("UNPARSED:", repr(line), file=sys.stderr)

body = "\n".join(f"  {code}: {json.dumps(name)}," for code, name in sorted(entries.items()))
js = f"""// Country code (T005 LAND1 / T500P-LAND1) -> country/region name.
// Source: "LAND1_code.pdf" (SAP list printed on 2026-11-08), {len(entries)} entries, names exactly as printed
// (SAP short texts, so some are abbreviated, e.g. "Utd.Arab Emir.").
//
// KNOWN GAP IN THE SOURCE DOCUMENT: every printed page lost four rows at its bottom edge, so these
// 20 codes are not in it: CF CG CH CI GM GN GP GQ LI LK LR LS PA PE PF PG TG TH TJ TK.
// countryName() falls back to the ICU English name for codes missing here. To get the exact SAP text for
// them, add the rows below.
export const COUNTRY_NAMES = Object.freeze({{
{body}
}});
"""
open(out, "w", encoding="utf-8").write(js)
print("entries:", len(entries))
