"""Write a simple graphite DelvePath icon (PNG + ICO). No third-party deps."""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "src-tauri" / "icons"


def pixel(x: int, y: int, n: int) -> tuple[int, int, int, int]:
    # Graphite field + amber tick mark
    gx = x / (n - 1)
    gy = y / (n - 1)
    r, g, b = 32, 36, 42
    if 0.18 < gx < 0.82 and 0.18 < gy < 0.82:
        r, g, b = 55, 62, 72
    # vertical well
    if abs(gx - 0.42) < 0.06 and 0.22 < gy < 0.82:
        r, g, b = 214, 208, 190
    # kick to the right
    if 0.42 < gx < 0.78 and abs(gy - (0.42 + 0.45 * (gx - 0.42))) < 0.07:
        r, g, b = 201, 162, 39
    return r, g, b, 255


def png(n: int) -> bytes:
    raw = b"".join(b"\x00" + bytes(c for x in range(n) for c in pixel(x, y, n)) for y in range(n))
    ihdr = struct.pack(">IIBBBBB", n, n, 8, 6, 0, 0, 0)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def ico(png_bytes: bytes) -> bytes:
    # PNG-in-ICO (Vista+)
    return struct.pack("<HHH", 0, 1, 1) + struct.pack("<BBBBHHII", 0, 0, 0, 0, 1, 32, len(png_bytes), 22) + png_bytes


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    p32 = png(32)
    p128 = png(128)
    p256 = png(256)
    (OUT / "32x32.png").write_bytes(p32)
    (OUT / "128x128.png").write_bytes(p128)
    (OUT / "icon.ico").write_bytes(ico(p256))
    print(f"wrote icons in {OUT}")


if __name__ == "__main__":
    main()
