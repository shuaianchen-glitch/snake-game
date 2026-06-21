#!/usr/bin/env python3
"""连续片段提取 + 裁剪主体 → 平滑动画 PNG 序列"""
import os
import sys

import imageio
import numpy as np
from PIL import Image
from rembg import new_session, remove

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(BASE, "assets")


def subject_pixels(img):
    return int(np.sum(np.array(img)[:, :, 3] > 100))


def crop_subject(img, pad=20):
    arr = np.array(img)
    mask = arr[:, :, 3] > 30
    if not mask.any():
        return img
    ys, xs = np.where(mask)
    x0, x1 = max(0, xs.min() - pad), min(arr.shape[1], xs.max() + pad)
    y0, y1 = max(0, ys.min() - pad), min(arr.shape[0], ys.max() + pad)
    return img.crop((x0, y0, x1, y1))


def refine_cutout(img):
    arr = np.array(img).astype(np.float32)
    a = arr[:, :, 3]
    solid = a > 60
    edge = (a > 8) & ~solid
    a[solid] = 255
    a[edge] = np.clip(a[edge] * 2.2, 0, 220)
    a[a <= 8] = 0
    arr[:, :, 3] = np.clip(a, 0, 255)
    return Image.fromarray(arr.astype(np.uint8))


def scan_scores(reader, session, step=2, scan_width=720):
    scores = []
    meta = reader.get_meta_data()
    total = int(meta.get("duration", 10) * meta.get("fps", 25))

    for idx in range(0, total, step):
        try:
            frame = reader.get_data(idx)
        except (IndexError, ValueError):
            break
        img = Image.fromarray(frame)
        r = scan_width / img.width
        small = img.resize((scan_width, int(img.height * r)), Image.LANCZOS)
        cut = remove(small, session=session)
        score = subject_pixels(cut)
        scores.append((idx, score))

    return scores


def best_segment(scores, window=10):
    """找连续 window 帧得分最高的片段起点"""
    if len(scores) < window:
        return scores[0][0] if scores else 0

    best_sum = 0
    best_start = scores[0][0]
    for i in range(len(scores) - window + 1):
        s = sum(scores[j][1] for j in range(i, i + window))
        if s > best_sum:
            best_sum = s
            best_start = scores[i][0]
    return best_start


def process(name, frame_count=18, max_width=1600):
    src = os.path.join(ASSETS, f"{name}.mp4")
    if not os.path.exists(src):
        print(f"missing {src}")
        return False

    session = new_session("u2net")
    reader = imageio.get_reader(src, "ffmpeg")
    meta = reader.get_meta_data()
    src_fps = meta.get("fps", 25) or 25

    print(f"scanning {name}...")
    scores = scan_scores(reader, session)
    if not scores:
        reader.close()
        return False

    start_idx = best_segment(scores, window=8)
    step = 1
    span = max(frame_count * 2, 24)
    indices = [start_idx + i * step for i in range(span)]
    print(f"segment start={start_idx}, step={step}, frames={len(indices)}")

    saved = 0
    for idx in indices:
        try:
            frame = reader.get_data(idx)
        except (IndexError, ValueError):
            continue

        img = Image.fromarray(frame)
        if img.width > max_width:
            r = max_width / img.width
            img = img.resize((max_width, int(img.height * r)), Image.LANCZOS)

        cut = refine_cutout(remove(img, session=session))
        cut = crop_subject(cut, pad=24)
        px = subject_pixels(cut)
        w, h = cut.size
        if px < 40000 or max(w, h) > 1100:
            if saved >= 10:
                break
            continue

        if saved >= frame_count:
            break

        out = os.path.join(ASSETS, f"{name}-frame{saved}.png")
        cut.save(out, optimize=True)
        print(f"  frame{saved}: idx={idx} size={cut.size} px={px}")
        saved += 1
        if saved == 1:
            cut.save(os.path.join(ASSETS, f"{name}-cutout.png"), optimize=True)

    reader.close()
    print(f"done: {saved} frames")
    return saved >= 8


if __name__ == "__main__":
    name = sys.argv[1] if len(sys.argv) > 1 else "whale"
    ok = process(name)
    sys.exit(0 if ok else 1)
