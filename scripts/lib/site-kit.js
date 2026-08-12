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
  // 「本次构建真的变了」的页面。⚠️ 别用 date === today 来数：today 走的是 UTC
  // (new Date().toISOString())，东八区 00:00-08:00 之间 today 会等于昨天，于是所有
  // 昨天改过的页面都被算成"本次改的"——2026-08-08 实测报出「变更 150/150 页」，实际只有 6 页。
  const changedKeys = new Set();

  /**
   * 只哈希「对读者和搜索引擎有意义的部分」：<title> + meta description + <body>。
   *
   * 为什么不哈希整篇 HTML（2026-08-08 加 Impact 验证 meta 时发现）：
   *   往 <head> 塞一个联盟所有权验证 meta，整篇 HTML 就变了 → 150 个页面的 lastmod
   *   全部跳到今天 → 等于告诉 Google「150 页内容都更新了」，而可见内容一个字没动。
   *   lastmod 谎报多了，Google 会干脆忽略整个站的 lastmod（官方明说会这么做），
   *   那就把这个信号彻底废掉了。而我们接 4 个联盟，这种 head 标签还会再加好几次。
   *
   * 保留 title/description 是因为它们**确实是内容**（决定 SERP 点击率），改了值得让爬虫重看；
   * 验证 meta、分析脚本、CSS 指纹则不是。
   */
  const contentOf = html => {
    const s = String(html);
    const title = (s.match(/<title>([\s\S]*?)<\/title>/i) || [, ""])[1];
    const desc = (s.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [, ""])[1];
    // ⚠️ 本项目的生成器**不输出 `</body>`**（HTML5 允许省略）。
    //    所以不能写 /<body>([\s\S]*)<\/body>/ —— 那样匹配失败会静默退回「哈希整篇」，
    //    fix 看着生效实则没生效（2026-08-08 就是这么错了一版：加 head meta 仍报 150/150）。
    //    正确做法：取 <body> 之后到结尾，再把可能存在的收尾标签去掉。
    const i = s.search(/<body[^>]*>/i);
    const body = i === -1 ? s
      : s.slice(i).replace(/^<body[^>]*>/i, "").replace(/<\/body>\s*<\/html>\s*$|<\/html>\s*$/i, "");
    return `${title}\n${desc}\n${body}`;
  };
  const stableHash = html => crypto.createHash("md5")
    .update(contentOf(html)
      .replace(new RegExp(LASTMOD_TOKEN, "g"), "")
      .replace(/style\.css\?v=[a-f0-9]+/g, "style.css")
    ).digest("hex");

  return {
    /** 传入渲染好的 HTML（含占位符），返回替换好日期的 HTML */
    stamp(key, html) {
      const hash = stableHash(html);
      const old = prev[key];
      const unchanged = Boolean(old) && old.hash === hash;
      if (!unchanged) changedKeys.add(key);
      const date = unchanged ? old.date : today;
      next[key] = { hash, date };
      return String(html).split(LASTMOD_TOKEN).join(date);
    },
    /** sitemap 用：取该 URL 的真实变更日期 */
    dateFor(key) { return (next[key] || prev[key] || {}).date || today; },
    save() {
      fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
      // ⚠️ 别写成 JSON.stringify(next, Object.keys(next).sort(), 2)：
      //    第二个参数是 replacer 白名单且对所有嵌套层生效，白名单里只有 URL 键、
      //    没有 hash/date，会把每个条目存成 {}，lastmod 于是静默退化成「永远是今天」。
      //    要排序就自己建有序对象。
      const sorted = {};
      for (const k of Object.keys(next).sort()) sorted[k] = next[k];
      fs.writeFileSync(manifestPath, JSON.stringify(sorted, null, 2) + "\n");
      return { total: Object.keys(next).length, changed: changedKeys.size, changedKeys: [...changedKeys] };
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

/* ---------- privacy / contact 正文 ----------
 * 这两页的内容是**纯样板**（GA4 匿名统计 / Cookie / 第三方服务 / 联系方式），
 * 三站各写一份纯属重复。更要命的是漏了某个语言就会出现
 * 「lang=ja 但正文全英文」——审计里的 lang-contamination，也是本项目最高频的 P0。
 * 放进共用层后，新站开箱即是全语言正确的。
 * 各站仍可以自己写更详细的版本；这里只保证「不漏、不混排」的底线。
 */
const H2 = "font-size:1.05rem;margin:18px 0 8px";
const STATIC_BODY = {
  privacy: {
    en: (n, d) => `<p>This is a game guide website and we respect visitor privacy.</p><h2 style="${H2}">What we collect</h2><p>We use Google Analytics (GA4) for anonymous traffic statistics: page views, referrers, device types and approximate regions. We do not collect names, email addresses or any personally identifiable information, and we do not sell data.</p><h2 style="${H2}">Cookies</h2><p>Google Analytics sets cookies for session statistics. You can disable cookies in your browser or install the Google Analytics opt-out add-on.</p><h2 style="${H2}">Third-party services</h2><p>The site is served via a CDN, which may record standard access logs (IP, user agent, time). Those services follow their own privacy policies.</p><h2 style="${H2}">Contact</h2><p>For privacy questions, email <a href="mailto:contact@${d}">contact@${d}</a>.</p>`,
    "zh-CN": (n, d) => `<p>本网站是游戏攻略站，我们重视访问者隐私。</p><h2 style="${H2}">我们收集什么</h2><p>我们使用 Google Analytics（GA4）统计匿名流量：页面浏览量、来源渠道、设备类型与大致地区。我们不收集姓名、邮箱或任何个人身份信息，也不出售数据。</p><h2 style="${H2}">Cookie</h2><p>Google Analytics 会设置 Cookie 用于会话统计。你可以在浏览器中禁用 Cookie，或安装 Google Analytics 退出插件。</p><h2 style="${H2}">第三方服务</h2><p>本站通过 CDN 提供服务，可能记录标准访问日志（IP、UA、时间）。这些服务受其各自的隐私政策约束。</p><h2 style="${H2}">联系我们</h2><p>如有隐私问题，请发邮件至 <a href="mailto:contact@${d}">contact@${d}</a>。</p>`,
    "zh-TW": (n, d) => `<p>本網站是遊戲攻略站，我們重視訪問者隱私。</p><h2 style="${H2}">我們收集什麼</h2><p>我們使用 Google Analytics（GA4）統計匿名流量：頁面瀏覽量、來源渠道、設備類型與大致地區。我們不收集姓名、郵箱或任何個人身份信息，也不出售數據。</p><h2 style="${H2}">Cookie</h2><p>Google Analytics 會設置 Cookie 用於會話統計。你可以在瀏覽器中停用 Cookie，或安裝 Google Analytics 退出外掛。</p><h2 style="${H2}">第三方服務</h2><p>本站透過 CDN 提供服務，可能記錄標準存取日誌（IP、UA、時間）。這些服務受其各自的隱私政策約束。</p><h2 style="${H2}">聯絡我們</h2><p>如有隱私問題，請發郵件至 <a href="mailto:contact@${d}">contact@${d}</a>。</p>`,
    ja: (n, d) => `<p>本サイトはゲーム攻略サイトです。訪問者のプライバシーを尊重しています。</p><h2 style="${H2}">収集する情報</h2><p>Google Analytics（GA4）で匿名のアクセス統計（ページビュー、流入元、端末タイプ、おおよその地域）を取得しています。氏名・メールアドレスなどの個人情報は収集せず、データの販売も行いません。</p><h2 style="${H2}">Cookie</h2><p>Google Analytics はセッション統計のため Cookie を使用します。ブラウザで無効化するか、オプトアウトアドオンを利用できます。</p><h2 style="${H2}">第三者サービス</h2><p>本サイトは CDN を通じて配信されており、標準的なアクセスログ（IP・UA・時刻）が記録される場合があります。</p><h2 style="${H2}">お問い合わせ</h2><p><a href="mailto:contact@${d}">contact@${d}</a> までご連絡ください。</p>`,
    ko: (n, d) => `<p>이 사이트는 게임 공략 사이트이며 방문자의 개인정보를 소중히 여깁니다.</p><h2 style="${H2}">수집하는 정보</h2><p>Google Analytics(GA4)로 익명 트래픽 통계(페이지뷰, 유입 경로, 기기 유형, 대략적인 지역)를 수집합니다. 이름·이메일 등 개인 식별 정보는 수집하지 않으며 데이터를 판매하지 않습니다.</p><h2 style="${H2}">쿠키</h2><p>Google Analytics는 세션 통계를 위해 쿠키를 사용합니다. 브라우저에서 비활성화하거나 옵트아웃 애드온을 설치할 수 있습니다.</p><h2 style="${H2}">제3자 서비스</h2><p>본 사이트는 CDN을 통해 제공되며 표준 접근 로그(IP, UA, 시간)가 기록될 수 있습니다.</p><h2 style="${H2}">문의</h2><p><a href="mailto:contact@${d}">contact@${d}</a> 로 보내주세요.</p>`,
    es: (n, d) => `<p>Este es un sitio de guías de juegos y respetamos la privacidad de los visitantes.</p><h2 style="${H2}">Qué recopilamos</h2><p>Usamos Google Analytics (GA4) para estadísticas anónimas de tráfico: visitas, referencias, tipos de dispositivo y regiones aproximadas. No recopilamos nombres, correos ni información personal identificable, y no vendemos datos.</p><h2 style="${H2}">Cookies</h2><p>Google Analytics establece cookies para estadísticas de sesión. Puedes desactivarlas en tu navegador o instalar el complemento de exclusión.</p><h2 style="${H2}">Servicios de terceros</h2><p>El sitio se sirve mediante una CDN, que puede registrar registros de acceso estándar (IP, agente de usuario, hora).</p><h2 style="${H2}">Contacto</h2><p>Escríbenos a <a href="mailto:contact@${d}">contact@${d}</a>.</p>`
  },
  contact: {
    en: (n, d) => `<p>Reach us at <a href="mailto:contact@${d}">contact@${d}</a>.</p><p>We usually reply within 2-3 business days. Corrections are especially welcome — tell us what is wrong and where you saw it, and we will check the source.</p>`,
    "zh-CN": (n, d) => `<p>联系我们：<a href="mailto:contact@${d}">contact@${d}</a></p><p>我们通常会在 2-3 个工作日内回复。尤其欢迎内容纠错——告诉我们哪里有误、在哪一页看到的，我们会核对来源。</p>`,
    "zh-TW": (n, d) => `<p>聯絡我們：<a href="mailto:contact@${d}">contact@${d}</a></p><p>我們通常會在 2-3 個工作天內回覆。尤其歡迎內容糾錯——告訴我們哪裡有誤、在哪一頁看到的，我們會核對來源。</p>`,
    ja: (n, d) => `<p>お問い合わせ：<a href="mailto:contact@${d}">contact@${d}</a></p><p>通常 2〜3 営業日以内に返信します。誤りのご指摘は特に歓迎します。どのページのどの記述かをお知らせいただければ、出典を確認いたします。</p>`,
    ko: (n, d) => `<p>문의：<a href="mailto:contact@${d}">contact@${d}</a></p><p>보통 2-3 영업일 내에 답변드립니다. 오류 제보를 특히 환영합니다. 어느 페이지의 어떤 내용인지 알려주시면 출처를 확인하겠습니다.</p>`,
    es: (n, d) => `<p>Escríbenos a <a href="mailto:contact@${d}">contact@${d}</a>.</p><p>Normalmente respondemos en 2-3 días laborables. Las correcciones son especialmente bienvenidas: dinos qué está mal y en qué página, y comprobaremos la fuente.</p>`
  }
};

/** privacy / contact 的样板正文；未覆盖的语言回退英文（回退时审计会报 lang-contamination，提醒你补） */
function staticBody(slug, lang, { siteName, domain }) {
  const g = STATIC_BODY[slug];
  if (!g) return "";
  return (g[lang] || g.en)(siteName, domain);
}

/* ---------- 联盟链接（affiliate） ----------
 * 为什么这层必须共用：
 *   1. Google 链接垃圾政策要求联盟链接带 rel="sponsored"（或 nofollow）。漏了是人工处罚风险，
 *      这条没有任何设计自由度，三站必须一致。
 *   2. 各联盟网络链接格式不同：Humble 是加 query 参数，Impact/Partnerize/Awin 是整条包一层跳转链接。
 *      所以配置用「模板」而不是写死参数名——拿到哪种格式都能填进去。
 *   3. 没配 ID 时原样返回原链接。注册联盟前后不用改任何内容，只改 site.json 一处。
 *
 * site.json 配置示例（键是商店域名，不带 www）：
 *   "affiliates": {
 *     "gamersgate.com":     { "type": "param", "param": "aff", "value": "01352e74..." },   // 任意 URL 加 ?aff=<ID>
 *     "humblebundle.com":   { "type": "param", "param": "partner", "value": "yourid" },
 *     "greenmangaming.com": { "type": "wrap",  "template": "https://prf.hn/click/camref:xxx/destination:{url}" },
 *     "fanatical.com":      { "type": "wrap",  "template": "https://www.awin1.com/cread.php?awinmid=118821&awinaffid=3026091&ued={url}" }
 *   }
 *   type=param → 在原 URL 上加 ?param=value
 *   type=wrap  → 用 template 包一层，{url} 会被替换成 encodeURIComponent(原URL)，{raw} 是不编码的原URL
 *
 *   Awin 格式（Fanatical 等商户走 Awin）：https://www.awin1.com/cread.php?awinmid=<商户ID>&awinaffid=<发布商ID>&ued=<urlencoded 商品URL>
 *     - 本项目 awinaffid = 3026091（Awin 后台 publisher ID，ui.awin.com/dashboard/awin/publisher/3026091）
 *     - Fanatical awinmid = 118821（ui.awin.com/awin/affiliate/3026091/merchant-profile/118821）
 *     - 新商户：Awin 后台「广告商名录」搜商户 → merchant-profile/<id> → 待批准后把 awinmid 换成新值
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

/* ---------- About 页编辑方针（E-E-A-T） ----------
 * 2026 的 Google core update 打击「高产低监督的 AI 内容」，AdSense 审核也加入了 helpful content 信号；
 * 而「被 AI 引用」比排名更重要之后，把**怎么核实的**讲清楚本身就是信任信号。
 *
 * ⚠️ 这段文案描述的是本项目真实在执行的做法（来源分级、拿不到就标注待补、每页列来源）。
 *    如果哪天不这么做了，必须同步删掉——写了做不到比不写更伤。
 */
const EDITORIAL = {
  "en": {
    h: "How we verify what's on this site",
    items: [
      "<b>Sources first.</b> Every guide page lists the sources it was checked against at the bottom. We prefer official material (the Steam store page, developer and publisher announcements), then established wikis and reputable gaming media.",
      "<b>Claims get graded before they get published.</b> Numbers and mechanics are weighed by how reliable their source is. Marketing copy and figures we cannot trace back to a source do not go on the page.",
      "<b>We say when we don't know.</b> If something cannot be verified yet — a chapter no one has documented, a stat no one has published — we mark it as unverified and leave it open instead of guessing. Gaps are never filled with generated text.",
      "<b>Pages are revised when the game changes.</b> Patches and content updates are tracked, and affected pages are rewritten rather than left stale.",
      "<b>We are independent.</b> This is an unofficial fan site with no affiliation to the game's developer or publisher, and no relationship that would influence what we write."
    ],
    fix: n => `Found something wrong? Corrections are welcome — email us and we will check the source and fix or retract it.`
  },
  "zh-CN": {
    h: "本站的内容核实方式",
    items: [
      "<b>来源优先。</b>每个攻略页底部都列出该页核实时使用的来源。优先采用官方material（Steam 商店页、开发商与发行商公告），其次是成熟 wiki 与有公信力的游戏媒体。",
      "<b>先定级再发布。</b>数据与玩法机制会按来源可靠程度评估后才写进页面。营销话术、以及无法追溯到来源的数字，一律不采用。",
      "<b>不知道就说不知道。</b>暂时无法核实的内容——还没人记录的章节、还没人公布的数值——会明确标注为未核实并留白，而不是猜一个填上。空缺绝不用 AI 生成内容补齐。",
      "<b>游戏更新则页面重写。</b>补丁与内容更新会被跟踪，受影响的页面会重写，而不是放着过期。",
      "<b>本站独立运营。</b>这是非官方粉丝攻略站，与游戏开发商、发行商无隶属关系，也不存在会影响内容立场的利益关系。"
    ],
    fix: n => `发现错误？欢迎指正——来信告诉我们，我们会核对来源并更正或撤下该内容。`
  },
  "zh-TW": {
    h: "本站的內容核實方式",
    items: [
      "<b>來源優先。</b>每個攻略頁底部都列出該頁核實時使用的來源。優先採用官方資料（Steam 商店頁、開發商與發行商公告），其次是成熟 wiki 與有公信力的遊戲媒體。",
      "<b>先定級再發布。</b>數據與玩法機制會按來源可靠程度評估後才寫進頁面。行銷話術、以及無法追溯到來源的數字，一律不採用。",
      "<b>不知道就說不知道。</b>暫時無法核實的內容——還沒人記錄的章節、還沒人公布的數值——會明確標註為未核實並留白，而不是猜一個填上。空缺絕不用 AI 生成內容補齊。",
      "<b>遊戲更新則頁面重寫。</b>修補與內容更新會被追蹤，受影響的頁面會重寫，而不是放著過期。",
      "<b>本站獨立運營。</b>這是非官方粉絲攻略站，與遊戲開發商、發行商無隸屬關係，也不存在會影響內容立場的利益關係。"
    ],
    fix: n => `發現錯誤？歡迎指正——來信告訴我們，我們會核對來源並更正或撤下該內容。`
  },
  "ja": {
    h: "本サイトの情報検証方針",
    items: [
      "<b>出典を最優先。</b>各攻略ページの末尾に、そのページの検証に使用した出典を明記しています。公式情報（Steam ストアページ、開発元・販売元の告知）を最優先し、次いで実績のある wiki と信頼できるゲームメディアを参照します。",
      "<b>公開前に情報の確度を判定。</b>数値やゲームシステムは、出典の信頼度を評価したうえで掲載します。宣伝文句や、出典をたどれない数字は掲載しません。",
      "<b>分からないことは「分からない」と書きます。</b>まだ検証できない情報（誰も記録していない章、公表されていない数値）は未確認と明記し、空欄のまま残します。推測や生成テキストで埋めることはありません。",
      "<b>ゲームの更新に合わせてページを改訂。</b>パッチや追加コンテンツを追跡し、影響を受けるページは放置せず書き直します。",
      "<b>独立した運営です。</b>本サイトは非公式のファンサイトであり、開発元・販売元とは無関係で、記述に影響するような利害関係もありません。"
    ],
    fix: n => `誤りを見つけた場合はご連絡ください。出典を確認のうえ、訂正または取り下げます。`
  },
  "ko": {
    h: "이 사이트의 정보 검증 방식",
    items: [
      "<b>출처 우선.</b> 모든 공략 페이지 하단에 해당 페이지를 검증할 때 사용한 출처를 표기합니다. 공식 자료(Steam 상점 페이지, 개발사·퍼블리셔 공지)를 우선하고, 그다음으로 검증된 위키와 신뢰할 수 있는 게임 매체를 참고합니다.",
      "<b>게재 전에 신뢰도를 판정합니다.</b> 수치와 게임 시스템은 출처의 신뢰도를 평가한 뒤에 페이지에 반영합니다. 마케팅 문구나 출처를 추적할 수 없는 수치는 사용하지 않습니다.",
      "<b>모르는 것은 모른다고 씁니다.</b> 아직 검증할 수 없는 내용(아무도 기록하지 않은 챕터, 공개되지 않은 수치)은 미확인으로 명시하고 비워 둡니다. 빈칸을 추측이나 생성된 문장으로 채우지 않습니다.",
      "<b>게임이 바뀌면 페이지를 다시 씁니다.</b> 패치와 콘텐츠 업데이트를 추적하고, 영향을 받는 페이지는 방치하지 않고 재작성합니다.",
      "<b>독립적으로 운영됩니다.</b> 이 사이트는 비공식 팬 공략 사이트로, 게임 개발사·퍼블리셔와 제휴 관계가 없으며 서술에 영향을 줄 이해관계도 없습니다."
    ],
    fix: n => `잘못된 내용을 발견하셨다면 알려주세요. 출처를 확인한 뒤 정정하거나 삭제합니다.`
  },
  "es": {
    h: "Cómo verificamos lo que publicamos",
    items: [
      "<b>Las fuentes primero.</b> Cada página de guía lista al final las fuentes con las que se contrastó. Damos prioridad al material oficial (la página de Steam, los anuncios del estudio y la distribuidora) y después a wikis consolidadas y medios de videojuegos con reputación.",
      "<b>Cada dato se evalúa antes de publicarse.</b> Las cifras y las mecánicas se valoran según la fiabilidad de su fuente. No usamos textos promocionales ni cifras que no podamos rastrear hasta un origen concreto.",
      "<b>Decimos cuándo no lo sabemos.</b> Si algo aún no se puede verificar —un capítulo que nadie ha documentado, un dato que nadie ha publicado— lo marcamos como no verificado y lo dejamos abierto en lugar de suponerlo. Nunca rellenamos huecos con texto generado.",
      "<b>Revisamos las páginas cuando el juego cambia.</b> Seguimos los parches y las actualizaciones de contenido, y reescribimos las páginas afectadas en vez de dejarlas obsoletas.",
      "<b>Somos independientes.</b> Este es un sitio de fans no oficial, sin vinculación con el estudio ni la distribuidora, y sin ninguna relación que condicione lo que escribimos."
    ],
    fix: n => `¿Has visto un error? Escríbenos: comprobaremos la fuente y lo corregiremos o lo retiraremos.`
  }
};

/**
 * 编辑方针 HTML 片段（插进各站 About 页）。
 * 只给结构，不给样式类——各站自己传 wrapper class，保持视觉独立。
 */
function editorialPolicy(lang, { siteName, contactEmail, headingTag = "h2", headingStyle = "font-size:1.05rem;margin:20px 0 10px" }) {
  const t = EDITORIAL[lang] || EDITORIAL.en;
  const li = t.items.map(i => `<li style="margin:0 0 10px">${i}</li>`).join("");
  const mail = contactEmail ? ` <a href="mailto:${contactEmail}">${contactEmail}</a>` : "";
  return `<${headingTag} style="${headingStyle}">${t.h}</${headingTag}>` +
    `<ul style="margin:0 0 12px;padding-left:1.15em">${li}</ul>` +
    `<p style="opacity:.85">${t.fix(siteName)}${mail}</p>`;
}

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

/**
 * 广告网络配置（site.json → site 对象）：
 *   "adsenseId": "ca-pub-xxxx",          // 非空时：注入 adsbygoogle 脚本 + 生成 ads.txt（阶段 1 再用）
 *   "adsterra": "<Adsterra 后台给的完整脚本 HTML>",  // 非空时：在 </body> 前原样注入
 *     - 手册（2026-08 航海关卡 6）：新站早期 AdSense 审核严 → 先用 Adsterra（门槛低、审核 1-3 分钟）
 *     - 广告形式选 Native Banner 或 Banner；别选 Popunder（影响体验）
 *     - 接入步骤：adsterra.com 注册 Publisher → 创建广告单元（审核通过拿 32 位 appkey）
 *       → 后台复制广告脚本（含 appkey）→ 整段粘到 site.json 的 "adsterra" 字段
 *     - 未配置时两处都不输出任何东西，站点输出与改动前逐字节一致
 */

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

/**
 * GA4 决策事件：统一记录商业出口和交互工具使用。
 * 不采集表单内容或个人信息；gtag 不可用时静默跳过。
 */
function decisionEventsScript() {
  return `<script>
(function(){
  function send(name, params){
    if (typeof window.gtag === "function") window.gtag("event", name, params || {});
  }
  function toolRoot(el){
    return el && el.closest && el.closest('.ff,.ach,.tool-shell,.tool-panel,.tracker,[data-tool]');
  }
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a[href]');
    if (a) {
      try {
        var u = new URL(a.href, location.href);
        if (u.origin !== location.origin) {
          var affiliate = /(^|\\s)sponsored(\\s|$)/.test(a.rel || '') ||
            /amazon\.|amzn\.|gamersgate\.|humblebundle\.|greenmangaming\.|prf\.hn/.test(u.hostname);
          send(affiliate ? 'affiliate_click' : 'outbound_click', {
            link_domain: u.hostname,
            link_url: u.origin + u.pathname,
            page_path: location.pathname
          });
        }
      } catch (_) {}
    }
    var root = toolRoot(e.target);
    // 表单控件统一由 change 记录，避免 checkbox/radio 的 click + change 双计数。
    var control = e.target.closest && e.target.closest('button,[role="button"]');
    if (root && control) send('tool_interaction', {
      tool_name: root.getAttribute('data-tool') || root.id || (root.className || '').toString().split(/\\s+/)[0] || 'interactive_tool',
      interaction_type: control.type || control.tagName.toLowerCase(),
      page_path: location.pathname
    });
  });
  document.addEventListener('change', function(e){
    var root = toolRoot(e.target);
    if (root && /^(INPUT|SELECT)$/.test(e.target.tagName)) send('tool_interaction', {
      tool_name: root.getAttribute('data-tool') || root.id || (root.className || '').toString().split(/\\s+/)[0] || 'interactive_tool',
      interaction_type: e.target.type || e.target.tagName.toLowerCase(),
      page_path: location.pathname
    });
  });
})();
</script>`;
}

module.exports = {
  esc, clean, createUrl, hreflangTags, ld,
  picture, toWebp, webpSrcset, heroPreload, staticDesc, staticBody, editorialPolicy,
  createLastmod, LASTMOD_TOKEN,
  hostKey, createAffiliate, affiliateDisclosure, AFFILIATE_DISCLOSURE,
  writeSitemap, writeRobots, writeAds, writeHeaders, writeIndexNowKey, writeLlmsTxt,
  decisionEventsScript
};
