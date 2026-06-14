#!/bin/bash
# 一键部署到公网，部署完成后把链接发给朋友即可
cd "$(dirname "$0")"

echo ""
echo "  正在部署贪吃蛇到公网..."
echo "  首次使用需要注册/登录 Netlify 账号（免费）"
echo ""

npx --yes netlify-cli deploy --prod --dir .
