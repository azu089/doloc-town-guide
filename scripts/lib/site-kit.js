// ⚠️ 自动生成，请勿直接编辑此文件。
// 唯一事实来源：packages/site-kit/index.js
// 修改后运行：node packages/site-kit/sync.js
// （项目根不是 git 仓库、三站各自独立仓库，所以基建必须复制进各仓库才能被 CF Pages 构建到）
/**
 * site-kit —— 三站共用的「无设计自由度」基建层
 *
 * ⚠️ 边界（对应 skill 铁律 2「每站独立设计，禁止套模板」）：
 *   ✅ 放这里：URL 规则 / hreflang / JSON-LD schema / sitemap / robots / _headers /
 *              图片 <picture> 降级 / lastmod 变更追踪 / IndexNow
 *              —— 这些东西没有设计自由度，三站写法必须一致，写三遍只会让 bug 修三遍
 *   ❌ 不放这里：style.css / renderHome / renderSection / header / footer / 组件语言 / 配色 / 图标
 *              —— 这些是每站的独立设计，必须保持分叉
 *
 * 历史教训：`lang === "zh"` 硬编码 bug 修了两次、JSON-LD `/undefined` bug 只在一个站修过，
 *          就是因为这层基建被复制了三份各自演化。
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/* ---------- 基础 ---------- */
const esc = s => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const clean = slug => String(slug).replace(/\.html$/, "");

/**
 * URL 规则：默认语言在根路径，其他语言在 /<lang>/ 前缀
 * ⚠️ 语言判断一律用 startsWith("zh")，禁止 `lang === "zh"`（zh-CN/zh-TW 改名后会全部失效）
 */
function createUrl({ domain, defaultLang }) {
  return function urlOf(slug, lang) {
    const p = clean(slug);
    const tail = lang === defaultLang
      ? (p === "index" ? "/" : `/${p}`)
      : (p === "index" ? `/${lang}/` : `/${lang}/${p}`);
    return `https://${domain}${tail}`;
  };
}

function hreflangTags({ langs, defaultLang, urlOf, slug }) {
  return langs.map(l => `<link rel="alternate" hreflang="${l}" href="${urlOf(slug, l)}" />`).join("\n") +
    `<link rel="alternate" hreflang="x-default" href="${urlOf(slug, defaultLang)}" />`;
}

/* ---------- JSON-LD ----------
 * ⚠️ 所有函数返回【对象】，由调用方合并成一个数组后整体 JSON.stringify。
 *    多个对象换行拼进同一个 <script> 是非法 JSON，Google 会整块丢弃。
 * ⚠️ page 必须是带 slug 的对象，不能只传 slug 字符串（曾导致全站 URL 变 /undefined）。
 */
const ld = {
  website: ({ name, url, description }) => ({
    "@context": "https://schema.org", "@type": "WebSite", name, url, description
  }),

  article: ({ page, lang, urlOf, siteName, datePublished, dateModified }) => {
    if (!page || !page.slug) throw new Error("[site-kit] ld.article 需要带 slug 的 page 对象（防 /undefined）");
    return {
      "@context": "https://schema.org", "@type": "Article",
      headline: page.title,
      description: page.metaDescription,
      mainEntityOfPage: urlOf(page.slug, lang),
      datePublished,
      dateModified,
      inLanguage: lang,
      publisher: { "@type": "Organization", name: siteName }
    };
  },

  breadcrumb: ({ page, lang, urlOf, homeName }) => {
    if (!page || !page.slug) throw new Error("[site-kit] ld.breadcrumb 需要带 slug 的 page 对象（防 /undefined）");
    return {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: homeName, item: urlOf("index", lang) },
        { "@type": "ListItem", position: 2, name: page.title, item: urlOf(page.slug, lang) }
      ]
    };
  },

  faq: items => ({
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: items.map(([q, a]) => ({
      "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a }
    }))
  })
};

/* ---------- 图片：WebP + JPG 降级 ----------
 * assets/images/ 里每张 x.jpg 都有同名 x.webp（由 scripts/build-webp.js 预生成并提交）。
 * Cloudflare Pages 构建机上没有 cwebp，所以必须预生成，不能在构建时转。
 * <picture> 用后代选择器（.wall-bg img 等）时对 CSS 无影响——三站 CSS 已全部核对过。
 */
const toWebp = src => String(src).replace(/\.jpe?g$/i, ".webp");

/** 把 "a.jpg 640w, b.jpg 1280w" 这类 srcset 整体换成 webp 版本 */
const webpSrcset = srcset => String(srcset).replace(/\.jpe?g(?=\s|,|$)/gi, ".webp");

/**
 * 生成 <picture>：WebP 优先，JPG 兜底。
 * imgAttrs 原样落到 <img> 上（class/alt/loading/width/height/fetchpriority/sizes…）
 */
function picture({ src, srcset, sizes, attrs = "" }) {
  const webpSet = srcset ? webpSrcset(srcset) : toWebp(src);
  const sizesAttr = sizes ? ` sizes="${sizes}"` : "";
  return `<picture><source type="image/webp" srcset="${webpSet}"${sizesAttr} />` +
    `<img src="${src}"${srcset ? ` srcset="${srcset}"` : ""}${sizesAttr}${attrs ? " " + attrs.trim() : ""} /></picture>`;
}

/** hero 预加载（LCP）：preload 走 WebP，type 声明让不支持的浏览器直接跳过 */
function heroPreload({ srcset, sizes }) {
  return `<link rel="preload" as="image" type="image/webp" imagesrcset="${webpSrcset(srcset)}" imagesizes="${sizes}" fetchpriority="high" />`;
}

/* ---------- lastmod：只在内容真变了才更新 ----------
 * 之前所有页面的 lastmod 都等于构建日期 → 每次重建都告诉 Google「150 个页面全改了」，
 * 这种恒为当日的 lastmod 会被 Google 逐步降权忽略。
 *
 * 做法：对渲染后的 HTML 取「稳定哈希」（剔除 lastmod 占位符和 CSS 版本号等易变位），
 *      与 data/.lastmod.json 里存的对比：变了才写今天，没变就沿用旧日期。
 */
const LASTMOD_TOKEN = "__SITEKIT_LASTMOD__";

function createLastmod({ manifestPath, today }) {
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(manifestPath, "utf8")); } catch { /* 首次构建：全部记为今天 */ }
  const next = {};

  /** 剔除易变位后再哈希：lastmod 占位符本身、CSS 指纹（样式改动不算内容改动） */
  const stableHash = html => crypto.createHash("md5")
    .update(String(html)
      .replace(new RegExp(LASTMOD_TOKEN, "g"), "")
      .replace(/style\.css\?v=[a-f0-9]+/g, "style.css")
    ).digest("hex");

  return {
    /** 传入渲染好的 HTML（含占位符），返回替换好日期的 HTML */
    stamp(key, html) {
      const hash = stableHash(html);
      const old = prev[key];
      const date = (old && old.hash === hash) ? old.date : today;
      next[key] = { hash, date };
      return String(html).split(LASTMOD_TOKEN).join(date);
    },
    /** sitemap 用：取该 URL 的真实变更日期 */
    dateFor(key) { return (next[key] || prev[key] || {}).date || today; },
    save() {
      fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
      fs.writeFileSync(manifestPath, JSON.stringify(next, Object.keys(next).sort(), 2) + "\n");
      const changed = Object.keys(next).filter(k => next[k].date === today).length;
      return { total: Object.keys(next).length, changed };
    },
    TOKEN: LASTMOD_TOKEN
  };
}

/* ---------- 静态页 meta description ----------
 * about / privacy / contact 之前的 description 直接等于标题（4-15 字符），
 * Google 基本必然弃用、自己拼摘要。这三页是 E-E-A-T 的信任页，值得给真描述。
 * 文案是三站通用样板（只有站名不同），所以放在共用层，避免三处各写一遍。
 */
const STATIC_DESC = {
  "en": {
    about: n => `About ${n}: who we are, how we fact-check every guide, and which sources we use on each page.`,
    privacy: n => `Privacy policy for ${n}: what anonymous analytics we collect, how cookies are used, and which third-party services we rely on.`,
    contact: n => `Contact ${n} by email for corrections, missing guides or partnership questions. We usually reply within 2-3 business days.`
  },
  "zh-CN": {
    about: n => `关于${n}：我们是谁、如何核实每一条攻略内容、以及每个页面使用的资料来源。`,
    privacy: n => `${n}隐私政策：我们收集哪些匿名访问统计、Cookie 如何使用、以及依赖的第三方服务。`,
    contact: n => `联系${n}：内容纠错、攻略补充或合作咨询请发邮件，我们通常 2-3 个工作日内回复。`
  },
  "zh-TW": {
    about: n => `關於${n}：我們是誰、如何核實每一條攻略內容、以及每個頁面使用的資料來源。`,
    privacy: n => `${n}隱私政策：我們收集哪些匿名訪問統計、Cookie 如何使用、以及依賴的第三方服務。`,
    contact: n => `聯絡${n}：內容糾錯、攻略補充或合作諮詢請發郵件，我們通常 2-3 個工作天內回覆。`
  },
  "ja": {
    about: n => `${n}について：運営者、攻略内容のファクトチェック方法、各ページで使用している情報源をご説明します。`,
    privacy: n => `${n}のプライバシーポリシー：取得する匿名アクセス統計、Cookie の利用、利用している第三者サービスについて。`,
    contact: n => `${n}へのお問い合わせ：誤りのご指摘、攻略の追加要望、提携のご相談はメールで。通常 2〜3 営業日以内に返信します。`
  },
  "ko": {
    about: n => `${n} 소개: 운영 주체, 공략 내용을 검증하는 방법, 각 페이지에서 사용하는 출처를 설명합니다.`,
    privacy: n => `${n} 개인정보 처리방침: 수집하는 익명 통계, 쿠키 사용 방식, 이용 중인 제3자 서비스를 안내합니다.`,
    contact: n => `${n} 문의: 오류 제보, 공략 추가 요청, 제휴 문의는 이메일로 보내주세요. 보통 2-3 영업일 내에 답변드립니다.`
  },
  "es": {
    about: n => `Sobre ${n}: quiénes somos, cómo verificamos cada guía y qué fuentes usamos en cada página.`,
    privacy: n => `Política de privacidad de ${n}: qué estadísticas anónimas recopilamos, cómo se usan las cookies y qué servicios de terceros utilizamos.`,
    contact: n => `Contacta con ${n} por correo para correcciones, guías que faltan o consultas de colaboración. Respondemos en 2-3 días laborables.`
  }
};

/** 拿静态页描述；未覆盖的语言/页回退到 `标题 — 站名`（保持旧行为，不会崩） */
function staticDesc(slug, lang, siteName, fallbackTitle) {
  const t = (STATIC_DESC[lang] || STATIC_DESC.en)[slug];
  return t ? t(siteName) : `${fallbackTitle} — ${siteName}`;
}

/* ---------- 联盟链接（affiliate） ----------
 * 为什么这层必须共用：
 *   1. Google 链接垃圾政策要求联盟链接带 rel="sponsored"（或 nofollow）。漏了是人工处罚风险，
 *      这条没有任何设计自由度，三站必须一致。
 *   2. 各联盟网络链接格式不同：Humble 是加 query 参数，Impact/Partnerize/Awin 是整条包一层跳转链接。
 *      所以配置用「模板」而不是写死参数名——拿到哪种格式都能填进去。
 *   3. 没配 ID 时原样返回原链接。注册联盟前后不用改任何内容，只改 site.json 一处。
 *
 * site.json 配置示例（拿到联盟 ID 后再填，键是商店域名，不带 www）：
 *   "affiliates": {
 *     "humblebundle.com":   { "type": "param", "param": "partner", "value": "yourid" },
 *     "greenmangaming.com": { "type": "wrap",  "template": "https://prf.hn/click/camref:xxx/destination:{url}" }
 *   }
 *   type=param → 在原 URL 上加 ?param=value
 *   type=wrap  → 用 template 包一层，{url} 会被替换成 encodeURIComponent(原URL)，{raw} 是不编码的原URL
 */

/** 取域名并去掉 www.，用作 affiliates 配置的键 */
function hostKey(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function createAffiliate(config = {}) {
  const rules = config || {};
  const ruleFor = url => rules[hostKey(url)] || null;

  /** 把原始商店 URL 转成带联盟追踪的 URL；没配规则就原样返回 */
  function apply(url) {
    const r = ruleFor(url);
    if (!r) return String(url);
    if (r.type === "param" && r.param && r.value) {
      const u = new URL(url);
      u.searchParams.set(r.param, r.value);
      return u.toString();
    }
    if (r.type === "wrap" && r.template) {
      return r.template
        .replace("{url}", encodeURIComponent(String(url)))
        .replace("{raw}", String(url));
    }
    return String(url);
  }

  return {
    apply,
    /** 这条链接是否会被计佣（决定要不要 rel="sponsored" 和是否触发页面披露） */
    isPartner: url => Boolean(ruleFor(url)),
    /**
     * 渲染一条外链。联盟链接自动带 rel="sponsored nofollow noopener"，
     * 普通来源链接保持 rel="noopener"（不加 nofollow，来源可信度是本项目的护城河）
     */
    anchor({ url, text, suffix = "" }) {
      const partner = Boolean(ruleFor(url));
      const rel = partner ? "sponsored nofollow noopener" : "noopener";
      return `<a href="${esc(apply(url))}" target="_blank" rel="${rel}">${esc(text)}${suffix}</a>`;
    },
    /** 页面里有任何一条联盟链接就必须显示披露（FTC 要求） */
    needsDisclosure: urls => (urls || []).some(u => Boolean(ruleFor(u)))
  };
}

/** FTC 联盟披露文案。必须出现在含联盟链接的页面上，且要在链接附近可见 */
const AFFILIATE_DISCLOSURE = {
  "en": "Some store links on this page are affiliate links: if you buy through them we may earn a small commission at no extra cost to you. This never changes which stores we list, the prices we quote, or what we write about the game.",
  "zh-CN": "本页部分商店链接为联盟链接：通过这些链接购买，我们可能获得少量佣金，你不会因此多付钱。这不会影响我们列出哪些商店、标注什么价格，也不会影响我们对游戏的评价。",
  "zh-TW": "本頁部分商店連結為聯盟連結：透過這些連結購買，我們可能獲得少量佣金，你不會因此多付錢。這不會影響我們列出哪些商店、標註什麼價格，也不會影響我們對遊戲的評價。",
  "ja": "このページの一部のストアリンクはアフィリエイトリンクです：リンク経由でご購入いただくと、当サイトに少額の紹介料が入る場合があります（追加費用はかかりません）。掲載するストア・記載する価格・ゲームの評価が変わることはありません。",
  "ko": "이 페이지의 일부 상점 링크는 제휴 링크입니다: 이 링크를 통해 구매하시면 추가 비용 없이 소액의 수수료를 받을 수 있습니다. 어떤 상점을 소개할지, 어떤 가격을 표기할지, 게임을 어떻게 평가할지에는 영향을 주지 않습니다.",
  "es": "Algunos enlaces a tiendas de esta página son enlaces de afiliado: si compras a través de ellos podemos ganar una pequeña comisión sin coste adicional para ti. Esto nunca cambia qué tiendas incluimos, los precios que indicamos ni lo que escribimos sobre el juego."
};

const affiliateDisclosure = lang => AFFILIATE_DISCLOSURE[lang] || AFFILIATE_DISCLOSURE.en;

/* ---------- 产物文件 ---------- */

/**
 * sitemap：带真实 lastmod；不再输出 changefreq（Google 已明确不使用）
 * urls: [{ loc, priority }]
 */
function writeSitemap(outDir, urls, lastmod) {
  const body = urls.map(({ loc, priority }) =>
    `  <url><loc>${loc}</loc><lastmod>${lastmod.dateFor(loc)}</lastmod><priority>${priority}</priority></url>`
  ).join("\n");
  fs.writeFileSync(path.join(outDir, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
  return urls.length;
}

function writeRobots(outDir, domain) {
  fs.writeFileSync(path.join(outDir, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: https://${domain}/sitemap.xml\n`);
}

/** 未接 AdSense 时不写空文件——空 ads.txt 无意义，直接不生成 */
function writeAds(outDir, adsenseId) {
  const p = path.join(outDir, "ads.txt");
  if (adsenseId) fs.writeFileSync(p, `google.com, ${adsenseId}, DIRECT, f08c47fec0942fa0\n`);
  else if (fs.existsSync(p)) fs.unlinkSync(p);
}

/**
 * Cloudflare Pages `_headers`
 * 之前三站都没有这个文件 → CF 默认 max-age=14400（4 小时），回访几乎拿不到缓存收益。
 * CSS 带 ?v=<hash> 指纹、图片文件名稳定，都可以放心 immutable 一年。
 */
function writeHeaders(outDir, extra = "") {
  fs.writeFileSync(path.join(outDir, "_headers"),
`/css/*
  Cache-Control: public, max-age=31536000, immutable
/images/*
  Cache-Control: public, max-age=31536000, immutable
/*.png
  Cache-Control: public, max-age=31536000, immutable
/*.svg
  Cache-Control: public, max-age=31536000, immutable
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
${extra}`);
}

/**
 * IndexNow：Bing / Yandex 分钟级收录，免费，新站最快的外部收录信号。
 * key 文件必须能在 https://<domain>/<key>.txt 访问到，内容就是 key 本身。
 */
function writeIndexNowKey(outDir, key) {
  if (!key) return;
  fs.writeFileSync(path.join(outDir, `${key}.txt`), key);
}

/**
 * llms.txt —— 给 AI agent 的机器可读站点入口。
 *
 * ⚠️ 定位要摆正：Google 的 John Mueller 已明确 Search 的任何系统都不读它，
 *    主流 AI 厂商也没公开承诺在生产环境使用。**不要当 SEO 手段、不要指望它带排名。**
 *    加它的理由是：成本 <30 分钟，而「被 AI 引用」已经是本项目的 KPI 之一，
 *    给 agent 一个结构化入口是低成本对冲。
 *
 * pages: [{ slug, title, desc }]（默认语言即可，agent 会自己跟链接）
 */
function writeLlmsTxt(outDir, { siteName, domain, summary, pages, groups = {}, notes = [] }) {
  const url = s => `https://${domain}${s === "index" ? "/" : "/" + s}`;
  const line = p => `- [${p.title}](${url(p.slug)})${p.desc ? ": " + p.desc : ""}`;

  const grouped = new Set(Object.values(groups).flat());
  const rest = pages.filter(p => !grouped.has(p.slug));

  let out = `# ${siteName}\n\n> ${summary}\n\n`;
  for (const [heading, slugs] of Object.entries(groups)) {
    const list = slugs.map(s => pages.find(p => p.slug === s)).filter(Boolean);
    if (list.length) out += `## ${heading}\n\n${list.map(line).join("\n")}\n\n`;
  }
  if (rest.length) out += `## Guides\n\n${rest.map(line).join("\n")}\n\n`;
  if (notes.length) out += `## Notes\n\n${notes.map(n => `- ${n}`).join("\n")}\n`;

  fs.writeFileSync(path.join(outDir, "llms.txt"), out);
}

module.exports = {
  esc, clean, createUrl, hreflangTags, ld,
  picture, toWebp, webpSrcset, heroPreload, staticDesc,
  createLastmod, LASTMOD_TOKEN,
  hostKey, createAffiliate, affiliateDisclosure, AFFILIATE_DISCLOSURE,
  writeSitemap, writeRobots, writeAds, writeHeaders, writeIndexNowKey, writeLlmsTxt
};
