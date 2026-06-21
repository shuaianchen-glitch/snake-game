#!/bin/bash
# 一键部署到公网（首页 + 贪吃蛇 + Idle Companion 项目页）
cd "$(dirname "$0")"

echo ""
echo "  正在部署网站到公网..."
echo "  /              项目首页"
echo "  /snake/        贪吃蛇"
echo "  /idle-companion/  扩展介绍页"
echo "  首次使用需要注册/登录 Netlify 账号（免费）"
echo ""

npx --yes netlify-cli deploy --prod --dir .
