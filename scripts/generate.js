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
const OUT = process.env.DOLOC_OUTPUT_DIR ? path.resolve(process.env.DOLOC_OUTPUT_DIR) : path.join(ROOT, "public");
const KIT = require("./lib/site-kit");   // 共用基建：URL/图片/sitemap/lastmod
// 联盟链接：site.json 的 affiliates 没配 ID 时原样输出原链接，配了才加追踪参数 + rel="sponsored"
const AFF = KIT.createAffiliate(DATA.site.affiliates);
const esc = KIT.esc;
const clean = KIT.clean;
const ADSENSE_FIXTURE_ENABLED = process.env.NODE_ENV === "test" && process.env.DOLOC_ADSENSE_FIXTURE === "enabled";
const ADSENSE_PUBLISHER_ID = /^pub-\d+$/.test(String(DATA.site.adsenseId || "").trim())
  ? String(DATA.site.adsenseId).trim()
  : "";
const ADSENSE_CLIENT_ID = ADSENSE_PUBLISHER_ID ? `ca-${ADSENSE_PUBLISHER_ID}` : "";
const ADSENSE_SERVING_ENABLED = Boolean(
  ADSENSE_CLIENT_ID && (
    ADSENSE_FIXTURE_ENABLED || (
      DATA.site.adsenseServing &&
      DATA.site.adsenseServing.enabled === true &&
      DATA.site.adsenseServing.providerReady === true &&
      DATA.site.adsenseServing.certifiedCmpReady === true
    )
  )
);
const ADSTERRA_CONFIG = (() => {
  const markup = String(DATA.site.adsterra || "");
  const src = (markup.match(/src=\"([^\"]*effectivecpmnetwork\.com[^\"]*)\"/) || [])[1] || "";
  const containerId = (markup.match(/id=\"([^\"]+)\"/) || [])[1] || "";
  if (markup && (!src || !containerId)) throw new Error("data/site.json adsterra markup must include one provider src and container id");
  return src && containerId ? { src, containerId } : null;
})();
const adsenseMeta = () => ADSENSE_CLIENT_ID
  ? `<meta name="google-adsense-account" content="${esc(ADSENSE_CLIENT_ID)}" />`
  : "";
const adsenseScript = () => ADSENSE_SERVING_ENABLED
  ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(ADSENSE_CLIENT_ID)}" crossorigin="anonymous"></script>`
  : "";
const LANGS = DATA.site.languages || ["en"];
const DEF = DATA.site.defaultLanguage || "en";
const CSS_V = crypto.createHash("md5").update(fs.readFileSync(path.join(ROOT,"templates","style.css"),"utf8")).digest("hex").slice(0,8);
const today = DATA.site.contentUpdatedAt;
if (!/^\d{4}-\d{2}-\d{2}$/.test(today || "")) {
  throw new Error("data/site.json site.contentUpdatedAt must be YYYY-MM-DD");
}
const urlOf = KIT.createUrl({ domain: DATA.site.domain, defaultLang: DEF });
const LASTMOD_PATH = process.env.DOLOC_LASTMOD_PATH
  ? path.resolve(process.env.DOLOC_LASTMOD_PATH)
  : path.join(ROOT,"data",".lastmod.json");
const LM = KIT.createLastmod({ manifestPath: LASTMOD_PATH, today });
const HERO_SET = "/images/hero-640.jpg 640w, /images/hero-1280.jpg 1280w, /images/hero.jpg 1600w";
const UPDATED_LABEL = { en:"Updated", "zh-CN":"更新于", "zh-TW":"更新於", ja:"更新日", ko:"업데이트", es:"Actualizado" };
const updLabel = lang => UPDATED_LABEL[lang] || "Updated";
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

const NAV_LABELS = {
  en: {
    "how-to-play":"How to Play", "make-money":"How to Make Money Fast", "where-to-buy":"Where to Buy",
    farming:"Farming Guide: Crops, Seasons & Soil", automation:"Farming Automation Guide (1.0)",
    "gene-system":"Gene System Guide: Mutations & Seeds", fishing:"Fishing Guide: Ponds, Weather & Rare Fish",
    "drone-combat":"Drone Combat Guide: Upgrades & Modules", exploration:"Exploration Guide: All 5 Regions",
    friendship:"Friendship Guide: Villagers, Gifts & Festivals", weather:"Weather Guide: Acid Rain, Storms & Drought",
    cooking:"Cooking Guide: Recipes, Buffs & Ingredients", ranching:"Ranching Guide: Barns, Fences & Animals",
    characters:"Characters: Villager Profiles & Secrets", story:"Story Guide: Mysteries & the 1.0 Ending",
    gifts:"Gift Guide: Every Villager's Loves, Likes & Dislikes", romance:"Romance: The Straight Answer",
    achievements:"Achievements: All 80 (1.0)", "how-long-to-beat":"How Long to Beat",
    mods:"Mods & Steam Workshop Guide", "update-log":"Update Log: 1.0 & Early Access History",
    faq:"FAQ: 1.0 Answers to Common Questions", "system-requirements":"System Requirements",
    "steam-deck":"Steam Deck Compatibility Guide",
  },
  es: {
    "how-to-play":"Cómo jugar: guía para principiantes (1.0)", "make-money":"Cómo ganar dinero rápido (1.0)",
    "where-to-buy":"Dónde comprar (precios, descuentos y plataformas)", farming:"Guía de agricultura: cultivos, estaciones y suelo",
    automation:"Guía de automatización agrícola (1.0)", "gene-system":"Guía del sistema genético: mutaciones y semillas",
    fishing:"Guía de pesca: estanques, clima y peces raros", "drone-combat":"Guía de combate con dron: mejoras y módulos",
    exploration:"Guía de exploración: las 5 regiones", friendship:"Guía de amistad: vecinos, regalos y festivales",
    weather:"Guía del clima: lluvia ácida, tormentas y sequía", cooking:"Guía de cocina: recetas, buffs e ingredientes",
    ranching:"Guía de ganadería: establos, vallas y animales", characters:"Personajes: perfiles de aldeanos y secretos",
    story:"Guía de la historia: misterios y final 1.0", gifts:"Guía de regalos: gustos y rechazos de cada aldeano",
    romance:"Romance: la respuesta directa", achievements:"Logros: los 80 (1.0)",
    "how-long-to-beat":"¿Cuánto se tarda en completar el juego?", mods:"Guía de mods y Steam Workshop",
    "update-log":"Registro de actualizaciones: 1.0 e historia de EA", faq:"Preguntas frecuentes: respuestas del 1.0",
    "system-requirements":"Requisitos del sistema", "steam-deck":"Steam Deck: guía de compatibilidad",
  },
};

const FAVICON_LINKS = `
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`;

const metaOf = slug => (DATA.pages.find(p=>p.slug===slug)?.meta) || {};
const normalizeSectionSchema = (page, lang, sections) => {
  const list = (sections || []).map(section => ({ ...section }));
  const override = DATA.site.sectionSchemaOverrides?.[page.slug]?.[lang];
  const tailTypes = override?.tailTypes;
  if (Array.isArray(tailTypes)) {
    if (list.length < tailTypes.length) throw new Error(`section schema override exceeds ${lang}:${page.slug}`);
    const start = list.length - tailTypes.length;
    tailTypes.forEach((type, index) => { list[start + index].type = type; });
  }
  return list;
};
const pageOf = (page, lang) => {
  if (lang === DEF || !page.i18n || !page.i18n[lang]) {
    return { title: page.title, metaTitle: page.metaTitle, metaDescription: page.metaDescription, intro: page.intro, sections: normalizeSectionSchema(page, lang, page.sections), heroImage: page.heroImage };
  }
  const t = page.i18n[lang];
  return { title: t.title || page.title, metaTitle: t.metaTitle || page.metaTitle, metaDescription: t.metaDescription || page.metaDescription, intro: t.intro || page.intro, sections: normalizeSectionSchema(page, lang, t.sections || page.sections), heroImage: t.heroImage || page.heroImage };
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

/* ---------- commercial funnel experiment (2026-08-13) ----------
 * Keep this intentionally narrow: only the seven approved high-engagement
 * entry pages get a purchase-guide link, while the comparison itself appears
 * only on where-to-buy. Store URLs come from the page's existing source list.
 */
const BUY_ENTRY_PAGES = new Set([
  "en:cooking", "en:fishing", "en:gifts", "en:mods",
  "ko:cooking", "ko:fishing", "ko:exploration",
]);
const BUY_UI = {
  "en":    { entryTag:"BUYING GUIDE", entryTitle:"Ready to buy Doloc Town?", entryBody:"Compare the available store links before you choose where to buy.", entryCta:"Compare stores →",
             title:"Compare places to buy", intro:"Open a store to check its current price and availability. Prices are not copied here because they can change.",
             steam:"Steam store", store:"Store link", compare:"Price comparison", partner:"Partner link", cta:"Check current offer ↗" },
  "zh-CN": { entryTag:"购买指南", entryTitle:"准备购买《多洛可小镇》？", entryBody:"购买前对比现有商店链接，再决定从哪里购买。", entryCta:"对比商店 →",
             title:"对比购买渠道", intro:"打开商店查看当前价格与库存。价格可能变化，因此这里不复制价格。",
             steam:"Steam 商店", store:"商店链接", compare:"价格对比", partner:"合作伙伴链接", cta:"查看当前信息 ↗" },
  "zh-TW": { entryTag:"購買指南", entryTitle:"準備購買《多洛可小鎮》？", entryBody:"購買前比較現有商店連結，再決定從哪裡購買。", entryCta:"比較商店 →",
             title:"比較購買管道", intro:"開啟商店查看目前價格與供應情況。價格可能變動，因此這裡不複製價格。",
             steam:"Steam 商店", store:"商店連結", compare:"價格比較", partner:"合作夥伴連結", cta:"查看目前資訊 ↗" },
  "ja":    { entryTag:"購入ガイド", entryTitle:"Doloc Town を購入しますか？", entryBody:"購入先を決める前に、利用できるストアリンクを比較できます。", entryCta:"ストアを比較 →",
             title:"購入先を比較", intro:"各ストアで現在の価格と在庫状況を確認してください。変動するため、価格はここに転載していません。",
             steam:"Steam ストア", store:"ストアリンク", compare:"価格比較", partner:"パートナーリンク", cta:"現在の情報を確認 ↗" },
  "ko":    { entryTag:"구매 가이드", entryTitle:"Doloc Town을 구매할 준비가 됐나요?", entryBody:"구매처를 정하기 전에 이용 가능한 스토어 링크를 비교해 보세요.", entryCta:"스토어 비교 →",
             title:"구매처 비교", intro:"각 스토어에서 현재 가격과 판매 여부를 확인하세요. 정보가 바뀔 수 있어 가격은 이 페이지에 복사하지 않습니다.",
             steam:"Steam 스토어", store:"스토어 링크", compare:"가격 비교", partner:"파트너 링크", cta:"현재 정보 확인 ↗" },
  "es":    { entryTag:"GUÍA DE COMPRA", entryTitle:"¿Listo para comprar Doloc Town?", entryBody:"Compara los enlaces disponibles antes de elegir dónde comprar.", entryCta:"Comparar tiendas →",
             title:"Compara dónde comprar", intro:"Abre cada tienda para consultar su precio y disponibilidad actuales. No copiamos precios porque pueden cambiar.",
             steam:"Tienda de Steam", store:"Enlace de tienda", compare:"Comparación de precios", partner:"Enlace de socio", cta:"Ver información actual ↗" },
};
const buyUi = lang => BUY_UI[lang] || BUY_UI.en;

function sourceByHost(page, hostname) {
  return (page.sources || []).find(source => {
    try { return new URL(source.url).hostname.replace(/^www\./, "") === hostname; }
    catch (_) { return false; }
  });
}

function renderStoreComparison(lang, page) {
  if (page.slug !== "where-to-buy") return "";
  const u = buyUi(lang);
  const stores = [
    ["store.steampowered.com", "Steam", "steam"],
    ["humblebundle.com", "Humble Store", "store"],
    ["greenmangaming.com", "Green Man Gaming", "store"],
    ["gamersgate.com", "GamersGate", "partner"],
    ["isthereanydeal.com", "IsThereAnyDeal", "compare"],
  ].map(([host, name, kind]) => {
    const source = sourceByHost(page, host);
    if (!source) return "";
    const partner = AFF.isPartner(source.url);
    const label = partner ? u.partner : u[kind];
    return `<li class="store-card${partner ? " is-partner" : ""}">
      <span class="store-kind">${esc(label)}</span>
      <b>${esc(name)}</b>
      ${AFF.anchor({ url: source.url, text: u.cta })}
    </li>`;
  }).join("");
  const trackedUrls = (page.sources || []).map(source => source.url);
  const disclosure = AFF.needsDisclosure(trackedUrls)
    ? `<p class="aff-note">${esc(KIT.affiliateDisclosure(lang))}</p>` : "";
  return `<section class="store-compare reveal" aria-labelledby="store-compare-title">
    <span class="furrow-tag">${esc(u.entryTag)}</span>
    <h2 id="store-compare-title">${esc(u.title)}</h2>
    <p class="store-intro">${esc(u.intro)}</p>
    <ul class="store-grid">${stores}</ul>
    ${disclosure}
  </section>`;
}

function renderBuyEntry(lang, page) {
  if (!BUY_ENTRY_PAGES.has(`${lang}:${page.slug}`)) return "";
  const u = buyUi(lang);
  const prefix = lang === DEF ? "" : `/${lang}`;
  return `<aside class="buy-entry reveal" aria-label="${esc(u.entryTag)}">
    <span class="furrow-tag">${esc(u.entryTag)}</span>
    <div><b>${esc(u.entryTitle)}</b><p>${esc(u.entryBody)}</p></div>
    <a class="btn btn-secondary" href="${prefix}/where-to-buy">${esc(u.entryCta)}</a>
  </aside>`;
}

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

/* 礼物筛选器文案。分档词要和 data/gifts_pages.py 的 VERDICT_W 对得上，
   否则筛选按钮和表格里的判定词会自说自话。 */
const GIFT_UI = {
  "en":    { title:"I'm holding an item — who wants it?", lead:"Filter 65 items by how safe they are to give. Every row stays on the page — this only narrows what you see.",
             search:"Search item name", v:"Verdict", reset:"Reset",
             all:"All", universal:"Universal", never:"Never gift", mixed:"Divisive", limited:"Limited data",
             count:"Showing {n} of {t} items", noMatch:"No items match these filters." },
  "zh-CN": { title:"我手上有个东西——该给谁？", lead:"按「送出去有多安全」筛选 65 件物品。所有行都仍在页面上，筛选只是收窄显示范围。",
             search:"搜索物品名", v:"判定", reset:"重置",
             all:"全部", universal:"万能", never:"绝对别送", mixed:"有分歧", limited:"数据有限",
             count:"显示 {t} 件中的 {n} 件", noMatch:"没有物品符合当前筛选。" },
  "zh-TW": { title:"我手上有個東西——該給誰？", lead:"按「送出去有多安全」篩選 65 件物品。所有列都仍在頁面上，篩選只是收窄顯示範圍。",
             search:"搜尋物品名", v:"判定", reset:"重設",
             all:"全部", universal:"萬能", never:"絕對別送", mixed:"有分歧", limited:"資料有限",
             count:"顯示 {t} 件中的 {n} 件", noMatch:"沒有物品符合目前篩選。" },
  "ja":    { title:"手持ちの品——誰にあげる？", lead:"「渡して安全か」で 65 品を絞り込む。全行はページに残ったまま、表示範囲が狭まるだけ。",
             search:"品名で検索", v:"判定", reset:"リセット",
             all:"すべて", universal:"万能", never:"絶対に贈らない", mixed:"賛否両論", limited:"データ不足",
             count:"{t} 品中 {n} 品を表示", noMatch:"条件に合う品がありません。" },
  "ko":    { title:"이 아이템, 누구한테 주지?", lead:"'줘도 안전한 정도'로 아이템 65종을 걸러낸다. 모든 행은 페이지에 그대로 남아 있고 보이는 범위만 좁아진다.",
             search:"아이템 이름 검색", v:"판정", reset:"초기화",
             all:"전체", universal:"만능", never:"절대 금지", mixed:"호불호", limited:"데이터 부족",
             count:"{t}종 중 {n}종 표시", noMatch:"조건에 맞는 아이템이 없습니다." },
  "es":    { title:"Tengo un objeto — ¿a quién se lo doy?", lead:"Filtra 65 objetos por lo seguro que es regalarlos. Todas las filas siguen en la página; esto solo acota lo que ves.",
             search:"Buscar objeto", v:"Veredicto", reset:"Reiniciar",
             all:"Todos", universal:"Universal", never:"Nunca", mixed:"Divisivo", limited:"Datos limitados",
             count:"Mostrando {n} de {t} objetos", noMatch:"Ningún objeto coincide con estos filtros." },
};
const giftUi = lang => GIFT_UI[lang] || GIFT_UI.en;

/* 基因筛选器文案（6 语）。
 * 效果分档（water/harvest/yield/seeds/survival）是从基因表已有英文单元格机械推导的归类，
 * 不是新事实（与鱼类筛选器同一原则）。第 7 行「+ ~14 more」待验证占位归 unlisted。
 */
const GENE_UI = {
  "en":    { title:"Which gene should I use?", lead:"Filter the 6 confirmed mutations by what they do. All rows stay on the page — this only narrows what you see.",
             search:"Search gene name", effect:"Effect type", reset:"Reset",
             all:"All", water:"Auto-water", harvest:"Auto-harvest", yield:"Extra yield", seeds:"Self-seed", survival:"Off-season", unlisted:"Unverified",
             count:"Showing {n} of {t} genes", noMatch:"No genes match these filters." },
  "zh-CN": { title:"该用哪种基因？", lead:"按效果筛选 6 种已确认的突变。所有行都仍在页面上，筛选只是收窄显示范围。",
             search:"搜索基因名", effect:"效果类型", reset:"重置",
             all:"全部", water:"自动浇水", harvest:"自动收获", yield:"增产", seeds:"自留种", survival:"耐非宜季", unlisted:"待验证",
             count:"显示 {n} / {t} 种", noMatch:"没有符合条件的基因。" },
  "zh-TW": { title:"該用哪種基因？", lead:"按效果篩選 6 種已確認的突變。所有列都仍在頁面上，篩選只是收窄顯示範圍。",
             search:"搜尋基因名", effect:"效果類型", reset:"重設",
             all:"全部", water:"自動澆水", harvest:"自動收穫", yield:"增產", seeds:"自留種", survival:"耐非宜季", unlisted:"待驗證",
             count:"顯示 {n} / {t} 種", noMatch:"沒有符合條件的基因。" },
  "ja":    { title:"どの遺伝子を使うべき？", lead:"確認済みの 6 つの変異を効果で絞り込む。全行はページに残ったまま、表示範囲が狭まるだけ。",
             search:"遺伝子名で検索", effect:"効果タイプ", reset:"リセット",
             all:"すべて", water:"自動潅水", harvest:"自動収穫", yield:"増収", seeds:"自家採種", survival:"シーズン外耐性", unlisted:"未検証",
             count:"{t} 種中 {n} 種を表示", noMatch:"条件に合う遺伝子がありません。" },
  "ko":    { title:"어떤 유전자를 써야 할까?", lead:"확인된 6종 변이를 효과별로 필터링합니다. 모든 행은 페이지에 그대로 남아 있으며, 표시 범위만 좁힙니다.",
             search:"유전자 이름 검색", effect:"효과 유형", reset:"초기화",
             all:"전체", water:"자동 물주기", harvest:"자동 수확", yield:"증산", seeds:"자가 채종", survival:"비수기 생존", unlisted:"미검증",
             count:"{t}종 중 {n}종 표시", noMatch:"조건에 맞는 유전자가 없습니다." },
  "es":    { title:"¿Qué gen debería usar?", lead:"Filtra las 6 mutaciones confirmadas por su efecto. Todas las filas siguen en la página; esto solo acota lo que ves.",
             search:"Buscar gen", effect:"Tipo de efecto", reset:"Restablecer",
             all:"Todos", water:"Auto-riego", harvest:"Auto-cosecha", yield:"Rendimiento extra", seeds:"Auto-semilla", survival:"Fuera de temporada", unlisted:"Sin verificar",
             count:"Mostrando {n} de {t} genes", noMatch:"Ningún gen coincide con estos filtros." },
};
const geneUi = lang => GENE_UI[lang] || GENE_UI.en;

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
  "make-money": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.5 9.5c.6-1 3-1 3.4.3.3 1-1.7 1.7-2.6 2.1-1 .4-2.3.9-2.3 2.2 0 1.2 1.3 2 2.8 2 1.7 0 3.4-.8 3.4-1.8"/><path d="M12 6.5v1.5M12 16v1.5"/></svg>',
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
  // Impact（Humble Bundle 联盟）所有权验证。
  // ⚠️ 两处刻意和本文件其它 meta 不一致，都别"顺手修正"：
  //    1. 属性名是 `value` 不是 `content`
  //    2. 单引号 + 不自闭合
  //    这是 Impact 后台给的原文格式。理论上 HTML 等价，但验证器若做字符串精确匹配就只认原样，
  //    照抄的成本是零，赌它按标准解析的成本是一轮部署 + 一次失败重试。
  //    值是 UUID（十六进制+连字符），单引号属性不会被内容破坏；仍然转义 ' 以防将来换成别的值。
  // impactVerification 支持单值或数组：Humble 主流程 + Connect channels 渠道表单会生成不同 UUID，
  // 都放上，无论 Impact 查哪个都通过。
  const _impVals = Array.isArray(DATA.site.impactVerification)
    ? DATA.site.impactVerification.filter(Boolean)
    : (DATA.site.impactVerification ? [DATA.site.impactVerification] : []);
  const impact = _impVals.map(v =>
    `<meta name='impact-site-verification' value='${esc(v).replace(/'/g, "&#39;")}'>`
  ).join("");
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
${FAVICON_LINKS}
${gsc}
  ${adsenseMeta()}${awin}${impact}
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

function amazonConfig() {
  const configured = DATA.site.amazonAffiliate || {};
  const fixture = process.env.DOLOC_AMAZON_FIXTURE === "enabled";
  const cfg = fixture ? { ...configured, enabled: true, providerRegistrationVerified: true } : configured;
  const validTag = /^[a-z0-9-]{3,64}$/i.test(cfg.trackingTag || "");
  const validHost = /(^|\.)amazon\.com$/i.test(cfg.marketplaceHost || "");
  const validDomain = cfg.registeredDomain === DATA.site.domain;
  return cfg.enabled === true && cfg.providerRegistrationVerified === true && validTag && validHost && validDomain ? cfg : null;
}

function renderAmazonAffiliate(lang) {
  const cfg = amazonConfig();
  if (!cfg) return "";
  const AMZ = {
    "en":    { title: "Game gear", local: "Prices and availability may change.", action: "search Amazon (opens in a new tab)", items: [["Gaming keyboard","gaming keyboard"],["Gaming mouse","gaming mouse"],["Gaming headset","gaming headset"],["Game controller","game controller"],["Gaming monitor","gaming monitor"]] },
    "zh-CN": { title: "游戏装备", local: "价格与库存可能变化。", action: "在 Amazon 搜索（新标签页）", items: [["游戏键盘","gaming keyboard"],["游戏鼠标","gaming mouse"],["游戏耳机","gaming headset"],["游戏手柄","game controller"],["游戏显示器","gaming monitor"]] },
    "zh-TW": { title: "遊戲裝備", local: "價格與庫存可能變動。", action: "在 Amazon 搜尋（新分頁）", items: [["遊戲鍵盤","gaming keyboard"],["遊戲滑鼠","gaming mouse"],["遊戲耳機","gaming headset"],["遊戲手把","game controller"],["遊戲顯示器","gaming monitor"]] },
    "ja":    { title: "ゲームギア", local: "価格と在庫は変動します。", action: "Amazon で検索（新しいタブ）", items: [["ゲーミングキーボード","gaming keyboard"],["ゲーミングマウス","gaming mouse"],["ゲーミングヘッドセット","gaming headset"],["ゲームコントローラー","game controller"],["ゲーミングモニター","gaming monitor"]] },
    "ko":    { title: "게임 장비", local: "가격과 재고는 변경될 수 있습니다.", action: "Amazon에서 검색 (새 탭)", items: [["게이밍 키보드","gaming keyboard"],["게이밍 마우스","gaming mouse"],["게이밍 헤드셋","gaming headset"],["게임 컨트롤러","game controller"],["게이밍 모니터","gaming monitor"]] },
    "es":    { title: "Equipo de juego", local: "Los precios y la disponibilidad pueden cambiar.", action: "buscar en Amazon (abre una pestaña nueva)", items: [["Teclado gaming","gaming keyboard"],["Ratón gaming","gaming mouse"],["Auriculares gaming","gaming headset"],["Mando","game controller"],["Monitor gaming","gaming monitor"]] },
  };
  const t = AMZ[lang] || AMZ.en;
  const links = t.items.map(it => `<li><a href="https://${esc(cfg.marketplaceHost)}/s?k=${encodeURIComponent(it[1])}&amp;tag=${encodeURIComponent(cfg.trackingTag)}" target="_blank" rel="sponsored nofollow noopener">${esc(it[0])} — ${esc(t.action)} ↗</a></li>`).join("");
  return `<aside class="amazon-gear" aria-labelledby="amazon-gear-title">
    <h2 id="amazon-gear-title">${esc(t.title)}</h2>
    <p class="amazon-disclosure">As an Amazon Associate I earn from qualifying purchases.</p>
    <ul class="amazon-gear-links">${links}</ul>
    <p class="aff-note">${esc(t.local)}</p>
  </aside>`;
}


function header(lang, active){
  const s = siteI18n(lang);
  const prefix = lang === DEF ? "" : `/${lang}`;
  const P0 = ["how-to-play","make-money","where-to-buy","farming","automation","gene-system","fishing","drone-combat","exploration","friendship","weather"];
  const P1 = ["cooking","ranching","characters","story","gifts","romance"];
  const P2 = ["achievements","how-long-to-beat","mods","update-log","faq","system-requirements","steam-deck"];
  const drop = (title, slugs) => `<div class="dd-group"><b class="dd-title">${esc(title)}</b>${slugs.map(slug=>{
    const p=DATA.pages.find(x=>x.slug===slug); if(!p) return "";
    const m=metaOf(slug);
    const _t = pageOf(p,lang).title;
    const _disp = NAV_LABELS[lang]?.[slug] || _t;
    return `<a href="${prefix}/${slug}" class="${slug===active?"active":""}"><span class="nav-ic">${SVG[m.icon]}</span><span>${esc(_disp)}</span></a>`;
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
/**
 * Doloc-specific decision events for this experiment.
 * A commercial exit is an affiliate click only when the rendered anchor is
 * explicitly marked sponsored by the active affiliate configuration. This
 * avoids counting ordinary Humble/GMG store links as commissionable traffic.
 */
function decisionEventsScript() {
  return `<script>
(function(){
  function send(name, params){
    if (window.DOLOC_CONSENT_ANALYTICS === true && typeof window.gtag === "function") window.gtag("event", name, params || {});
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
          var affiliate = /(^|\\s)sponsored(\\s|$)/.test(a.rel || '');
          send(affiliate ? 'affiliate_click' : 'outbound_click', {
            link_domain: u.hostname,
            link_url: u.origin + u.pathname,
            page_path: location.pathname
          });
        }
      } catch (_) {}
    }
    var root = toolRoot(e.target);
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
const CONSENT_UI = {
  en: { title:"Privacy choices", body:"Google Analytics and, on seven eligible guides, Adsterra stay blocked until you choose. They may use IP, device, page, referrer, approximate-region and cookie or identifier data for analytics, advertising, fraud prevention and reporting.", change:"You can change or withdraw your choice at any time.", accept:"Accept analytics & ads", reject:"Reject optional services", settings:"Privacy settings", dialog:"Privacy settings", analytics:"Analytics (Google Analytics / GA4)", advertising:"Advertising (Adsterra on eligible guides)", save:"Save choices", withdraw:"Withdraw all", close:"Close", policy:"Privacy policy and provider links", adBlocked:"Optional ad blocked until you accept advertising." },
  "zh-CN": { title:"隐私选择", body:"在您作出选择前，Google Analytics 以及 7 个符合条件攻略页上的 Adsterra 均保持阻止。它们可能为分析、广告、防欺诈和报告处理 IP、设备、页面、来源、大致地区以及 Cookie 或类似标识符。", change:"您可以随时更改或撤回选择。", accept:"接受分析与广告", reject:"拒绝可选服务", settings:"隐私设置", dialog:"隐私设置", analytics:"分析（Google Analytics / GA4）", advertising:"广告（仅符合条件攻略页上的 Adsterra）", save:"保存选择", withdraw:"全部撤回", close:"关闭", policy:"隐私政策与服务商链接", adBlocked:"接受广告前，可选广告保持阻止。" },
  "zh-TW": { title:"隱私選擇", body:"在您做出選擇前，Google Analytics 及 7 個符合條件攻略頁上的 Adsterra 都會維持封鎖。它們可能為分析、廣告、防詐欺與報告處理 IP、裝置、頁面、來源、大致地區，以及 Cookie 或類似識別碼。", change:"您可以隨時變更或撤回選擇。", accept:"接受分析與廣告", reject:"拒絕選用服務", settings:"隱私設定", dialog:"隱私設定", analytics:"分析（Google Analytics / GA4）", advertising:"廣告（僅符合條件攻略頁上的 Adsterra）", save:"儲存選擇", withdraw:"全部撤回", close:"關閉", policy:"隱私政策與服務商連結", adBlocked:"接受廣告前，選用廣告維持封鎖。" },
  ja: { title:"プライバシー設定", body:"選択するまで Google Analytics と、対象となる 7 つの攻略ページの Adsterra はブロックされます。分析、広告、不正防止、レポートのため IP、端末、ページ、参照元、おおよその地域、Cookie や類似識別子を処理する場合があります。", change:"選択はいつでも変更・撤回できます。", accept:"分析と広告を許可", reject:"任意サービスを拒否", settings:"プライバシー設定", dialog:"プライバシー設定", analytics:"分析（Google Analytics / GA4）", advertising:"広告（対象ページの Adsterra のみ）", save:"選択を保存", withdraw:"すべて撤回", close:"閉じる", policy:"プライバシーポリシーと事業者リンク", adBlocked:"広告を許可するまで任意広告はブロックされます。" },
  ko: { title:"개인정보 선택", body:"선택하기 전에는 Google Analytics와 대상 가이드 7개의 Adsterra가 차단됩니다. 분석, 광고, 사기 방지 및 보고를 위해 IP, 기기, 페이지, 유입 경로, 대략적 지역, 쿠키나 유사 식별자를 처리할 수 있습니다.", change:"선택은 언제든 변경하거나 철회할 수 있습니다.", accept:"분석 및 광고 허용", reject:"선택 서비스 거부", settings:"개인정보 설정", dialog:"개인정보 설정", analytics:"분석 (Google Analytics / GA4)", advertising:"광고 (대상 가이드의 Adsterra만)", save:"선택 저장", withdraw:"모두 철회", close:"닫기", policy:"개인정보 처리방침 및 공급자 링크", adBlocked:"광고를 허용하기 전까지 선택 광고가 차단됩니다." },
  es: { title:"Opciones de privacidad", body:"Google Analytics y, en siete guías aptas, Adsterra permanecen bloqueados hasta que elijas. Pueden tratar IP, dispositivo, página, referencia, región aproximada y cookies o identificadores para análisis, publicidad, prevención del fraude e informes.", change:"Puedes cambiar o retirar tu elección en cualquier momento.", accept:"Aceptar análisis y anuncios", reject:"Rechazar servicios opcionales", settings:"Ajustes de privacidad", dialog:"Ajustes de privacidad", analytics:"Análisis (Google Analytics / GA4)", advertising:"Publicidad (Adsterra solo en guías aptas)", save:"Guardar opciones", withdraw:"Retirar todo", close:"Cerrar", policy:"Política de privacidad y enlaces de proveedores", adBlocked:"El anuncio opcional sigue bloqueado hasta que aceptes publicidad." },
};
function consentUi(lang, adsterraEligible){
  const u = CONSENT_UI[lang] || CONSENT_UI.en;
  const prefix = lang === DEF ? "" : `/${lang}`;
  const adConfig = adsterraEligible && ADSTERRA_CONFIG ? ADSTERRA_CONFIG : null;
  const cfg = JSON.stringify({
    storageKey: DATA.site.consentStorageKey || "doloc_consent_v1",
    gaId: DATA.site.gaId || "",
    adsterra: adConfig,
  }).replace(/</g, "\\u003c");
  return `<button type="button" class="privacy-settings-button" data-consent-settings aria-haspopup="dialog" aria-controls="consent-dialog-${esc(lang)}" aria-expanded="false">${esc(u.settings)}</button>
<section class="consent-banner" data-consent-banner role="dialog" aria-modal="false" aria-labelledby="consent-title-${esc(lang)}">
  <div><h2 id="consent-title-${esc(lang)}">${esc(u.title)}</h2><p>${esc(u.body)}</p><p>${esc(u.change)} <a href="${prefix}/privacy">${esc(u.policy)}</a>.</p></div>
  <div class="consent-actions"><button type="button" class="btn btn-primary" data-consent-accept>${esc(u.accept)}</button><button type="button" class="btn" data-consent-reject>${esc(u.reject)}</button><button type="button" class="consent-link" data-consent-open>${esc(u.settings)}</button></div>
</section>
<dialog id="consent-dialog-${esc(lang)}" class="consent-dialog" data-consent-dialog aria-labelledby="consent-dialog-title-${esc(lang)}">
  <div class="consent-panel"><div class="consent-panel-head"><h2 id="consent-dialog-title-${esc(lang)}">${esc(u.dialog)}</h2><button type="button" class="consent-close" data-consent-close aria-label="${esc(u.close)}">×</button></div>
  <p class="consent-detail">${esc(u.body)} ${esc(u.change)} <a href="${prefix}/privacy">${esc(u.policy)}</a>.</p>
  <label><input type="checkbox" data-consent-analytics /> <span>${esc(u.analytics)}</span></label>
  <label><input type="checkbox" data-consent-advertising /> <span>${esc(u.advertising)}</span></label>
  <div class="consent-actions"><button type="button" class="btn btn-primary" data-consent-save>${esc(u.save)}</button><button type="button" class="btn" data-consent-withdraw>${esc(u.withdraw)}</button></div></div>
</dialog>
<script>
(function(){
  var cfg=${cfg}, banner=document.querySelector('[data-consent-banner]'), dialog=document.querySelector('[data-consent-dialog]');
  var analytics=document.querySelector('[data-consent-analytics]'), advertising=document.querySelector('[data-consent-advertising]');
  var current=null, gaLoaded=false, adLoaded=false, lastFocus=null;
  function read(){try{var v=JSON.parse(localStorage.getItem(cfg.storageKey));return v&&typeof v.analytics==='boolean'&&typeof v.advertising==='boolean'?v:null;}catch(_){return null;}}
  function persist(v){var reload=!!(current&&((current.analytics&&!v.analytics)||(current.advertising&&!v.advertising)));current=v;try{localStorage.setItem(cfg.storageKey,JSON.stringify(v));}catch(_){} apply(v);banner.hidden=true;close();if(reload&&location.protocol.indexOf('http')===0)location.reload();}
  function clearGaCookies(){document.cookie.split(';').forEach(function(row){var n=row.split('=')[0].trim();if(n==='_ga'||n.indexOf('_ga_')===0)document.cookie=n+'=; Max-Age=0; path=/; SameSite=Lax';});}
  function loadGa(){if(!cfg.gaId||gaLoaded||document.getElementById('doloc-ga4-script'))return;window['ga-disable-'+cfg.gaId]=false;window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){dataLayer.push(arguments);};window.gtag('js',new Date());window.gtag('config',cfg.gaId);var s=document.createElement('script');s.id='doloc-ga4-script';s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(cfg.gaId);document.head.appendChild(s);gaLoaded=true;}
  function blockGa(){if(cfg.gaId)window['ga-disable-'+cfg.gaId]=true;var s=document.getElementById('doloc-ga4-script');if(s)s.remove();gaLoaded=false;clearGaCookies();}
  function ensureAdContainer(){if(!cfg.adsterra)return null;var mount=document.querySelector('[data-adsterra-mount]');if(!mount)return null;var c=document.getElementById(cfg.adsterra.containerId);if(!c){c=document.createElement('div');c.id=cfg.adsterra.containerId;mount.appendChild(c);}return c;}
  function loadAd(){if(!cfg.adsterra||adLoaded||document.getElementById('doloc-adsterra-script'))return;if(!ensureAdContainer())return;var note=document.querySelector('.native-ad-consent-note');if(note)note.remove();var s=document.createElement('script');s.id='doloc-adsterra-script';s.async=true;s.setAttribute('data-cfasync','false');s.src=cfg.adsterra.src;document.body.appendChild(s);adLoaded=true;}
  function blockAd(){var s=document.getElementById('doloc-adsterra-script');if(s)s.remove();if(cfg.adsterra){var c=document.getElementById(cfg.adsterra.containerId);if(c)c.remove();}adLoaded=false;}
  function apply(v){window.DOLOC_CONSENT_ANALYTICS=v.analytics===true;window.DOLOC_CONSENT_ADVERTISING=v.advertising===true;v.analytics?loadGa():blockGa();v.advertising?loadAd():blockAd();}
  function close(){if(dialog.open)dialog.close();document.querySelector('[data-consent-settings]').setAttribute('aria-expanded','false');if(lastFocus&&lastFocus.focus)lastFocus.focus();}
  function open(){var v=current||{analytics:false,advertising:false};lastFocus=document.activeElement;analytics.checked=v.analytics;advertising.checked=v.advertising;if(!dialog.open)dialog.showModal();document.querySelector('[data-consent-settings]').setAttribute('aria-expanded','true');dialog.querySelector('[data-consent-close]').focus();}
  document.querySelector('[data-consent-accept]').addEventListener('click',function(){persist({analytics:true,advertising:true});});
  document.querySelector('[data-consent-reject]').addEventListener('click',function(){persist({analytics:false,advertising:false});});
  document.querySelector('[data-consent-open]').addEventListener('click',open);document.querySelector('[data-consent-settings]').addEventListener('click',open);
  document.querySelector('[data-consent-close]').addEventListener('click',close);
  dialog.addEventListener('cancel',function(e){e.preventDefault();close();});
  dialog.addEventListener('keydown',function(e){if(e.key!=='Tab')return;var items=Array.prototype.slice.call(dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled])')).filter(function(el){return el.offsetParent!==null;});if(!items.length)return;var first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
  document.querySelector('[data-consent-save]').addEventListener('click',function(){persist({analytics:analytics.checked,advertising:advertising.checked});});
  document.querySelector('[data-consent-withdraw]').addEventListener('click',function(){persist({analytics:false,advertising:false});});
  document.addEventListener('keydown',function(e){if(e.key!=='Escape'||dialog.open)return;if(!banner.hidden){banner.hidden=true;document.querySelector('[data-consent-settings]').focus();}});
  current=read();if(current){banner.hidden=true;apply(current);}else{banner.hidden=false;blockGa();blockAd();}
})();
</script>`;
}
function footer(lang, { adsterraEligible = false } = {}){
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
    ${adsenseScript()}
  </div>
${decisionEventsScript()}
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
    /* 筛选维度不写死，从 DOM 里的 .ff-group[data-key] 读出来。
       这样鱼类（period/loc/req）和礼物（v）共用同一段代码，将来加第三个表也不用改这里。
       匹配一律用「空格分隔的多值包含」——单值属性走这条同样成立，行为与改动前一致。 */
    var keys = Array.prototype.slice.call(ff.querySelectorAll('.ff-group'))
                 .map(function(g){ return g.getAttribute('data-key'); });
    function fresh(){ var s = { q:'' }; keys.forEach(function(k){ s[k] = 'all'; }); return s; }
    var state = fresh();
    var countEl = ff.querySelector('.ff-count');
    var tpl = countEl ? countEl.getAttribute('data-tpl') : '';

    function matches(tr){
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i], v = state[k];
        if (v !== 'all' && (' '+(tr.getAttribute('data-'+k)||'')+' ').indexOf(' '+v+' ') < 0) return false;
      }
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
        state = fresh();
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
</footer>${consentUi(lang, adsterraEligible)}`;
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
    case "giftfilter": {
      // 礼物筛选器。和 fishfilter 同一套 DOM 约定（.ff / .ff-group[data-key] / .ff-chip[data-v]），
      // 底部那段 JS 已泛化成按 data-key 读取，所以这里只要把组名对上 rowAttrs 的键即可。
      // ⚠️ 同样是渐进增强：默认 hidden，JS 没跑时页面等同于没有筛选器。
      const u = giftUi(lang);
      const chips = ["all","universal","never","mixed","limited"].map((o,i)=>
        `<button type="button" class="ff-chip${i===0?" on":""}" data-v="${o}">${esc(u[o])}</button>`).join("");
      return `<section class="ff reveal" id="${id}" hidden>
        <div class="ff-head"><span class="furrow-tag">${esc(st.seasonTag)}</span><h2>${esc(u.title)}</h2></div>
        <p class="ff-lead">${esc(u.lead)}</p>
        <div class="ff-search"><span class="ff-search-ic" aria-hidden="true">${SVG.friendship || ""}</span>
          <input type="search" class="ff-input" placeholder="${esc(u.search)}" aria-label="${esc(u.search)}" />
        </div>
        <div class="ff-group" data-key="v"><span class="ff-label">${esc(u.v)}</span><div class="ff-chips">${chips}</div></div>
        <div class="ff-foot"><span class="ff-count" data-tpl="${esc(u.count)}"></span>
          <button type="button" class="ff-reset">${esc(u.reset)}</button></div>
      </section>`;
    }
    case "genefilter": {
      // 基因筛选器。与 fishfilter/giftfilter 同一套 DOM 约定（.ff / .ff-group[data-key] / .ff-chip[data-v]），
      // 底部 JS 已泛化：这里只需把 data-key="effect" 对上 rowAttrs 的 effect 键。
      // ⚠️ 渐进增强：默认 hidden，JS 没跑时页面等同于没有筛选器。
      const u = geneUi(lang);
      const chips = ["all","water","harvest","yield","seeds","survival","unlisted"].map((o,i)=>
        `<button type="button" class="ff-chip${i===0?" on":""}" data-v="${o}">${esc(u[o])}</button>`).join("");
      return `<section class="ff reveal" id="${id}" hidden>
        <div class="ff-head"><span class="furrow-tag">${esc(st.seasonTag)}</span><h2>${esc(u.title)}</h2></div>
        <p class="ff-lead">${esc(u.lead)}</p>
        <div class="ff-search"><span class="ff-search-ic" aria-hidden="true">${SVG["gene-system"] || ""}</span>
          <input type="search" class="ff-input" placeholder="${esc(u.search)}" aria-label="${esc(u.search)}" />
        </div>
        <div class="ff-group" data-key="effect"><span class="ff-label">${esc(u.effect)}</span><div class="ff-chips">${chips}</div></div>
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
      // 空态文案跟着表的种类走：礼物表的 rowAttrs 用 v 这个键（判定档），鱼表用 period/loc/req。
      const isGift = !!(s.rowAttrs && s.rowAttrs[0] && "v" in s.rowAttrs[0]);
      const isGene = !!(s.rowAttrs && s.rowAttrs[0] && "effect" in s.rowAttrs[0]);
      const noMatch = (isGift ? giftUi(lang) : isGene ? geneUi(lang) : fishUi(lang)).noMatch;
      return `<section class="furrow-block reveal" id="${id}"><div class="furrow-head"><span class="furrow-tag">${tag}</span><h2>${esc(s.heading)}</h2></div>${s.body?`<p class="furrow-lead">${esc(s.body)}</p>`:""}<div class="${cls}"><table><thead><tr>${headRow}</tr></thead><tbody>${rows}</tbody></table><p class="table-empty" hidden>${esc(noMatch)}</p></div></section>`;
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
     tip:L("Month 4 is Harsh Dry Season — protect crops and plan watering.","第 4 月是 Harsh Dry Season——保护作物并规划浇水。","第4月は Harsh Dry Season——作物保護と水やりを準備。","4번째 달은 Harsh Dry Season——작물 보호와 물주기를 계획하세요.","El mes 4 es Harsh Dry Season: protege cultivos y planifica el riego."),
     tasks:[L("Prepare crop protection before Month 4","第 4 月前准备作物防护","第4月前に作物保護を準備","4번째 달 전에 작물 보호 준비","Prepara protección antes del mes 4"),
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
    {label:L("Plant & Grow","种植与生长","植えて育てる","심고 기르기","Plantar y crecer"), emoji:"🌱", slugs:["how-to-play","make-money","farming","gene-system","weather"]},
    {label:L("Automate & Power","自动化与能源","自動化とエネルギー","자동화와 에너지","Automatizar y energía"), emoji:"⚙️", slugs:["automation","fishing","drone-combat"]},
    {label:L("Explore & Fight","探索与战斗","探索と戦闘","탐험과 전투","Explorar y luchar"), emoji:"🗺️", slugs:["exploration","story","characters"]},
    {label:L("Harvest & Live","收获与生活","収穫と生活","수확과 생활","Cosechar y vivir"), emoji:"🍲", slugs:["cooking","ranching","friendship","gifts","romance","achievements","mods","update-log","faq","system-requirements","steam-deck"]},
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
  return renderFull(lang, siteI18n(lang).name, s.description, [gameLd()], "index", body, "/images/hero.jpg");
}
function renderFull(lang, title, desc, extraLd, slug, body, ogImage, options = {}){
  const s = siteI18n(lang);
  return head(title, desc, extraLd, slug, lang, ogImage) + header(lang, slug === "index" ? "" : slug) + body + footer(lang, options);
}

/* ---------- article pages ---------- */
const ARTICLE_AD_EXPERIMENT = "doloc-native-ad-viewability-20260814";
const ARTICLE_AD_COHORT = new Set([
  "en:cooking", "en:fishing", "en:mods", "en:gifts",
  "ko:cooking", "ko:fishing", "ko:exploration"
]);
const AD_LABELS = { en:"Advertisement", "zh-CN":"广告", "zh-TW":"廣告", ja:"広告", ko:"광고", es:"Publicidad" };
function hasArticleAd(lang, slug){ return ARTICLE_AD_COHORT.has(`${lang}:${slug}`); }
function articleAdInsertionCount(sections){
  const list = sections || [];
  const n = list.length;
  if (n < 3) throw new Error("Article ad cohort requires at least three rendered sections");
  let count = Math.max(2, Math.min(n - 1, Math.ceil(0.60 * n)));
  for (let i = 0; i < list.length; i += 1) {
    if (!["fishfilter", "giftfilter", "genefilter"].includes(list[i].type)) continue;
    let end = i + 1;
    while (end < list.length && list[end].type === "table") end += 1;
    const startOneBased = i + 1;
    const endOneBased = end;
    if (count >= startOneBased && count <= endOneBased) count = endOneBased;
  }
  return Math.min(count, n - 1);
}
function renderArticleAd(lang){
  const label = AD_LABELS[lang] || AD_LABELS.en;
  const consent = (CONSENT_UI[lang] || CONSENT_UI.en).adBlocked;
  if (!ADSTERRA_CONFIG) return "";
  return `<aside class="native-ad-slot" aria-label="${esc(label)}" data-ad-placement="article-mid-late" data-experiment="${ARTICLE_AD_EXPERIMENT}">
    <span class="native-ad-label">${esc(label)}</span>
    <div data-adsterra-mount><p class="native-ad-consent-note">${esc(consent)}</p><div id="${esc(ADSTERRA_CONFIG.containerId)}"></div></div>
  </aside>`;
}
function renderPage(lang, page){
  const t = Object.assign(pageOf(page, lang), {slug: page.slug});
  const prefix = lang === DEF ? "" : `/${lang}`;
  SEC_IDX = 0;
  const toc = (t.sections||[]).filter(x=>x.heading).map((x,i)=>{
    SEC_IDX += 1;
    return `<a href="#sec-${SEC_IDX}"><span class="toc-no">${String(SEC_IDX).padStart(2,"0")}</span>${esc(x.heading)}</a>`;
  }).join("");
  SEC_IDX = 0;
  const eligibleArticleAd = hasArticleAd(lang, page.slug);
  const adInsertionCount = eligibleArticleAd ? articleAdInsertionCount(t.sections) : -1;
  const sections2 = (t.sections||[]).map((x, i) => {
    const rendered = renderSection(x, lang);
    return rendered + (eligibleArticleAd && i + 1 === adInsertionCount ? renderArticleAd(lang) : "");
  }).join("");
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
        ${renderStoreComparison(lang, page)}
        ${sections2}
        ${renderBuyEntry(lang, page)}
        ${renderAmazonAffiliate(lang)}
        ${sources ? `<div class="sources reveal"><b>${esc(s.sources)}</b><ul>${sources}</ul>${affNote}</div>` : ""}
      </div>
      <aside class="manual-side">
        <div class="plot-meta reveal">
          <span class="cm-tag">${esc(s.plotTag)}</span>
          <div class="cm-row"><span class="cm-k">${esc(lang==="en"?"Page":lang==="ja"?"ページ":lang==="ko"?"페이지":lang==="es"?"Página":"页面")}</span><b>${esc(t.title)}</b></div>
          <div class="cm-row"><span class="cm-k">${esc(lang==="en"?"Category":lang==="ja"?"分類":lang==="ko"?"분류":lang==="es"?"Categoría":"分类")}</span><b>${esc(t.title.split(":")[0].split("—")[0].trim())}</b></div>
          <div class="cm-row"><span class="cm-k">${esc(updLabel(lang))}</span><b>${today}</b></div>
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
  return renderFull(lang, t.metaTitle || t.title, t.metaDescription, extraLd, page.slug, body, heroImg || DATA.site.ogImage, { adsterraEligible: eligibleArticleAd });
}
function gnameOf(lang){ return (DATA.game.nameI18n && DATA.game.nameI18n[lang]) || DATA.game.name; }

/* ---------- static pages ---------- */
function renderStatic(lang, slug, title, body, descOverride){
  const prefix = lang === DEF ? "" : `/${lang}`;
  const s = siteI18n(lang);
  const desc = descOverride || KIT.staticDesc(slug, lang, s.name, title);
  return renderFull(lang, title, desc, [breadcrumbLd({slug,title}, lang)], slug, `<main class="container"><div class="article-wrap single"><article><div class="page-hero reveal"><span class="evidence-tag">${esc(s.plotTag)} // ${esc(slug.toUpperCase())}</span><h1>${esc(title)}</h1></div>${body}</article></div></main>`);
}
const PRIVACY_DESC = {
  en: n => `Privacy policy for ${n}: which analytics and advertising services load or are configured, how cookies work, and how to control them.`,
  "zh-CN": n => `关于${n}的隐私政策：哪些分析与广告服务会加载或仅已配置、Cookie 如何使用，以及如何控制。`,
  "zh-TW": n => `關於${n}的隱私政策：哪些分析與廣告服務會載入或僅已設定、Cookie 如何使用，以及如何控制。`,
  ja: n => `${n}のプライバシーポリシー：読み込まれるものと設定のみの分析・広告サービス、Cookie の使い方と制御方法について。`,
  ko: n => `${n} 개인정보 처리방침: 로드되는 분석·광고 서비스와 설정만 된 서비스, 쿠키 사용 방식과 통제 방법을 안내합니다.`,
  es: n => `Política de privacidad de ${n}: servicios de análisis o publicidad cargados o configurados, cookies y controles.`
};
const privacyDescOf = (lang, siteName) => (PRIVACY_DESC[lang] || PRIVACY_DESC.en)(siteName);
const PRIVACY_SERVICE_SECTIONS = {
  en: `<h2 style="font-size:1.05rem;margin:18px 0 8px">What we collect</h2><p>This site loads Google Analytics (GA4) for analytics and loads Adsterra (effectivecpmnetwork) advertising on the seven eligible guide pages. Google AdSense account metadata and ads.txt are configured, but its serving script is gated off unless serving, provider readiness and certified CMP readiness are all explicitly enabled. Configuration does not mean that AdSense ads are currently serving. The active services may process your IP address, browser and device information, the pages you visit, the referring page, an approximate region, and cookies or similar identifiers for analytics, advertising, fraud prevention and reporting.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Cookies and identifiers</h2><p>Google Analytics and eligible-page Adsterra may set cookies or similar identifiers. If Google AdSense serving is enabled later, it may also use advertising identifiers under Google's policies. You can block or delete cookies in your browser settings and opt out of Google Analytics with the <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener">Google Analytics opt-out browser add-on</a>. This site does not show a consent banner and does not claim that consent for third-party tracking has been obtained.</p>`,
  "zh-CN": `<h2 style="font-size:1.05rem;margin:18px 0 8px">我们收集什么</h2><p>本站会加载用于分析的 Google Analytics（GA4），并在 7 个符合条件的攻略页加载 Adsterra（effectivecpmnetwork）广告。Google AdSense 账户元数据与 ads.txt 已配置，但只有在投放、服务商就绪和认证 CMP 就绪三个条件都被明确开启时，才会加载 AdSense 投放脚本。已配置不代表 AdSense 广告目前正在投放。正在加载的服务可能处理您的 IP 地址、浏览器与设备信息、访问页面、来源页面、大致地区及 Cookie 或类似标识符，用于分析与广告、防欺诈及报告。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Cookie 与标识符</h2><p>Google Analytics 与符合条件页面上的 Adsterra 可能设置 Cookie 或类似标识符。如果日后开启 Google AdSense 投放，它也可能依据 Google 政策使用广告标识符。您可以在浏览器设置中阻止或删除 Cookie，也可以安装 <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener">Google Analytics 停用浏览器插件</a> 选择退出 Google Analytics。本站未显示同意横幅，也不声称已获得任何第三方跟踪同意。</p>`,
  "zh-TW": `<h2 style="font-size:1.05rem;margin:18px 0 8px">我們收集什麼</h2><p>本站會載入用於分析的 Google Analytics（GA4），並在 7 個符合條件的攻略頁載入 Adsterra（effectivecpmnetwork）廣告。Google AdSense 帳戶後設資料與 ads.txt 已設定，但只有在投放、服務商就緒和認證 CMP 就緒三個條件都被明確開啟時，才會載入 AdSense 投放腳本。已設定不代表 AdSense 廣告目前正在投放。正在載入的服務可能處理您的 IP 位址、瀏覽器與裝置資訊、造訪頁面、來源頁面、大致地區及 Cookie 或類似識別碼，用於分析與廣告、防詐欺及報告。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Cookie 與識別碼</h2><p>Google Analytics 與符合條件頁面上的 Adsterra 可能設定 Cookie 或類似識別碼。如果日後開啟 Google AdSense 投放，它也可能依 Google 政策使用廣告識別碼。您可以在瀏覽器設定中封鎖或刪除 Cookie，也可以安裝 <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener">Google Analytics 停用瀏覽器外掛</a> 選擇退出 Google Analytics。本站未顯示同意橫幅，也不聲稱已獲得任何第三方追蹤同意。</p>`,
  ja: `<h2 style="font-size:1.05rem;margin:18px 0 8px">収集する情報</h2><p>本サイトは分析用の Google Analytics（GA4）を読み込み、7 つの対象攻略ページで Adsterra（effectivecpmnetwork）広告を読み込みます。Google AdSense のアカウント用メタデータと ads.txt は設定済みですが、配信、プロバイダー準備、認定 CMP 準備の 3 条件がすべて明示的に有効化されない限り、AdSense 配信スクリプトは読み込まれません。設定済みであることは、現在 AdSense 広告が配信中であることを意味しません。読み込まれるサービスは、IP アドレス、ブラウザー・端末情報、閲覧ページ、参照元、おおよその地域、Cookie や類似の識別子を、分析と広告、不正防止、レポートのために処理する場合があります。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Cookie と識別子</h2><p>Google Analytics と対象ページの Adsterra は Cookie や類似の識別子を設定する場合があります。将来 Google AdSense 配信を有効化した場合は、Google のポリシーに従って広告識別子を利用する可能性もあります。ブラウザー設定で Cookie をブロック・削除できるほか、<a href="https://tools.google.com/dlpage/gaoptout" rel="noopener">Google Analytics オプトアウトアドオン</a>で Google Analytics を無効化できます。本サイトは同意バナーを表示しておらず、第三者によるトラッキングの同意を得たとは主張しません。</p>`,
  ko: `<h2 style="font-size:1.05rem;margin:18px 0 8px">수집하는 정보</h2><p>본 사이트는 분석용 Google Analytics(GA4)를 로드하고, 대상 가이드 7개에서 Adsterra(effectivecpmnetwork) 광고를 로드합니다. Google AdSense 계정 메타데이터와 ads.txt는 설정되어 있지만, 광고 게재, 공급자 준비, 인증 CMP 준비의 세 조건이 모두 명시적으로 활성화되지 않으면 AdSense 게재 스크립트는 로드되지 않습니다. 설정되었다고 해서 현재 AdSense 광고가 게재 중이라는 뜻은 아닙니다. 로드되는 서비스는 IP 주소, 브라우저·기기 정보, 방문 페이지, 유입 경로, 대략적인 지역, 쿠키나 유사 식별자를 분석과 광고, 사기 방지, 보고 목적으로 처리할 수 있습니다.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">쿠키 및 식별자</h2><p>Google Analytics와 대상 페이지의 Adsterra는 쿠키나 유사 식별자를 설정할 수 있습니다. 향후 Google AdSense 게재를 활성화하면 Google 정책에 따라 광고 식별자를 사용할 수도 있습니다. 브라우저 설정에서 쿠키를 차단·삭제할 수 있고, <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener">Google Analytics 차단 부가기능</a>으로 Google Analytics를 거부할 수 있습니다. 본 사이트는 동의 배너를 표시하지 않으며, 제3자 추적에 대한 동의를 받았다고 주장하지 않습니다.</p>`,
  es: `<h2 style="font-size:1.05rem;margin:18px 0 8px">Qué recopilamos</h2><p>Este sitio carga Google Analytics (GA4) para análisis y publicidad de Adsterra (effectivecpmnetwork) en las siete guías que cumplen los criterios. Los metadatos de cuenta de Google AdSense y ads.txt están configurados, pero su script de publicación permanece bloqueado salvo que se habiliten expresamente la publicación, la preparación del proveedor y la de un CMP certificado. La configuración no significa que los anuncios de AdSense se estén publicando ahora. Los servicios activos pueden procesar tu dirección IP, información del navegador o dispositivo, las páginas visitadas, la referencia, una región aproximada y cookies o identificadores similares para análisis y publicidad, prevención de fraude e informes.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Cookies e identificadores</h2><p>Google Analytics y Adsterra en las páginas aptas pueden instalar cookies o identificadores similares. Si Google AdSense se habilita más adelante, también podrá usar identificadores publicitarios según las políticas de Google. Puedes bloquear o eliminar cookies en la configuración del navegador y excluirte de Google Analytics con el <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener">complemento de exclusión de Google Analytics</a>. Este sitio no muestra un banner de consentimiento ni afirma haber obtenido consentimiento para el rastreo de terceros.</p>`,
};
const PRIVACY_CONSENT_SECTIONS = {
  en: `<h2 style="font-size:1.05rem;margin:18px 0 8px">Optional services and data</h2><p>Google Analytics (GA4) is available for audience measurement on every page. Adsterra (effectivecpmnetwork) advertising is available only on seven eligible guide pages. Until you choose, neither service is requested. If you accept, GA4 may process your IP address, browser and device information, visited page, referrer, approximate region, and cookies or similar identifiers for analytics and reporting; on an eligible guide, Adsterra may process the same categories for advertising, fraud prevention and reporting. Reject keeps both blocked.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Your controls</h2><p>The initial privacy panel offers accept, reject and detailed settings. The always-visible Privacy settings button lets you change individual preferences or withdraw all consent. Withdrawal blocks future GA4 and Adsterra requests on this site and removes accessible GA cookies where the browser permits. You may also use the <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener">Google Analytics opt-out add-on</a>. Google AdSense metadata and ads.txt are configured, but its serving script remains gated off unless serving, provider readiness and certified CMP readiness are all explicitly enabled; configuration does not mean that AdSense ads are currently serving.</p>`,
  "zh-CN": `<h2 style="font-size:1.05rem;margin:18px 0 8px">可选服务与数据</h2><p>Google Analytics（GA4）可在所有页面用于受众分析；Adsterra（effectivecpmnetwork）广告仅可在 7 个符合条件的攻略页使用。在您选择前，本站不会请求这两项服务。接受后，GA4 可能处理 IP 地址、浏览器与设备信息、访问页面、来源页面、大致地区以及 Cookie 或类似标识符，用于分析和报告；在符合条件的攻略页上，Adsterra 可能为广告、防欺诈和报告处理相同类别。拒绝会继续阻止两者。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">您的控制方式</h2><p>首次隐私面板提供接受、拒绝和详细设置。始终可见的“隐私设置”按钮可单独更改偏好或全部撤回。撤回后，本站会阻止后续 GA4 与 Adsterra 请求，并在浏览器允许时删除可访问的 GA Cookie。您也可使用 <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener">Google Analytics 停用浏览器插件</a>。Google AdSense 元数据与 ads.txt 已配置，但只有投放、服务商就绪和认证 CMP 就绪三个条件都明确开启时才会加载投放脚本；已配置不代表 AdSense 广告目前正在投放。</p>`,
  "zh-TW": `<h2 style="font-size:1.05rem;margin:18px 0 8px">選用服務與資料</h2><p>Google Analytics（GA4）可在所有頁面用於受眾分析；Adsterra（effectivecpmnetwork）廣告只可在 7 個符合條件的攻略頁使用。在您選擇前，本站不會請求這兩項服務。接受後，GA4 可能處理 IP 位址、瀏覽器與裝置資訊、造訪頁面、來源頁面、大致地區，以及 Cookie 或類似識別碼，用於分析與報告；在符合條件的攻略頁上，Adsterra 可能為廣告、防詐欺與報告處理相同類別。拒絕會繼續封鎖兩者。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">您的控制方式</h2><p>首次隱私面板提供接受、拒絕與詳細設定。永遠可見的「隱私設定」按鈕可個別變更偏好或全部撤回。撤回後，本站會封鎖後續 GA4 與 Adsterra 請求，並在瀏覽器允許時刪除可存取的 GA Cookie。您也可使用 <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener">Google Analytics 停用瀏覽器外掛</a>。Google AdSense 後設資料與 ads.txt 已設定，但只有投放、服務商就緒及認證 CMP 就緒三個條件都明確開啟時才會載入投放指令碼；已設定不代表目前正在投放。</p>`,
  ja: `<h2 style="font-size:1.05rem;margin:18px 0 8px">任意サービスとデータ</h2><p>Google Analytics（GA4）は全ページの利用状況分析に、Adsterra（effectivecpmnetwork）広告は対象となる 7 つの攻略ページだけで利用できます。選択前はどちらにもリクエストしません。許可すると、GA4 は分析・レポートのため IP アドレス、ブラウザー・端末情報、閲覧ページ、参照元、おおよその地域、Cookie や類似識別子を処理する場合があります。対象ページでは Adsterra が広告、不正防止、レポートのため同じ種類を処理する場合があります。拒否すると両方をブロックします。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">設定と撤回</h2><p>最初のパネルで許可、拒否、詳細設定を選べます。常に表示される「プライバシー設定」から個別設定の変更や全撤回ができます。撤回後は今後の GA4 と Adsterra リクエストをブロックし、ブラウザーが許す範囲で GA Cookie を削除します。Google AdSense のメタデータと ads.txt は設定済みですが、配信、プロバイダー準備、認定 CMP 準備がすべて明示的に有効になるまで配信スクリプトは読み込まれません。設定済みでも現在の配信を意味しません。</p>`,
  ko: `<h2 style="font-size:1.05rem;margin:18px 0 8px">선택 서비스 및 데이터</h2><p>Google Analytics(GA4)는 모든 페이지의 이용 분석에 사용할 수 있고, Adsterra(effectivecpmnetwork) 광고는 대상 가이드 7개에서만 사용할 수 있습니다. 선택 전에는 두 서비스 모두 요청하지 않습니다. 허용하면 GA4가 분석 및 보고를 위해 IP 주소, 브라우저·기기 정보, 방문 페이지, 유입 경로, 대략적 지역, 쿠키나 유사 식별자를 처리할 수 있습니다. 대상 페이지에서는 Adsterra가 광고, 사기 방지 및 보고를 위해 같은 범주를 처리할 수 있습니다. 거부하면 둘 다 계속 차단됩니다.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">설정 및 철회</h2><p>첫 개인정보 패널에서 허용, 거부 또는 상세 설정을 선택할 수 있습니다. 항상 보이는 개인정보 설정 버튼에서 개별 선택을 변경하거나 모두 철회할 수 있습니다. 철회 후에는 향후 GA4 및 Adsterra 요청을 차단하고 브라우저가 허용하는 GA 쿠키를 삭제합니다. Google AdSense 메타데이터와 ads.txt는 설정되어 있지만 게재, 공급자 준비, 인증 CMP 준비가 모두 명시적으로 활성화되기 전에는 게재 스크립트를 로드하지 않습니다. 설정만으로 현재 게재 중이라는 뜻은 아닙니다.</p>`,
  es: `<h2 style="font-size:1.05rem;margin:18px 0 8px">Servicios opcionales y datos</h2><p>Google Analytics (GA4) puede usarse para medir la audiencia en todas las páginas. La publicidad de Adsterra (effectivecpmnetwork) solo puede usarse en siete guías aptas. Antes de elegir, no se solicita ninguno. Si aceptas, GA4 puede tratar la dirección IP, datos del navegador y dispositivo, página visitada, referencia, región aproximada y cookies o identificadores similares para análisis e informes; en una guía apta, Adsterra puede tratar las mismas categorías para publicidad, prevención del fraude e informes. Rechazar mantiene ambos bloqueados.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Tus controles</h2><p>El panel inicial ofrece aceptar, rechazar y ajustes detallados. El botón siempre visible de Ajustes de privacidad permite cambiar preferencias o retirar todo. Tras retirar, se bloquean futuras solicitudes de GA4 y Adsterra y se eliminan las cookies de GA accesibles cuando el navegador lo permite. Los metadatos de Google AdSense y ads.txt están configurados, pero su script sigue bloqueado hasta que publicación, proveedor y CMP certificado estén listos y habilitados expresamente; estar configurado no significa que publique anuncios ahora.</p>`,
};
const PRIVACY_CMP_BOUNDARY = {
  en: `<p><strong>CMP boundary:</strong> This is a first-party preference control. It is not presented as a Google-certified CMP and does not enable AdSense serving.</p>`,
  "zh-CN": `<p><strong>CMP 边界：</strong>这是本站自有的偏好控制，不会被表述为 Google 认证 CMP，也不会开启 AdSense 投放。</p>`,
  "zh-TW": `<p><strong>CMP 邊界：</strong>這是本站自有的偏好控制，不會被表述為 Google 認證 CMP，也不會開啟 AdSense 投放。</p>`,
  ja: `<p><strong>CMP の範囲：</strong>これは本サイト独自の設定機能です。Google 認定 CMP とは表示せず、AdSense 配信を有効にするものでもありません。</p>`,
  ko: `<p><strong>CMP 범위:</strong> 이 기능은 사이트 자체 선택 설정입니다. Google 인증 CMP라고 표시하지 않으며 AdSense 게재를 활성화하지 않습니다.</p>`,
  es: `<p><strong>Límite del CMP:</strong> Este es un control propio de preferencias. No se presenta como CMP certificado por Google ni activa la publicación de AdSense.</p>`,
};
const PRIVACY_THIRD_PARTY_HEADING = {
  en: "Third-party services", "zh-CN": "第三方服务", "zh-TW": "第三方服務",
  ja: "第三者サービス", ko: "제3자 서비스", es: "Servicios de terceros",
};
function genStatic(lang){
  const s = siteI18n(lang);
  const dir = path.join(OUT, lang === DEF ? "" : lang);
  const aboutPoints = (DATA.game.aboutPointsI18n && DATA.game.aboutPointsI18n[lang]) || DATA.game.aboutPoints || [];
  const aboutBody = `<p>${esc(s.aboutText)}</p><h2 style="font-size:1.05rem;margin:18px 0 8px">${esc(s.aboutSources)}</h2><ul class="checks">${aboutPoints.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`;
  writePage(path.join(dir,"about.html"), "about", lang, renderStatic(lang,"about", s.aboutTitle,
    aboutBody + `<section class="card">` + KIT.editorialPolicy(lang, { siteName: s.name, contactEmail: `contact@${DATA.site.domain}` }) + `</section>`));
  const privacyBodyLegacy = lang==="zh-CN"
    ? `<p>这是游戏攻略网站，我们尊重访问者隐私。以下说明我们收集什么、如何使用。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">我们收集什么</h2><p>本站会加载用于分析与广告的第三方脚本：Google Analytics（GA4）、Google AdSense 与 Adsterra（effectivecpmnetwork）。这些服务可能处理您的 IP 地址、浏览器与设备信息、您访问的页面、来源页面、大致地区，以及 Cookie 或类似标识符。相关信息用于分析、广告、防欺诈与报告。正常浏览攻略时我们不会主动索取您的姓名或邮箱，我们也不出售访客数据。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Cookie 与标识符</h2><p>上述服务可能在您的设备上设置 Cookie 或类似标识符。您可以在浏览器设置中阻止或删除 Cookie，也可以安装 <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener">Google Analytics 停用浏览器插件</a> 选择退出 Google Analytics。本站未显示同意横幅，也不声称已获得任何第三方跟踪同意。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">第三方服务</h2><p>字体来自 Google Fonts，站点由 Cloudflare CDN 提供服务。这些服务商可能记录标准访问日志（如 IP 地址、用户代理与时间），并遵循各自的保留政策；我们无法控制其保留期限。请查看相关隐私政策：<a href="https://policies.google.com/privacy" rel="noopener">Google 隐私政策</a>（Google Analytics 与 AdSense）、<a href="https://policies.google.com/technologies/ads" rel="noopener">Google 广告技术</a>、<a href="https://adsterra.com/privacy-policy/" rel="noopener">Adsterra 隐私政策</a>、<a href="https://developers.google.com/fonts/faq" rel="noopener">Google Fonts FAQ</a> 与 <a href="https://www.cloudflare.com/privacypolicy/" rel="noopener">Cloudflare 隐私政策</a>。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">联系我们</h2><p>隐私问题请邮件 <a href="mailto:contact@${esc(DATA.site.domain)}">contact@${esc(DATA.site.domain)}</a>。</p><p style="margin-top:14px;opacity:.75">生效日期：${today}</p>`
    : lang==="zh-TW"
    ? `<p>這是遊戲攻略網站，我們尊重訪問者隱私。以下說明我們收集什麼、如何使用。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">我們收集什麼</h2><p>本站會載入用於分析與廣告的第三方腳本：Google Analytics（GA4）、Google AdSense 與 Adsterra（effectivecpmnetwork）。這些服務可能處理您的 IP 位址、瀏覽器與裝置資訊、您造訪的頁面、來源頁面、大致地區，以及 Cookie 或類似識別碼。相關資訊用於分析、廣告、防詐欺與報告。正常瀏覽攻略時我們不會主動索取您的姓名或電子郵件，我們也不出售訪客資料。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Cookie 與識別碼</h2><p>上述服務可能在您的裝置上設定 Cookie 或類似識別碼。您可以在瀏覽器設定中封鎖或刪除 Cookie，也可以安裝 <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener">Google Analytics 停用瀏覽器外掛</a> 選擇退出 Google Analytics。本站未顯示同意橫幅，也不聲稱已獲得任何第三方追蹤同意。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">第三方服務</h2><p>字型來自 Google Fonts，網站由 Cloudflare CDN 提供服務。這些服務商可能記錄標準存取記錄（如 IP 位址、使用者代理與時間），並遵循各自的保留政策；我們無法控制其保留期限。請查看相關隱私政策：<a href="https://policies.google.com/privacy" rel="noopener">Google 隱私政策</a>（Google Analytics 與 AdSense）、<a href="https://policies.google.com/technologies/ads" rel="noopener">Google 廣告技術</a>、<a href="https://adsterra.com/privacy-policy/" rel="noopener">Adsterra 隱私政策</a>、<a href="https://developers.google.com/fonts/faq" rel="noopener">Google Fonts FAQ</a> 與 <a href="https://www.cloudflare.com/privacypolicy/" rel="noopener">Cloudflare 隱私政策</a>。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">聯絡我們</h2><p>隱私問題請寄電子郵件至 <a href="mailto:contact@${esc(DATA.site.domain)}">contact@${esc(DATA.site.domain)}</a>。</p><p style="margin-top:14px;opacity:.75">生效日期：${today}</p>`
    : lang==="ko"
    ? `<p>이곳은 게임 공략 사이트이며 방문자의 개인정보를 존중합니다. 수집 항목과 사용 방식을 설명합니다.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">수집하는 정보</h2><p>이 사이트는 분석과 광고를 위해 제3자 스크립트(Google Analytics(GA4), Google AdSense, Adsterra(effectivecpmnetwork))를 로드합니다. 이 서비스들은 IP 주소, 브라우저·기기 정보, 방문한 페이지, 유입 경로, 대략적 지역, 쿠키나 유사 식별자를 처리할 수 있습니다. 정보는 분석, 광고, 사기 방지, 보고 목적으로 사용됩니다. 일반적인 공략 페이지를 보는 동안 이름이나 이메일을 요구하지 않으며, 방문자 데이터를 판매하지 않습니다.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">쿠키 및 식별자</h2><p>위 서비스들은 사용자 기기에 쿠키나 유사 식별자를 설정할 수 있습니다. 브라우저 설정에서 쿠키를 차단·삭제할 수 있고, <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener">Google Analytics 차단 부가기능</a>으로 Google Analytics를 거부할 수 있습니다. 본 사이트는 동의 배너를 표시하지 않으며, 제3자 추적에 대한 동의를 받았다고 주장하지 않습니다.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">제3자 서비스</h2><p>글꼴은 Google Fonts에서, 사이트는 Cloudflare CDN으로 제공됩니다. 이 사업자들은 표준 접속 로그(IP 주소, 사용자 에이전트, 시간 등)를 기록하고 각자의 보존 정책을 따르며, 보존 기간을 당사가 통제할 수 없습니다. 관련 개인정보 처리방침을 확인하세요: <a href="https://policies.google.com/privacy" rel="noopener">Google 개인정보처리방침</a>(Google Analytics 및 AdSense), <a href="https://policies.google.com/technologies/ads" rel="noopener">Google 광고 기술</a>, <a href="https://adsterra.com/privacy-policy/" rel="noopener">Adsterra 개인정보 처리방침</a>, <a href="https://developers.google.com/fonts/faq" rel="noopener">Google Fonts FAQ</a>, <a href="https://www.cloudflare.com/privacypolicy/" rel="noopener">Cloudflare 개인정보 처리방침</a>.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">문의</h2><p>개인정보 관련 질문은 <a href="mailto:contact@${esc(DATA.site.domain)}">contact@${esc(DATA.site.domain)}</a>로 보내주세요.</p><p style="margin-top:14px;opacity:.75">발효일: ${today}</p>`
    : lang==="es"
    ? `<p>Este es un sitio web de guías de juegos y respetamos la privacidad de los visitantes. Esta política explica qué recopilamos y cómo se usa.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Qué recopilamos</h2><p>Este sitio carga scripts de terceros para análisis y publicidad: Google Analytics (GA4), Google AdSense y Adsterra (effectivecpmnetwork). Estos servicios pueden procesar tu dirección IP, información del navegador o del dispositivo, las páginas que visitas, la página de referencia, una región aproximada y cookies o identificadores similares. La información se usa para análisis, publicidad, prevención de fraude e informes. Navegar por las guías no requiere que facilites tu nombre o correo, y no vendemos datos de visitantes.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Cookies e identificadores</h2><p>Los servicios mencionados pueden instalar cookies o identificadores similares en tu dispositivo. Puedes bloquear o eliminar cookies en la configuración del navegador y puedes excluirte de Google Analytics con el <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener">complemento de exclusión de Google Analytics</a>. Este sitio no muestra un banner de consentimiento ni afirma haber obtenido consentimiento para el rastreo de terceros.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Servicios de terceros</h2><p>Las fuentes se cargan desde Google Fonts y el sitio se sirve a través de Cloudflare CDN. Estos proveedores pueden registrar registros de acceso estándar (como dirección IP, agente de usuario y hora) y siguen sus propias políticas de retención, que no controlamos. Consulta las políticas de privacidad de los proveedores que utilizamos: <a href="https://policies.google.com/privacy" rel="noopener">Política de privacidad de Google</a> (Google Analytics y AdSense), <a href="https://policies.google.com/technologies/ads" rel="noopener">Tecnologías publicitarias de Google</a>, <a href="https://adsterra.com/privacy-policy/" rel="noopener">Política de privacidad de Adsterra</a>, <a href="https://developers.google.com/fonts/faq" rel="noopener">FAQ de Google Fonts</a> y <a href="https://www.cloudflare.com/privacypolicy/" rel="noopener">Política de privacidad de Cloudflare</a>.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Contacto</h2><p>Para preguntas de privacidad, escribe a <a href="mailto:contact@${esc(DATA.site.domain)}">contact@${esc(DATA.site.domain)}</a>.</p><p style="margin-top:14px;opacity:.75">Fecha de entrada en vigor: ${today}</p>`
    : lang==="ja"
    ? `<p>これはゲーム攻略サイトです。訪問者のプライバシーを尊重します。以下、収集内容と利用方法を説明します。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">収集する情報</h2><p>このサイトは分析と広告のために第三者スクリプト（Google Analytics（GA4）、Google AdSense、Adsterra（effectivecpmnetwork））を読み込みます。これらのサービスは、IP アドレス、ブラウザー・端末情報、閲覧したページ、参照元、おおよその地域、Cookie や類似の識別子を処理する可能性があります。情報は分析、広告、不正防止、レポートのために利用されます。通常の攻略ページの閲覧では氏名やメールアドレスの入力は求めません。訪問者データを販売することはありません。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Cookie と識別子</h2><p>上記のサービスはお使いの端末に Cookie や類似の識別子を設定する場合があります。ブラウザー設定で Cookie をブロック・削除できるほか、<a href="https://tools.google.com/dlpage/gaoptout" rel="noopener">Google Analytics オプトアウトアドオン</a>で Google Analytics を無効化できます。本サイトは同意バナーを表示しておらず、第三者によるトラッキングの同意を得たとは主張しません。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">第三者サービス</h2><p>フォントは Google Fonts から、サイトは Cloudflare の CDN から提供されています。これらの事業者は標準的なアクセスログ（IP アドレス・ユーザーエージェント・時刻など）を記録し、それぞれの保存ポリシーに従います。保存期間を当サイトが管理することはできません。関連するプライバシーポリシーをご確認ください：<a href="https://policies.google.com/privacy" rel="noopener">Google プライバシーポリシー</a>（Google Analytics と AdSense）、<a href="https://policies.google.com/technologies/ads" rel="noopener">Google 広告テクノロジー</a>、<a href="https://adsterra.com/privacy-policy/" rel="noopener">Adsterra プライバシーポリシー</a>、<a href="https://developers.google.com/fonts/faq" rel="noopener">Google Fonts FAQ</a>、<a href="https://www.cloudflare.com/privacypolicy/" rel="noopener">Cloudflare プライバシーポリシー</a>。</p><h2 style="font-size:1.05rem;margin:18px 0 8px">お問い合わせ</h2><p>プライバシーに関する質問は <a href="mailto:contact@${esc(DATA.site.domain)}">contact@${esc(DATA.site.domain)}</a> まで。</p><p style="margin-top:14px;opacity:.75">発効日：${today}</p>`
    : `<p>This is a game guide website and we respect visitor privacy. This policy explains what we collect and how it is used.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">What we collect</h2><p>This site loads third-party scripts for analytics and advertising: Google Analytics (GA4), Google AdSense and Adsterra (effectivecpmnetwork). These services may process your IP address, browser and device information, the pages you visit, the referring page, an approximate region, and cookies or similar identifiers. The information is used for analytics, advertising, fraud prevention and reporting. Browsing the guides does not require you to provide your name or email address, and we do not sell visitor data.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Cookies and identifiers</h2><p>The services mentioned above may set cookies or similar identifiers on your device. You can block or delete cookies in your browser settings, and you can opt out of Google Analytics with the <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener">Google Analytics opt-out browser add-on</a>. This site does not show a consent banner and does not claim that consent for third-party tracking has been obtained.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Third-party services</h2><p>Fonts are loaded from Google Fonts and the site is served through Cloudflare's CDN. These providers may record standard access logs (such as IP address, user agent and time) and follow their own retention policies, which we do not control. Please review the privacy policies of the providers we use: <a href="https://policies.google.com/privacy" rel="noopener">Google Privacy Policy</a> (Google Analytics and AdSense), <a href="https://policies.google.com/technologies/ads" rel="noopener">Google Ads technologies</a>, <a href="https://adsterra.com/privacy-policy/" rel="noopener">Adsterra Privacy Policy</a>, <a href="https://developers.google.com/fonts/faq" rel="noopener">Google Fonts FAQ</a> and <a href="https://www.cloudflare.com/privacypolicy/" rel="noopener">Cloudflare Privacy Policy</a>.</p><h2 style="font-size:1.05rem;margin:18px 0 8px">Contact</h2><p>For privacy questions, email <a href="mailto:contact@${esc(DATA.site.domain)}">contact@${esc(DATA.site.domain)}</a>.</p><p style="margin-top:14px;opacity:.75">Effective date: ${today}</p>`;
  const firstHeading = privacyBodyLegacy.indexOf("<h2");
  const thirdHeading = `<h2 style="font-size:1.05rem;margin:18px 0 8px">${PRIVACY_THIRD_PARTY_HEADING[lang] || PRIVACY_THIRD_PARTY_HEADING.en}</h2>`;
  const thirdHeadingAt = privacyBodyLegacy.indexOf(thirdHeading);
  if (firstHeading < 0 || thirdHeadingAt < 0) throw new Error(`Privacy section boundary missing for ${lang}`);
  const privacyBody = privacyBodyLegacy.slice(0, firstHeading) +
    (PRIVACY_CONSENT_SECTIONS[lang] || PRIVACY_CONSENT_SECTIONS.en) +
    (PRIVACY_CMP_BOUNDARY[lang] || PRIVACY_CMP_BOUNDARY.en) +
    privacyBodyLegacy.slice(thirdHeadingAt);
  writePage(path.join(dir,"privacy.html"), "privacy", lang, renderStatic(lang,"privacy", s.privacyTitle, privacyBody, privacyDescOf(lang, s.name)));
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
  fs.writeFileSync(path.join(OUT,"404.html"), `<!DOCTYPE html><html lang="${LANG_META[DEF].html}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>404 - ${esc(s404.name)}</title><meta name="robots" content="noindex" />${FAVICON_LINKS}${adsenseMeta()}<link rel="stylesheet" href="/css/style.css?v=${CSS_V}"></head><body>${header(DEF,"")}<main class="container" style="padding-top:70px;text-align:center"><section class="card grow-card" style="max-width:560px;margin:0 auto"><h1 style="font-size:3rem">404</h1><p>This page doesn't exist. Try one of these guides instead:</p><div style="margin:18px 0">${pop404}</div><p><a class="btn btn-primary" href="/">← Back to Home</a></p></section></main>${footer(DEF)}</body></html>`);
}

/* ---------- JSON-LD ---------- */
const siteLd = lang => ({"@context":"https://schema.org","@type":"WebSite",name:siteI18n(lang).name,url:urlOf("index",lang),description:siteI18n(lang).description});
function isoDate(str){
  const m=/([A-Za-z]+) (\d+), (\d+)/.exec(str||"")||[];
  const mo={Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12,January:1,February:2,March:3,April:4,May:5,June:6,July:7,August:8,September:9,October:10,November:11,December:12};
  return m[3] ? `${m[3]}-${String(mo[m[1]]||0).padStart(2,"0")}-${String(m[2]).padStart(2,"0")}` : today;
}
function gameLd(){
  return {"@context":"https://schema.org","@type":"VideoGame",name:DATA.game.name,description:DATA.game.intro,url:DATA.game.steamUrl,applicationCategory:"Game",operatingSystem:"Windows",genre:DATA.game.genre,datePublished:isoDate(DATA.game.releaseDate),inLanguage:"en",offers:{"@type":"Offer",price:DATA.game.price,priceCurrency:"USD",availability:"https://schema.org/InStock"}};
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
