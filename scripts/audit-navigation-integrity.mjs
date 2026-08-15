#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const auditScript = fileURLToPath(import.meta.url);
const root = path.resolve(process.argv[2] || ".");
const fault = process.env.DOLOC_NAV_AUDIT_FAULT || "";
const failures = [];
const fail = (code, detail) => failures.push({ code, detail });
const walkHtml = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(target, out);
    else if (entry.name.endsWith(".html")) out.push(target);
  }
  return out;
};
const esc = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const slugs = [
  "how-to-play", "make-money", "where-to-buy", "farming", "automation", "gene-system", "fishing", "drone-combat",
  "exploration", "friendship", "weather", "cooking", "ranching", "characters", "story", "gifts", "romance",
  "achievements", "how-long-to-beat", "mods", "update-log", "faq", "system-requirements", "steam-deck",
];
const labels = {
  en: [
    "How to Play", "How to Make Money Fast", "Where to Buy", "Farming Guide: Crops, Seasons & Soil",
    "Farming Automation Guide (1.0)", "Gene System Guide: Mutations & Seeds", "Fishing Guide: Ponds, Weather & Rare Fish",
    "Drone Combat Guide: Upgrades & Modules", "Exploration Guide: All 5 Regions", "Friendship Guide: Villagers, Gifts & Festivals",
    "Weather Guide: Acid Rain, Storms & Drought", "Cooking Guide: Recipes, Buffs & Ingredients",
    "Ranching Guide: Barns, Fences & Animals", "Characters: Villager Profiles & Secrets", "Story Guide: Mysteries & the 1.0 Ending",
    "Gift Guide: Every Villager's Loves, Likes & Dislikes", "Romance: The Straight Answer", "Achievements: All 80 (1.0)",
    "How Long to Beat", "Mods & Steam Workshop Guide", "Update Log: 1.0 & Early Access History",
    "FAQ: 1.0 Answers to Common Questions", "System Requirements", "Steam Deck Compatibility Guide",
  ],
  es: [
    "Cómo jugar: guía para principiantes (1.0)", "Cómo ganar dinero rápido (1.0)", "Dónde comprar (precios, descuentos y plataformas)",
    "Guía de agricultura: cultivos, estaciones y suelo", "Guía de automatización agrícola (1.0)",
    "Guía del sistema genético: mutaciones y semillas", "Guía de pesca: estanques, clima y peces raros",
    "Guía de combate con dron: mejoras y módulos", "Guía de exploración: las 5 regiones",
    "Guía de amistad: vecinos, regalos y festivales", "Guía del clima: lluvia ácida, tormentas y sequía",
    "Guía de cocina: recetas, buffs e ingredientes", "Guía de ganadería: establos, vallas y animales",
    "Personajes: perfiles de aldeanos y secretos", "Guía de la historia: misterios y final 1.0",
    "Guía de regalos: gustos y rechazos de cada aldeano", "Romance: la respuesta directa", "Logros: los 80 (1.0)",
    "¿Cuánto se tarda en completar el juego?", "Guía de mods y Steam Workshop",
    "Registro de actualizaciones: 1.0 e historia de EA", "Preguntas frecuentes: respuestas del 1.0",
    "Requisitos del sistema", "Steam Deck: guía de compatibilidad",
  ],
};
const expected = Object.fromEntries(Object.entries(labels).map(([lang, list]) => [lang, Object.fromEntries(slugs.map((slug, i) => [slug, esc(list[i])]))]));

const menuLinks = html => {
  const menu = (html.match(/<div class="dd-menu dd-manual">([\s\S]*?)<\/details>/) || [])[1] || "";
  return [...menu.matchAll(/<a href="([^"]+)" class="[^"]*">[\s\S]*?<span>([^<]*)<\/span><\/a>/g)]
    .map(match => ({ href: match[1], label: match[2] }));
};

const out = fs.mkdtempSync(path.join(os.tmpdir(), "doloc-nav-audit-"));
const negativeFixtureExitCodes = {};
let searchComputedMinimums = null;
try {
  execFileSync(process.execPath, [path.join(root, "scripts/generate.js")], {
    cwd: root,
    env: { ...process.env, TZ: "UTC", DOLOC_OUTPUT_DIR: out, DOLOC_LASTMOD_PATH: path.join(out, ".lastmod.json") },
    stdio: "pipe",
  });

  if (fault === "blind-removal") {
    const target = path.join(out, "index.html");
    fs.writeFileSync(target, fs.readFileSync(target, "utf8").replace("Romance: The Straight Answer", "Is There Romance in ? The Straight Answer"));
  } else if (fault === "spanish-malformed-label") {
    const target = path.join(out, "es", "index.html");
    fs.writeFileSync(target, fs.readFileSync(target, "utf8").replace("Guía de agricultura: cultivos, estaciones y suelo", "Guía de agricultura de : cultivos, estaciones y suelo"));
  } else if (fault === "korean-name-drift") {
    const target = path.join(out, "ko", "index.html");
    fs.writeFileSync(target, fs.readFileSync(target, "utf8").replace("돌록 타운에서 빨리 돈 버는 법", "도록 타운에서 빨리 돈 버는 법"));
  } else if (fault === "missing-404-icon") {
    const target = path.join(out, "404.html");
    fs.writeFileSync(target, fs.readFileSync(target, "utf8").replace(/<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg" \/>\n?/, ""));
  } else if (fault === "missing-icon-asset") {
    fs.rmSync(path.join(out, "favicon-32x32.png"));
  } else if (fault === "escape-focus-loss") {
    const target = path.join(out, "index.html");
    fs.writeFileSync(target, fs.readFileSync(target, "utf8").replace("if (restoreFocus && summary) summary.focus();", "if (restoreFocus && summary) return;"));
  } else if (fault === "consent-escape-steals-focus") {
    const target = path.join(out, "index.html");
    fs.writeFileSync(target, fs.readFileSync(target, "utf8").replace("||!banner.contains(document.activeElement)", ""));
  } else if (fault === "touch-target-contract") {
    const target = path.join(out, "css", "style.css");
    fs.writeFileSync(target, fs.readFileSync(target, "utf8").replace("min-block-size:44px", "min-block-size:34px"));
  } else if (fault === "inline-target-contract") {
    const target = path.join(out, "css", "style.css");
    fs.writeFileSync(target, fs.readFileSync(target, "utf8").replace("min-inline-size:44px", "min-inline-size:34px"));
  } else if (fault === "search-under-44") {
    const target = path.join(out, "css", "style.css");
    fs.writeFileSync(target, fs.readFileSync(target, "utf8").replace(/(\.site-search input\[type="search"\]\{[^}]*min-block-size:)44px/, "$1 8px"));
  } else if (fault === "search-focus-ring-loss") {
    const target = path.join(out, "css", "style.css");
    fs.writeFileSync(target, fs.readFileSync(target, "utf8").replace("outline:2px solid var(--amber-soft)", "outline:none"));
  } else if (fault === "search-icon-captures-click") {
    const target = path.join(out, "css", "style.css");
    fs.writeFileSync(target, fs.readFileSync(target, "utf8").replace("pointer-events:none;z-index:1", "pointer-events:auto;z-index:1"));
  } else if (fault === "search-input-not-full-control") {
    const target = path.join(out, "css", "style.css");
    fs.writeFileSync(target, fs.readFileSync(target, "utf8").replace(/(\.site-search input\[type="search"\]\{[^}]*?)width:100%/, "$1width:calc(100% - 20px)"));
  } else if (fault === "search-late-cascade-override") {
    const target = path.join(out, "css", "style.css");
    fs.appendFileSync(target, '\n.site-search input[type="search"]{min-block-size:8px;pointer-events:none}\n');
  } else if (fault === "search-specificity-shrink") {
    const target = path.join(out, "css", "style.css");
    fs.appendFileSync(target, '\n.site-header .site-search input[type="search"]{min-inline-size:8px;min-block-size:8px}\n');
  } else if (fault === "search-important-focus-loss") {
    const target = path.join(out, "css", "style.css");
    fs.appendFileSync(target, '\n.site-search input[type="search"]:focus-visible{outline:none!important}\n');
  } else if (fault === "search-specificity-icon-capture") {
    const target = path.join(out, "css", "style.css");
    fs.appendFileSync(target, '\n.site-header .site-search .search-ic{pointer-events:auto}\n');
  } else if (fault === "search-mobile-only-shrink") {
    const target = path.join(out, "css", "style.css");
    fs.appendFileSync(target, '\n@media (max-width:480px){.site-header .site-search input[type="search"]{min-block-size:8px}}\n');
  } else if (fault === "transition-shorthand") {
    const target = path.join(out, "css", "style.css");
    fs.writeFileSync(target, fs.readFileSync(target, "utf8").replace("transition:color .16s ease,background-color .16s ease,box-shadow .16s ease", "transition:.16s"));
  } else if (fault === "unscoped-navigation-hover") {
    const target = path.join(out, "css", "style.css");
    fs.writeFileSync(target, fs.readFileSync(target, "utf8").replace("@media (hover:hover) and (pointer:fine)", "@media (min-width:1px)"));
  } else if (fault === "logo-transition-all") {
    const target = path.join(out, "css", "style.css");
    fs.writeFileSync(target, fs.readFileSync(target, "utf8").replace("white-space:nowrap;transition:none", "white-space:nowrap;transition:all .16s ease"));
  } else if (fault === "component-stats-layout") {
    const target = path.join(out, "css", "style.css");
    fs.writeFileSync(target, fs.readFileSync(target, "utf8").replace(".stats{display:grid", ".stats{display:block"));
  } else if (fault === "component-button-target") {
    const target = path.join(out, "css", "style.css");
    fs.writeFileSync(target, fs.readFileSync(target, "utf8").replace("min-block-size:var(--control-min)", "min-block-size:20px"));
  } else if (fault === "component-button-focus") {
    const target = path.join(out, "css", "style.css");
    fs.writeFileSync(target, fs.readFileSync(target, "utf8").replace(".btn:focus-visible{outline:3px solid var(--amber-soft)", ".btn:focus-visible{outline:none"));
  } else if (fault === "mobile-header-height") {
    const target = path.join(out, "css", "style.css");
    fs.writeFileSync(target, fs.readFileSync(target, "utf8").replaceAll("padding-top:3px;padding-bottom:3px", "padding-top:6px;padding-bottom:6px"));
  } else if (fault === "season-motion-duration") {
    const target = path.join(out, "css", "style.css");
    fs.writeFileSync(target, fs.readFileSync(target, "utf8").replace("animation:fadeUp 240ms", "animation:fadeUp 400ms"));
  } else if (fault === "season-motion-easing") {
    const target = path.join(out, "css", "style.css");
    fs.writeFileSync(target, fs.readFileSync(target, "utf8").replace("cubic-bezier(0,0,.2,1)", "ease"));
  }

  const allFiles = walkHtml(out);
  if (allFiles.length !== 169) fail("html-count", String(allFiles.length));
  const localeFiles = {
    en: allFiles.filter(file => path.dirname(path.relative(out, file)) === "."),
    es: allFiles.filter(file => path.dirname(path.relative(out, file)) === "es"),
    ko: allFiles.filter(file => path.dirname(path.relative(out, file)) === "ko"),
  };
  if (localeFiles.en.length !== 29) fail("english-page-count", String(localeFiles.en.length));
  if (localeFiles.es.length !== 28) fail("spanish-page-count", String(localeFiles.es.length));
  if (localeFiles.ko.length !== 28) fail("korean-page-count", String(localeFiles.ko.length));

  for (const lang of ["en", "es", "ko"]) {
    const prefix = lang === "en" ? "" : `/${lang}`;
    for (const file of localeFiles[lang]) {
      const rel = path.relative(out, file);
      const links = menuLinks(fs.readFileSync(file, "utf8"));
      if (links.length !== 24) { fail("menu-link-count", `${rel}:${links.length}`); continue; }
      for (const [index, slug] of slugs.entries()) {
        const link = links[index];
        if (link.href !== `${prefix}/${slug}`) fail("menu-href", `${rel}:${index}:${link.href}`);
        if (lang === "ko") {
          if (!link.label.includes("돌록 타운") || link.label.includes("도록 타운")) fail("korean-name", `${rel}:${slug}:${link.label}`);
        } else if (link.label !== expected[lang][slug]) {
          fail(`${lang}-label`, `${rel}:${slug}:${link.label}`);
        }
      }
    }
  }

  const css = fs.readFileSync(path.join(out, "css", "style.css"), "utf8");
  const targetContracts = [
    /\.logo\{(?=[^}]*min-inline-size:44px)(?=[^}]*min-block-size:44px)(?=[^}]*justify-content:center)[^}]*\}/,
    /\.nav>a,\.nav summary\{(?=[^}]*min-inline-size:44px)(?=[^}]*min-block-size:44px)(?=[^}]*justify-content:center)[^}]*\}/,
    /\.lang-dd summary\{(?=[^}]*min-inline-size:44px)(?=[^}]*min-block-size:44px)(?=[^}]*justify-content:center)[^}]*\}/,
    /\.dd-menu a\{(?=[^}]*min-inline-size:44px)(?=[^}]*min-block-size:44px)(?=[^}]*justify-content:center)[^}]*\}/,
    /\.dd-manual a\{(?=[^}]*min-inline-size:44px)(?=[^}]*min-block-size:44px)(?=[^}]*justify-content:center)[^}]*\}/,
  ];
  for (const re of targetContracts) if (!re.test(css)) fail("touch-target-css-contract", String(re));
  for (const [code,re] of [
    ["component-stats-contract",/\.stats\{(?=[^}]*display:grid)(?=[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\))(?=[^}]*gap:var\(--space-3\))[^}]*\}/],
    ["component-stat-contract",/\.stat\{(?=[^}]*padding:var\(--space-3\))(?=[^}]*border:1px solid var\(--line-strong\))(?=[^}]*text-align:center)[^}]*\}/],
    ["component-cta-contract",/\.cta-row\{(?=[^}]*display:flex)(?=[^}]*flex-wrap:wrap)(?=[^}]*gap:var\(--space-3\))[^}]*\}/],
    ["component-button-contract",/\.btn\{(?=[^}]*appearance:none)(?=[^}]*min-inline-size:var\(--control-min\))(?=[^}]*min-block-size:var\(--control-min\))(?=[^}]*padding:10px 16px)(?=[^}]*font:700)[^}]*\}/],
    ["component-button-focus",/\.btn:focus-visible\{outline:3px solid var\(--amber-soft\);outline-offset:3px\}/],
    ["component-button-active",/\.btn:active\{transform:scale\(\.98\)\}/],
  ]) if (!re.test(css)) fail(code, String(re));
  const mobileHeaderRules=[...css.matchAll(/@media \(max-width:900px\)\{[\s\S]*?\.header-inner\{[^}]*padding-top:([0-9.]+)px;padding-bottom:([0-9.]+)px[^}]*\}/g)];
  if (!mobileHeaderRules.length || mobileHeaderRules.some(match=>Number(match[1])+Number(match[2])>6)) fail("mobile-header-height-css-contract", "375px header padding budget must be no more than 6px total");
  const seasonMotion=css.match(/\.season-panel\{[^}]*animation:fadeUp\s+([0-9.]+)(ms|s)\s+([^;}]+)/);
  const seasonMs=seasonMotion ? Number(seasonMotion[1])*(seasonMotion[2]==="s"?1000:1) : Infinity;
  if (seasonMs>300) fail("season-motion-duration-contract", String(seasonMs));
  if (!seasonMotion || !/^cubic-bezier\(0,0,\.2,1\)$/.test(seasonMotion[3].trim())) fail("season-motion-easing-contract", seasonMotion?.[3]||"missing");
  // Minimal cascade evaluator for the real header DOM. It resolves importance,
  // specificity, source order and width/pointer media applicability. This is
  // intentionally narrower than a browser CSS engine, but broader than exact
  // selector matching and fail-closed for every search-control property below.
  const cssRules = [];
  let cssOrder = 0;
  const cssText = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const matchingBrace = (text, openAt) => {
    let depth = 0, quote = "", escaped = false;
    for (let i = openAt; i < text.length; i += 1) {
      const ch = text[i];
      if (quote) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === quote) quote = "";
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === "{") depth += 1;
      else if (ch === "}" && --depth === 0) return i;
    }
    return -1;
  };
  const parseRuleList = (text, media = []) => {
    let cursor = 0;
    while (cursor < text.length) {
      const openAt = text.indexOf("{", cursor);
      if (openAt < 0) break;
      const prelude = text.slice(cursor, openAt).trim();
      const closeAt = matchingBrace(text, openAt);
      if (closeAt < 0) break;
      const body = text.slice(openAt + 1, closeAt);
      if (/^@media\b/i.test(prelude)) parseRuleList(body, [...media, prelude.replace(/^@media\s*/i, "")]);
      else if (!prelude.startsWith("@")) {
        const declarations = {};
        for (const declaration of body.split(";")) {
          const splitAt = declaration.indexOf(":");
          if (splitAt < 1) continue;
          const property = declaration.slice(0, splitAt).trim().toLowerCase();
          let value = declaration.slice(splitAt + 1).trim();
          const important = /!important\s*$/i.test(value);
          value = value.replace(/\s*!important\s*$/i, "").trim();
          declarations[property] = { value, important };
        }
        for (const selector of prelude.split(",").map(item => item.trim()).filter(Boolean))
          cssRules.push({ selector, declarations, media, order: cssOrder++ });
      }
      cursor = closeAt + 1;
    }
  };
  parseRuleList(cssText);
  const profiles = {
    form: {tag:"form", classes:["site-search"], attrs:{}, pseudos:[], ancestors:[
      {tag:"div",classes:["header-inner"]},{tag:"div",classes:["container"]},{tag:"header",classes:["site-header"]},
    ]},
    input: {tag:"input", classes:[], attrs:{type:"search"}, pseudos:[], ancestors:[
      {tag:"form",classes:["site-search"]},{tag:"div",classes:["header-inner"]},{tag:"div",classes:["container"]},{tag:"header",classes:["site-header"]},
    ]},
    icon: {tag:"span", classes:["search-ic"], attrs:{}, pseudos:[], ancestors:[
      {tag:"form",classes:["site-search"]},{tag:"div",classes:["header-inner"]},{tag:"div",classes:["container"]},{tag:"header",classes:["site-header"]},
    ]},
    focus: {tag:"input", classes:[], attrs:{type:"search"}, pseudos:["focus-visible"], ancestors:[
      {tag:"form",classes:["site-search"]},{tag:"div",classes:["header-inner"]},{tag:"div",classes:["container"]},{tag:"header",classes:["site-header"]},
    ]},
  };
  const compoundMatches = (compound, node) => {
    if (!node || /::/.test(compound)) return false;
    for (const pseudo of [...compound.matchAll(/:([\w-]+)/g)].map(match => match[1]))
      if (!node.pseudos?.includes(pseudo)) return false;
    for (const klass of [...compound.matchAll(/\.([\w-]+)/g)].map(match => match[1]))
      if (!node.classes?.includes(klass)) return false;
    for (const attr of compound.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g))
      if (!(attr[1] in (node.attrs || {})) || (attr[2] && node.attrs[attr[1]] !== attr[2])) return false;
    const tag = compound.replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|:{1,2}[\w-]+(?:\([^)]*\))?/g, "").trim();
    return !tag || tag === "*" || tag.toLowerCase() === node.tag;
  };
  const selectorMatches = (selector, profile) => {
    const compounds = selector.replace(/>/g, " ").trim().split(/\s+/).filter(Boolean);
    if (!compounds.length || !compoundMatches(compounds.at(-1), profile)) return false;
    let ancestorAt = 0;
    for (let i = compounds.length - 2; i >= 0; i -= 1) {
      while (ancestorAt < profile.ancestors.length && !compoundMatches(compounds[i], profile.ancestors[ancestorAt])) ancestorAt += 1;
      if (ancestorAt >= profile.ancestors.length) return false;
      ancestorAt += 1;
    }
    return true;
  };
  const specificity = selector => [
    (selector.match(/#[\w-]+/g) || []).length,
    (selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) || []).length,
    (selector.replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|:{1,2}[\w-]+(?:\([^)]*\))?/g, " ").match(/\b[a-z][\w-]*\b/gi) || []).length,
  ];
  const mediaMatches = (queries, width) => queries.every(query => query.split(",").some(branch => {
    const max = branch.match(/max-width\s*:\s*([0-9.]+)px/i);
    const min = branch.match(/min-width\s*:\s*([0-9.]+)px/i);
    if (max && width > Number(max[1])) return false;
    if (min && width < Number(min[1])) return false;
    if (/hover\s*:\s*hover/i.test(branch) && width < 769) return false;
    if (/hover\s*:\s*none/i.test(branch) && width >= 769) return false;
    if (/pointer\s*:\s*fine/i.test(branch) && width < 769) return false;
    if (/pointer\s*:\s*coarse/i.test(branch) && width >= 769) return false;
    if (/prefers-reduced-motion\s*:\s*reduce/i.test(branch)) return false;
    return true;
  }));
  const wins = (candidate, current) => {
    if (!current) return true;
    if (candidate.important !== current.important) return candidate.important;
    for (let i = 0; i < 3; i += 1) if (candidate.specificity[i] !== current.specificity[i]) return candidate.specificity[i] > current.specificity[i];
    return candidate.order >= current.order;
  };
  const resolvedRule = (target, width) => {
    const resolved = {};
    for (const rule of cssRules) {
      if (!mediaMatches(rule.media, width) || !selectorMatches(rule.selector, profiles[target])) continue;
      for (const [property, declaration] of Object.entries(rule.declarations)) {
        const candidate = {...declaration, specificity:specificity(rule.selector), order:rule.order, selector:rule.selector};
        if (wins(candidate, resolved[property])) resolved[property] = candidate;
      }
    }
    return Object.fromEntries(Object.entries(resolved).map(([property, item]) => [property, item.value]));
  };
  const pxValue = (rule, property) => Number((String(rule[property] || "").match(/^([0-9.]+)px$/) || [])[1] || 0);
  searchComputedMinimums = {};
  for (const width of [375, 1440]) {
    const formRule = resolvedRule("form", width), inputRule = resolvedRule("input", width);
    const iconRule = resolvedRule("icon", width), focusRule = resolvedRule("focus", width);
    const computed = searchComputedMinimums[width] = {
      form: {inline:pxValue(formRule,"min-inline-size"),block:pxValue(formRule,"min-block-size")},
      input: {inline:pxValue(inputRule,"min-inline-size"),block:pxValue(inputRule,"min-block-size")},
      input_width: inputRule.width, icon_pointer_events: iconRule["pointer-events"], focus_outline: focusRule.outline,
    };
    for (const [target, size] of Object.entries({form:computed.form,input:computed.input}))
      if (size.inline < 44 || size.block < 44) fail("search-computed-size-contract", `${width}:${target}:${size.inline}x${size.block}`);
    if (inputRule.width !== "100%" || inputRule.padding !== "0 12px 0 35px" || formRule.padding !== "0" || inputRule["pointer-events"] === "none")
      fail("search-full-control-click-contract", `${width}:visible search pill must be the full-width search input`);
    if (iconRule["pointer-events"] !== "none") fail("search-icon-click-through", `${width}:search icon must pass clicks to the input`);
    if (/^(?:0|none)$/i.test(focusRule.outline || "") || /^(?:0|none)$/i.test(focusRule["outline-width"] || ""))
      fail("search-focus-visible", `${width}:search input requires a visible keyboard focus outline`);
  }
  if (!/\.logo\{[^}]*transition:none[^}]*\}/.test(css)) fail("logo-transition-property", "logo transition must compute to none, never all");
  if (!/\.dd-manual\{[^}]*max-block-size:calc\(100dvh - 132px\)[^}]*overflow-y:auto/.test(css)) fail("menu-keyboard-reachability-css", "mobile guide menu requires a bounded scroll region");
  const navigationRules = (css.match(/\.(?:logo|nav|dd-menu|dd-manual|lang-dd|site-search)[^{]*\{[^}]*\}/g) || []).join("\n");
  if (/transition\s*:\s*(?:\d|\.)/.test(navigationRules)) fail("navigation-transition-shorthand", "navigation transition must name changed properties");
  const fineStart = css.indexOf("@media (hover:hover) and (pointer:fine)");
  const fineEnd = fineStart < 0 ? -1 : css.indexOf("\n}", fineStart);
  if (fineStart < 0 || fineEnd < 0) fail("fine-pointer-hover-scope", "missing hover:hover + pointer:fine media scope");
  for (const match of css.matchAll(/(?:\.nav[^,{]*|\.lang-dd summary|\.dd-menu a|\.dd-manual a):hover/g)) {
    if (match.index < fineStart || match.index > fineEnd) fail("unscoped-navigation-hover", match[0]);
  }
  if (!/\.logo:focus-visible[^}]*outline:2px solid var\(--amber-soft\)/.test(css)) fail("navigation-focus-visible", "focus indicator missing");

  for (const file of allFiles) {
    const rel = path.relative(out, file);
    const html = fs.readFileSync(file, "utf8");
    if (!/<form class="site-search"[^>]*role="search"[\s\S]*?<input type="search"[^>]*name="q"[^>]*>[\s\S]*?<input type="hidden"[^>]*name="as_sitesearch"/.test(html))
      fail("search-keyboard-focus-contract", rel);
    for (const token of [
      "function closeNavigationDetails(details, restoreFocus)",
      "details.querySelector(':scope > summary')",
      "if (restoreFocus && summary) summary.focus();",
      "details.dd[open], details.lang-dd[open]",
      "banner.hidden||!banner.contains(document.activeElement)",
    ]) if (!html.includes(token)) fail("escape-focus-runtime-contract", `${rel}:${token}`);
  }

  const icons = [
    { rel: "icon", href: "/favicon.svg" },
    { rel: "icon", href: "/favicon-32x32.png" },
    { rel: "icon", href: "/favicon-16x16.png" },
    { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  ];
  for (const file of allFiles) {
    const rel = path.relative(out, file);
    const html = fs.readFileSync(file, "utf8");
    for (const icon of icons) {
      const marker = `href="${icon.href}"`;
      const count = html.split(marker).length - 1;
      const declaration = html.match(new RegExp(`<link[^>]*rel="${icon.rel}"[^>]*href="${icon.href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`));
      if (count !== 1 || !declaration) fail("icon-declaration", `${rel}:${icon.href}:${count}`);
      const asset = path.join(out, icon.href.slice(1));
      if (!fs.existsSync(asset) || !fs.statSync(asset).isFile() || fs.statSync(asset).size === 0) fail("icon-asset", `${rel}:${icon.href}`);
    }
  }

  if (!fault && !failures.length) {
    for (const name of ["blind-removal", "spanish-malformed-label", "korean-name-drift", "missing-404-icon", "missing-icon-asset", "escape-focus-loss", "consent-escape-steals-focus", "touch-target-contract", "inline-target-contract", "search-under-44", "search-focus-ring-loss", "search-icon-captures-click", "search-input-not-full-control", "search-late-cascade-override", "search-specificity-shrink", "search-important-focus-loss", "search-specificity-icon-capture", "search-mobile-only-shrink", "transition-shorthand", "unscoped-navigation-hover", "logo-transition-all", "component-stats-layout", "component-button-target", "component-button-focus", "mobile-header-height", "season-motion-duration", "season-motion-easing"]) {
      const child = spawnSync(process.execPath, [auditScript, root], { env: { ...process.env, DOLOC_NAV_AUDIT_FAULT: name }, encoding: "utf8" });
      negativeFixtureExitCodes[name] = child.status;
      if (!Number.isInteger(child.status) || child.status <= 0) fail("negative-fixture-did-not-fail", name);
      const expected={"component-stats-layout":"component-stats-contract","component-button-target":"component-button-contract","component-button-focus":"component-button-focus","mobile-header-height":"mobile-header-height-css-contract","season-motion-duration":"season-motion-duration-contract","season-motion-easing":"season-motion-easing-contract"}[name];
      if (expected) {
        let report;
        try { report=JSON.parse(child.stdout); } catch { fail("negative-fixture-invalid-output",name); continue; }
        if (!(report.failures||[]).some(item=>item.code===expected)) fail("negative-fixture-wrong-failure",`${name}:${expected}`);
      }
    }
  }
} finally {
  fs.rmSync(out, { recursive: true, force: true });
}

console.log(JSON.stringify({
  html_pages: 169,
  navigation_pages: { en: 29, es: 28, ko: 28 },
  labels_per_menu: 24,
  malformed_english_occurrences: failures.filter(item => item.code === "en-label").length,
  malformed_spanish_occurrences: failures.filter(item => item.code === "es-label").length,
  favicon_pages: 169,
  search_target_pages: 169,
  search_computed_minimums: searchComputedMinimums,
  negative_fixture_exit_codes: negativeFixtureExitCodes,
  failures,
}, null, 2));
process.exit(failures.length ? 1 : 0);
