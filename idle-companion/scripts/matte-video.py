#!/usr/bin/env python3
"""
任意 MP4 → 透明 WebM（扩展用）

用法:
  # 1) 从 Pexels 手动下载 MP4，放进 assets/
  # 2) 运行抠图:
  NUMBA_DISABLE_JIT=1 python3 scripts/matte-video.py \\
    assets/cat-groom-pexels.mp4 \\
    -o assets/cat-groom.webm \\
    --mode rembg --start 0 --duration 6

模式:
  white  — 白底/近白底，色度键（最稳、不闪）
  rembg  — AI 逐帧抠图 + 帧间平滑（沙发/草地等复杂背景）
"""
import argparse
import importlib.util
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(BASE, "assets")

_spec = importlib.util.spec_from_file_location(
    "make_cat_behaviors",
    os.path.join(os.path.dirname(__file__), "make-cat-behaviors.py"),
)
_mcb = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mcb)


def main():
    p = argparse.ArgumentParser(description="MP4 → 透明 WebM")
    p.add_argument("input", help="源 MP4 路径")
    p.add_argument("-o", "--output", required=True, help="输出 WebM 路径")
    p.add_argument(
        "--mode",
        choices=("white", "rembg"),
        default="rembg",
        help="white=白底色度键, rembg=AI抠图",
    )
    p.add_argument("--start", type=float, default=0.0, help="起始秒")
    p.add_argument("--duration", type=float, default=5.0, help="时长秒")
    args = p.parse_args()

    src = args.input
    if not os.path.isabs(src):
        if os.path.isfile(src):
            pass
        elif os.path.isfile(os.path.join(ASSETS, os.path.basename(src))):
            src = os.path.join(ASSETS, os.path.basename(src))
        else:
            src = os.path.join(ASSETS, src)

    out = args.output
    if not os.path.isabs(out):
        if out.startswith("assets/"):
            out = os.path.join(BASE, out)
        else:
            out = os.path.join(ASSETS, out)

    if not os.path.isfile(src):
        print(f"找不到源文件: {src}")
        print("请先从 Pexels 下载 MP4，保存到 idle-companion/assets/")
        return 1

    session = _mcb.new_session("u2net") if args.mode == "rembg" else None
    print(f"matte {src}")
    print(f"  mode={args.mode} start={args.start}s dur={args.duration}s")
    frames = _mcb.extract_clip(src, args.mode, args.start, args.duration, session)
    if not _mcb.encode_webm(frames, out):
        print(f"失败: 仅 {len(frames)} 帧")
        return 1
    print(f"完成 -> {out} ({os.path.getsize(out) // 1024} KB, {len(frames)} 帧)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
