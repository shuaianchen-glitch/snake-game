#!/bin/bash
cd "$(dirname "$0")"
PORT=8080
echo ""
echo "  贪吃蛇已启动！"
echo "  在浏览器打开: http://localhost:${PORT}"
echo "  按 Ctrl+C 停止服务器"
echo ""
python3 -m http.server "$PORT"
