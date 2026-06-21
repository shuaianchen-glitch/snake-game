#!/usr/bin/env python3
"""
优质白底素材 → 色度键 + 帧间平滑 → 稳定透明 WebM
同源猫咪减少跳变；优先 Mixkit 白底/简洁背景
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

CANVAS_W = 1080
CANVAS_H = 1920
SUBJ_H = int(CANVAS_H * 0.98)
BOTTOM_PAD = 0
OUT_FPS = 30
OVERSCAN = 1.12

PEXELS_SRC = "13673965_3840_2160_30fps.mp4"
CAT_LOOP = (PEXELS_SRC, 0.0, 9.5, "rembg")

# Pexels 手动下载后放 assets/，存在则优先于 Mixkit
PEXELS = {
    "entry": [
        ("13673965_3840_2160_30fps.mp4", 0.0, 3.0, "rembg"),
    ],
    "idle": [
        ("13673965_3840_2160_30fps.mp4", 5.0, 4.0, "rembg"),
    ],
    "groom": [
        ("cat-groom-pexels.mp4", 0.0, 8.0, "rembg"),
        ("13673965_3840_2160_30fps.mp4", 0.0, 8.0, "rembg"),
    ],
    "lie": [
        ("cat-lie-pexels.mp4", 0.0, 5.0, "rembg"),
    ],
}

# (源文件, 起始秒, 时长秒, 模式: white=色度键 rembg=AI抠图)
CAT_CLIPS = {
    "entry": ("cat-premium-src.mp4", 0.0, 3.5, "white"),
    "walk": ("cat-premium-src.mp4", 1.0, 5.0, "white"),
    "lie": ("cat-premium-src.mp4", 4.0, 4.5, "white"),
    "idle": ("cat-premium-src.mp4", 2.0, 4.0, "white"),
    "groom": ("cat-groom-src.mp4", 0.5, 5.0, "rembg"),
    "yawn": ("cat-yawn-src.mp4", 3.0, 6.0, "rembg"),
}


def find_pexels_clip(clip_id):
    opts = PEXELS.get(clip_id)
    if not opts:
        return None
    if isinstance(opts[0], str):
        opts = [opts]
    for name, start, dur, mode in opts:
        if os.path.isfile(os.path.join(ASSETS, name)):
            return name, start, dur, mode
    return None


def resolve_clip(clip_id, src_name, start, dur, mode):
    pex = find_pexels_clip(clip_id)
    if pex:
        return pex
    return src_name, start, dur, mode

DOWNLOADS = {
    # 30fps 白底小猫 — 主素材（最稳）
    "cat-premium-src.mp4": "https://assets.mixkit.co/videos/45407/45407-720.mp4",
    "cat-groom-src.mp4": "https://assets.mixkit.co/videos/7230/7230-720.mp4",
    "cat-yawn-src.mp4": "https://assets.mixkit.co/videos/6897/6897-720.mp4",
}


def download_sources():
    import urllib.request
    for name, url in DOWNLOADS.items():
        path = os.path.join(ASSETS, name)
        if os.path.exists(path) and os.path.getsize(path) > 200000:
            print(f"have {name}")
            continue
        print(f"download {name}...")
        urllib.request.urlretrieve(url, path)


def white_key(img, thresh=240, softness=12):
    arr = np.array(img.convert("RGB")).astype(np.float32)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    dist = np.maximum(np.maximum(255 - r, 255 - g), 255 - b)
    alpha = np.clip((dist - (255 - thresh - softness)) / max(softness, 1) * 255, 0, 255)
    # 近白/浅灰背景强制透明，避免灰块
    alpha = np.where(lum > thresh - 8, 0, alpha)
    rgba = np.dstack([arr, alpha]).astype(np.uint8)
    return Image.fromarray(rgba)


def refine_alpha(img):
    arr = np.array(img).astype(np.float32)
    a = arr[:, :, 3]
    solid = a > 140
    edge = (a > 20) & ~solid
    a[solid] = 255
    a[edge] = np.clip(a[edge] * 1.6, 0, 210)
    a[a <= 20] = 0
    blur = Image.fromarray(a.astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))
    arr[:, :, 3] = np.array(blur, dtype=np.float32)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def stabilize(prev_a, prev_rgb, img):
    arr = np.array(img).astype(np.float32)
    a = arr[:, :, 3]
    rgb = arr[:, :, :3]
    if prev_a is not None:
        a = 0.72 * prev_a + 0.28 * a
        m = (a > 160)[:, :, np.newaxis]
        rgb = np.where(m, 0.55 * prev_rgb + 0.45 * rgb, rgb)
    arr[:, :, :3] = rgb
    arr[:, :, 3] = np.clip(a, 0, 255)
    out = arr.astype(np.uint8)
    return out, out[:, :, 3].astype(np.float32), out[:, :, :3].astype(np.float32)


def subject_bbox(img):
    arr = np.array(img)
    m = arr[:, :, 3] > 50
    if not m.any():
        return None
    ys, xs = np.where(m)
    return xs.min(), ys.min(), xs.max(), ys.max()


def smooth_bbox(history, bb):
    history.append(bb)
    if len(history) > 7:
        history.pop(0)
    xs = [b[0] for b in history]
    ys = [b[1] for b in history]
    xe = [b[2] for b in history]
    ye = [b[3] for b in history]
    return int(np.mean(xs)), int(np.mean(ys)), int(np.mean(xe)), int(np.mean(ye))


def place_on_canvas(cut, bb, scale=None):
    x0, y0, x1, y1 = bb
    pad = 16
    crop = cut.crop((
        max(0, x0 - pad), max(0, y0 - pad),
        min(cut.width, x1 + pad + 1), min(cut.height, y1 + pad + 1),
    ))
    if scale is None:
        scale = SUBJ_H / max(1, crop.height)
    nw, nh = int(crop.width * scale), int(crop.height * scale)
    if nw > CANVAS_W:
        scale *= CANVAS_W / nw
        nw, nh = int(crop.width * scale), int(crop.height * scale)
    scaled = crop.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    canvas.paste(scaled, ((CANVAS_W - nw) // 2, CANVAS_H - nh - BOTTOM_PAD), scaled)
    return canvas


def extract_clip_fixed(src_path, mode, start_sec, duration_sec, session):
    """同源固定缩放 + 底对齐，切换/循环不跳"""
    reader = imageio.get_reader(src_path, "ffmpeg")
    src_fps = reader.get_meta_data().get("fps", 30) or 30
    step = max(1, round(src_fps / OUT_FPS))
    start_i = int(start_sec * src_fps)
    end_i = start_i + int(duration_sec * src_fps)

    prev_a = prev_rgb = None
    staged = []

    for idx in range(start_i, end_i, step):
        try:
            raw = reader.get_data(idx)
        except (IndexError, ValueError):
            break
        img = Image.fromarray(raw)
        if img.width > 1280:
            r = 1280 / img.width
            img = img.resize((1280, int(img.height * r)), Image.LANCZOS)

        if mode == "white":
            cut = refine_alpha(white_key(img))
        else:
            cut = refine_alpha(remove(img, session=session))

        stable, prev_a, prev_rgb = stabilize(prev_a, prev_rgb, cut)
        cut = Image.fromarray(stable)
        bb = subject_bbox(cut)
        if not bb:
            continue
        staged.append((cut, bb))

    reader.close()
    if not staged:
        return []

    max_h = max(bb[3] - bb[1] for _, bb in staged)
    fixed_scale = SUBJ_H / max(1, max_h)
    frames = [place_on_canvas(cut, bb, fixed_scale) for cut, bb in staged]
    return autofit_frames(frames)


def frame_content_box(img, thresh=40):
    arr = np.array(img)
    m = arr[:, :, 3] > thresh
    if not m.any():
        return 0, 0, img.width, img.height
    ys, xs = np.where(m)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def autofit_frames(frames, margin=28):
    """裁掉透明留白并放大到满画布，播放时真正挡屏"""
    boxes = [frame_content_box(f) for f in frames]
    x0 = max(0, min(b[0] for b in boxes) - margin)
    y0 = max(0, min(b[1] for b in boxes) - margin)
    x1 = min(frames[0].width, max(b[2] for b in boxes) + margin)
    y1 = min(frames[0].height, max(b[3] for b in boxes) + margin)
    cw, ch = max(1, x1 - x0), max(1, y1 - y0)
    scale = min(CANVAS_W / cw, CANVAS_H / ch) * OVERSCAN
    out = []
    for f in frames:
        crop = f.crop((x0, y0, x1, y1))
        nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
        scaled = crop.resize((nw, nh), Image.LANCZOS)
        canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
        canvas.paste(scaled, ((CANVAS_W - nw) // 2, CANVAS_H - nh), scaled)
        out.append(canvas)
    return temporal_alpha_pass(out)


def temporal_alpha_pass(frames):
    """时序中值 + 柔边，减轻 rembg 边缘闪烁"""
    alphas = [np.array(f)[:, :, 3].astype(np.float32) for f in frames]
    out = []
    for i, fr in enumerate(frames):
        lo = max(0, i - 2)
        hi = min(len(alphas), i + 3)
        med = np.median(np.stack(alphas[lo:hi]), axis=0)
        a = 0.65 * med + 0.35 * alphas[i]
        solid = a > 210
        a[solid] = 255
        a[a < 18] = 0
        soft = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).filter(
            ImageFilter.GaussianBlur(0.8)
        )
        arr = np.array(fr).copy()
        arr[:, :, 3] = np.array(soft)
        out.append(Image.fromarray(arr))
    return out


def extract_clip(src_path, mode, start_sec, duration_sec, session):
    reader = imageio.get_reader(src_path, "ffmpeg")
    src_fps = reader.get_meta_data().get("fps", 30) or 30
    step = max(1, round(src_fps / OUT_FPS))
    start_i = int(start_sec * src_fps)
    end_i = start_i + int(duration_sec * src_fps)

    prev_a = prev_rgb = None
    bbox_hist = []
    frames = []

    for idx in range(start_i, end_i, step):
        try:
            raw = reader.get_data(idx)
        except (IndexError, ValueError):
            break
        img = Image.fromarray(raw)
        if img.width > 1280:
            r = 1280 / img.width
            img = img.resize((1280, int(img.height * r)), Image.LANCZOS)

        if mode == "white":
            cut = refine_alpha(white_key(img))
        else:
            cut = refine_alpha(remove(img, session=session))

        stable, prev_a, prev_rgb = stabilize(prev_a, prev_rgb, cut)
        cut = Image.fromarray(stable)
        bb = subject_bbox(cut)
        if not bb:
            continue
        bb = smooth_bbox(bbox_hist, bb)
        frames.append(place_on_canvas(cut, bb))

    reader.close()
    return frames


def encode_webm(frames, out_path):
    if len(frames) < 12:
        return False
    tmp = out_path + "_tmp"
    os.makedirs(tmp, exist_ok=True)
    for i, fr in enumerate(frames):
        fr.save(os.path.join(tmp, f"{i:04d}.png"))
    cmd = [
        FFMPEG, "-y", "-framerate", str(OUT_FPS),
        "-i", os.path.join(tmp, "%04d.png"),
        "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
        "-auto-alt-ref", "0", "-crf", "12", "-b:v", "0", out_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    shutil.rmtree(tmp)
    return True


def main():
    import sys
    loop_only = "--loop-only" in sys.argv

    download_sources()
    session = new_session("u2net")

    pexels_path = os.path.join(ASSETS, PEXELS_SRC)
    if os.path.isfile(pexels_path):
        src_name, start, dur, mode = CAT_LOOP
        out = os.path.join(ASSETS, "cat-loop.webm")
        print(f"[loop] {src_name} {mode} {start}s +{dur}s fixed @ {OUT_FPS}fps")
        frames = extract_clip_fixed(os.path.join(ASSETS, src_name), mode, start, dur, session)
        if not encode_webm(frames, out):
            print(f"  FAIL ({len(frames)} frames)")
            return 1
        print(f"  -> {out} ({os.path.getsize(out)//1024}KB, {len(frames)}f)")
        for alias in ("cat-entry.webm", "cat-idle.webm"):
            alias_path = os.path.join(ASSETS, alias)
            if os.path.exists(alias_path):
                os.remove(alias_path)
            try:
                os.link(out, alias_path)
            except OSError:
                shutil.copy2(out, alias_path)
            print(f"  -> {alias} (same loop)")
        if loop_only:
            return 0

    if loop_only:
        print(f"missing {pexels_path}")
        return 1

    for clip_id, (src_name, start, dur, mode) in CAT_CLIPS.items():
        src_name, start, dur, mode = resolve_clip(clip_id, src_name, start, dur, mode)
        src = os.path.join(ASSETS, src_name)
        out = os.path.join(ASSETS, f"cat-{clip_id}.webm")
        print(f"[{clip_id}] {src_name} {mode} {start}s +{dur}s @ {OUT_FPS}fps")
        frames = extract_clip(src, mode, start, dur, session)
        if not encode_webm(frames, out):
            print(f"  FAIL ({len(frames)} frames)")
            return 1
        print(f"  -> {out} ({os.path.getsize(out)//1024}KB, {len(frames)}f)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
