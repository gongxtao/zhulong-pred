# 易拉宝 · 烛龙 ZHULONG（80×200cm）

两版设计，同一品牌系统（深空电力蓝 `#0A1D37` / 面板蓝 `#123B63` / 电光青 `#22D3EE`，无渐变、SVG 数据可视化主视觉——与路演 PPT / 产品本体同源）。

## 选哪版

| | A · 重绘概念版 | B · 真实截图版 |
|---|---|---|
| 主视觉 | 真数据 SVG 重绘：72h 窗（48h 实际 + 24h 预测带）+ 双模型线分叉 + **NOW 龙眼**签名 | 决策台深色实拍截图，浏览器框 + LIVE 徽章 + 三特性条 |
| 气质 | 高设计感，曲线即图腾；「诚实可审计」叙事最强 | 直白可信，「这是真产品」一目了然 |
| 适合 | 评委走过慢、有讲解 | 人流快、无人值守自解释 |

画面其余部分（品牌区 / 14 年曲线脊柱 / 决策告示 / 三大数字 / QR 行动区 / 底部）两版完全一致。

## 交付文件

| 文件 | 用途 |
|---|---|
| `banner-a-print.pdf` / `banner-b-print.pdf` | **给印刷店**（81×201cm 含出血，矢量文字，直接可印） |
| `banner-a.html` / `banner-b.html` | 源稿（改文字/数字后重新出 PDF，见下） |
| `preview-a.png` / `preview-b.png` | 快速预览 |
| `assets/` | 真数据（banner-data）、字体（Space Grotesk OFL）、QR 矢量、产品截图 |
| `scripts/extract-data.mjs` | 重取主视觉真数据 |

## 印刷规格（交给店里照念）

- 成品 **80×200cm**，文件 **81×201cm**（四周各 5mm 出血已留）
- 关键内容距边 ≥4.5cm（卷轴/边夹安全区已留，底部留 7cm）
- 矢量 PDF，文字无限放大不糊；颜色为 RGB，正常 CMYK 转换即可（深空蓝转后略暗属正常，无需追色）
- 建议工艺：铝合金易拉宝 + 哑面宝丽布/PVC（哑面防反光，暗底画面在展灯下更稳）
- 深色大底对打印均匀度敏感——取件时平视检查有无纵向条纹

## 数据与口径（全部可复算）

- 曲线为 **真值重绘**：AEP 负荷区，NOW=2018-08-02 起点窗（快照 `window.ZL_DATA`）；持续学习轨取自生产库
- 决策告示 2,171 MW = 该窗 P90 上界 − 97%×P50（13:00–16:00 EST 取最大），与画面曲线同窗自洽
- 三大数字与 README/线上页面一致：3.39% / 88.8% / ↓41%
- 顶部 14 年曲线 = 5,054 天日峰值序列；2014 琥珀刻度 = 极地涡旋年（诚实盲区叙事）

## QR 注意

指向 `https://zhulong-seven.vercel.app`（v4·纠错 H·矢量）。⚠️ 部分网络对 \*.vercel.app 有 DNS 污染——版面已注「试试手机流量」；展会现场建议同时备本地 dev 兜底。

## 改稿重出（一条龙）

```bash
node 易拉宝/scripts/extract-data.mjs     # 重取真数据（可选；数字变时）
# 编辑 banner-a.html / banner-b.html
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --allow-file-access-from-files --no-pdf-header-footer \
  --print-to-pdf="易拉宝/banner-a-print.pdf" "file://$PWD/易拉宝/banner-a.html"
```

预览：浏览器打开 `banner-a.html?preview=0.25`（缩放到屏）；`?only=z2` 单区裁剪检查。
