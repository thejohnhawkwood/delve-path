"""Scan PDF pages and write OCR header lines to files (no console unicode)."""
from pathlib import Path
import fitz
from rapidocr_onnxruntime import RapidOCR

ocr = RapidOCR()
root = Path(__file__).resolve().parents[2]
out = root / "research" / "golden" / "source-pdfs" / "_ocr"
render = root / "research" / "golden" / "source-pdfs" / "_render"

jobs = [
    (root / "research/golden/source-pdfs/compass_30039313630000_20251003.pdf", 0, 21),
    (root / "research/golden/source-pdfs/compass_30015559690000_20250812.pdf", 8, 20),
    (root / "research/golden/source-pdfs/hawkeye_idaho_Fallon1-10_DIR_20180218.pdf", 1, 16),
]

for pdf, start, end in jobs:
    doc = fitz.open(pdf)
    end = min(end, doc.page_count)
    lines = [f"# {pdf.name} pages {doc.page_count}"]
    for i in range(start, end):
        pix = doc[i].get_pixmap(matrix=fitz.Matrix(1.15, 1.15), alpha=False)
        png = render / f"{pdf.stem}_scan_p{i+1}.png"
        pix.save(str(png))
        result, _ = ocr(str(png))
        texts = [item[1] for item in (result or [])[:18]]
        lines.append(f"p{i+1}: " + " | ".join(texts))
    dest = out / f"{pdf.stem}_headers.txt"
    dest.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {dest.name}")
