"""OCR scanned survey report renders. Output is a draft — verify visually before golden use."""
from pathlib import Path
from rapidocr_onnxruntime import RapidOCR

ocr = RapidOCR()
root = Path(__file__).resolve().parents[2]
out = root / "research" / "golden" / "source-pdfs" / "_ocr"
out.mkdir(parents=True, exist_ok=True)

paths = []
paths += sorted((root / "research/golden/source-pdfs/_render/oregon_strips").glob("*.png"))
for name in [
    "nm_3003929320_5_WF_p3.png",
    "nm_3003929320_5_WF_p4.png",
    "nm_3003929320_5_WF_p5.png",
    "nm_3003929461_13_WF_p1.png",
    "nm_3003929461_13_WF_p2.png",
    "nm_3003929461_13_WF_p3.png",
    "nm_3004532380_7_WF_p4.png",
    "nm_3004532380_7_WF_p5.png",
]:
    p = root / "research/golden/source-pdfs/_render" / name
    if p.exists():
        paths.append(p)

for p in paths:
    result, elapse = ocr(str(p))
    items = []
    if result:
        for box, text, score in result:
            y = sum(pt[1] for pt in box) / 4.0
            x = sum(pt[0] for pt in box) / 4.0
            items.append((y, x, float(score), text))
    items.sort()
    # cluster into rows by y proximity
    rows = []
    for y, x, score, text in items:
        if not rows or abs(y - rows[-1][0][0]) > 12:
            rows.append([(y, x, score, text)])
        else:
            rows[-1].append((y, x, score, text))
    lines = [f"# {p.name} items={len(items)}"]
    for row in rows:
        row.sort(key=lambda t: t[1])
        texts = [t[3] for t in row]
        scores = [f"{t[2]:.2f}" for t in row]
        lines.append(" | ".join(texts) + f"  << {','.join(scores)}")
    dest = out / (p.stem + ".txt")
    dest.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {dest.name} rows={len(rows)}")
