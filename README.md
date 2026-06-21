# snake-game

个人项目集合，可部署为静态网站（GitHub Pages / Netlify）。

## 网站结构

| 路径 | 内容 |
|------|------|
| `/` | 项目首页 |
| `/snake/` | 在线贪吃蛇 |
| `/idle-companion/` | Idle Companion 扩展介绍与安装说明 |

## 本地预览

```bash
python3 -m http.server 8080
# 打开 http://localhost:8080
```

## 部署

```bash
./deploy.sh
```

## 子项目

- **idle-companion/** — Chrome 扩展，空闲时透明动物挡屏
- **snake/** — Canvas 贪吃蛇
- **koumen-map/** — 扣门地图微信小程序
