# 古建殿门前院 · 高斯泼溅角色播放器

用 Viggle PINOC 生成的古建场景和角色，在浏览器里用键盘控制角色走、跑、跳、踢腿。
基于 `@viggle/splat-engine` 和 PlayCanvas 2.18.0，用 Vite 构建。

## 操作

| 按键 | 作用 |
|---|---|
| W A S D | 移动 |
| Shift | 跑 |
| Space | 跳 |
| J / K / L | 前踢 / 侧踢 / 回旋踢 |
| R | 回到起点 |
| H | 阴影开关 |
| C | 显示碰撞体 |
| [ / ] | 场景缩小 / 放大 |
| \ | 场景缩放恢复默认 |
| 点击画面 | 鼠标转视角，Esc 释放 |

## 本地运行

```
npm install
npm run dev
```

## 部署

推送到 `main` 分支后，`.github/workflows/deploy.yml` 会自动构建并发布到 GitHub Pages。
第一次需要在仓库 Settings → Pages → Build and deployment → Source 里选 **GitHub Actions**。

## 资源

- `public/assets/temple_courtyard.spz`：场景，PINOC 生成的高斯泼溅（SPZ，+Y 向上）。
- `public/assets/middle_aged_man.high.vsplat`：角色，PINOC 生成，high 档 48,000 个高斯点。
- `public/assets/motions/*.glb`：PINOC 免费动作库的 splat-skeleton 动作。
