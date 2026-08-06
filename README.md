# Doloc Town Guide · doloctownguides.com

> 热词游戏站第 3 站（废墟田园主题）。主词 Doloc Town（Steam 后末日像素农场模拟，1.0 2026-08-06）。
> 生成器：`data/site.json` → `node scripts/generate.js` → `public/`（零依赖纯静态）。

## 快速开始
```bash
cd sites/doloc-town
python3 data/build_content.py   # 从 site.base.json + 6 语言翻译重建 site.json（幂等）
node scripts/generate.js        # 生成 public/
python3 scripts/gen_images.py   # Seedream 生成配图（hero + 每页，火山方舟）
```

## 结构
- `data/site.base.json` — en 全量内容（19 页，每页 1-2 来源，⚠️=待实测）
- `data/build_content.py` — 多语言构建（en/zh-CN/zh-TW/ja/ko/es，zh-TW 用 OpenCC）
- `templates/style.css` — 「废墟田园 Ruins & Roots」主题（全新，非套模板）
- `scripts/generate.js` — 生成器（数据驱动 + SEO + i18n）
- `public/` — 构建输出（6 语言 × 24 页 + sitemap）

## 语言
en（根）/ zh-CN / zh-TW / ja / ko / es —— 按 Steam 官方语言区动态定；全语言纯净（grep 硬编码验证）。

## 事实口径
每页 1-2 可靠来源（官方 Steam/1.0 公告/媒体/灰机wiki 交叉），未实测内容标注 ⚠️，宁缺毋滥。
来源分级与数据分辨见 skill `references/data-integrity.md`。
