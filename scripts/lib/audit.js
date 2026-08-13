#!/usr/bin/env node
// ⚠️ 自动生成，请勿直接编辑此文件。
// 唯一事实来源：packages/site-kit/audit.js
// 修改后运行：node packages/site-kit/sync.js
// （项目根不是 git 仓库、站点各自独立仓库，所以基建必须复制进各仓库才能被 CF Pages 构建到）
/**
 * 站点静态审计 —— G4「开发者视角」那一半的自动化实现。
 *
 * 设计原则：**每一条检查都对应一个真实踩过的坑**（见 skill references/pitfalls.md），
 *          不做「看起来该查」的检查，避免噪音把真问题淹掉。
 *
 * 用法：
 *   node packages/site-kit/audit.js sites/meccha-chameleon sites/kill-the-shadow sites/doloc-town
 *   node packages/site-kit/audit.js . --json      # CI 用，输出机器可读结果
 *
 * 退出码：0 = 全通过；1 = 有 FAIL（CI 应据此阻断部署）
 */
const fs = require("fs");
const path = require("path");

const JSON_OUT = process.argv.includes("--json");
const roots = process.argv.slice(2).filter(a => !a.startsWith("--"));
if (!roots.length) { console.error("用法: node audit.js <site-root>... [--json]"); process.exit(1); }

/* ---------- 阈值 ----------
 * Google SERP 按**像素**截断，不是字符数。CJK 字宽约拉丁 2 倍，
 * 用统一字符阈值会把中日韩页面全部误报成「过短」。
 */
const isCJK = l => /^(zh|ja|ko)/.test(l || "");
const LIMIT = {
  desc: l => isCJK(l) ? [24, 78] : [60, 158],
  title: l => isCJK(l) ? 40 : 60
};

const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    e.isDirectory() ? walk(p, out) : e.name.endsWith(".html") && out.push(p);
  }
  return out;
};

const textOf = html => html
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ")
  .replace(/\s+/g, " ").trim();

const cjkRatio = t => {
  const cjk = (t.match(/[一-鿿぀-ヿ가-힯]/g) || []).length;
  const lat = (t.match(/[A-Za-z]/g) || []).length;
  return cjk + lat === 0 ? 0 : cjk / (cjk + lat);
};

function auditSite(root) {
  const pub = path.join(root, "public");
  const cfgPath = path.join(root, "data", "site.json");
  if (!fs.existsSync(pub)) return { root, fatal: `没有 ${pub}，先跑 node scripts/generate.js` };
  if (!fs.existsSync(cfgPath)) return { root, fatal: `没有 ${cfgPath}` };

  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")).site;
  const langs = cfg.languages || ["en"];
  const files = walk(pub);
  const fail = [], warn = [];
  const F = (code, detail) => fail.push({ code, detail });
  const W = (code, detail) => warn.push({ code, detail });

  const titles = new Map(), descs = new Map(), slugs = new Set(), noindexSlugs = new Set(), inbound = new Map();
  let pages = 0;

  for (const f of files) {
    const rel = path.relative(pub, f);
    const html = fs.readFileSync(f, "utf8");
    const is404 = /(^|\/)404\.html$/.test(rel);
    const slug = "/" + rel.replace(/index\.html$/, "").replace(/\.html$/, "").replace(/\/$/, "");
    slugs.add(slug === "/" ? "/" : slug);
    if (/<meta name="robots" content="[^"]*noindex/i.test(html)) noindexSlugs.add(slug === "/" ? "/" : slug);
    if (is404) continue;
    pages++;

    const lang = (html.match(/<html lang="([^"]+)"/) || [])[1] || "";
    const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
    const desc = (html.match(/<meta name="description" content="([\s\S]*?)"/) || [])[1] || "";

    // — 坑：JSON-LD 多对象换行拼进同一个 script 是非法 JSON，Google 整块丢弃
    for (const blk of html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || []) {
      const raw = blk.replace(/^<script type="application\/ld\+json">/, "").replace(/<\/script>$/, "");
      try { JSON.parse(raw); } catch { F("ld-invalid", rel); }
    }
    // — 坑：articleLd 传 slug 字符串而非对象 → 全站 URL 变 /undefined
    if (html.includes("/undefined")) F("undefined-url", rel);

    if (!title) F("no-title", rel);
    else if (title.length > LIMIT.title(lang)) F("title-too-long", `${rel} (${title.length} > ${LIMIT.title(lang)})`);
    if (!desc) F("no-desc", rel);
    else {
      const [lo, hi] = LIMIT.desc(lang);
      if (desc.length > hi) F("desc-too-long", `${rel} (${desc.length} > ${hi})`);
      else if (desc.length < lo) W("desc-short", `${rel} (${desc.length} < ${lo})`);
    }
    if (!/<link rel="canonical"/.test(html)) F("no-canonical", rel);
    if (!lang) F("no-html-lang", rel);

    const h1 = (html.match(/<h1[^>]*>/g) || []).length;
    if (h1 !== 1) F("h1-count", `${rel} (h1=${h1})`);

    const hl = (html.match(/hreflang="/g) || []).length;
    if (hl && hl !== langs.length + 1) F("hreflang-count", `${rel} (${hl}, 期望 ${langs.length + 1})`);

    // — 坑（本项目 P0 惯犯）：加语言/改语言代码后，硬编码 lang==="zh" 失效 → 整页回落英文
    if (isCJK(lang)) {
      // ⚠️ 量的是**散文**，先把 <table> 剔掉。数据表里大量是不该翻译的专有名词
      //   （游戏物品名/角色名——官方本地化拿不到就必须保留英文，翻了就是编造）。
      //   2026-08-08 实测 Doloc gifts 页：整页 CJK 只有 22-26%，剔掉表格后是 68-74%。
      //   连 ja 都只高出阈值 1 个百分点，再多几行就会误伤。
      //   本检查要抓的是「lang==="zh" 硬编码导致正文回退英文」，散文才是判据。
      const main = (html.match(/<main[\s\S]*?<\/main>/) || [""])[0];
      const prose = main.replace(/<table[\s\S]*?<\/table>/g, "");
      const r = cjkRatio(textOf(prose));
      if (r < 0.25) F("lang-contamination", `${rel} (lang=${lang} 但散文 CJK 占比仅 ${(r * 100).toFixed(0)}%)`);
    }

    // — 坑：OpenCC 用 s2t 转繁体，出来的是「大陆繁体」字形（爲/覈/裏/祕/啓/着/喫/羣/纔/僞/峯），
    //   台湾读者一眼看出是机器转的。台湾标准字形要用 s2tw（简→繁）或 t2tw（繁→台湾正体）。
    //   2026-08-08 实测：三站 zh-TW 共 200+ 处，Meccha 更是每页都有。
    if (lang && lang.startsWith("zh-TW")) {
      // ⚠️ 字表要和转换器对齐：逐字跑过 t2tw 才敢列。汙 是台湾正体（t2tw 不动它），
      //    会被转换的是 污 → 汙，别把两者写反。
      const bad = textOf(html).match(/[爲覈裏祕啓着喫羣纔僞峯麪衆牀污]/g);
      if (bad) F("zhtw-nonstandard-glyph", `${rel} (${[...new Set(bad)].join("")} 共 ${bad.length} 处，应改用 OpenCC s2tw/t2tw)`);
    }

    // — 图片：无尺寸会造成 CLS；WebP 兄弟文件缺失说明忘了跑 build-webp
    for (const img of html.match(/<img [^>]*>/g) || []) {
      if (!/alt="/.test(img)) F("img-no-alt", rel);
      if (!/width="/.test(img) || !/height="/.test(img)) F("img-no-dims", rel);
    }
    for (const m of html.matchAll(/<source type="image\/webp" srcset="([^"]+)"/g)) {
      for (const u of m[1].split(",").map(s => s.trim().split(/\s+/)[0])) {
        if (u.startsWith("/") && !fs.existsSync(path.join(pub, u.slice(1)))) F("webp-missing", `${rel} → ${u}`);
      }
    }

    if (title) titles.set(title, (titles.get(title) || 0) + 1);
    if (desc) descs.set(desc, (descs.get(desc) || 0) + 1);
    for (const m of html.matchAll(/href="(\/[^"#?]*)"/g)) {
      const k = m[1].replace(/\/$/, "") || "/";
      inbound.set(k, (inbound.get(k) || 0) + 1);
    }
  }

  // 死链
  for (const [l] of inbound) {
    const fp = path.join(pub, l.replace(/^\//, ""));
    if (!slugs.has(l) && !fs.existsSync(fp) && !fs.existsSync(fp + ".html") && !fs.existsSync(path.join(fp, "index.html")))
      F("dead-link", l);
  }
  // — 坑：新页只进 sitemap 没进导航 → 孤儿页，只有 sitemap 可达
  for (const s of slugs) if (!inbound.has(s) && !/\/404$/.test(s)) F("orphan-page", s);

  for (const [t, c] of titles) if (c > 1) F("dup-title", `${c}× ${t.slice(0, 60)}`);
  for (const [d, c] of descs) if (c > 1) F("dup-desc", `${c}× ${d.slice(0, 60)}`);

  // sitemap ↔ 实际文件
  const smPath = path.join(pub, "sitemap.xml");
  if (!fs.existsSync(smPath)) F("no-sitemap", "");
  else {
    const locs = [...fs.readFileSync(smPath, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map(m => new URL(m[1]).pathname.replace(/\/$/, "") || "/");
    const locCounts = new Map();
    for (const loc of locs) locCounts.set(loc, (locCounts.get(loc) || 0) + 1);
    for (const [loc, count] of locCounts) if (count > 1) F("dup-sitemap-url", `${count}× ${loc}`);
    const sm = new Set(locs);
    for (const s of slugs) if (!sm.has(s) && !noindexSlugs.has(s) && !/\/404$/.test(s)) F("not-in-sitemap", s);
    for (const s of sm) if (!slugs.has(s)) F("sitemap-dead", s);
    if (/<changefreq>/.test(fs.readFileSync(smPath, "utf8"))) W("changefreq", "Google 已不使用，可移除");
  }

  // 必备产物
  for (const [f, code] of [["robots.txt", "no-robots"], ["_headers", "no-headers"], ["llms.txt", "no-llms"]])
    if (!fs.existsSync(path.join(pub, f))) F(code, f);
  if (cfg.indexNowKey && !fs.existsSync(path.join(pub, `${cfg.indexNowKey}.txt`))) F("no-indexnow-key", "");
  // — 空 ads.txt 无意义；未接 AdSense 就不该输出
  const ads = path.join(pub, "ads.txt");
  if (fs.existsSync(ads) && fs.statSync(ads).size === 0) F("empty-ads-txt", "未接 AdSense 时不应输出空文件");

  return { root, domain: cfg.domain, pages, langs: langs.length, fail, warn };
}

const results = roots.map(auditSite);

if (JSON_OUT) {
  console.log(JSON.stringify(results, null, 2));
} else {
  for (const r of results) {
    if (r.fatal) { console.log(`\n❌ ${r.root}: ${r.fatal}`); continue; }
    const group = arr => arr.reduce((m, x) => (m[x.code] = (m[x.code] || []).concat(x.detail), m), {});
    console.log(`\n${"─".repeat(64)}\n${r.domain}  ${r.pages} 页 · ${r.langs} 语`);
    const gf = group(r.fail), gw = group(r.warn);
    if (!r.fail.length) console.log("  ✅ 全部通过");
    for (const [code, list] of Object.entries(gf)) {
      console.log(`  ❌ ${code} × ${list.length}`);
      list.slice(0, 5).forEach(d => d && console.log(`       ${d}`));
      if (list.length > 5) console.log(`       …还有 ${list.length - 5} 条`);
    }
    for (const [code, list] of Object.entries(gw)) console.log(`  ⚠️  ${code} × ${list.length}`);
  }
}

const failed = results.reduce((n, r) => n + (r.fatal ? 1 : r.fail.length), 0);
if (!JSON_OUT) console.log(failed ? `\n❌ 共 ${failed} 个 FAIL —— 不得部署` : `\n✅ 全部通过`);
process.exit(failed ? 1 : 0);
