#!/usr/bin/env python3
"""AI 抠图 + 主体加固 + 帧间平滑 → 稳定透明 WebM"""
import os
import shutil
import subprocess
import sys

import imageio
import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageFilter
from rembg import new_session, remove

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(BASE, "assets")


def feather_alpha(alpha, radius=1.2):
    img = Image.fromarray(np.clip(alpha, 0, 255).astype(np.uint8))
    img = img.filter(ImageFilter.GaussianBlur(radius=radius))
    return np.array(img, dtype=np.float32)


def stabilize_frame(img, prev_alpha=None, prev_rgb=None):
    arr = np.array(img).astype(np.float32)
    alpha = arr[:, :, 3]

    if prev_alpha is not None:
        alpha = 0.4 * prev_alpha + 0.6 * alpha

    solid = alpha > 80
    edge = (alpha > 15) & ~solid
    background = alpha <= 15

    alpha[solid] = 255
    alpha[edge] = np.clip(alpha[edge] * 2.8, 0, 255)
    alpha[background] = 0
    alpha = feather_alpha(alpha, radius=1.0)

    arr[:, :, 3] = np.clip(alpha, 0, 255)

    if prev_rgb is not None:
        mask = alpha > 200
        m3 = mask[:, :, np.newaxis]
        blended = 0.35 * prev_rgb + 0.65 * arr[:, :, :3]
        arr[:, :, :3] = np.where(m3, blended, arr[:, :, :3])

    out = arr.astype(np.uint8)
    return Image.fromarray(out), out[:, :, 3].astype(np.float32), out[:, :, :3].astype(np.float32)


def process(name, max_frames=90, fps=15, max_width=1280, start_sec=1.0):
    src = os.path.join(ASSETS, f"{name}.mp4")
    out = os.path.join(ASSETS, f"{name}-alpha.webm")
    tmp = os.path.join(ASSETS, f"_tmp_{name}")

    if not os.path.exists(src):
        print(f"skip: {src} not found")
        return False

    os.makedirs(tmp, exist_ok=True)
    session = new_session("u2net")
    reader = imageio.get_reader(src, "ffmpeg")
    meta = reader.get_meta_data()
    src_fps = meta.get("fps", 24) or 24
    start_frame = int(start_sec * src_fps)
    step = max(1, round(src_fps / fps))
    saved = 0
    prev_alpha = None
    prev_rgb = None

    print(f"processing {name}: u2net, start={start_sec}s, step={step}, frames={max_frames}")
    for i, frame in enumerate(reader):
        if i < start_frame:
            continue
        if (i - start_frame) % step != 0:
            continue
        if saved >= max_frames:
            break

        img = Image.fromarray(frame)
        if img.width > max_width:
            ratio = max_width / img.width
            img = img.resize((max_width, int(img.height * ratio)), Image.LANCZOS)

        cut = remove(img, session=session)
        stable, prev_alpha, prev_rgb = stabilize_frame(cut, prev_alpha, prev_rgb)
        stable.save(os.path.join(tmp, f"{saved:04d}.png"))
        saved += 1
        if saved % 5 == 0:
            print(f"  {saved}/{max_frames}")

    reader.close()

    if saved == 0:
        print("error: no frames processed")
        shutil.rmtree(tmp)
        return False

    cmd = [
        FFMPEG, "-y",
        "-framerate", str(fps),
        "-i", os.path.join(tmp, "%04d.png"),
        "-c:v", "libvpx-vp9",
        "-pix_fmt", "yuva420p",
        "-auto-alt-ref", "0",
        "-lag-in-frames", "0",
        "-b:v", "4M",
        "-crf", "16",
        out,
    ]
    print("encoding webm...")
    subprocess.run(cmd, check=True)
    shutil.rmtree(tmp)
    print(f"done: {out} ({os.path.getsize(out) / 1024 / 1024:.1f} MB, {saved} frames)")
    return True


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "whale"
    ok = process(target)
    sys.exit(0 if ok else 1)
