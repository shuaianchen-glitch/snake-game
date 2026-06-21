#!/bin/bash
# Mixkit 近景/竖屏友好源素材（个人使用许可）
set -euo pipefail
ASSETS="$(cd "$(dirname "$0")/.." && pwd)/assets"
mkdir -p "$ASSETS"

curl -fsSL "https://assets.mixkit.co/videos/15275/15275-720.mp4" -o "$ASSETS/whale-src.mp4"
curl -fsSL "https://assets.mixkit.co/videos/22732/22732-1080.mp4" -o "$ASSETS/cat-src.mp4"
curl -fsSL "https://assets.mixkit.co/videos/11380/11380-720.mp4" -o "$ASSETS/fox-src.mp4"

echo "Sources downloaded. Run: python3 scripts/make-gatekeeper-videos.py"
