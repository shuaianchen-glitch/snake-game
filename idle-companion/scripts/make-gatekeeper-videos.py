#!/usr/bin/env python3
"""
生成 Cat Gatekeeper 同款素材（竖屏放大版）：
  {name}-entry.webm / {name}-idle.webm

源视频映射见 SOURCES；竖屏 9:16 + 主体占屏高 ~92%
"""
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

SOURCES = {
    "whale": "whale-src.mp4",   # Mixkit #15275 水族馆单只海豚
    "cat": "cat-src.mp4",       # Mixkit #22732 白猫近景
    "fox": "fox-src.mp4",       # Mixkit #11380 狐狸近景
}

ENTRY_SEC = 3.0
IDLE_SEC = 5.0
OUT_FPS = 24
MAX_WIDTH = 1280
TARGET_W = 900
TARGET_H = 1600
FILL_HEIGHT = 0.96


def subject_bbox(img, threshold=40):
    arr = np.array(img)
    mask = arr[:, :, 3] > threshold
    if not mask.any():
        return None
    ys, xs = np.where(mask)
    return xs.min(), ys.min(), xs.max(), ys.max()


def subject_pixels(img):
    return int(np.sum(np.array(img)[:, :, 3] > 80))


def refine_alpha(img):
    arr = np.array(img).astype(np.float32)
    a = arr[:, :, 3]
    solid = a > 70
    edge = (a > 10) & ~solid
    a[solid] = 255
    a[edge] = np.clip(a[edge] * 2.4, 0, 240)
    a[a <= 10] = 0
    blur = Image.fromarray(a.astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    arr[:, :, 3] = np.array(blur, dtype=np.float32)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def zoom_source_frame(img, session, min_fill=0.32):
    """源帧主体太小时，先裁切放大再抠图"""
    scan_w = 640
    ratio = scan_w / img.width
    small = img.resize((scan_w, max(1, int(img.height * ratio))), Image.LANCZOS)
    probe = remove(small, session=session)
    bb = subject_bbox(probe, threshold=50)
    if not bb:
        return img

    sw, sh = small.size
    sx0, sy0, sx1, sy1 = bb
    subj_w, subj_h = sx1 - sx0 + 1, sy1 - sy0 + 1
    fill = max(subj_w / sw, subj_h / sh)
    if fill >= min_fill:
        return img

    cx = (sx0 + sx1) / 2
    cy = (sy0 + sy1) / 2
    crop_w = min(sw, max(subj_w * 2.4, sw * 0.62))
    crop_h = min(sh, max(subj_h * 2.4, sh * 0.62))
    x0 = int(max(0, min(sw - crop_w, cx - crop_w / 2)))
    y0 = int(max(0, min(sh - crop_h, cy - crop_h / 2)))
    x1 = int(min(sw, x0 + crop_w))
    y1 = int(min(sh, y0 + crop_h))

    inv = 1 / ratio
    fx0 = int(x0 * inv)
    fy0 = int(y0 * inv)
    fx1 = int(min(img.width, x1 * inv))
    fy1 = int(min(img.height, y1 * inv))
    if fx1 - fx0 < 80 or fy1 - fy0 < 80:
        return img
    return img.crop((fx0, fy0, fx1, fy1))


def to_portrait_frame(frame):
    """竖屏画布，主体占屏高 FILL_HEIGHT，底对齐"""
    bb = subject_bbox(frame)
    if not bb:
        return frame

    target_subj_h = int(TARGET_H * FILL_HEIGHT)
    subj_h = bb[3] - bb[1] + 1
    if subj_h <= 0:
        return frame

    scale = target_subj_h / subj_h
    nw = max(1, int(frame.width * scale))
    nh = max(1, int(frame.height * scale))
    scaled = frame.resize((nw, nh), Image.LANCZOS)

    out = Image.new("RGBA", (TARGET_W, TARGET_H), (0, 0, 0, 0))
    px = (TARGET_W - nw) // 2
    py = TARGET_H - nh - int(TARGET_H * 0.02)
    out.paste(scaled, (px, py), scaled)
    return out


def scan_best_start(reader, session, window_frames=24, step=2, scan_width=640):
    meta = reader.get_meta_data()
    fps = meta.get("fps", 25) or 25
    total = int(meta.get("duration", 10) * fps)
    scores = []

    for idx in range(0, total, step):
        try:
            frame = reader.get_data(idx)
        except (IndexError, ValueError):
            break
        img = Image.fromarray(frame)
        img = zoom_source_frame(img, session)
        r = scan_width / img.width
        small = img.resize((scan_width, max(1, int(img.height * r))), Image.LANCZOS)
        cut = remove(small, session=session)
        scores.append((idx, subject_pixels(cut)))

    if not scores:
        return 0

    best_sum = 0
    best_start = scores[0][0]
    win = max(1, window_frames // step)
    for i in range(max(1, len(scores) - win + 1)):
        s = sum(scores[j][1] for j in range(i, min(i + win, len(scores))))
        if s > best_sum:
            best_sum = s
            best_start = scores[i][0]
    return best_start


def extract_segment_frames(reader, session, start_idx, duration_sec, src_fps):
    end_idx = start_idx + int(duration_sec * src_fps)
    step = max(1, round(src_fps / OUT_FPS))
    samples = []

    for idx in range(start_idx, end_idx, step):
        try:
            raw = reader.get_data(idx)
        except (IndexError, ValueError):
            break

        img = Image.fromarray(raw)
        img = zoom_source_frame(img, session)
        if img.width > MAX_WIDTH:
            r = MAX_WIDTH / img.width
            img = img.resize((MAX_WIDTH, max(1, int(img.height * r))), Image.LANCZOS)

        cut = refine_alpha(remove(img, session=session))
        bb = subject_bbox(cut)
        if not bb or subject_pixels(cut) < 8000:
            continue

        pad = 24
        x0, y0, x1, y1 = bb
        w, h = cut.size
        x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
        x1, y1 = min(w - 1, x1 + pad), min(h - 1, y1 + pad)
        samples.append((cut, (x0, y0, x1, y1)))

    if len(samples) < 6:
        return []

    ux0 = min(s[1][0] for s in samples)
    uy0 = min(s[1][1] for s in samples)
    ux1 = max(s[1][2] for s in samples)
    uy1 = max(s[1][3] for s in samples)
    cw, ch = ux1 - ux0 + 1, uy1 - uy0 + 1

    out_frames = []
    for cut, (x0, y0, x1, y1) in samples:
        cropped = cut.crop((x0, y0, x1 + 1, y1 + 1))
        canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        canvas.paste(cropped, (x0 - ux0, y0 - uy0), cropped)
        out_frames.append(to_portrait_frame(canvas))

    return crop_sequence_tight(out_frames)


def crop_sequence_tight(frames, pad=16):
    """去掉透明边距，让主体撑满视频帧（Gatekeeper 同款）"""
    if not frames:
        return frames

    union = None
    for fr in frames:
        bb = subject_bbox(fr, threshold=25)
        if not bb:
            continue
        if union is None:
            union = list(bb)
        else:
            union[0] = min(union[0], bb[0])
            union[1] = min(union[1], bb[1])
            union[2] = max(union[2], bb[2])
            union[3] = max(union[3], bb[3])

    if union is None:
        return frames

    x0 = max(0, union[0] - pad)
    y0 = max(0, union[1] - pad)
    x1 = min(frames[0].width - 1, union[2] + pad)
    y1 = min(frames[0].height - 1, union[3] + pad)

    return [fr.crop((x0, y0, x1 + 1, y1 + 1)) for fr in frames]


def encode_webm(frames, out_path):
    if len(frames) < 6:
        return False

    tmp = out_path + "_frames"
    os.makedirs(tmp, exist_ok=True)
    for i, fr in enumerate(frames):
        fr.save(os.path.join(tmp, f"{i:04d}.png"), optimize=True)

    cmd = [
        FFMPEG, "-y",
        "-framerate", str(OUT_FPS),
        "-i", os.path.join(tmp, "%04d.png"),
        "-c:v", "libvpx-vp9",
        "-pix_fmt", "yuva420p",
        "-auto-alt-ref", "0",
        "-lag-in-frames", "0",
        "-row-mt", "1",
        "-crf", "8",
        "-b:v", "0",
        out_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    shutil.rmtree(tmp)
    return True


def process(name):
    src_name = SOURCES.get(name, f"{name}.mp4")
    src = os.path.join(ASSETS, src_name)
    if not os.path.exists(src):
        fallback = os.path.join(ASSETS, f"{name}.mp4")
        src = fallback if os.path.exists(fallback) else src

    entry_out = os.path.join(ASSETS, f"{name}-entry.webm")
    idle_out = os.path.join(ASSETS, f"{name}-idle.webm")

    if not os.path.exists(src):
        print(f"missing {src}")
        return False

    session = new_session("u2net")
    reader = imageio.get_reader(src, "ffmpeg")
    meta = reader.get_meta_data()
    src_fps = meta.get("fps", 25) or 25
    duration = meta.get("duration", 10)

    print(f"[{name}] source={os.path.basename(src)} portrait={TARGET_W}x{TARGET_H}")
    print(f"[{name}] scanning best segment...")
    start = scan_best_start(reader, session)
    print(f"[{name}] start frame {start}")

    print(f"[{name}] entry {ENTRY_SEC}s...")
    entry_frames = extract_segment_frames(reader, session, start, ENTRY_SEC, src_fps)
    print(f"[{name}] entry frames: {len(entry_frames)}")

    idle_start = start + int(ENTRY_SEC * src_fps)
    if idle_start / src_fps + IDLE_SEC > duration - 0.5:
        idle_start = max(0, start)

    print(f"[{name}] idle {IDLE_SEC}s from {idle_start}...")
    idle_frames = extract_segment_frames(reader, session, idle_start, IDLE_SEC, src_fps)
    if len(idle_frames) < 20 and len(entry_frames) >= 8:
        idle_frames = entry_frames[-min(48, len(entry_frames)) :]
        print(f"[{name}] idle fallback: reuse entry tail ({len(idle_frames)} frames)")
    print(f"[{name}] idle frames: {len(idle_frames)}")

    reader.close()

    ok_entry = encode_webm(entry_frames, entry_out)
    ok_idle = encode_webm(idle_frames, idle_out)

    if ok_entry:
        print(f"  entry: {entry_out} ({os.path.getsize(entry_out)/1024/1024:.1f} MB)")
    if ok_idle:
        print(f"  idle:  {idle_out} ({os.path.getsize(idle_out)/1024/1024:.1f} MB)")

    return ok_entry and ok_idle


if __name__ == "__main__":
    names = sys.argv[1:] if len(sys.argv) > 1 else ["cat", "whale", "fox"]
    failed = [n for n in names if not process(n)]
    sys.exit(1 if failed else 0)
