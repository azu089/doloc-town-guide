#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(process.argv[2] || ".");
const failures = [];
const fail = (code, detail) => failures.push({code, detail});
const walk = (dir, out=[]) => { for (const e of fs.readdirSync(dir,{withFileTypes:true})) { const p=path.join(dir,e.name); e.isDirectory()?walk(p,out):e.name.endsWith(".html")&&out.push(p); } return out; };
const count = (s,n) => s.split(n).length-1;
const generate = (out, fixture) => execFileSync(process.execPath,[path.join(root,"scripts/generate.js")],{cwd:root,env:{...process.env,TZ:"UTC",DOLOC_OUTPUT_DIR:out,DOLOC_LASTMOD_PATH:path.join(out,".lastmod.json"),...(fixture?{DOLOC_AMAZON_FIXTURE:"enabled"}:{})},stdio:"pipe"});

// Month 4 / Harsh Dry Season may be named, and a source-boundary warning may
// explain that no trading claim is established. The unsupported assertion is
// the correlation of that season with a price spike, stockpiling or selling.
const boundaryPatterns = [
  /the cited official notes do not establish (?:a )?(?:month 4 )?(?:price-)?(?:arbitrage|trading) strategy/giu,
  /(?:without|does not claim|do not claim)[^.\n]{0,90}(?:unsupported|unverified)[^.\n]{0,40}(?:trading|price-arbitrage|crop risk)/giu,
  /(?:引用的官方公告|引用的官方資訊)[^。\n]{0,50}(?:未建立|未支持)[^。\n]{0,30}(?:倒卖|倒賣|交易)策略/gu,
  /(?:本站|本指南)[^。\n]{0,50}(?:不再声称|不再宣稱|不采用|不採用)[^。\n]{0,50}(?:涨价倒卖|漲價倒賣|交易机制|交易機制)/gu,
  /引用した公式情報は売買攻略を示していません/gu,
  /未確認の(?:価格|取引)攻略は掲載しません/gu,
  /(?:인용한 공식 공지는|이 가이드는)[^.\n]{0,60}(?:거래 전략을 제시하지 않습니다|확인되지 않은 가격 거래 주장은 제외합니다)/gu,
  /(?:los avisos oficiales citados no establecen|esta guía no afirma|sin)[^.\n]{0,90}(?:estrategia de compraventa|arbitraje de precios|estrategias comerciales)/giu,
];
const droughtPatterns = {
  en: [/(?:drought|month\s*4|harsh dry season)[^\n]{0,120}(?:price(?:s)?\s*(?:spike|rise|surge)|worst prices?|highest prices?|stockpil(?:e|ing)|hoard|sell(?:ing)?\s+high|arbitrag)/iu, /(?:price(?:s)?\s*(?:spike|rise|surge)|worst prices?|highest prices?|stockpil(?:e|ing)|hoard|sell(?:ing)?\s+high)[^\n]{0,120}(?:drought|month\s*4|harsh dry season)/iu],
  "zh-CN": [/(?:旱季|干旱|第\s*4\s*月|4\s*月)[^\n]{0,100}(?:价格|物价)[^\n]{0,24}(?:飙升|高涨|最高|最差)/u, /(?:旱季|干旱|第\s*4\s*月|4\s*月)[^\n]{0,100}(?:囤货|倒卖|高价卖出)/u],
  "zh-TW": [/(?:旱季|乾旱|第\s*4\s*月|4\s*月)[^\n]{0,100}(?:價格|物價)[^\n]{0,24}(?:飆升|高漲|最高|最差|最壞)/u, /(?:旱季|乾旱|第\s*4\s*月|4\s*月)[^\n]{0,100}(?:囤貨|倒賣|高價賣出)/u],
  ja: [/(?:干ばつ|乾季|第?4月)[^\n]{0,100}(?:価格|物価)[^\n]{0,24}(?:高騰|上昇|最高|最悪)/u, /(?:干ばつ|乾季|第?4月)[^\n]{0,100}(?:備蓄|高値で売)/u],
  ko: [/(?:가뭄|건기|4월|4번째\s*달)[^\n]{0,100}(?:가격|물가)[^\n]{0,24}(?:급등|상승|최고|최악)/u, /(?:가뭄|건기|4월|4번째\s*달)[^\n]{0,100}(?:비축|비싸게\s*판매|고가\s*판매)/u],
  es: [/(?:sequ[ií]a|mes\s*4|temporada\s+seca)[^\n]{0,120}(?:precio(?:s)?[^\n]{0,24}(?:sube|subida|dispara|alto|peor)|acumula|vende\s+caro|arbitraje)/iu, /(?:acumula|vende\s+caro|subida\s+de\s+(?:la\s+)?sequ[ií]a)[^\n]{0,120}(?:sequ[ií]a|mes\s*4)/iu],
};
const stripBoundaries = text => boundaryPatterns.reduce((s,re)=>s.replace(re,""), text);
const droughtHit = text => {
  const clean=stripBoundaries(text);
  for (const [locale,patterns] of Object.entries(droughtPatterns)) for (const re of patterns) {
    const hit=clean.match(re);
    if (hit) return {locale,excerpt:hit[0].replace(/\s+/g," ").slice(0,220)};
  }
  return null;
};
const faultFixtures = {
  en:"Month 4 drought makes prices spike; stockpile crops and sell high.",
  "zh-CN":"第4月旱季物价飙升，提前囤货再高价卖出。",
  "zh-TW":"第4月旱季物價飆升，提前囤貨再高價賣出。",
  ja:"4月の干ばつで価格が高騰するため、備蓄して高値で売る。",
  ko:"4월 가뭄에 가격이 급등하니 비축 후 비싸게 판매하세요.",
  es:"La sequía del mes 4 dispara los precios; acumula y vende caro.",
};
const safeBoundaries = {
  en:"Month 4 is Harsh Dry Season. Protect crops and plan watering; the cited official notes do not establish a trading strategy.",
  "zh-CN":"第 4 月是 Harsh Dry Season。请保护作物并规划浇水；引用的官方公告未建立倒卖策略。",
  "zh-TW":"第 4 月是 Harsh Dry Season。請保護作物並規劃澆水；引用的官方公告未建立倒賣策略。",
  ja:"第4月は Harsh Dry Season です。作物保護と水やりを準備してください。引用した公式情報は売買攻略を示していません。",
  ko:"4번째 달은 Harsh Dry Season입니다. 작물을 보호하고 물주기를 계획하세요. 인용한 공식 공지는 거래 전략을 제시하지 않습니다.",
  es:"El mes 4 es Harsh Dry Season. Protege cultivos y planifica el riego; los avisos oficiales citados no establecen una estrategia de compraventa.",
};

const disabled = fs.mkdtempSync(path.join(os.tmpdir(),"doloc-amz-off-"));
const enabled = fs.mkdtempSync(path.join(os.tmpdir(),"doloc-amz-on-"));
try {
  generate(disabled,false); generate(enabled,true);
  const offFiles=walk(disabled), onFiles=walk(enabled);
  for (const f of offFiles) {
    const rel=path.relative(disabled,f), html=fs.readFileSync(f,"utf8");
    if (count(html,'class="amazon-gear"')) fail("disabled-module",rel);
    if (/amazon\.com\/s\?k=[^" ]+.*(?:tag=|tag%3D)/i.test(html)) fail("disabled-link",rel);
  }
  for (const f of onFiles) {
    const rel=path.relative(enabled,f), html=fs.readFileSync(f,"utf8");
    const article=!/(^|\/)(index|about|privacy|contact|404)\.html$/.test(rel);
    const modules=count(html,'class="amazon-gear"');
    if (modules !== (article?1:0)) fail("enabled-count",`${rel}:${modules}`);
    const footer=(html.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)||[""])[0];
    if (footer.includes('class="amazon-gear"')) fail("footer-leak",rel);
    if (!article) continue;
    const main=(html.match(/<div class="manual-main">[\s\S]*?<\/div>\s*<aside class="manual-side">/)||[""])[0];
    if (!main.includes('class="amazon-gear"')) fail("outside-main",rel);
    if (!main.includes("As an Amazon Associate I earn from qualifying purchases.")) fail("disclosure",rel);
    if (main.indexOf("As an Amazon Associate I earn from qualifying purchases.") > main.indexOf('class="amazon-gear-links"')) fail("disclosure-order",rel);
    if (main.indexOf('class="amazon-gear"') > main.indexOf('class="sources')) fail("placement",rel);
    const links=main.match(/<a href="https:\/\/www\.amazon\.com\/s\?k=[^"]+" target="_blank" rel="sponsored nofollow noopener">[^<]+<\/a>/g)||[];
    if (links.length!==5) fail("links",`${rel}:${links.length}`);
    if (links.some(a=>!a.includes("tag=cozysimhub20-20")||!a.includes("↗"))) fail("link-contract",rel);
  }
  const css=fs.readFileSync(path.join(root,"templates/style.css"),"utf8");
  for (const token of ["inline-size:100%","max-inline-size:100%","min-inline-size:44px","min-block-size:44px","outline:2px solid var(--amber-soft)","grid-template-columns:1fr","minmax(0,1fr)","overflow-wrap:anywhere","prefers-reduced-motion:reduce","margin:32px auto 0"]) if(!css.includes(token)) fail("css-contract",token);
  const authored=(css.match(/\.amazon[^}]*\{[^}]*\}/g)||[]).join("\n");
  if (/animation\s*:|translateY|reveal/.test(authored)) fail("motion-contract","entrance motion found");

  // Evidence-semantic guard: inspect the generated data and final HTML, not
  // only one visible route. Exceptions are narrowly limited to warning copy.
  const semanticFiles = [
    path.join(root,"data/site.base.json"),
    path.join(root,"data/site.json"),
    ...walk(disabled)
  ];
  const forbidden = [
    ["wind-claim", /\bwind(?:\s+(?:power|turbines?))\b|aerogeneradores|風力|风力|풍력/i],
    ["unsafe-mod-advice", /DTMAPI.{0,100}(subscribe|install|订阅|訂閱|購読|구독|Suscríbete)|(?:dependencies|依赖|依賴|依存|의존성).{0,40}(first|先|먼저)/i],
    ["new-year-beast-mistranslation", /New Year Beast.{0,20}(difficulty|难度|難度|난이도|dificultad)/i],
    ["self-backing", /complete.{0,30}(?:change|log)|完整.{0,20}(?:变更|變更)|完全.{0,20}(?:変更|ログ)|완전한.{0,20}(?:변경|로그)|registro completo|site (?:like this )?is the reliable source|本站.{0,20}可靠|本網站.{0,20}可靠|このガイド.{0,20}情報源|이 가이드.{0,20}출처|sitio .*fuente fiable/i]
  ];
  for (const file of semanticFiles) {
    const text=fs.readFileSync(file,"utf8");
    const drought=droughtHit(text);
    if (drought) fail("drought-arbitrage",`${path.relative(root,file)}:${drought.locale}:${drought.excerpt}`);
    for (const [code,re] of forbidden) if(re.test(text)) fail(code,path.relative(root,file));
  }
  for (const [locale,fixture] of Object.entries(faultFixtures)) {
    const hit=droughtHit(fixture);
    if (!hit || hit.locale!==locale) fail(`fault-injection-${locale}`,hit?`misclassified:${hit.locale}`:"not detected");
  }
  for (const [locale,fixture] of Object.entries(safeBoundaries)) if(droughtHit(fixture)) fail(`boundary-false-positive-${locale}`,fixture);
} finally { fs.rmSync(disabled,{recursive:true,force:true}); fs.rmSync(enabled,{recursive:true,force:true}); }
console.log(JSON.stringify({disabled_pages:"all",enabled_fixture_pages:"all",semantic_locales:Object.keys(droughtPatterns),fault_injections:Object.keys(faultFixtures),source_boundaries:Object.keys(safeBoundaries),failures},null,2));
process.exit(failures.length?1:0);
