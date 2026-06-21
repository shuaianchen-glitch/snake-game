# 素材规范（路径 A — 对标 Cat Gatekeeper）

将你自己准备的透明视频放入 `assets/`，文件名固定如下：

| 角色 | 入场 | 待机循环 |
|------|------|----------|
| 蓝鲸 | `whale-entry.webm` | `whale-idle.webm` |
| 猫咪 | `cat-entry.webm` | `cat-idle.webm` |
| 狐狸 | `fox-entry.webm` | `fox-idle.webm` |

## 合格标准（与 Gatekeeper 一致）

1. **格式**：WebM，VP9，带 Alpha 通道（`yuva420p`）
2. **主体占比**：动物占画面高度 **≥ 85%**（上下尽量不留大透明边）
3. **构图**：竖屏 9:16，动物**贴底居中**，正面或侧身均可
4. **时长**：入场 2–4 秒；待机 3–6 秒可无缝循环
5. **边缘**：抠图干净，无白边、无灰晕

## 推荐制作方式

- AI 视频工具生成「透明背景 + 超大动物」后导出 WebM
- 或提供 PNG 序列，运行：
  ```bash
  python3 scripts/make-gatekeeper-videos.py cat
  ```

## 替换步骤

1. 把 `{角色}-entry.webm` 和 `{角色}-idle.webm` 放进 `assets/`
2. `chrome://extensions` 重新加载扩展
3. 刷新测试页，空闲 1 分钟验收

## 当前默认：Hero 透明 PNG（推荐）

扩展优先加载 `cat-hero.png` / `whale-hero.png` / `fox-hero.png`（全身 AI 图 + 透明底 + 竖屏裁切），效果最接近 Gatekeeper 挡屏。

重新生成：
```bash
python3 scripts/make-hero-png.py cat whale fox
```

## 可选：透明 WebM 视频（路径 A 高级）
