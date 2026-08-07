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
const KIT = require("./lib/site-kit");   // 共用基建：URL/图片/sitemap/lastmod
// 联盟链接：site.json 的 affiliates 没配 ID 时原样输出原链接，配了才加追踪参数 + rel="sponsored"
const AFF = KIT.createAffiliate(DATA.site.affiliates);
const esc = KIT.esc;
const clean = KIT.clean;
const LANGS = DATA.site.languages || ["en"];
const DEF = DATA.site.defaultLanguage || "en";
const CSS_V = crypto.createHash("md5").update(fs.readFileSync(path.join(ROOT,"templates","style.css"),"utf8")).digest("hex").slice(0,8);
const today = new Date().toISOString().slice(0,10);
const urlOf = KIT.createUrl({ domain: DATA.site.domain, defaultLang: DEF });
const LM = KIT.createLastmod({ manifestPath: path.join(ROOT,"data",".lastmod.json"), today });
const HERO_SET = "/images/hero-640.jpg 640w, /images/hero-1280.jpg 1280w, /images/hero.jpg 1600w";
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

/* ---------- 鱼类筛选器文案（6 语） ----------
 * 术语全部沿用 data 层已有译法（水核心/竹竿/钓点…），不另造词。
 * 地点分组（池塘/码头海域/浅滩/洞穴）是对已有钓点字段的归类，不是新事实。
 */
const FISH_UI = {
  "en":    { title:"What can I catch right now?", lead:"Filter the 33 confirmed fish by season, spot and unlock. Every row below stays on the page — this only narrows what you see.",
             search:"Search fish name", period:"Season", loc:"Spot", req:"Unlock needed", reset:"Reset",
             all:"All", allyear:"All year", rainy:"Rainy (Jan–Feb)", dry:"Dry (Mar–Apr)", single:"Single month", breed:"Breeding only",
             pond:"Ponds", sea:"Docks & sea", shallow:"Shallows", cave:"Caves",
             none:"Nothing needed", watercore:"Water Core", bamboo:"Bamboo rod", rockcore:"Rock Core Sample",
             count:"Showing {n} of {t} fish", noMatch:"No fish match these filters." },
  "zh-CN": { title:"现在能钓到什么？", lead:"按季节、钓点和解锁条件筛选 33 种已确认鱼类。下方所有行都仍在页面上，筛选只是收窄显示范围。",
             search:"搜索鱼名", period:"季节", loc:"钓点", req:"需要解锁", reset:"重置",
             all:"全部", allyear:"全年", rainy:"雨季（1–2 月）", dry:"旱季（3–4 月）", single:"单月限定", breed:"仅可繁殖",
             pond:"池塘", sea:"码头与海域", shallow:"浅滩", cave:"洞穴",
             none:"无需解锁", watercore:"水核心", bamboo:"竹竿", rockcore:"岩石核心样本",
             count:"显示 {n} / {t} 种", noMatch:"没有符合条件的鱼。" },
  "zh-TW": { title:"現在能釣到什麼？", lead:"按季節、釣點和解鎖條件篩選 33 種已確認魚類。下方所有行都仍在頁面上，篩選只是收窄顯示範圍。",
             search:"搜尋魚名", period:"季節", loc:"釣點", req:"需要解鎖", reset:"重設",
             all:"全部", allyear:"全年", rainy:"雨季（1–2 月）", dry:"旱季（3–4 月）", single:"單月限定", breed:"僅可繁殖",
             pond:"池塘", sea:"碼頭與海域", shallow:"淺灘", cave:"洞穴",
             none:"無需解鎖", watercore:"水核心", bamboo:"竹竿", rockcore:"岩石核心樣本",
             count:"顯示 {n} / {t} 種", noMatch:"沒有符合條件的魚。" },
  "ja":    { title:"今どの魚が釣れる？", lead:"確認済み 33 種を季節・釣り場・解放条件で絞り込み。下の行はすべてページに残ります——表示範囲を狭めるだけです。",
             search:"魚名で検索", period:"季節", loc:"釣り場", req:"必要な解放", reset:"リセット",
             all:"すべて", allyear:"周年", rainy:"雨季（1〜2月）", dry:"乾季（3〜4月）", single:"単月限定", breed:"繁殖限定",
             pond:"池", sea:"桟橋・海", shallow:"浅瀬", cave:"洞窟",
             none:"解放不要", watercore:"ウォーターコア", bamboo:"竹の竿", rockcore:"ロックコアサンプル",
             count:"{t} 種中 {n} 種を表示", noMatch:"条件に合う魚がありません。" },
  "ko":    { title:"지금 어떤 물고기를 잡을 수 있나요?", lead:"확인된 33종을 계절·낚시터·해금 조건으로 필터링합니다. 아래 모든 행은 페이지에 그대로 남아 있으며, 표시 범위만 좁힙니다.",
             search:"물고기 이름 검색", period:"계절", loc:"낚시터", req:"필요한 해금", reset:"초기화",
             all:"전체", allyear:"연중", rainy:"우기 (1–2월)", dry:"건기 (3–4월)", single:"단일 월 한정", breed:"번식 전용",
             pond:"연못", sea:"부두·바다", shallow:"얕은 물", cave:"동굴",
             none:"해금 불필요", watercore:"물 코어", bamboo:"대나무 낚싯대", rockcore:"암석 코어 샘플",
             count:"{t}종 중 {n}종 표시", noMatch:"조건에 맞는 물고기가 없습니다." },
  "es":    { title:"¿Qué puedo pescar ahora?", lead:"Filtra los 33 peces confirmados por estación, lugar y desbloqueo. Todas las filas siguen en la página: esto solo acota lo que ves.",
             search:"Buscar nombre de pez", period:"Estación", loc:"Lugar", req:"Desbloqueo necesario", reset:"Restablecer",
             all:"Todos", allyear:"Todo el año", rainy:"Lluviosa (ene–feb)", dry:"Seca (mar–abr)", single:"Un solo mes", breed:"Solo cría",
             pond:"Estanques", sea:"Muelles y mar", shallow:"Aguas someras", cave:"Cuevas",
             none:"Sin requisitos", watercore:"Núcleo de agua", bamboo:"Caña de bambú", rockcore:"Muestra de núcleo rocoso",
             count:"Mostrando {n} de {t} peces", noMatch:"Ningún pez coincide con estos filtros." },
};
const fishUi = lang => FISH_UI[lang] || FISH_UI.en;

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
  "where-to-buy": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"/></svg>',
  "how-long-to-beat": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
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
  // Awin 联盟所有权验证：官方要求是「源代码里出现 Awin 字样」，没有规定 meta 名称，这里用描述性名字。
  // 值可以是任意字符串（拿到正式验证码就换成那个）；未配置时不输出。
  const awin = DATA.site.awinVerification ? `<meta name="awin-site-verification" content="${esc(DATA.site.awinVerification)}" />` : "";
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
${gsc}${awin}
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
<link rel="stylesheet" href="/css/style.css?v=${CSS_V}" />${slug === "index" ? "\n" + KIT.heroPreload({ srcset: HERO_SET, sizes: "100vw" }) : ""}
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
  const P0 = ["how-to-play","where-to-buy","farming","automation","gene-system","fishing","drone-combat","exploration","friendship","weather"];
  const P1 = ["cooking","ranching","characters","story"];
  const P2 = ["achievements","how-long-to-beat","mods","update-log","faq","system-requirements","steam-deck"];
  const drop = (title, slugs) => `<div class="dd-group"><b class="dd-title">${esc(title)}</b>${slugs.map(slug=>{
    const p=DATA.pages.find(x=>x.slug===slug); if(!p) return "";
    const m=metaOf(slug);
    return `<a href="${prefix}/${slug}" class="${slug===active?"active":""}"><span class="nav-ic">${SVG[m.icon]}</span><span>${esc(pageOf(p,lang).title)}</span></a>`;
  }).join("")}</div>`;
  const guides = `<div class="dd-menu dd-manual">${drop(lang==="en"?"Core guides":lang==="ja"?"コア攻略":lang==="ko"?"핵심 가이드":lang==="es"?"Guías principales":"核心攻略", P0)}${drop(lang==="en"?"Deep dives":lang==="ja"?"深掘り":lang==="ko"?"심층 가이드":lang==="es"?"A fondo":"深度拆解", P1)}${drop(lang==="en"?"Quick answers":lang==="ja"?"クイック回答":lang==="ko"?"빠른 답변":lang==="es"?"Respuestas rápidas":"快速答案", P2)}</div>`;
  const searchPh = lang==="en"?"Search guides…":lang==="ja"?"ガイドを検索…":lang==="ko"?"공략 검색…":lang==="es"?"Buscar guías…":"搜索攻略…";
  const searchLabel = lang==="en"?"Search guides":lang==="ja"?"ガイドを検索":lang==="ko"?"공략 검색":lang==="es"?"Buscar guías":"搜索攻略";
  return `<header class="site-header">
  <div class="container header-inner">
    <a class="logo" href="${prefix}/"><span class="logo-badge">${SVG.logo}</span><span class="logo-txt">${esc(s.name)}</span></a>
    <nav class="nav" aria-label="Main">
      <a href="${prefix}/" class="${active===""?"active":""}">${esc(s.navHome)}</a>
      <details class="dd">
        <summary>${esc(s.navGuides)} <span class="caret">▾</span></summary>
        ${guides}
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

  /* ---- 鱼类筛选器（渐进增强：JS 没跑 = 页面完全等同于改动前）---- */
  var ff = document.querySelector('.ff');
  var rows = Array.prototype.slice.call(document.querySelectorAll('.harvest-table.filterable tbody tr'));
  if (ff && rows.length) {
    ff.removeAttribute('hidden');
    var state = { period:'all', loc:'all', req:'all', q:'' };
    var countEl = ff.querySelector('.ff-count');
    var tpl = countEl ? countEl.getAttribute('data-tpl') : '';

    function matches(tr){
      if (state.period !== 'all' && tr.getAttribute('data-period') !== state.period) return false;
      // loc/req 是空格分隔的多值
      if (state.loc !== 'all' && (' '+(tr.getAttribute('data-loc')||'')+' ').indexOf(' '+state.loc+' ') < 0) return false;
      if (state.req !== 'all' && (' '+(tr.getAttribute('data-req')||'')+' ').indexOf(' '+state.req+' ') < 0) return false;
      if (state.q && (tr.cells[0].textContent||'').toLowerCase().indexOf(state.q) < 0) return false;
      return true;
    }
    function apply(){
      var shown = 0;
      rows.forEach(function(tr){
        var ok = matches(tr);
        tr.hidden = !ok;
        if (ok) shown++;
      });
      // 整张表都被筛没了就收起该表、显示空态
      document.querySelectorAll('.harvest-table.filterable').forEach(function(box){
        var any = Array.prototype.slice.call(box.querySelectorAll('tbody tr')).some(function(tr){ return !tr.hidden; });
        var tbl = box.querySelector('table'), empty = box.querySelector('.table-empty');
        if (tbl) tbl.hidden = !any;
        if (empty) empty.hidden = any;
      });
      if (countEl) countEl.textContent = tpl.replace('{n}', shown).replace('{t}', rows.length);
    }
    ff.addEventListener('click', function(e){
      var chip = e.target.closest('.ff-chip');
      if (chip) {
        var g = chip.closest('.ff-group');
        g.querySelectorAll('.ff-chip').forEach(function(c){ c.classList.toggle('on', c === chip); });
        state[g.getAttribute('data-key')] = chip.getAttribute('data-v');
        apply(); return;
      }
      if (e.target.closest('.ff-reset')) {
        state = { period:'all', loc:'all', req:'all', q:'' };
        ff.querySelectorAll('.ff-group').forEach(function(g){
          g.querySelectorAll('.ff-chip').forEach(function(c,i){ c.classList.toggle('on', i === 0); });
        });
        var inp = ff.querySelector('.ff-input'); if (inp) inp.value = '';
        apply();
      }
    });
    var input = ff.querySelector('.ff-input');
    if (input) input.addEventListener('input', function(){ state.q = this.value.trim().toLowerCase(); apply(); });
    apply();
  }
});
</script>
</footer>`;
}

/* ---------- section renderer (Farmstead Manual components — 田园农具语言, 全局独立) ---------- */
let SEC_IDX = 0;
function secId(){ SEC_IDX += 1; return "sec-" + SEC_IDX; }
function renderSection(s, lang){
  const id = secId();
  const st = siteI18n(lang);
  const tag = esc(s.tag || st.seedTag);
  switch(s.type){
    case "steps": {
      // 生长步骤：纵向生长线（种子→嫩芽→开花→结果），每步一块田垄
      const items = (s.items||[]).map((it,i)=>{
        const phase = ["seed","sprout","grow","fruit","harvest"][i%5];
        return `<li class="furrow-item">
          <span class="furrow-phase furrow-${phase}" aria-hidden="true"><span class="furrow-dot"></span></span>
          <div class="furrow-body"><b>${esc(it[0])}</b>${it[1]?`<p>${esc(it[1])}</p>`:""}</div>
        </li>`;
      }).join("");
      return `<section class="furrow-block reveal" id="${id}"><div class="furrow-head"><span class="furrow-tag">${tag}</span><h2>${esc(s.heading)}</h2></div>${s.body?`<p class="furrow-lead">${esc(s.body)}</p>`:""}<ol class="furrows">${items}</ol></section>`;
    }
    case "list": {
      // 种子清单：每项一块「秧苗牌」
      const items = (s.items||[]).map(it=>`<li class="seed-item"><span class="seed-mark" aria-hidden="true">${SVG.sprout}</span><p>${esc(it)}</p></li>`).join("");
      return `<section class="furrow-block reveal" id="${id}"><div class="furrow-head"><span class="furrow-tag">${tag}</span><h2>${esc(s.heading)}</h2></div>${s.body?`<p class="furrow-lead">${esc(s.body)}</p>`:""}<ul class="seed-list">${items}</ul></section>`;
    }
    case "fishfilter": {
      // 鱼类筛选器（Doloc 专属组件）——「农事记录板」形态：木牌标签 + 田垄分隔
      // ⚠️ 渐进增强：默认 hidden，只有 JS 跑起来才显示。没有 JS 时页面完全等同于改动前。
      const u = fishUi(lang);
      const group = (key, opts) => `<div class="ff-group" data-key="${key}">
        <span class="ff-label">${esc(u[key])}</span>
        <div class="ff-chips">${opts.map((o,i)=>
          `<button type="button" class="ff-chip${i===0?" on":""}" data-v="${o}">${esc(u[o])}</button>`
        ).join("")}</div>
      </div>`;
      return `<section class="ff reveal" id="${id}" hidden>
        <div class="ff-head"><span class="furrow-tag">${esc(st.seasonTag)}</span><h2>${esc(u.title)}</h2></div>
        <p class="ff-lead">${esc(u.lead)}</p>
        <div class="ff-search"><span class="ff-search-ic" aria-hidden="true">${SVG.fishing || ""}</span>
          <input type="search" class="ff-input" placeholder="${esc(u.search)}" aria-label="${esc(u.search)}" />
        </div>
        ${group("period", ["all","allyear","rainy","dry","single","breed"])}
        ${group("loc",    ["all","pond","sea","shallow","cave"])}
        ${group("req",    ["all","none","watercore","bamboo","rockcore"])}
        <div class="ff-foot"><span class="ff-count" data-tpl="${esc(u.count)}"></span>
          <button type="button" class="ff-reset">${esc(u.reset)}</button></div>
      </section>`;
    }
    case "table": {
      // 季节表：表头季节色，行 hover 生长感
      // rowAttrs（目前只有 fishing 有）：把语义标签挂到 <tr> 上供筛选器用。
      // ⚠️ 表格本身完全不变——SEO 与 AI 抓取读到的仍是完整 33 行，筛选纯属渐进增强。
      const headRow = (s.columns||[]).map(c=>`<th>${esc(c)}</th>`).join("");
      const attrsOf = i => {
        const a = (s.rowAttrs||[])[i];
        if (!a) return "";
        return " " + Object.entries(a).map(([k,v])=>`data-${k}="${esc(v)}"`).join(" ");
      };
      const rows = (s.rows||[]).map((r,i)=>`<tr${attrsOf(i)}>${r.map(c=>`<td>${esc(c)}</td>`).join("")}</tr>`).join("");
      const cls = s.rowAttrs ? "harvest-table filterable" : "harvest-table";
      return `<section class="furrow-block reveal" id="${id}"><div class="furrow-head"><span class="furrow-tag">${tag}</span><h2>${esc(s.heading)}</h2></div>${s.body?`<p class="furrow-lead">${esc(s.body)}</p>`:""}<div class="${cls}"><table><thead><tr>${headRow}</tr></thead><tbody>${rows}</tbody></table><p class="table-empty" hidden>${esc(fishUi(lang).noMatch)}</p></div></section>`;
    }
    case "faq": {
      // 收获问答：手风琴带叶片标记
      const items = (s.items||[]).map(([q,a])=>`<details class="harvest-faq"><summary><span class="harvest-leaf" aria-hidden="true">${SVG.sprout}</span><span>${esc(q)}</span><span class="pm">+</span></summary><div class="harvest-a">${esc(a)}</div></details>`).join("");
      return `<section class="furrow-block reveal" id="${id}"><div class="furrow-head"><span class="furrow-tag">${tag}</span><h2>${esc(s.heading)}</h2></div>${items}</section>`;
    }
    case "evidence": {
      // 田野笔记：手写笔记卡
      const items = (s.items||[]).map(([label,txt])=>`<div class="field-note"><span class="field-label">${esc(label)}</span><p>${esc(txt)}</p></div>`).join("");
      return `<section class="furrow-block reveal" id="${id}"><div class="furrow-head"><span class="furrow-tag">${tag}</span><h2>${esc(s.heading)}</h2></div>${s.body?`<p class="furrow-lead">${esc(s.body)}</p>`:""}<div class="field-notes">${items}</div></section>`;
    }
    case "timeline": {
      // 季节时间线：横向四季
      const items = (s.items||[]).map(([t,txt])=>`<li class="season-tl"><span class="season-tl-time">${esc(t)}</span><p>${esc(txt)}</p></li>`).join("");
      return `<section class="furrow-block reveal" id="${id}"><div class="furrow-head"><span class="furrow-tag">${tag}</span><h2>${esc(s.heading)}</h2></div>${s.body?`<p class="furrow-lead">${esc(s.body)}</p>`:""}<ul class="season-timeline">${items}</ul></section>`;
    }
    case "note": {
      // 农舍便签：黄纸便签+图钉
      return `<section class="furrow-block reveal barn-note" id="${id}"><div class="barn-pin" aria-hidden="true"></div><div class="furrow-head"><span class="furrow-tag">${tag}</span><h2>${esc(s.heading)}</h2></div>${s.body?`<p class="furrow-lead">${esc(s.body)}</p>`:""}</section>`;
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
  const _faqSec = (pageOf(DATA.pages.find(p=>p.slug==="faq"), lang).sections||[]).find(x=>x.type==="faq");
  const faqItems = _faqSec?.items || [];
  const faqHtml = faqItems.map(([q,a])=>`<details class="faq"><summary>${esc(q)}<span class="pm">+</span></summary><div class="faq-a">${esc(a)}</div></details>`).join("");
  const keyFactsArr = (DATA.game.keyFactsI18n && DATA.game.keyFactsI18n[lang]) || DATA.game.keyFacts || [];
  const keyFacts = keyFactsArr.map(f=>`<li>${esc(f)}</li>`).join("");
  const keyFactsFirst3 = keyFactsArr.slice(0,3).map(f=>`<div class="plot-note-card"><span class="plot-note-ic">${SVG.sprout}</span><p>${esc(f)}</p></div>`).join("");
  // ---- 四季数据：每个季节有主题色 / 农事历 / 推荐攻略 ----
  const L = (en, zh, ja, ko, es) => lang==="zh-CN"||lang==="zh-TW" ? zh : lang==="ja" ? ja : lang==="ko" ? ko : lang==="es" ? es : en;
  const SEASONS = [
    {key:"spring", name:L("Spring","春","春","봄","Primavera"), emoji:"🌱",
     accent:"#7FB069", soft:"#A8D08D",
     tip:L("Sow fast crops and prep soil.","播种速生作物、翻整土地。","速成作物を蒔き、土を整える。","속성 작물을 심고 흙을 정비하세요.","Siembra cultivos rápidos y prepara el suelo."),
     tasks:[L("Plant herbs — 2-day filler crops","种香草——2 天速生填充作物","ハーブを植える——2日で育つフィラー作物","허브 심기——2일 속성 필러 작물","Planta hierbas: cultivos de relleno de 2 días"),
            L("Clear new plots for the season","为季节清理新地块","季節の新しい区画を整地","계절용 새 구획 정리","Limpia nuevas parcelas para la temporada"),
            L("Save seed mother plants early","尽早保存种子母本","種子母体を早めに確保","종자 모본을 일찍 확보","Guarda plantas madre pronto")],
     guides:["how-to-play","farming","gene-system"]},
    {key:"summer", name:L("Summer","夏","夏","여름","Verano"), emoji:"☀️",
     accent:"#D97706", soft:"#F0B457",
     tip:L("Storms charge power — build lightning capture.","雷暴可蓄电——建闪电收集。","嵐で充電——落雷キャプチャを建てる。","폭풍이 충전——번개 포집을 지으세요.","Las tormentas cargan: construye captura de rayos."),
     tasks:[L("Let torrential rain irrigate for free","让暴雨免费灌溉","豪雨に無料灌漑を任せる","폭우로 무료 관개","Deja que la lluvia torrencial riegue gratis"),
            L("Upgrade drone battery before storms","雷暴前升级无人机电池","嵐の前にドローンのバッテリー強化","폭풍 전 드론 배터리 강화","Mejora la batería del dron antes de las tormentas"),
            L("Fish through weather for rare catches","趁天气钓鱼拿稀有渔获","天候を狙ってレア魚","날씨를 노려 희귀어","Pesca con clima para capturas raras")],
     guides:["weather","drone-combat","fishing"]},
    {key:"autumn", name:L("Autumn","秋","秋","가을","Otoño"), emoji:"🍂",
     accent:"#9A6A4F", soft:"#C29A7D",
     tip:L("Harvest, cook, and attend the Mushroom Fest.","收获、烹饪、参加蘑菇节。","収穫、料理、キノコ祭りへ。","수확, 요리, 버섯 축제 참여.","Cosecha, cocina y acude al Festival de las Setas."),
     tasks:[L("Collect autumn mushroom forage","收集秋季蘑菇","秋のキノコ採取","가을 버섯 채집","Recoge setas de otoño"),
            L("Cook buff meals before big explorations","探索前做增益餐","探索前にバフ料理","탐험 전 버프 요리","Cocina buffs antes de explorar"),
            L("Raise friendship at the festival","在节日提升好感","祭りで友好度アップ","축제에서 우정 올리기","Sube amistad en el festival")],
     guides:["cooking","friendship","exploration"]},
    {key:"winter", name:L("Winter","冬","冬","겨울","Invierno"), emoji:"❄️",
     accent:"#5C8AC9", soft:"#9DB8E0",
     tip:L("Drought hits in Month 4 — stockpile and sell high.","4 月旱季来袭——囤货高价卖。","4月の乾季——備蓄して高値で売る。","4월 가뭄——비축 후 고가 판매.","La sequía llega en el mes 4: acumula y vende caro."),
     tasks:[L("Stockpile before Month 4 prices spike","4 月前囤货应对涨价","4月の値上がり前に備蓄","4월 가격 급등 전 비축","Acumula antes de la subida del mes 4"),
            L("Push the 1.0 story through Old City Ruins","推进 1.0 旧城废墟剧情","旧市街遺跡のストーリーを進める","구시가지 유적 스토리 진행","Avanza la historia 1.0 en las Ruinas"),
            L("Use automated stations for indoor growing","用自动站做室内种植","自動基地で屋内栽培","자동 기지로 실내 재배","Usa estaciones para cultivar en interior")],
     guides:["story","automation","achievements"]},
  ];
  // 季节 tab（含主题色变量名，供 JS 切换）
  const seasonTabs = SEASONS.map((se,i)=>`<button class="season-tab" data-season="${se.key}" data-accent="${se.accent}" data-soft="${se.soft}" ${i===0?'aria-pressed="true"':''}><span class="season-emoji" aria-hidden="true">${se.emoji}</span>${esc(se.name)}</button>`).join("");
  // 每季节：农事历卡片（含任务 + 推荐攻略链接）
  const seasonPanel = (se, i) => {
    const gs = se.guides.map(slug=>{
      const p=DATA.pages.find(x=>x.slug===slug); if(!p) return "";
      const t=Object.assign(pageOf(p,lang),{slug});
      return `<a class="season-guide" href="${prefix}/${slug}"><span class="nav-ic">${SVG[metaOf(slug).icon]}</span><span>${esc(t.title)}</span></a>`;
    }).join("");
    const tasks = se.tasks.map(t=>`<li class="season-task"><span class="task-dot" style="background:${se.accent}"></span><p>${esc(t)}</p></li>`).join("");
    return `<div class="season-panel" data-panel="${se.key}" ${i===0?'data-active="1"':''}>
      <div class="season-panel-head"><span class="season-emoji-lg" aria-hidden="true">${se.emoji}</span><div><h3>${esc(se.name)} ${L("Farm Calendar","农事历","農事暦","농사 달력","Calendario de granja")}</h3><p class="season-tip" style="color:${se.accent}">${esc(se.tip)}</p></div></div>
      <ul class="season-tasks">${tasks}</ul>
      <div class="season-guides"><b>${esc(L("This season's guides","本季攻略","今シーズンの攻略","이번 시즌 가이드","Guías de esta temporada"))}</b>${gs}</div>
    </div>`;
  };
  const seasonPanels = SEASONS.map((se,i)=>seasonPanel(se,i)).join("");
  // ---- 攻略区：按季节分组的「田垄」（非方块网格）----
  const farmPlot = (slug) => {
    const p=DATA.pages.find(x=>x.slug===slug); if(!p) return "";
    const m=metaOf(slug); const t=Object.assign(pageOf(p,lang),{slug});
    return `<a class="farm-plot" href="${prefix}/${slug}" style="--plot-acc:${t.seasonAccent||"var(--sprout)"}">
      <span class="plot-rail"></span>
      <span class="plot-ic">${SVG[m.icon]}</span>
      <span class="plot-tx"><b>${esc(t.title)}</b><span>${esc(t.metaDescription)}</span></span>
      <span class="plot-go">${esc(s.readGuide)}</span>
    </a>`;
  };
  // 地块按「农场分区」：种下去 → 自动化 → 战斗探索 → 收获生活
  const BEDS = [
    {label:L("Plant & Grow","种植与生长","植えて育てる","심고 기르기","Plantar y crecer"), emoji:"🌱", slugs:["how-to-play","farming","gene-system","weather"]},
    {label:L("Automate & Power","自动化与能源","自動化とエネルギー","자동화와 에너지","Automatizar y energía"), emoji:"⚙️", slugs:["automation","fishing","drone-combat"]},
    {label:L("Explore & Fight","探索与战斗","探索と戦闘","탐험과 전투","Explorar y luchar"), emoji:"🗺️", slugs:["exploration","story","characters"]},
    {label:L("Harvest & Live","收获与生活","収穫と生活","수확과 생활","Cosechar y vivir"), emoji:"🍲", slugs:["cooking","ranching","friendship","achievements","mods","update-log","faq","system-requirements","steam-deck"]},
  ];
  const bedHtml = BEDS.map((bed,bi)=>{
    const plots = bed.slugs.map(slug=>farmPlot(slug)).join("");
    return `<div class="farm-bed reveal">
      <div class="bed-head"><span class="bed-emoji" aria-hidden="true">${bed.emoji}</span><h3>${esc(bed.label)}</h3><span class="bed-count">${bed.slugs.length}</span></div>
      <div class="bed-plots">${plots}</div>
    </div>`;
  }).join("");
  const badgeTxt = lang==="en" ? "Post-apocalyptic farming sim — 1.0 full release guides"
    : lang==="ja" ? "終末世界の農場シム — 1.0 完全版攻略"
    : lang==="ko" ? "포스트 아포칼립스 농장 시뮬 — 1.0 공략"
    : lang==="es" ? "Simulador de granja post-apocalíptico — guías 1.0"
    : "后末日农场模拟 — 1.0 完整攻略";
  const body = `
  <main>
    <section class="pano-hero">
      ${KIT.picture({ src:"/images/hero-1280.jpg", srcset:HERO_SET, sizes:"100vw", attrs:`class="pano-bg" alt="${esc(gname)} key art" loading="eager" width="1600" height="900" fetchpriority="high"` })}
      <div class="pano-overlay"></div>
      <div class="container pano-copy">
        <span class="evidence-tag"><span class="dot"></span> ${esc(badgeTxt)}</span>
        <h1>${esc(gname)} <span class="stamp-hl">${esc(s.harvest)}</span></h1>
        <p class="lead">${esc(s.tagline)}.</p>
        <div class="stats pano-stats">${stats}</div>
        <div class="cta-row">
          <a class="btn btn-primary" href="${esc(DATA.game.steamUrl)}" target="_blank" rel="noopener">${esc(s.startPlaying)}</a>
          <a class="btn btn-ghost" href="${prefix}/how-to-play">${esc(s.readGuide)}</a>
        </div>
      </div>
    </section>
    <section class="container">
      <div class="season-box reveal">
        <div class="season-tabs">${seasonTabs}</div>
        <div class="season-panels">${seasonPanels}</div>
      </div>
    </section>
    <section class="container section">
      <div class="sec-head reveal"><span class="mono">${esc(s.plotTag)} // FARM</span><h2>${esc(L("The Farmstead Guides","农场攻略图","農場攻略図","농장 가이드 지도","Guías de la granja"))}</h2></div>
      <div class="farm-beds">${bedHtml}</div>
    </section>
    <section class="container section split">
      <div class="card grow-card reveal">
        <h2><span class="sec-tag">${esc(s.aboutGame)}</span></h2>
        <p class="sec-body">${esc(gintro)}</p>
        <div class="plot-notes">${keyFactsFirst3}</div>
      </div>
      <div class="card grow-card reveal">
        <h2><span class="sec-tag">${esc(s.quickAnswers)}</span></h2>
        ${faqHtml}
      </div>
    </section>
  </main>
  <script>
  document.addEventListener('DOMContentLoaded', function(){
    var root = document.documentElement;
    var tabs = document.querySelectorAll('.season-tab');
    var panels = document.querySelectorAll('.season-panel');
    tabs.forEach(function(t){
      t.addEventListener('click', function(){
        tabs.forEach(function(x){ x.setAttribute('aria-pressed','false'); x.classList.remove('on'); });
        t.setAttribute('aria-pressed','true'); t.classList.add('on');
        // 切主题色
        root.style.setProperty('--season-acc', t.dataset.accent);
        root.style.setProperty('--season-soft', t.dataset.soft);
        // 切农事历面板
        panels.forEach(function(p){ if(p.dataset.panel===t.dataset.season){ p.setAttribute('data-active','1'); } else { p.removeAttribute('data-active'); } });
      });
    });
  });
  </script>`;
  return renderFull(lang, siteI18n(lang).name, s.description, [], "index", body, "/images/hero.jpg");
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
  const toc = (t.sections||[]).filter(x=>x.heading).map((x,i)=>{
    SEC_IDX += 1;
    return `<a href="#sec-${SEC_IDX}"><span class="toc-no">${String(SEC_IDX).padStart(2,"0")}</span>${esc(x.heading)}</a>`;
  }).join("");
  SEC_IDX = 0;
  const sections2 = (t.sections||[]).map(x => renderSection(x, lang)).join("");
  const related = DATA.pages.filter(p=>p.slug!==page.slug).slice(0,6).map(p=>{
    const m = metaOf(p.slug);
    return `<a href="${prefix}/${p.slug}"><span class="nav-ic">${SVG[m.icon]}</span><span>${esc(pageOf(p,lang).title)}</span></a>`;
  }).join("");
  const srcList = page.sources || [];
  const sources = srcList.map(x=>`<li>${AFF.anchor({ url: x.url, text: (x.labels && x.labels[lang]) || x.label, suffix: " ↗" })}</li>`).join("");
  // FTC：页面上只要有一条计佣链接就必须披露，且要显示在链接附近
  const affNote = AFF.needsDisclosure(srcList.map(x=>x.url))
    ? `<p class="aff-note">${esc(KIT.affiliateDisclosure(lang))}</p>` : "";
  const s = siteI18n(lang);
  const heroImg = t.heroImage;
  const srcsetOf = img => {
    if (!img) return null;
    const base = img.replace(/\.(jpg|jpeg|png|webp)$/i, "");
    return { srcset: `${base}-640.jpg 640w, ${base}-1280.jpg 1280w, ${img} 1600w`, sizes: "(max-width: 640px) 94vw, (max-width: 960px) 92vw, 820px" };
  };
  const pageHero = heroImg ? `<div class="plot-hero-img">${KIT.picture({ ...srcsetOf(heroImg), src: heroImg, attrs: `alt="${esc(t.title)}" loading="lazy" width="1600" height="900"` })}</div>` : "";
  const noImgCls = heroImg ? "" : " noimg";
  // 生长进度条（耕作手册特色组件）
  const growthSteps = [
    [lang==="en"?"Seed":lang==="ja"?"種":lang==="ko"?"씨앗":lang==="es"?"Semilla":"种子"],
    [lang==="en"?"Sprout":lang==="ja"?"芽":lang==="ko"?"새싹":lang==="es"?"Brote":"嫩芽"],
    [lang==="en"?"Grow":lang==="ja"?"育つ":lang==="ko"?"성장":lang==="es"?"Crecer":"生长"],
    [lang==="en"?"Harvest":lang==="ja"?"収穫":lang==="ko"?"수확":lang==="es"?"Cosecha":"收获"],
  ].map((n,i)=>`<div class="growth-step ${i===3?'done':''}"><span class="growth-dot"></span><span>${esc(n[0])}</span></div>`).join("");
  const body = `
  <main class="container">
    <nav class="crumbs"><a href="${prefix}/">${esc(s.navHome)}</a><span>›</span><span>${esc(t.title)}</span></nav>
    <div class="plot-hero reveal${noImgCls}">
      ${heroImg ? "" : `<span class="hero-ic" aria-hidden="true">${SVG[page.meta?.icon || "faq"]}</span>`}
      <span class="evidence-tag">${esc(s.plotTag)} // ${esc(page.slug.toUpperCase())}</span>
      <h1>${esc(t.title)}</h1>
      <p class="intro">${esc(t.intro)}</p>
      ${pageHero}
      <div class="growth-bar" aria-hidden="true">${growthSteps}</div>
    </div>
    <div class="manual-grid">
      <div class="manual-main">
        ${toc ? `<nav class="toc reveal"><b class="toc-title">${esc(s.updated)}</b>${toc}</nav>` : ""}
        ${sections2}
        ${sources ? `<div class="sources reveal"><b>${esc(s.sources)}</b><ul>${sources}</ul>${affNote}</div>` : ""}
      </div>
      <aside class="manual-side">
        <div class="plot-meta reveal">
          <span class="cm-tag">${esc(s.plotTag)}</span>
          <div class="cm-row"><span class="cm-k">${esc(lang==="en"?"Page":lang==="ja"?"ページ":lang==="ko"?"페이지":lang==="es"?"Página":"页面")}</span><b>${esc(t.title)}</b></div>
          <div class="cm-row"><span class="cm-k">${esc(lang==="en"?"Category":lang==="ja"?"分類":lang==="ko"?"분류":lang==="es"?"Categoría":"分类")}</span><b>${esc(t.title.split(":")[0].split("—")[0].trim())}</b></div>
          <div class="cm-row"><span class="cm-k">${esc(s.updated)}</span><b>${today}</b></div>
          <div class="weather-card">
            <span class="weather-ic">${SVG.weather}</span>
            <div><b>${esc(lang==="en"?"Season tip":lang==="ja"?"季節のヒント":lang==="ko"?"계절 팁":lang==="es"?"Consejo de temporada":"季节提示")}</b>
            <p>${esc(lang==="en"?"Check the forecast — storms charge power, rain irrigates free.":lang==="ja"?"予報を確認——嵐で充電、雨で無料灌漑。":lang==="ko"?"예보를 확인하세요——폭풍은 충전, 비는 무료 관개.":lang==="es"?"Mira el pronóstico: las tormentas cargan y la lluvia riega gratis.":"看天气预报——雷暴蓄电、雨水免费灌溉。")}</p></div>
          </div>
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
  const desc = KIT.staticDesc(slug, lang, s.name, title);
  return renderFull(lang, title, desc, [breadcrumbLd({slug,title}, lang)], slug, `<main class="container"><div class="article-wrap single"><article><div class="page-hero reveal"><span class="evidence-tag">${esc(s.plotTag)} // ${esc(slug.toUpperCase())}</span><h1>${esc(title)}</h1></div>${body}</article></div></main>`);
}
function genStatic(lang){
  const s = siteI18n(lang);
  const dir = path.join(OUT, lang === DEF ? "" : lang);
  const aboutPoints = (DATA.game.aboutPointsI18n && DATA.game.aboutPointsI18n[lang]) || DATA.game.aboutPoints || [];
  const aboutBody = `<p>${esc(s.aboutText)}</p><h2 style="font-size:1.05rem;margin:18px 0 8px">${esc(s.aboutSources)}</h2><ul class="checks">${aboutPoints.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`;
  writePage(path.join(dir,"about.html"), "about", lang, renderStatic(lang,"about", s.aboutTitle,
    aboutBody + `<section class="card">` + KIT.editorialPolicy(lang, { siteName: s.name, contactEmail: `contact@${DATA.site.domain}` }) + `</section>`));
  const privacyBody = lang==="zh-CN"||lang==="zh-TW"
    ? `<p>这是游戏攻略网站，我们尊重访问者隐私。以下说明我们收集什么、如何使用。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">我们收集什么</h2><p>我们使用 Google Analytics（GA4）进行匿名流量统计：页面浏览、来源、设备类型和大致地区。我们不收集姓名、邮箱等个人身份信息，不出售数据。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Cookie</h2><p>Google Analytics 会使用 Cookie 进行会话统计。你可以在浏览器中禁用，或安装 Google Analytics 的停用插件。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">第三方服务</h2><p>字体来自 Google Fonts，站点由 Cloudflare CDN 提供服务；两者可能记录标准访问日志（IP、UA、时间）。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">联系我们</h2><p>隐私问题请邮件 <a href="mailto:contact@${esc(DATA.site.domain)}">contact@${esc(DATA.site.domain)}</a>。</p><p style="margin-top:14px;opacity:.75">生效日期：${today}</p>`
    : lang==="ko"
    ? `<p>이곳은 게임 공략 사이트이며 방문자의 개인정보를 존중합니다. 수집 항목과 사용 방식을 설명합니다.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">수집하는 정보</h2><p>Google Analytics(GA4)로 익명 트래픽 통계(페이지뷰, 유입 경로, 기기 유형, 대략적 지역)를 수집합니다. 이름, 이메일 등 개인 식별 정보는 수집하지 않으며 데이터를 판매하지 않습니다.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">쿠키</h2><p>Google Analytics는 세션 통계를 위해 쿠키를 사용합니다. 브라우저에서 비활성화하거나 Google Analytics 차단 부가기능을 사용할 수 있습니다.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">제3자 서비스</h2><p>글꼴은 Google Fonts에서, 사이트는 Cloudflare CDN으로 제공됩니다. 두 서비스 모두 표준 접속 로그(IP, UA, 시간)를 기록할 수 있습니다.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">문의</h2><p>개인정보 관련 질문은 <a href="mailto:contact@${esc(DATA.site.domain)}">contact@${esc(DATA.site.domain)}</a>로 보내주세요.</p><p style="margin-top:14px;opacity:.75">발효일: ${today}</p>`
    : lang==="es"
    ? `<p>Este es un sitio web de guías de juegos y respetamos la privacidad de los visitantes. Esto explica qué recopilamos y cómo se usa.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Qué recopilamos</h2><p>Usamos Google Analytics (GA4) para estadísticas de tráfico anónimas: visitas, referencias, tipos de dispositivo y regiones aproximadas. No recopilamos nombres, correos ni información personal identificable, y no vendemos datos.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Cookies</h2><p>Google Analytics usa cookies para estadísticas de sesión. Puedes desactivarlas en tu navegador o instalar el complemento de exclusión de Google Analytics.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Servicios de terceros</h2><p>Las fuentes se cargan desde Google Fonts y el sitio se sirve a través de Cloudflare CDN; ambos pueden registrar registros de acceso estándar (IP, agente de usuario, hora).</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Contacto</h2><p>Para preguntas de privacidad, escribe a <a href="mailto:contact@${esc(DATA.site.domain)}">contact@${esc(DATA.site.domain)}</a>.</p><p style="margin-top:14px;opacity:.75">Fecha de entrada en vigor: ${today}</p>`
    : lang==="ja"
    ? `<p>これはゲーム攻略サイトです。訪問者のプライバシーを尊重します。以下、収集内容と利用方法を説明します。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">収集する情報</h2><p>Google Analytics（GA4）で匿名のトラフィック統計（ページビュー、参照元、端末種別、おおよその地域）を取得しています。氏名・メールアドレスなどの個人情報は収集せず、データの販売も行いません。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Cookie</h2><p>Google Analytics はセッション統計のため Cookie を使用します。ブラウザで無効化するか、Google Analytics のオプトアウトアドオンを利用できます。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">第三者サービス</h2><p>Google Fonts からフォントを、Cloudflare の CDN を利用しています。標準的なアクセスログ（IP・UA・時刻）を記録する場合があります。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">お問い合わせ</h2><p>プライバシーに関する質問は <a href="mailto:contact@${esc(DATA.site.domain)}">contact@${esc(DATA.site.domain)}</a> まで。</p><p style="margin-top:14px;opacity:.75">発効日：${today}</p>`
    : `<p>This is a game guide website and we respect visitor privacy. This policy explains what we collect and how it is used.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">What we collect</h2><p>We use Google Analytics (GA4) for anonymous traffic statistics: page views, referrers, device types and approximate regions. We do not collect names, email addresses or any personally identifiable information, and we do not sell data.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Cookies</h2><p>Google Analytics sets cookies for session statistics. You can disable cookies in your browser or install the Google Analytics opt-out add-on.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Third-party services</h2><p>Fonts are loaded from Google Fonts and the site is served via Cloudflare's CDN; both may record standard access logs (IP, user agent, time). Those services follow their own privacy policies.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Contact</h2><p>For privacy questions, email <a href="mailto:contact@${esc(DATA.site.domain)}">contact@${esc(DATA.site.domain)}</a>.</p><p style="margin-top:14px;opacity:.75">Effective date: ${today}</p>`;
  writePage(path.join(dir,"privacy.html"), "privacy", lang, renderStatic(lang,"privacy", s.privacyTitle, privacyBody));
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
  writePage(path.join(dir,"contact.html"), "contact", lang, renderStatic(lang,"contact", s.contactTitle, `<p>${contactPh} <a href="mailto:contact@${esc(DATA.site.domain)}">contact@${esc(DATA.site.domain)}</a></p><p style="margin-top:10px">${contactReply}</p>`));
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
  return {"@context":"https://schema.org","@type":"Article",headline:t.title,description:t.metaDescription,mainEntityOfPage:urlOf(page.slug,lang),datePublished:isoDate(DATA.game.releaseDate),dateModified:KIT.LASTMOD_TOKEN,inLanguage:LANG_META[lang]?.html||lang,publisher:{"@type":"Organization",name:siteI18n(lang).name}};
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
// 写页面统一走这里：按「内容是否真变了」把 lastmod 占位符换成真实日期
const writePage = (filePath, slug, lang, html) => fs.writeFileSync(filePath, LM.stamp(urlOf(slug, lang), html));
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
  writePage(path.join(dir,"index.html"), "index", lang, renderHome(lang));
  for (const page of DATA.pages) {
    SEC_IDX = 0;
    const html = renderPage(lang, page);
    writePage(path.join(dir, page.slug + ".html"), page.slug, lang, html);
  }
  genStatic(lang);
}
gen404();

// sitemap（lastmod 走 LM：内容没变就沿用旧日期，不再每次全站标记为当天）
const urls = [];
for (const lang of LANGS) {
  urls.push({ loc: urlOf("index",lang), priority: "1.0" });
  for (const p of DATA.pages) urls.push({ loc: urlOf(p.slug,lang), priority: "0.8" });
  for (const sp of ["about","privacy","contact"]) urls.push({ loc: urlOf(sp,lang), priority: "0.3" });
}
const smN = KIT.writeSitemap(OUT, urls, LM);
KIT.writeRobots(OUT, DATA.site.domain);
KIT.writeAds(OUT, DATA.site.adsenseId);
KIT.writeHeaders(OUT);
KIT.writeIndexNowKey(OUT, DATA.site.indexNowKey);
// llms.txt：给 AI agent 的机器可读入口（不是 SEO 手段，见 site-kit 注释）
KIT.writeLlmsTxt(OUT, {
  siteName: DATA.site.name,
  domain: DATA.site.domain,
  summary: `Unofficial ${DATA.game.name} guide site. Each page answers one question players actually search for, and lists the sources it was checked against. Available in ${LANGS.length} languages: ${LANGS.join(", ")}.`,
  pages: DATA.pages.map(p => { const t = pageOf(p, DEF); return { slug: p.slug, title: t.title, desc: t.metaDescription }; }),
  notes: [
    "Facts are checked against the official Steam store page and reputable gaming media; every page lists its own sources at the bottom.",
    "Anything we could not verify is explicitly marked as unverified — gaps are left open rather than filled with generated text.",
    "Localised versions live under /<lang>/ (e.g. /ja/how-to-play) and are declared via hreflang on every page.",
    "This is an unofficial fan site, not affiliated with the game's developer or publisher."
  ]
});
const lm = LM.save();
console.log(`✓ ${LANGS.length} locales × ${1+DATA.pages.length+3} pages｜sitemap ${smN} URL｜内容有变更 ${lm.changed}/${lm.total} 页`);
