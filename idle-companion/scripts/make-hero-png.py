#!/usr/bin/env python3
"""AI 全身图 → 透明竖屏 Hero PNG（Gatekeeper 挡屏）"""
import os
import sys

import numpy as np
from PIL import Image
from rembg import remove

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(BASE, "assets")
TARGET_W = 900
TARGET_H = 1600
FILL = 0.94


def bbox(img):
    arr = np.array(img)
    m = arr[:, :, 3] > 40
    if not m.any():
        return None
    ys, xs = np.where(m)
    return xs.min(), ys.min(), xs.max(), ys.max()


def to_portrait(cut):
    bb = bbox(cut)
    if not bb:
        return cut
    x0, y0, x1, y1 = bb
    pad = 20
    cropped = cut.crop((
        max(0, x0 - pad), max(0, y0 - pad),
        min(cut.width, x1 + pad + 1), min(cut.height, y1 + pad + 1),
    ))
    sh = cropped.height
    scale = (TARGET_H * FILL) / sh
    nw, nh = int(cropped.width * scale), int(cropped.height * scale)
    scaled = cropped.resize((nw, nh), Image.LANCZOS)
    out = Image.new("RGBA", (TARGET_W, TARGET_H), (0, 0, 0, 0))
    out.paste(scaled, ((TARGET_W - nw) // 2, TARGET_H - nh - 20), scaled)
    bb2 = bbox(out)
    if not bb2:
        return out
    return out.crop((bb2[0] - 8, bb2[1] - 8, bb2[2] + 9, bb2[3] + 9))


def process(name):
    src = os.path.join(ASSETS, f"{name}-hero-source.png")
    out = os.path.join(ASSETS, f"{name}-hero.png")
    if not os.path.exists(src):
        print(f"missing {src}")
        return False

    img = Image.open(src).convert("RGBA")
    cut = remove(img)
    hero = to_portrait(cut)
    hero.save(out, optimize=True)
    print(f"{name}: {hero.size} -> {out} ({os.path.getsize(out)//1024}KB)")
    return True


if __name__ == "__main__":
    names = sys.argv[1:] if len(sys.argv) > 1 else ["cat", "whale", "fox"]
    ok = all(process(n) for n in names)
    sys.exit(0 if ok else 1)
