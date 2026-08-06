# Doloc Town · 设计方案（G2 修订版 v2 · 2026-08-07）

> 主词：Doloc Town（Steam 后末日像素农场模拟，**1.0 正式版 2026-08-06 发布**）
> 验证：docs/热词验证报告-2026-08-07.md → ✅ 主推（英文 1.0 窗口）
> 状态：G2 设计方案（已按 2026-08-07 游戏实查修订）→ 用户批准后进 G3 建站
> 本版修订点：① 恋爱页 → 友谊（官方明确无 romance/marriage）；② 新增 gene-system / drone-combat / story 页；③ 语言集按 Steam 官方 9 语定；④ 1.0 事实修正（37 新成就→共 80、蘑菇节、单人无 co-op、Steam Deck Playable 非 Verified）

## 0. 一句话差异化（流量判断）
**英文 1.0 内容真空**：Doloc Town 1.0（8/6）新增「完整故事线结局 / 新区域旧城废墟 / 农业自动化 / 蘑菇节 / 37 新成就」，但英文站只有 2025 EA 期浅指南（mejoress 一篇 + Fandom 浅层 + Game8 仅评测）→ **抢「1.0 新内容」搜索（automation / old city ruins / full release / mushroom fest）+ 深度机制拆解（gene system / drone combat / fishing / friendship）**。中文已饱和（灰机 wiki 805 页 / 3DM / 18183 / 9game）→ **主攻 en + ja/ko/es，zh 仅基础页**。

## 1. 对标研究（≥6 · 4 层 · 桌面量化，G3 前补真实浏览器截图入 work/bench-results.json）
| 层 | 对标 | 已量化观察 |
|---|---|---|
| 头部攻略站 | Stardew Valley Wiki（cozy 全收集标杆） | 数百页 wiki 式；全鱼图鉴/好感/季节作物；英文最大 |
| 头部攻略站 | Game8（cozy guide 模板） | 章节化 + 截图 + 表格；页面内广告密集 |
| 同类题材 | Fields of Mistria Fandom（后末日农场 sim 生态） | Fandom 式全收集；1.0 后生态成熟 → 学结构不学饱和 |
| 本游戏已有 | doloctown.fandom.com | 页面少、EA 期内容浅（无 1.0 新系统页） |
| 本游戏已有 | mejoress Doloc guide（2025-07） | 单篇长文：Early Upgrades/Resource Loops/Drone Combat；无 1.0 |
| 本游戏已有 | game8.co Doloc Town review | 仅评测非攻略；英文攻略位空缺 |
| 参考（中文已饱和） | 灰机wiki「多洛可小镇」（805 页） | 钓鱼/基因/无人机较全（中文）→ 事实交叉参考，不做中文正面 |

**量化缺口**：英文站均无 1.0 专页（automation/old city ruins/storyline/mushroom fest）、无全鱼图鉴英文版、无基因系统英文页、无友谊攻略（官方定位）→ 这些是差异化核心。

## 2. 概念推导（游戏气质 → 主题）
- 游戏气质：**温柔末世 × 田园重建**——废土废墟上开垦农田、断桥残骸下钓鱼、火车残骸里建家园、无人机在酸雨中劳作
- 主题概念：**「废墟田园志 · Ruins & Roots」**——暖绿/琥珀/锈灰，像素点缀 + 现代可读正文
- 视觉语言：
  - 配色：苔藓绿 #3F7A4D / 嫩芽绿 #7FB069（成长）、琥珀橙 #D97706（CT/收获）、锈铁灰 #6B7280 + 深炭底 #1C1917（废土）、米纸底 #F7F3EA（正文区）
  - 字体：正文 Inter（可读性）；标题可用带像素衬线气质的 serif（如 "Zilla Slab" 或 Georgia 类）+ 少量 Press Start 2P 仅用于 logo/kicker 点缀（**禁止正文全像素字体**）
  - 图标语言：SVG 线稿（植物/扳手/无人机/鱼钩/心形友谊），stroke currentColor，非 emoji
  - 组件形态：卡片=「生长卡」（左上角小像素方块 + 圆角 12 + 淡投影）；进度条=生长条（seed→sprout→harvest 三态色）；标签=「锈蚀标签」（像素边框 + 琥珀角标）
- 独特组件（≥3）：① 季节/天气影响表 ② 基因突变卡（稀有度徽章）③ 鱼图鉴收集卡（池塘×天气×鱼竿矩阵）④ 友谊进度条（非恋爱）⑤ 自动化流水线示意图（SVG 太阳能→风电→无人机站）
- 动效原则（emil-design-eng）：hover 抬升 150-250ms、焦点可见、prefers-reduced-motion 关闭动效、卡片 hover 光效 300ms

## 3. 信息架构（页面矩阵 · 按关键词定制）
### P0（英文真空/核心玩法，主攻略页 ≥1000 词 ≥8 章）
| 页面 | 类型 | 内容核心 | 来源 |
|---|---|---|---|
| home | 首页 | 1.0 发布横幅 + 入门卡片 + 核心系统导览 + FAQ 预览 | 官方/Steam |
| how-to-play | 主攻略 | 五段循环：清障→收集→种田→建造→探索；垂直农场/天气利用/无人机协同 | 官方+实测 |
| farming-automation | **1.0 专页** | 太阳能/风能→无人机站→全自动播种/培育/收割；工业区传送带 | 官方 1.0 公告 |
| gene-system | 机制页 | 3 基因模块×~20 突变（孢子喷射/分形作物/时间馈赠/雨露均沾/体质增强）；种子母本研究 | 官方+灰机交叉 |
| fishing | 机制页 | **全鱼图鉴英文版（缺口）** + 池塘×天气×鱼竿影响 | 灰机wiki 交叉+实测 |
| drone-combat | 机制页 | 无人机改装（底盘/枪管/电池）、模块（战术电容/影子射手）、技能 | mejoress+灰机 |
| exploration | 1.0 专页 | 5 区域（Outskirts/River Valley/Wetlands/Caves/**Old City Ruins 1.0**） | 官方 1.0 公告 |
| friendship | 机制页 | **全角色好感（非恋爱，官方定位）** + 送礼/生日/节日 | 官方+社区 |
### P1（深度拆解，机制页 ≥600 词 + 步骤）
| farming | 作物/季节/土壤/工具升级/果树/香草/蘑菇 |
| cooking | 80+ 食谱、buff 表、恢复值 |
| ranching | 谷仓/围栏/喂食/清洁/副产品 |
| characters | 村民档案 + 剧情线索（含 1.0 完整故事线） |
| story | **1.0 专页**：三大谜团（河谷生机/失踪镇长/Eden 印记）+ 结局 | 官方 |
| weather | 极端天气利用手册（酸雨/酷热/雷暴/暴雨/旱季 4 月） |
### P2（答案页 ≥400 词 + FAQ schema）
| achievements | 全 80 成就清单（**43 基础 + 37 新**） + FAQ schema |
| mods | 创意工坊/热门模组 |
| update-log | 1.0 全部变更点（英文） |
| faq | 常见问题（含：**单人无 co-op**、**Steam Deck Playable 非 Verified**、价格/平台） |
| system-requirements | 配置页 |
| steam-deck | Deck 兼容性指南 |
| 404/about/privacy/contact | 基础页 + 来源声明 |

## 4. 语言集（按 Steam 官方支持区动态决定）
- **主：en**（US 流量命脉，内容最完整）
- **增量：ja / ko / es**（Steam 官方支持 + 农场模拟在日韩拉美热度高）——全量翻译，**禁止 generator 回退英文混排**
- **zh-CN / zh-TW**：仅首页 + 基础页（中文已饱和，不做正面）；zh-TW 用 OpenCC 转繁
- 全语言纯净：改语言代码/加语言后全仓 grep 硬编码 `lang==="zh"` 判断 + curl 原始 HTML 验语言纯净（P0 坑）
- Steam 官方 9 语：en/zh-CN/zh-TW/fr/de/ja/ko/pt-BR/ru → 我们取 en+ja+ko+es+zh-CN+zh-TW（fr/de/pt-BR/ru 视人力二期）

## 5. 内容策略（质量门槛）
- 每页 1-2 可靠来源：官方 Steam/官方 1.0 公告/Steam 社区实测/Game8/mejoress/灰机wiki（事实交叉）
- **1.0 新内容（automation/old city ruins/storyline/mushroom fest）必须官方公告可核实**，未实测部分明确标注 ⚠️
- 主攻略页 ≥1000 词 ≥8 章；答案页 ≥400 词 + FAQ schema；机制页 ≥600 词 + 步骤级拆解 + 常见错误
- 每页含「怎么做/怎么避免」可执行块；**禁止编造**（宁缺毋滥）
- 标题 ≤60；JSON-LD（WebSite/Article/FAQPage/BreadcrumbList 数组）；hreflang；sitemap

## 6. 配图清单（Seedream 按主题出 · 火山方舟个人认证 API）
- hero：废土田园主视觉（16:9，暖绿+锈橙，像素风点缀）
- 每页 1 张：fishing（鱼图鉴插画）、automation（无人机站流水线）、gene（基因实验室）、drone（战斗无人机）、exploration（旧城废墟地图）…
- 统一风格 prompt 模板 + 16:9 三档 srcset（640/1280/3136w）+ object-fit cover + aspect-ratio

## 7. 执行顺序
1. ✅ 知识库 docs/doloc-town-research.md（已建，8 大块全量）
2. 建仓 azu089/doloc-town-guide + 生成器改造（全新 style.css「废墟田园」主题，grep 校验无上一站残留）
3. en 全量内容（按知识库，每页 1-2 来源）
4. ja/ko/es/zh-CN/zh-TW 翻译（OpenCC 繁）
5. Seedream 生图（hero+每页，三档 srcset）
6. G4 双视角全维审计（用户+开发者、死链/JSON-LD/hreflang/移动端 375/横向溢出/语言纯净/图片缩放）
7. 部署：域名 doloctownguides.com（Spaceship 直连 API，curl）+ Cloudflare Pages + GSC + GA4（**新属性，勿复用旧站 G-XXXX**）
8. G6 复盘：D3/D7/D14 GSC+GA4

## 8. 流量判断
- 主词「doloc town」：1.0 发布搜索峰值已过（8/6），但「doloc town automation / old city ruins / gene system / fishing / 1.0」长尾真空
- 预期：D3-D14 长尾进收录，D30+ 累计 5-15 个长尾词进前 10（类比 Meccha 首月）
- 变现：种子期无广告 + AFS 搜索框 + 联盟（GMG/Humble 无此游戏则 Amazon 周边）；AdSense 待日 UV 500+

## 9. 补充待办（2026-08-07 实查游戏后新增，避免返工）
1. **购买游戏本体实测**（¥46.40 促销至 8/19）：钓鱼/食谱/成就/角色生日等 L2 数据靠实测补全，未实测一律 ⚠️ 标注
2. **对标真实浏览器截图**：G3 前用 Chrome 打开 Stardew Wiki / Game8 / Fandom / mejoress / 灰机wiki 逐站截图，量化写入 work/bench-results.json
3. **站内搜索**：header 加 Google `site:` 搜索框（零后端，头部站标配）
4. **Steam 小部件**：首页嵌入官方 Steam 商店 widget（转化/信任）
5. **GSC/GA4 新资源**：每站独立（不混用旧站 G-XXXX）
6. **上线后 D3/D7/D14 三查**（GSC 搜索查询 + GA4 访问/停留/跳出）
7. **变现研究已整合 skill**（docs/游戏站变现研究报告.md + references/monetization.md），建站时按埋点
8. **多语言纯净验证**：grep 硬编码 + curl 原始 HTML（Chrome 自动翻译会误导审计）

---
*产出：G2 设计方案 v2（2026-08-07 实查 Steam 官方页 + 1.0 公告 + 多源交叉后修订）· 待用户批准后进 G3。*
