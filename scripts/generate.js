#!/usr/bin/env node
/**
 * Doloc Town Guide Static Site Generator — "Ruins & Roots" theme
 * 数据驱动 + 6 语言：data/site.json → node scripts/generate.js → public/
 * 语言：en（默认，根路径）/ zh-CN / zh-TW / ja / ko / es，hreflang + 语言切换器
 * 视觉：废墟田园（暖绿+琥珀+锈灰、生长卡、季节条、废土手册风）
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ROOT = path.join(__dirname, "..");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "site.json"), "utf8"));
const OUT = path.join(ROOT, "public");
const esc = s => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const clean = slug => String(slug).replace(/\.html$/,"");
const LANGS = DATA.site.languages || ["en"];
const DEF = DATA.site.defaultLanguage || "en";
const CSS_V = crypto.createHash("md5").update(fs.readFileSync(path.join(ROOT,"templates","style.css"),"utf8")).digest("hex").slice(0,8);
const today = new Date().toISOString().slice(0,10);
const urlOf = (slug, lang) => {
  const base = `https://${DATA.site.domain}`;
  const p = clean(slug);
  const pathPart = lang === DEF ? (p === "index" ? "/" : `/${p}`) : (p === "index" ? `/${lang}/` : `/${lang}/${p}`);
  return base + pathPart;
};
const LANG_META = {
  "en":    { flag: "🇬🇧", name: "English",  html: "en" },
  "zh-CN": { flag: "🇨🇳", name: "简体中文", html: "zh-CN" },
  "zh-TW": { flag: "🇹🇼", name: "繁體中文", html: "zh-TW" },
  "ja":    { flag: "🇯🇵", name: "日本語",   html: "ja" },
  "ko":    { flag: "🇰🇷", name: "한국어",   html: "ko" },
  "es":    { flag: "🇪🇸", name: "Español",  html: "es" },
};
/* ---------- SVG flags (premium, render on all platforms) ---------- */
const FLAGS = {
  "en": '<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#012169"/><path d="M0 0 60 40M60 0 0 40" stroke="#fff" stroke-width="11"/><path d="M0 0 60 40M60 0 0 40" stroke="#C8102E" stroke-width="6"/><path d="M30 0v40M0 20h60" stroke="#fff" stroke-width="14"/><path d="M30 0v40M0 20h60" stroke="#C8102E" stroke-width="8"/></svg>',
  "zh-CN": '<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#EE1C25"/><g fill="#FFDE00"><path d="M12 8l1.7 3.4 3.8.5-2.8 2.7.7 3.8L12 16.7l-3.4 1.7.7-3.8-2.8-2.7 3.8-.5z"/><path d="M22 4l.8 1.6 1.8.3-1.3 1.3.3 1.8-1.6-.8-1.6.8.3-1.8-1.3-1.3 1.8-.3zM25 11l.8 1.6 1.8.3-1.3 1.3.3 1.8-1.6-.8-1.6.8.3-1.8-1.3-1.3 1.8-.3zM22 18l.8 1.6 1.8.3-1.3 1.3.3 1.8-1.6-.8-1.6.8.3-1.8-1.3-1.3 1.8-.3zM19 11l.8 1.6 1.8.3-1.3 1.3.3 1.8-1.6-.8-1.6.8.3-1.8-1.3-1.3 1.8-.3z"/></g></svg>',
  "zh-TW": '<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#FE0000"/><rect width="30" height="20" fill="#000095"/><g fill="#fff" stroke="#fff" stroke-width="1"><path d="M15 2l2.3 6.7 7 .1-5.6 4.2 2.1 6.7-5.8-4-5.8 4 2.1-6.7L5.7 8.8l7-.1z"/><g stroke-width=".6"><path d="M15 2v16M15 2 5.7 8.8 15 15.6M15 2l9.3 6.8L15 15.6M15 2v16M15 18.8 5.7 12 15 5.2M15 18.8l9.3-6.8L15 5.2"/></g></g></svg>',
  "ja": '<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#fff"/><circle cx="30" cy="20" r="11" fill="#BC002D"/></svg>',
  "ko": '<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#fff"/><g transform="translate(30 20)"><g transform="rotate(45)"><rect x="-10" y="-5" width="20" height="10" fill="#CD2E3A"/><rect x="-10" y="0" width="20" height="10" fill="#0047A0"/><circle r="6" fill="#fff"/></g><circle r="5" fill="#CD2E3A"/><path d="M0-5a5 5 0 0 1 0 10 2 2 0 0 1 0-10" fill="#0047A0"/></g><g fill="#000"><path d="M15 2h3v6h-3zM15 32h3v6h-3zM42 2h3v6h-3zM42 32h3v6h-3z"/></g></svg>',
  "es": '<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#AA151B"/><rect y="10" width="60" height="20" fill="#F1BF00"/><g transform="translate(30 20)"><path d="M-10 0a10 10 0 0 1 10-10 10 10 0 0 1 0 20 10 10 0 0 1-10-10z" fill="#fff" opacity=".85"/></g></svg>',
};
const flagOf = lang => FLAGS[lang] || "🌐";

const metaOf = slug => (DATA.pages.find(p=>p.slug===slug)?.meta) || {};
const pageOf = (page, lang) => {
  if (lang === DEF || !page.i18n || !page.i18n[lang]) {
    return { title: page.title, metaTitle: page.metaTitle, metaDescription: page.metaDescription, intro: page.intro, sections: page.sections, heroImage: page.heroImage };
  }
  const t = page.i18n[lang];
  return { title: t.title || page.title, metaTitle: t.metaTitle || page.metaTitle, metaDescription: t.metaDescription || page.metaDescription, intro: t.intro || page.intro, sections: t.sections || page.sections, heroImage: t.heroImage || page.heroImage };
};
const siteI18n = lang => {
  const s = (DATA.site.i18n && DATA.site.i18n[lang]) || {};
  return {
    name: s.name || DATA.site.name, tagline: s.tagline || DATA.site.tagline, description: s.description || DATA.site.description,
    navHome: s.navHome || "Home", navGuides: s.navGuides || "Guides", navSystems: s.navSystems || "Systems",
    navAbout: s.navAbout || "About", navPrivacy: s.navPrivacy || "Privacy", navContact: s.navContact || "Contact",
    langLabel: s.langLabel || "Language", aboutTitle: s.aboutTitle || "About", privacyTitle: s.privacyTitle || "Privacy Policy", contactTitle: s.contactTitle || "Contact",
    footerNote: s.footerNote || "Unofficial fan site — game and related assets belong to their respective owners.",
    footerSource: s.footerSource || "Information checked against the official Steam store page, official 1.0 announcement, publisher and media reports.",
    quickAnswers: s.quickAnswers || "Quick answers", guides: s.guides || "All guides", aboutGame: s.aboutGame || "About the game",
    startPlaying: s.startPlaying || "Get it on Steam", getOnSteam: s.getOnSteam || "Get it on Steam ↗", readGuide: s.readGuide || "Read the guide →",
    moreGuides: s.moreGuides || "More guides", sources: s.sources || "Sources & fact-checking",
    plotTag: s.plotTag || "FIELD NOTE", growTag: s.growTag || "GROWTH", seasonTag: s.seasonTag || "SEASON",
    updated: s.updated || "Contents", explore: s.explore || "From scrap to harvest in a wasteland", latest: s.latest || "Latest guides",
    harvest: s.harvest || "HARVEST", seedTag: s.seedTag || "SEED",
  };
};

/* ---------- SVG icons (Ruins & Roots line icons, stroke currentColor) ---------- */
const SVG = {
  logo: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="3" y="3" width="34" height="34" rx="9" fill="#1C2A1E"/><path d="M20 32C14 27 10 22 10 16.5A6.5 6.5 0 0 1 16.5 10c2.2 0 4 1 5.5 2.8C23.5 11 25.3 10 27.5 10a6.5 6.5 0 0 1 6.5 6.5C34 22 30 27 20 32z" fill="none" stroke="#7FB069" stroke-width="2.4" stroke-linejoin="round"/><path d="M20 32v-8" stroke="#D97706" stroke-width="2.2" stroke-linecap="round"/><circle cx="20" cy="19" r="2.4" fill="#D97706"/></svg>',
  "how-to-play": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z"/></svg>',
  "farming": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21v-7m0 0c-3-1.5-5-4.5-5-8 4.5 0 8 3 8 8z"/><path d="M12 14c3-1 5.5-3.5 5.5-7C13 7 10.5 10 10 14z" opacity=".75"/><path d="M8 21h8"/></svg>',
  "automation": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 17V7m8 10V7M3.5 12h17"/><circle cx="8" cy="9" r="1.2" fill="currentColor"/><circle cx="8" cy="15" r="1.2" fill="currentColor"/><circle cx="16" cy="9" r="1.2" fill="currentColor"/><circle cx="16" cy="15" r="1.2" fill="currentColor"/></svg>',
  "gene-system": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="6" r="2.5"/><circle cx="6.5" cy="17" r="2.5"/><circle cx="17.5" cy="17" r="2.5"/><path d="M12 8.5c-1 4-1 7.5-4 10.5M12 8.5c1 4 1 7.5 4 10.5M12 8.5v11M12 19.5h.01"/></svg>',
  "fishing": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h7a3 3 0 013 3v12a1.5 1.5 0 003 0V8"/><path d="M17 8l3-1.5v3L17 8z"/><path d="M4 8h4"/></svg>',
  "drone-combat": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c-2 0-3.5 1.5-3.5 3.5S10 10 12 10s3.5-1.5 3.5-3.5S14 3 12 3z"/><path d="M12 10v6"/><circle cx="12" cy="19" r="2"/><path d="M5 6.5h2M17 6.5h2"/></svg>',
  "exploration": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 4.5 3.5 8 8 9 4.5-1 8-4.5 8-9V6l-8-3z"/><path d="M12 8v5m-2.5-2.5 5 0"/></svg>',
  "friendship": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.5-9-9c-1.2-3 1.2-6.5 4.5-6.5 2 0 3.5 1 4.5 2.5 1-1.5 2.5-2.5 4.5-2.5 3.3 0 5.7 3.5 4.5 6.5-2 4.5-9 9-9 9z"/><path d="M9 12h6M12 9v6" opacity=".7"/></svg>',
  "cooking": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9h14v3a7 7 0 01-14 0V9z"/><path d="M9 4c0 1.5-1 2-1 3.5M12 4c0 1.5-1 2-1 3.5M15 4c0 1.5-1 2-1 3.5"/></svg>',
  "ranching": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V8l8-4 8 4v12"/><path d="M4 12h16M9 20v-4a3 3 0 016 0v4"/></svg>',
  "characters": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"/></svg>',
  "story": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 6.5 9.5 12 15l5.5-5.5L12 4z"/><path d="M6.5 9.5h11M8 15l1.5 5h5L16 15"/></svg>',
  "weather": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17a4.5 4.5 0 01-.5-9A6 6 0 0118 9.5 3.5 3.5 0 0117.5 17H7z"/><path d="M4 5.5 5 6.5M4 5.5 5 4.5M19 5.5 20 6.5M19 5.5 18 4.5" opacity=".8"/><path d="M4.5 11h-1.5M21 11h-1.5"/></svg>',
  "achievements": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8m-4-3v3m-3.5-18 1.5 2.5L9 6l1.5 1L12 5l1.5 2L15 6l-1-1.5L15.5 3H8.5z"/><path d="M9 8.5h6v1.5a3 3 0 01-6 0V8.5z"/></svg>',
  "mods": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4-3 7.5-7 9-4-1.5-7-5-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg>',
  "update-log": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 3h6"/></svg>',
  "faq": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 115.1.9c-.6 1.1-2.1 1.6-2.1 2.9M12 16.5h.01"/></svg>',
  "system-requirements": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8 20h8m-4-3.5V20"/><path d="M7 8h4M7 11h7"/></svg>',
  "steam-deck": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="16" height="12" rx="3"/><path d="M8.5 10h.01M12 10h.01M15.5 10h.01M9.5 13.5c.8.8 4.2.8 5 0"/></svg>',
  "up": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5m-6 6 6-6 6 6"/></svg>',
  "pin": '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 00-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6a2.5 2.5 0 010 5.5z"/></svg>',
  "search": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>',
  "sprout": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21v-8"/><path d="M12 13c-3-1.5-5-4-5-7.5C11.5 5.5 15 8 12 13z"/><path d="M12 13c3-1 5.5-3.5 5.5-7C13 6 10.5 8.5 10.5 12.5" opacity=".7"/></svg>',
};

function hreflang(slug){
  const alt = LANGS.map(l => `<link rel="alternate" hreflang="${LANG_META[l]?.html || l}" href="${urlOf(slug,l)}" />`).join("\n");
  return `${alt}\n<link rel="alternate" hreflang="x-default" href="${urlOf(slug,DEF)}" />`;
}
function head(title, desc, extraLd, slug, lang, ogImage){
  const ld = JSON.stringify([siteLd(lang)].concat(extraLd || []));
  const gsc = DATA.site.gscVerification ? `<meta name="google-site-verification" content="${esc(DATA.site.gscVerification)}" />` : "";
  const og = ogImage || DATA.site.ogImage || "/images/hero.jpg";
  const htmlLang = LANG_META[lang]?.html || lang;
  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${urlOf(slug,lang)}" />
${hreflang(slug)}
<meta name="theme-color" content="#16211A" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
${gsc}
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${esc(siteI18n(lang).name)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${urlOf(slug,lang)}" />
<meta property="og:image" content="https://${DATA.site.domain}${og}" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;600;700&family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/css/style.css?v=${CSS_V}" />
<script type="application/ld+json">${ld}</script>
${DATA.site.gaId ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(DATA.site.gaId)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${esc(DATA.site.gaId)}');</script>` : ""}
</head>
<body>`;
}
function langSwitcher(lang, slug){
  const items = LANGS.map(l =>
    `<a href="${urlOf(slug,l)}" class="${l===lang?"active":""}"><span class="flag svg-flag">${flagOf(l)}</span>${LANG_META[l]?.name||l}</a>`
  ).join("");
  return `<details class="lang-dd">
    <summary><span class="flag svg-flag">${flagOf(lang)}</span><span class="lang-name">${LANG_META[lang]?.name||lang}</span><span class="caret">▾</span></summary>
    <div class="dd-menu dd-lang">${items}</div>
  </details>`;
}
function header(lang, active){
  const s = siteI18n(lang);
  const prefix = lang === DEF ? "" : `/${lang}`;
  const guideItems = DATA.pages.map(p => {
    const m = metaOf(p.slug);
    return `<a href="${prefix}/${p.slug}" class="${p.slug===active?"active":""}"><span class="nav-ic">${SVG[m.icon]}</span><span>${esc(pageOf(p,lang).title)}</span></a>`;
  }).join("");
  const searchPh = lang==="en"?"Search guides…":lang==="ja"?"ガイドを検索…":lang==="ko"?"공략 검색…":lang==="es"?"Buscar guías…":"搜索攻略…";
  const searchLabel = lang==="en"?"Search guides":lang==="ja"?"ガイドを検索":lang==="ko"?"공략 검색":lang==="es"?"Buscar guías":"搜索攻略";
  return `<header class="site-header">
  <div class="container header-inner">
    <a class="logo" href="${prefix}/"><span class="logo-badge">${SVG.logo}</span><span class="logo-txt">${esc(s.name)}</span></a>
    <nav class="nav" aria-label="Main">
      <a href="${prefix}/" class="${active===""?"active":""}">${esc(s.navHome)}</a>
      <details class="dd">
        <summary>${esc(s.navGuides)} <span class="caret">▾</span></summary>
        <div class="dd-menu dd-grid">${guideItems}</div>
      </details>
    </nav>
    <form class="site-search" action="https://www.google.com/search" method="get" target="_blank" rel="noopener" role="search">
      <input type="search" name="q" placeholder="${searchPh}" aria-label="${searchLabel}" />
      <input type="hidden" name="as_sitesearch" value="${esc(DATA.site.domain)}" />
      <span class="search-ic" aria-hidden="true">${SVG.search}</span>
    </form>
    ${langSwitcher(lang, active || "index")}
  </div>
</header>`;
}
function footer(lang){
  const s = siteI18n(lang);
  const prefix = lang === DEF ? "" : `/${lang}`;
  const cols = DATA.pages.slice(0, 10).map(p => `<a href="${prefix}/${p.slug}">${esc(pageOf(p,lang).title)}</a>`).join("");
  return `<footer class="site-footer">
  <div class="container footer-inner">
    <div class="footer-brand-row">
      <div class="footer-brand"><span class="logo-badge small">${SVG.logo}</span><span>${esc(s.name)}</span></div>
      <div class="footer-links">
        <a href="${prefix}/about">${esc(s.navAbout)}</a><a href="${prefix}/privacy">${esc(s.navPrivacy)}</a><a href="${prefix}/contact">${esc(s.navContact)}</a>
        <a href="${esc(DATA.game.steamUrl)}" target="_blank" rel="noopener">Steam ↗</a>
      </div>
    </div>
    <div class="footer-cols">
      <nav class="footer-col">${cols}</nav>
      <div class="footer-meta">
        <p>${esc(s.tagline)}</p>
        <p>${esc(s.footerNote)}</p>
        <p>${esc(s.footerSource)} · ${today}</p>
      </div>
    </div>
    ${DATA.site.adsenseId ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(DATA.site.adsenseId)}" crossorigin="anonymous"></script>` : ""}
  </div>
<script>
document.addEventListener('click', function(e){
  document.querySelectorAll('details.dd[open], details.lang-dd[open]').forEach(function(d){
    if (!d.contains(e.target)) d.removeAttribute('open');
  });
});
document.addEventListener('keydown', function(e){
  if (e.key === 'Escape') document.querySelectorAll('details[open]').forEach(function(d){ d.removeAttribute('open'); });
});
document.addEventListener('DOMContentLoaded', function(){
  var obs = new IntersectionObserver(function(es){
    es.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add('in'); obs.unobserve(en.target); } });
  }, {threshold:.08});
  document.querySelectorAll('.reveal').forEach(function(el){ obs.observe(el); });
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc a'));
  if (tocLinks.length) {
    var tocTargets = tocLinks.map(function(a){ return document.querySelector(a.getAttribute('href')); });
    var tocObs = new IntersectionObserver(function(es){
      es.forEach(function(en){
        if (en.isIntersecting) {
          var id = '#' + en.target.id;
          tocLinks.forEach(function(a){ a.classList.toggle('active', a.getAttribute('href') === id); });
        }
      });
    }, {rootMargin:'-15% 0px -70% 0px', threshold:0});
    tocTargets.forEach(function(s){ if (s) tocObs.observe(s); });
  }
});
</script>
</footer>`;
}

/* ---------- section renderer (Ruins & Roots components) ---------- */
let SEC_IDX = 0;
function secId(){ SEC_IDX += 1; return "sec-" + SEC_IDX; }
function renderSection(s, lang){
  const id = secId();
  const st = siteI18n(lang);
  switch(s.type){
    case "steps": {
      const items = (s.items||[]).map((it,i)=>`<li class="step-item"><span class="step-no">${String(i+1).padStart(2,"0")}</span><div><b>${esc(it[0])}</b>${it[1]?`<p>${esc(it[1])}</p>`:""}</div></li>`).join("");
      return `<section class="card grow-card reveal" id="${id}"><h2><span class="sec-tag">${esc(s.tag||st.seedTag)}</span>${esc(s.heading)}</h2>${s.body?`<p class="sec-body">${esc(s.body)}</p>`:""}<ol class="steps">${items}</ol></section>`;
    }
    case "list": {
      const items = (s.items||[]).map(it=>`<li>${esc(it)}</li>`).join("");
      return `<section class="card grow-card reveal" id="${id}"><h2><span class="sec-tag">${esc(s.tag||st.growTag)}</span>${esc(s.heading)}</h2>${s.body?`<p class="sec-body">${esc(s.body)}</p>`:""}<ul class="checks">${items}</ul></section>`;
    }
    case "table": {
      const headRow = (s.columns||[]).map(c=>`<th>${esc(c)}</th>`).join("");
      const rows = (s.rows||[]).map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join("")}</tr>`).join("");
      return `<section class="card grow-card reveal" id="${id}"><h2><span class="sec-tag">${esc(s.tag||st.seasonTag)}</span>${esc(s.heading)}</h2>${s.body?`<p class="sec-body">${esc(s.body)}</p>`:""}<div class="tbl-wrap"><table><thead><tr>${headRow}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
    }
    case "faq": {
      const items = (s.items||[]).map(([q,a])=>`<details class="faq"><summary>${esc(q)}<span class="pm">+</span></summary><div class="faq-a">${esc(a)}</div></details>`).join("");
      return `<section class="card grow-card reveal" id="${id}"><h2><span class="sec-tag">${esc(s.tag||"QA")}</span>${esc(s.heading)}</h2>${items}</section>`;
    }
    case "evidence": {
      const items = (s.items||[]).map(([label,txt])=>`<div class="evidence"><span class="ev-tag">${esc(label)}</span><p>${esc(txt)}</p></div>`).join("");
      return `<section class="card grow-card reveal" id="${id}"><h2><span class="sec-tag">${esc(s.tag||st.plotTag)}</span>${esc(s.heading)}</h2>${s.body?`<p class="sec-body">${esc(s.body)}</p>`:""}<div class="evidence-stack">${items}</div></section>`;
    }
    case "timeline": {
      const items = (s.items||[]).map(([t,txt])=>`<li class="tl-item"><span class="tl-time">${esc(t)}</span><p>${esc(txt)}</p></li>`).join("");
      return `<section class="card grow-card reveal" id="${id}"><h2><span class="sec-tag">${esc(s.tag||st.seasonTag)}</span>${esc(s.heading)}</h2>${s.body?`<p class="sec-body">${esc(s.body)}</p>`:""}<ul class="timeline">${items}</ul></section>`;
    }
    case "note": {
      return `<section class="card grow-card reveal plot-note" id="${id}"><h2><span class="sec-tag">${esc(s.tag||st.plotTag)}</span>${esc(s.heading)}</h2>${s.body?`<p class="sec-body">${esc(s.body)}</p>`:""}</section>`;
    }
    default: return "";
  }
}

/* ---------- home ---------- */
function renderHome(lang){
  const s = siteI18n(lang);
  const prefix = lang === DEF ? "" : `/${lang}`;
  const gname = (DATA.game.nameI18n && DATA.game.nameI18n[lang]) || DATA.game.name;
  const gintro = (DATA.game.introI18n && DATA.game.introI18n[lang]) || DATA.game.intro;
  const statsArr = (DATA.game.statsI18n && DATA.game.statsI18n[lang]) || DATA.game.stats || [];
  const stats = statsArr.map(st=>`<div class="stat"><b>${esc(st.value)}</b><span>${esc(st.label)}</span></div>`).join("");
  const cards = DATA.pages.map((p,i) => {
    const m = metaOf(p.slug);
    const t = Object.assign(pageOf(p, lang), {slug: p.slug});
    return `<a class="file-card reveal" href="${prefix}/${p.slug}">
      <span class="file-icon">${SVG[m.icon]}</span>
      <h3>${esc(t.title)}</h3>
      <p>${esc(t.metaDescription)}</p>
      <span class="file-open">${esc(s.readGuide)}</span>
    </a>`;
  }).join("");
  const _faqSec = (pageOf(DATA.pages.find(p=>p.slug==="faq"), lang).sections||[]).find(x=>x.type==="faq");
  const faqItems = _faqSec?.items || [];
  const faqHtml = faqItems.map(([q,a])=>`<details class="faq"><summary>${esc(q)}<span class="pm">+</span></summary><div class="faq-a">${esc(a)}</div></details>`).join("");
  const keyFactsArr = (DATA.game.keyFactsI18n && DATA.game.keyFactsI18n[lang]) || DATA.game.keyFacts || [];
  const keyFacts = keyFactsArr.map(f=>`<li>${esc(f)}</li>`).join("");
  const sproutCards = [
    ["farming", lang==="en"?"Vertical farms & crops":lang==="ja"?"垂直農場と作物":lang==="ko"?"수직 농장과 작물":lang==="es"?"Granjas verticales y cultivos":"垂直农场与作物", lang==="en"?"Stack platforms, planters, seasons and harvests.":lang==="ja"?"プラットフォームを積み、季節と収穫を管理。":lang==="ko"?"플랫폼을 쌓고 계절과 수확을 관리하세요.":lang==="es"?"Apila plataformas, cultiva y cosecha por estaciones.":"堆叠平台、管理季节与收成。"],
    ["automation", lang==="en"?"Farming automation (1.0)":lang==="ja"?"農業オートメーション（1.0）":lang==="ko"?"농업 자동화 (1.0)":lang==="es"?"Automatización agrícola (1.0)":"农业自动化（1.0）", lang==="en"?"Solar, wind and drone stations do the chores.":lang==="ja"?"太陽光・風力とドローン基地が作業を代行。":lang==="ko"?"태양광·풍력과 드론 기지가 일을 대신합니다.":lang==="es"?"Paneles solares, viento y estaciones de drones.":"太阳能、风能与无人机站代劳。"],
    ["gene-system", lang==="en"?"Crop gene system":lang==="ja"?"作物遺伝子システム":lang==="ko"?"작물 유전자 시스템":lang==="es"?"Sistema genético de cultivos":"作物基因系统", lang==="en"?"~20 mutations across 30+ crops.":lang==="ja"?"30以上の作物に約20の変異。":lang==="ko"?"30개 이상 작물에 약 20가지 변이.":lang==="es"?"~20 mutaciones en más de 30 cultivos.":"30+ 作物、约 20 种突变。"],
    ["weather", lang==="en"?"Extreme weather":lang==="ja"?"過酷な天候":lang==="ko"?"극한 날씨":lang==="es"?"Clima extremo":"极端天气", lang==="en"?"Turn acid rain and storms to your advantage.":lang==="ja"?"酸性雨や嵐を味方に。":lang==="ko"?"산성비와 폭풍을 활용하세요.":lang==="es"?"Convierte la lluvia ácida y las tormentas en aliadas.":"把酸雨与雷暴变成优势。"],
  ].map(([ic,t,d])=>`<a class="sprout-card reveal" href="${prefix}/${ic==="farming"?"farming":ic==="automation"?"automation":ic==="gene-system"?"gene-system":"weather"}"><span class="sprout-ic">${SVG[ic]}</span><b>${esc(t)}</b><p>${esc(d)}</p></a>`).join("");
  const heroImg = "/images/hero.jpg";
  const badgeTxt = lang==="en" ? "Post-apocalyptic farming sim — 1.0 full release guides"
    : lang==="ja" ? "終末世界の農場シム — 1.0 完全版攻略"
    : lang==="ko" ? "포스트 아포칼립스 농장 시뮬 — 1.0 공략"
    : lang==="es" ? "Simulador de granja post-apocalíptico — guías 1.0"
    : "后末日农场模拟 — 1.0 完整攻略";
  const h1Tail = lang==="en" ? "GUIDES" : lang==="ja" ? "攻略" : lang==="ko" ? "공략" : lang==="es" ? "GUÍAS" : "攻略";
  const body = `
  <main class="container">
    <section class="hero land-hero">
      <div class="hero-copy">
        <span class="evidence-tag"><span class="dot"></span> ${esc(badgeTxt)}</span>
        <h1>${esc(gname)} <span class="stamp-hl">${esc(h1Tail)}</span></h1>
        <p class="lead">${esc(s.tagline)}.</p>
        <div class="stats">${stats}</div>
        <div class="cta-row">
          <a class="btn btn-primary" href="${esc(DATA.game.steamUrl)}" target="_blank" rel="noopener">${esc(s.startPlaying)}</a>
          <a class="btn btn-ghost" href="${prefix}/how-to-play">${esc(s.readGuide)}</a>
        </div>
      </div>
      <div class="land-panel">
        <div class="land-photo"><img src="/images/hero-1280.jpg" srcset="/images/hero-640.jpg 640w, /images/hero-1280.jpg 1280w, /images/hero.jpg 1600w" sizes="(max-width: 560px) 92vw, (max-width: 960px) 60vw, 520px" alt="${esc(gname)} key art" loading="eager" width="1600" height="900" fetchpriority="high" /></div>
        <div class="clue clue-a"><span class="clue-pin">${SVG.sprout}</span><b>${esc(keyFactsArr[0]||"")}</b></div>
        <div class="clue clue-b"><span class="clue-pin">${SVG.sprout}</span><b>${esc(keyFactsArr[1]||"")}</b></div>
        <div class="clue clue-c"><span class="clue-pin">${SVG.pin}</span><b>${esc(keyFactsArr[2]||"")}</b></div>
        <div class="stamp" aria-hidden="true">${esc(s.harvest)}</div>
      </div>
    </section>
    <section class="section">
      <div class="sec-head reveal"><span class="mono">${esc(s.plotTag)} // 001</span><h2>${esc(s.guides)}</h2></div>
      <div class="file-grid">${cards}</div>
    </section>
    <section class="section">
      <div class="sec-head reveal"><span class="mono">${esc(s.seasonTag)} // CORE</span><h2>${esc(s.latest)}</h2></div>
      <div class="sprout-grid">${sproutCards}</div>
    </section>
    <section class="section split">
      <div class="card grow-card reveal">
        <h2><span class="sec-tag">${esc(s.aboutGame)}</span></h2>
        <p class="sec-body">${esc(gintro)}</p>
        <ul class="checks">${keyFacts}</ul>
      </div>
      <div class="card grow-card reveal">
        <h2><span class="sec-tag">${esc(s.quickAnswers)}</span></h2>
        ${faqHtml}
      </div>
    </section>
  </main>`;
  return renderFull(lang, siteI18n(lang).name, `${esc(gname)} — ${esc(s.tagline)}`, [], "index", body, heroImg);
}
function renderFull(lang, title, desc, extraLd, slug, body, ogImage){
  const s = siteI18n(lang);
  return head(title, desc, extraLd, slug, lang, ogImage) + header(lang, slug === "index" ? "" : slug) + body + footer(lang);
}

/* ---------- article pages ---------- */
function renderPage(lang, page){
  const t = Object.assign(pageOf(page, lang), {slug: page.slug});
  const prefix = lang === DEF ? "" : `/${lang}`;
  SEC_IDX = 0;
  const toc = (t.sections||[]).filter(s=>s.heading).map((s,i)=>{
    SEC_IDX += 1;
    return `<a href="#sec-${SEC_IDX}">${esc(s.heading)}</a>`;
  }).join("");
  SEC_IDX = 0;
  const sections2 = (t.sections||[]).map(s => renderSection(s, lang)).join("");
  const related = DATA.pages.filter(p=>p.slug!==page.slug).slice(0,6).map(p=>{
    const m = metaOf(p.slug);
    return `<a href="${prefix}/${p.slug}"><span class="nav-ic">${SVG[m.icon]}</span><span>${esc(pageOf(p,lang).title)}</span></a>`;
  }).join("");
  const sources = (page.sources||[]).map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc((s.labels && s.labels[lang]) || s.label)} ↗</a></li>`).join("");
  const s = siteI18n(lang);
  const heroImg = t.heroImage;
  const srcsetOf = img => {
    if (!img) return "";
    const base = img.replace(/\.(jpg|jpeg|png|webp)$/i, "");
    return ` srcset="${base}-640.jpg 640w, ${base}-1280.jpg 1280w, ${img} 1600w" sizes="(max-width: 640px) 94vw, (max-width: 960px) 92vw, 820px"`;
  };
  const pageHero = heroImg ? `<div class="page-hero-img"><img src="${heroImg}"${srcsetOf(heroImg)} alt="${esc(t.title)}" loading="lazy" width="1600" height="900" /></div>` : "";
  const noImgCls = heroImg ? "" : " noimg";
  const body = `
  <main class="container">
    <nav class="crumbs"><a href="${prefix}/">${esc(s.navHome)}</a><span>›</span><span>${esc(t.title)}</span></nav>
    <div class="article-wrap">
      <article>
        <div class="page-hero reveal${noImgCls}">
          ${heroImg ? "" : `<span class="hero-ic" aria-hidden="true">${SVG[page.meta?.icon || "faq"]}</span>`}
          <span class="hero-wm" aria-hidden="true">${esc(page.slug.toUpperCase())}</span>
          <span class="evidence-tag">${esc(s.plotTag)} // ${esc(page.slug.toUpperCase())}</span>
          <h1>${esc(t.title)}</h1>
          <p class="intro">${esc(t.intro)}</p>
          ${pageHero}
        </div>
        ${toc ? `<nav class="toc reveal"><b class="toc-title">${esc(s.updated)}</b>${toc}</nav>` : ""}
        ${sections2}
        ${sources ? `<div class="sources reveal"><b>${esc(s.sources)}</b><ul>${sources}</ul></div>` : ""}
      </article>
      <aside class="grow-side">
        <div class="case-meta reveal">
          <span class="cm-tag">${esc(s.plotTag)}</span>
          <div class="cm-row"><span class="cm-k">${esc(lang==="en"?"Page":lang==="ja"?"ページ":lang==="ko"?"페이지":lang==="es"?"Página":"页面")}</span><b>${esc(t.title)}</b></div>
          <div class="cm-row"><span class="cm-k">${esc(lang==="en"?"Category":lang==="ja"?"分類":lang==="ko"?"분류":lang==="es"?"Categoría":"分类")}</span><b>${esc(t.title.split(":")[0].split("—")[0].trim())}</b></div>
          <div class="cm-row"><span class="cm-k">${esc(s.updated)}</span><b>${today}</b></div>
          <div class="cm-stamp">${esc(s.harvest)}</div>
        </div>
        <div class="related reveal">
          <b>${esc(s.moreGuides)}</b>
          ${related}
        </div>
        <div class="cta-box reveal">
          <span class="mono">${esc(s.plotTag)} // STEAM</span>
          <p>${esc(gnameOf(lang))}</p>
          <a class="btn btn-primary" href="${esc(DATA.game.steamUrl)}" target="_blank" rel="noopener">${esc(s.getOnSteam)}</a>
        </div>
      </aside>
    </div>
  </main>`;
  const extraLd = [articleLd(page, lang), breadcrumbLd(page, lang)];
  const fq = faqLd(t.sections);
  if (fq) extraLd.push(fq);
  return renderFull(lang, t.metaTitle || t.title, t.metaDescription, extraLd, page.slug, body, heroImg || DATA.site.ogImage);
}
function gnameOf(lang){ return (DATA.game.nameI18n && DATA.game.nameI18n[lang]) || DATA.game.name; }

/* ---------- static pages ---------- */
function renderStatic(lang, slug, title, body){
  const prefix = lang === DEF ? "" : `/${lang}`;
  const s = siteI18n(lang);
  return renderFull(lang, title, title, [breadcrumbLd({slug,title}, lang)], slug, `<main class="container"><div class="article-wrap single"><article><div class="page-hero reveal"><span class="evidence-tag">${esc(s.plotTag)} // ${esc(slug.toUpperCase())}</span><h1>${esc(title)}</h1></div>${body}</article></div></main>`);
}
function genStatic(lang){
  const s = siteI18n(lang);
  const dir = path.join(OUT, lang === DEF ? "" : lang);
  const aboutPoints = (DATA.game.aboutPointsI18n && DATA.game.aboutPointsI18n[lang]) || DATA.game.aboutPoints || [];
  const aboutBody = `<p>${esc(s.aboutText)}</p><h2 style="font-size:1.05rem;margin:18px 0 8px">${esc(s.aboutSources)}</h2><ul class="checks">${aboutPoints.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`;
  fs.writeFileSync(path.join(dir,"about.html"), renderStatic(lang,"about", s.aboutTitle, aboutBody));
  const privacyBody = lang==="zh-CN"||lang==="zh-TW"
    ? `<p>这是游戏攻略网站，我们尊重访问者隐私。以下说明我们收集什么、如何使用。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">我们收集什么</h2><p>我们使用 Google Analytics（GA4）进行匿名流量统计：页面浏览、来源、设备类型和大致地区。我们不收集姓名、邮箱等个人身份信息，不出售数据。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Cookie</h2><p>Google Analytics 会使用 Cookie 进行会话统计。你可以在浏览器中禁用，或安装 Google Analytics 的停用插件。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">第三方服务</h2><p>字体来自 Google Fonts，站点由 Cloudflare CDN 提供服务；两者可能记录标准访问日志（IP、UA、时间）。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">联系我们</h2><p>隐私问题请邮件 <a href="mailto:contact@${esc(DATA.site.domain)}">contact@${esc(DATA.site.domain)}</a>。</p><p style="margin-top:14px;opacity:.75">生效日期：${today}</p>`
    : lang==="ko"
    ? `<p>이곳은 게임 공략 사이트이며 방문자의 개인정보를 존중합니다. 수집 항목과 사용 방식을 설명합니다.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">수집하는 정보</h2><p>Google Analytics(GA4)로 익명 트래픽 통계(페이지뷰, 유입 경로, 기기 유형, 대략적 지역)를 수집합니다. 이름, 이메일 등 개인 식별 정보는 수집하지 않으며 데이터를 판매하지 않습니다.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">쿠키</h2><p>Google Analytics는 세션 통계를 위해 쿠키를 사용합니다. 브라우저에서 비활성화하거나 Google Analytics 차단 부가기능을 사용할 수 있습니다.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">제3자 서비스</h2><p>글꼴은 Google Fonts에서, 사이트는 Cloudflare CDN으로 제공됩니다. 두 서비스 모두 표준 접속 로그(IP, UA, 시간)를 기록할 수 있습니다.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">문의</h2><p>개인정보 관련 질문은 <a href="mailto:contact@${esc(DATA.site.domain)}">contact@${esc(DATA.site.domain)}</a>로 보내주세요.</p><p style="margin-top:14px;opacity:.75">발효일: ${today}</p>`
    : lang==="es"
    ? `<p>Este es un sitio web de guías de juegos y respetamos la privacidad de los visitantes. Esto explica qué recopilamos y cómo se usa.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Qué recopilamos</h2><p>Usamos Google Analytics (GA4) para estadísticas de tráfico anónimas: visitas, referencias, tipos de dispositivo y regiones aproximadas. No recopilamos nombres, correos ni información personal identificable, y no vendemos datos.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Cookies</h2><p>Google Analytics usa cookies para estadísticas de sesión. Puedes desactivarlas en tu navegador o instalar el complemento de exclusión de Google Analytics.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Servicios de terceros</h2><p>Las fuentes se cargan desde Google Fonts y el sitio se sirve a través de Cloudflare CDN; ambos pueden registrar registros de acceso estándar (IP, agente de usuario, hora).</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Contacto</h2><p>Para preguntas de privacidad, escribe a <a href="mailto:contact@${esc(DATA.site.domain)}">contact@${esc(DATA.site.domain)}</a>.</p><p style="margin-top:14px;opacity:.75">Fecha de entrada en vigor: ${today}</p>`
    : lang==="ja"
    ? `<p>これはゲーム攻略サイトです。訪問者のプライバシーを尊重します。以下、収集内容と利用方法を説明します。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">収集する情報</h2><p>Google Analytics（GA4）で匿名のトラフィック統計（ページビュー、参照元、端末種別、おおよその地域）を取得しています。氏名・メールアドレスなどの個人情報は収集せず、データの販売も行いません。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Cookie</h2><p>Google Analytics はセッション統計のため Cookie を使用します。ブラウザで無効化するか、Google Analytics のオプトアウトアドオンを利用できます。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">第三者サービス</h2><p>Google Fonts からフォントを、Cloudflare の CDN を利用しています。標準的なアクセスログ（IP・UA・時刻）を記録する場合があります。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">お問い合わせ</h2><p>プライバシーに関する質問は <a href="mailto:contact@${esc(DATA.site.domain)}">contact@${esc(DATA.site.domain)}</a> まで。</p><p style="margin-top:14px;opacity:.75">発効日：${today}</p>`
    : `<p>This is a game guide website and we respect visitor privacy. This policy explains what we collect and how it is used.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">What we collect</h2><p>We use Google Analytics (GA4) for anonymous traffic statistics: page views, referrers, device types and approximate regions. We do not collect names, email addresses or any personally identifiable information, and we do not sell data.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Cookies</h2><p>Google Analytics sets cookies for session statistics. You can disable cookies in your browser or install the Google Analytics opt-out add-on.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Third-party services</h2><p>Fonts are loaded from Google Fonts and the site is served via Cloudflare's CDN; both may record standard access logs (IP, user agent, time). Those services follow their own privacy policies.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Contact</h2><p>For privacy questions, email <a href="mailto:contact@${esc(DATA.site.domain)}">contact@${esc(DATA.site.domain)}</a>.</p><p style="margin-top:14px;opacity:.75">Effective date: ${today}</p>`;
  fs.writeFileSync(path.join(dir,"privacy.html"), renderStatic(lang,"privacy", s.privacyTitle, privacyBody));
  const contactPh = lang==="zh-CN"||lang==="zh-TW" ? "联系我们："
    : lang==="ja" ? "お問い合わせ："
    : lang==="ko" ? "문의하기: "
    : lang==="es" ? "Contáctanos: "
    : "Reach us at:";
  const contactReply = lang==="zh-CN"||lang==="zh-TW" ? "我们通常会在 2-3 个工作日内回复。"
    : lang==="ja" ? "通常 2〜3 営業日以内に返信します。"
    : lang==="ko" ? "보통 2~3 영업일 내에 답변드립니다."
    : lang==="es" ? "Normalmente respondemos en 2-3 días laborables."
    : "We usually reply within 2-3 business days.";
  fs.writeFileSync(path.join(dir,"contact.html"), renderStatic(lang,"contact", s.contactTitle, `<p>${contactPh} <a href="mailto:contact@${esc(DATA.site.domain)}">contact@${esc(DATA.site.domain)}</a></p><p style="margin-top:10px">${contactReply}</p>`));
}
// 404 (default lang) — function so OUT exists when called
function gen404(){
  const s404 = siteI18n(DEF);
  const pop404 = DATA.pages.filter(p=>["how-to-play","fishing","automation","faq"].includes(p.slug)).map(p=>`<a href="/${p.slug}" style="display:inline-block;margin:6px;padding:9px 16px;border:1px solid var(--border);border-radius:10px;color:var(--muted);text-decoration:none">${esc(p.title)}</a>`).join("");
  fs.writeFileSync(path.join(OUT,"404.html"), `<!DOCTYPE html><html lang="${LANG_META[DEF].html}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>404 - ${esc(s404.name)}</title><meta name="robots" content="noindex" /><link rel="stylesheet" href="/css/style.css?v=${CSS_V}"></head><body>${header(DEF,"")}<main class="container" style="padding-top:70px;text-align:center"><section class="card grow-card" style="max-width:560px;margin:0 auto"><h1 style="font-size:3rem">404</h1><p>This page doesn't exist. Try one of these guides instead:</p><div style="margin:18px 0">${pop404}</div><p><a class="btn btn-primary" href="/">← Back to Home</a></p></section></main>${footer(DEF)}</body></html>`);
}

/* ---------- JSON-LD ---------- */
const siteLd = lang => ({"@context":"https://schema.org","@type":"WebSite",name:siteI18n(lang).name,url:urlOf("index",lang),description:siteI18n(lang).description});
function isoDate(str){
  const m=/([A-Za-z]+) (\d+), (\d+)/.exec(str||"")||[];
  const mo={Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12,January:1,February:2,March:3,April:4,May:5,June:6,July:7,August:8,September:9,October:10,November:11,December:12};
  return m[3] ? `${m[3]}-${String(mo[m[1]]||0).padStart(2,"0")}-${String(m[2]).padStart(2,"0")}` : today;
}
function gameLd(){
  return {"@context":"https://schema.org","@type":"VideoGame",name:DATA.game.name,description:DATA.game.intro,url:DATA.game.steamUrl,applicationCategory:"Game",operatingSystem:"Windows",genre:DATA.game.genre,datePublished:isoDate(DATA.game.releaseDate),inLanguage:"en",offers:{"@type":"Offer",price:DATA.game.price,priceCurrency:"CNY",availability:"https://schema.org/InStock"}};
}
function articleLd(page, lang){
  const t = pageOf(page, lang);
  return {"@context":"https://schema.org","@type":"Article",headline:t.title,description:t.metaDescription,mainEntityOfPage:urlOf(page.slug,lang),datePublished:isoDate(DATA.game.releaseDate),dateModified:today,inLanguage:LANG_META[lang]?.html||lang,publisher:{"@type":"Organization",name:siteI18n(lang).name}};
}
function faqLd(sections){
  const items = (sections||[]).filter(s=>s.type==="faq").flatMap(s=>s.items||[]);
  if (!items.length) return null;
  return {"@context":"https://schema.org","@type":"FAQPage",mainEntity:items.map(([q,a])=>({"@type":"Question",name:q,acceptedAnswer:{"@type":"Answer",text:a}}))};
}
function breadcrumbLd(page, lang){
  return {"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:siteI18n(lang).navHome,item:`https://${DATA.site.domain}/${lang===DEF?"":lang+"/"}`},{"@type":"ListItem",position:2,name:page.title,item:urlOf(page.slug,lang)}]};
}

/* ---------- build ---------- */
fs.rmSync(OUT, {recursive:true, force:true});
fs.mkdirSync(OUT, {recursive:true});
// assets copy
for (const f of ["favicon.svg","favicon-16x16.png","favicon-32x32.png","apple-touch-icon.png"]) {
  const src = path.join(ROOT,"assets","favicon",f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT,f));
}
const imgDir = path.join(ROOT,"assets","images");
if (fs.existsSync(imgDir)) {
  fs.mkdirSync(path.join(OUT,"images"),{recursive:true});
  for (const f of fs.readdirSync(imgDir)) {
    if (/\.(jpg|jpeg|webp)$/i.test(f)) fs.copyFileSync(path.join(imgDir,f), path.join(OUT,"images",f));
  }
}
fs.mkdirSync(path.join(OUT,"css"),{recursive:true});
fs.writeFileSync(path.join(OUT,"css","style.css"), fs.readFileSync(path.join(ROOT,"templates","style.css"),"utf8"));

// index + pages per language
for (const lang of LANGS) {
  const dir = path.join(OUT, lang === DEF ? "" : lang);
  fs.mkdirSync(dir, {recursive:true});
  fs.writeFileSync(path.join(dir,"index.html"), renderHome(lang));
  for (const page of DATA.pages) {
    SEC_IDX = 0;
    const html = renderPage(lang, page);
    fs.writeFileSync(path.join(dir, page.slug + ".html"), html);
  }
  genStatic(lang);
}
gen404();

// sitemap
const urls = [];
for (const lang of LANGS) {
  urls.push(urlOf("index",lang));
  for (const p of DATA.pages) urls.push(urlOf(p.slug,lang));
  for (const sp of ["about","privacy","contact"]) urls.push(urlOf(sp,lang));
}
fs.writeFileSync(path.join(OUT,"sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u=>`  <url><loc>${u}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>${u.endsWith("/")?"1.0":"0.8"}</priority></url>`).join("\n")}\n</urlset>\n`);
fs.writeFileSync(path.join(OUT,"robots.txt"), `User-agent: *\nAllow: /\nSitemap: https://${DATA.site.domain}/sitemap.xml\n`);
fs.writeFileSync(path.join(OUT,"ads.txt"), DATA.site.adsenseId ? `google.com, ${DATA.site.adsenseId}, DIRECT, f08c47fec0942fa0\n` : "");
console.log(`✓ Generated ${LANGS.length} locales x ${1+DATA.pages.length+4} pages + sitemap (${today})`);
