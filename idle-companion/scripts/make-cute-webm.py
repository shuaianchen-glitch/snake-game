#!/usr/bin/env python3
"""从 Hero PNG 生成可爱动效 WebM：滑入入场 + 呼吸摇摆待机"""
import math
import os
import shutil
import subprocess
import sys

import imageio_ffmpeg
from PIL import Image

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(BASE, "assets")
FPS = 24
ENTRY_SEC = 3.0
IDLE_SEC = 3.0


def ease_out_back(t):
    c1 = 1.70158
    c3 = c1 + 1
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2


def render_entry_frames(img, n):
    w, h = img.size
    frames = []
    for i in range(n):
        t = (i + 1) / n
        e = ease_out_back(min(1.0, t))
        slide = (1 - e) * 1.15
        scale = 0.88 + 0.12 * e
        bounce = math.sin(t * math.pi) * 0.02 * (1 - t)
        scale += bounce
        nw, nh = int(w * scale), int(h * scale)
        scaled = img.resize((nw, nh), Image.LANCZOS)
        canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ox = int(w * slide * 0.55 - (nw - w) // 2)
        oy = h - nh - int(h * 0.02) + int(math.sin(t * math.pi * 2) * 3 * (1 - t))
        canvas.paste(scaled, (ox, oy), scaled)
        frames.append(canvas)
    return frames


def render_idle_frames(img, n):
    w, h = img.size
    frames = []
    for i in range(n):
        t = i / n
        breath = math.sin(t * math.pi * 2) * 0.025
        sway = math.sin(t * math.pi * 2 + 0.6) * 1.8
        bob = math.sin(t * math.pi * 2 + 1.2) * 6
        scale = 1.0 + breath
        nw, nh = int(w * scale), int(h * scale)
        scaled = img.resize((nw, nh), Image.LANCZOS)
        rotated = scaled.rotate(sway, resample=Image.BICUBIC, expand=True)
        canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ox = (w - rotated.width) // 2
        oy = h - rotated.height - int(h * 0.02) + int(bob)
        canvas.paste(rotated, (ox, oy), rotated)
        frames.append(canvas)
    return frames


def encode(frames, out_path):
    tmp = out_path + "_tmp"
    os.makedirs(tmp, exist_ok=True)
    for i, fr in enumerate(frames):
        fr.save(os.path.join(tmp, f"{i:04d}.png"))
    cmd = [
        FFMPEG, "-y",
        "-framerate", str(FPS),
        "-i", os.path.join(tmp, "%04d.png"),
        "-c:v", "libvpx-vp9",
        "-pix_fmt", "yuva420p",
        "-auto-alt-ref", "0",
        "-crf", "10",
        "-b:v", "0",
        out_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    shutil.rmtree(tmp)


def process(name):
    hero = os.path.join(ASSETS, f"{name}-hero.png")
    if not os.path.exists(hero):
        print(f"missing {hero}")
        return False

    img = Image.open(hero).convert("RGBA")
    entry_frames = render_entry_frames(img, int(ENTRY_SEC * FPS))
    idle_frames = render_idle_frames(img, int(IDLE_SEC * FPS))

    entry_out = os.path.join(ASSETS, f"{name}-entry.webm")
    idle_out = os.path.join(ASSETS, f"{name}-idle.webm")
    encode(entry_frames, entry_out)
    encode(idle_frames, idle_out)
    print(f"{name}: entry={len(entry_frames)}f idle={len(idle_frames)}f")
    return True


if __name__ == "__main__":
    names = sys.argv[1:] if len(sys.argv) > 1 else ["cat", "whale", "fox"]
    ok = all(process(n) for n in names)
    sys.exit(0 if ok else 1)
