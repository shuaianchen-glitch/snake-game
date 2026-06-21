# 抠门地图 — 微信小程序

中国版「穷鬼地图」：帮年轻人按预算找附近平价餐厅。

## 功能

- **地图找店**：按 ≤15 / ≤20 / ≤30 元筛选，地图 pin 显示起价
- **店铺详情**：菜单价格、核实人数、最便宜吃饱方案、一键导航
- **UGC 投稿**：新增平价店、选地图位置、填菜单价
- **价格核实**：用户可确认价格准确，赚取抠抠币
- **反馈**：报涨价、关门、信息有误

## 本地运行

1. 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 打开开发者工具 → **导入项目**
3. 目录选择：`koumen-map/`
4. AppID：测试阶段选「测试号」或使用 `touristappid`
5. 点击「编译」即可预览

### 定位说明

- 种子数据默认在 **武汉大学周边**（珞喻路、广八路）
- 授权定位后，会按你的位置排序附近店铺
- 未授权时展示示例区域，仍可浏览和投稿

### 真机调试

详情 → 本地设置 → 勾选「不校验合法域名」（MVP 无后端，无需配置）

## 项目结构

```
koumen-map/
├── app.js / app.json / app.wxss
├── pages/
│   ├── index/      # 地图 + 列表
│   ├── detail/     # 店铺详情
│   ├── submit/     # 投稿
│   └── profile/    # 我的 / 抠抠币
├── utils/
│   ├── data.js     # 种子数据、分类
│   ├── storage.js  # 本地存储
│   └── geo.js      # 距离计算
└── assets/         # Tab 图标
```

## 替换种子数据

编辑 `utils/data.js` 中的 `SEED_SHOPS`，改成你目标城市的店铺和坐标。

## 下一步（上线前）

| 事项 | 说明 |
|------|------|
| 注册小程序 | [微信公众平台](https://mp.weixin.qq.com/) 获取正式 AppID |
| 后端 API | 云开发 / Supabase，同步投稿与核实 |
| 内容审核 | UGC 投稿需人工或机审 |
| 用户登录 | 微信登录 + openid |
| 分享 | 店铺卡片分享、生成海报 |

## 技术栈

- 原生微信小程序（无框架依赖）
- 本地 Storage（MVP）
- 微信 map / openLocation / chooseLocation API
