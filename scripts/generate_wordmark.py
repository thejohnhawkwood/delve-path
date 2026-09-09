"""DelvePath wordmark from straight stone strokes — no curves, no pixel font."""

from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

CREAM = (214, 208, 190, 255)
OUT = Path(__file__).resolve().parents[1] / "assets" / "web"
ICON = OUT / "delvepath-icon-black.png"

# Each letter: list of (x0, y0, x1, y1) in a 0–10 x 0–16 em box.
# Strokes are thick parallelograms with square or diamond ends.
LETTERS: dict[str, list[tuple[float, float, float, float]]] = {
    "D": [
        (1.6, 0.8, 1.6, 15.2),
        (1.6, 0.8, 5.8, 0.8),
        (5.8, 0.8, 8.0, 8.0),
        (8.0, 8.0, 5.8, 15.2),
        (5.8, 15.2, 1.6, 15.2),
    ],
    "e": [
        (1.8, 5.4, 1.8, 13.8),
        (1.8, 5.4, 7.0, 5.4),
        (1.8, 9.2, 6.6, 9.2),
        (1.8, 13.8, 7.0, 13.8),
    ],
    "l": [
        (3.6, 0.6, 3.6, 15.2),
    ],
    "v": [
        (1.4, 5.2, 5.0, 14.8),
        (8.6, 5.2, 5.0, 14.8),
    ],
    "P": [
        (1.6, 0.8, 1.6, 15.2),
        (1.6, 0.8, 6.0, 0.8),
        (6.0, 0.8, 7.8, 4.4),
        (7.8, 4.4, 6.0, 8.0),
        (6.0, 8.0, 1.6, 8.0),
    ],
    "a": [
        (7.0, 5.2, 7.0, 14.8),
        (2.0, 5.2, 7.0, 5.2),
        (2.0, 5.2, 2.0, 9.4),
        (2.0, 9.4, 7.0, 9.4),
        (2.0, 14.8, 7.0, 14.8),
    ],
    "t": [
        (5.0, 1.0, 5.0, 14.8),
        (1.4, 4.4, 8.6, 4.4),
    ],
    "h": [
        (1.8, 0.6, 1.8, 15.2),
        (1.8, 8.0, 7.2, 8.0),
        (7.2, 8.0, 7.2, 15.2),
    ],
}


def unit(ax: float, ay: float) -> tuple[float, float]:
    n = math.hypot(ax, ay) or 1.0
    return ax / n, ay / n


def stroke_poly(
    x0: float, y0: float, x1: float, y1: float, width: float, diamond: bool
) -> list[tuple[float, float]]:
    dx, dy = x1 - x0, y1 - y0
    ux, uy = unit(dx, dy)
    px, py = -uy, ux
    hw = width / 2
    # square butt
    a = (x0 + px * hw, y0 + py * hw)
    b = (x0 - px * hw, y0 - py * hw)
    c = (x1 - px * hw, y1 - py * hw)
    d = (x1 + px * hw, y1 + py * hw)
    if not diamond:
        return [a, d, c, b]
    tip0 = (x0 - ux * width * 0.55, y0 - uy * width * 0.55)
    tip1 = (x1 + ux * width * 0.55, y1 + uy * width * 0.55)
    return [tip0, a, d, tip1, c, b]


def draw_letter(draw: ImageDraw.ImageDraw, ch: str, ox: float, oy: float, s: float, width: float) -> None:
    for x0, y0, x1, y1 in LETTERS[ch]:
        poly = stroke_poly(ox + x0 * s, oy + y0 * s, ox + x1 * s, oy + y1 * s, width, False)
        draw.polygon(poly, fill=CREAM)


def stone_grain(im: Image.Image) -> Image.Image:
    w, h = im.size
    grain = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gp = grain.load()
    random.seed(11)
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            n = random.randint(-22, 16)
            gp[x, y] = (n + 128, n + 124, n + 112, 70)
    grain = grain.resize((w, h), Image.Resampling.BILINEAR).filter(ImageFilter.GaussianBlur(0.4))
    base = im.copy()
    px = base.load()
    gx = grain.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 10:
                continue
            gr, gg, gb, ga = gx[x, y]
            t = ga / 255 * 0.35
            px[x, y] = (
                int(r * (1 - t) + gr * t),
                int(g * (1 - t) + gg * t),
                int(b * (1 - t) + gb * t),
                a,
            )
    return base


def render_word(width: int, height: int, background: tuple[int, int, int, int]) -> Image.Image:
    im = Image.new("RGBA", (width, height), background)
    draw = ImageDraw.Draw(im)
    text = "DelvePath"
    s = 26
    stroke_w = 38
    box_w = 9.2 * s
    gap = int(0.35 * s)
    total = len(text) * box_w + (len(text) - 1) * gap
    x = (width - total) / 2
    y = (height - 16 * s) / 2
    for ch in text:
        draw_letter(draw, ch, x, y, s, stroke_w)
        x += box_w + gap
    return stone_grain(im)


def punch_black(im: Image.Image) -> Image.Image:
    out = im.copy()
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r + g + b < 36:
                px[x, y] = (0, 0, 0, 0)
    return out


def crop_icon_tile(icon: Image.Image) -> Image.Image:
    rgba = icon.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            if r + g + b > 50:
                xs.append(x)
                ys.append(y)
    pad = 4
    return rgba.crop(
        (max(0, min(xs) - pad), max(0, min(ys) - pad), min(w, max(xs) + pad + 1), min(h, max(ys) + pad + 1))
    )


def lockup(word: Image.Image, icon_path: Path) -> Image.Image:
    icon = crop_icon_tile(Image.open(icon_path))
    target_h = 300
    scale = target_h / icon.size[1]
    icon = icon.resize((max(1, int(icon.size[0] * scale)), target_h), Image.Resampling.LANCZOS)
    bbox = word.getbbox()
    letters = word.crop(bbox) if bbox else word
    gap, side = 44, 64
    inner_w = icon.size[0] + gap + letters.size[0]
    width = max(1920, inner_w + side * 2)
    height = 768
    bg = word.getpixel((0, 0))
    out = Image.new("RGBA", (width, height), bg)
    x0 = (width - inner_w) // 2
    out.paste(icon, (x0, (height - icon.size[1]) // 2), icon)
    out.paste(letters, (x0 + icon.size[0] + gap, (height - letters.size[1]) // 2), letters)
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    black = (0, 0, 0, 255)
    clear = (0, 0, 0, 0)
    word_black = render_word(1920, 768, black)
    word_clear = render_word(1920, 768, clear)
    word_black.save(OUT / "delvepath-wordmark-black.png")
    word_clear.save(OUT / "delvepath-wordmark-transparent.png")
    if ICON.exists():
        lock_black = lockup(word_black, ICON)
        lock_black.save(OUT / "delvepath-lockup-black.png")
        punch_black(lock_black).save(OUT / "delvepath-lockup-transparent.png")
    print(f"wrote stone-stroke wordmarks in {OUT}")


if __name__ == "__main__":
    main()
