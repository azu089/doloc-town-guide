#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const auditScript = fileURLToPath(import.meta.url);
const root = path.resolve(process.argv[2] || ".");
const fault = process.env.DOLOC_AMAZON_AUDIT_FAULT || "";
const failures = [];
const fail = (code, detail) => failures.push({code, detail});
const walk = (dir, out=[]) => { for (const e of fs.readdirSync(dir,{withFileTypes:true})) { const p=path.join(dir,e.name); e.isDirectory()?walk(p,out):e.name.endsWith(".html")&&out.push(p); } return out; };
const count = (s,n) => s.split(n).length-1;
const generate = (out, fixture) => execFileSync(process.execPath,[path.join(root,"scripts/generate.js")],{cwd:root,env:{...process.env,TZ:"UTC",DOLOC_OUTPUT_DIR:out,DOLOC_LASTMOD_PATH:path.join(out,".lastmod.json"),...(fixture?{DOLOC_AMAZON_FIXTURE:"enabled"}:{})},stdio:"pipe"});
const canonicalSources = {
  patch: "https://steamcommunity.com/games/2285550/announcements/detail/703275952293020586",
  release: "https://steamcommunity.com/games/2285550/announcements/detail/703275952293019702",
  store: "https://store.steampowered.com/app/2285550/Doloc_Town/",
};
const genericNewsHubSources = [
  "https://store.steampowered.com/news/app/2285550/view/1840310314351178",
  "https://store.steampowered.com/news/app/2285550/view/1840310314341005",
];

// Month 4 / Harsh Dry Season may be named, and a source-boundary warning may
// explain that no trading claim is established. The unsupported assertion is
// the correlation of that season with a price spike, stockpiling or selling.
const boundaryPatterns = [
  /the cited official notes do not establish (?:a )?(?:month 4 )?(?:price-)?(?:arbitrage|trading) strategy/giu,
  /(?:without|does not claim|do not claim)[^.\n]{0,90}(?:unsupported|unverified)[^.\n]{0,40}(?:trading|price-arbitrage|crop risk)/giu,
  /(?:引用的官方公告|引用的官方資訊)[^。\n]{0,50}(?:未建立|未支持)[^。\n]{0,30}(?:倒卖|倒賣|交易)策略/gu,
  /(?:本站|本指南)[^。\n]{0,50}(?:不再声称|不再宣稱|不采用|不採用)[^。\n]{0,50}(?:涨价倒卖|漲價倒賣|交易机制|交易機制)/gu,
  /不(?:采用未经证实的涨价倒卖说法|採用未證實的漲價倒賣說法)/gu,
  /引用した公式情報は売買攻略を示していません/gu,
  /未確認の(?:価格|取引)攻略は掲載しません/gu,
  /(?:인용한 공식 공지는|이 가이드는)[^.\n]{0,60}(?:거래 전략을 제시하지 않습니다|확인되지 않은 가격 거래 주장은 제외합니다)/gu,
  /확인되지 않은 가격 거래 주장은 제외합니다/gu,
  /공식 공지는 가격 변동이나 판매 시점을 뒷받침하지 않습니다/gu,
  /(?:los avisos oficiales citados no establecen|esta guía no afirma|sin)[^.\n]{0,90}(?:estrategia de compraventa|arbitraje de precios|estrategias comerciales)/giu,
];
const droughtPatterns = {
  en: [/(?:drought|month\s*4|harsh dry season)[^\n]{0,120}(?:price(?:s)?\s*(?:spike|rise|surge)|worst prices?|highest prices?|stockpil(?:e|ing)|hoard|sell(?:ing)?\s+high|arbitrag)/iu, /(?:price(?:s)?\s*(?:spike|rise|surge)|worst prices?|highest prices?|stockpil(?:e|ing)|hoard|sell(?:ing)?\s+high)[^\n]{0,120}(?:drought|month\s*4|harsh dry season)/iu],
  "zh-CN": [
    /(?:旱灾|旱季|干旱|第\s*4\s*月|4\s*月|作物压力)[^。\n]{0,120}(?:价格|物价)[^。\n]{0,24}(?:飙升|高涨|最高|最差)/u,
    /(?:旱灾|旱季|干旱|第\s*4\s*月|4\s*月|作物压力)[^。\n]{0,120}(?:囤货|倒卖|高价卖出|卖出|出售|获利|利润|回报)/u,
    /(?:卖出|出售)[^。；;\n]{0,55}(?:旱灾|旱季|干旱|第\s*4\s*月|4\s*月|作物压力)/u,
  ],
  "zh-TW": [
    /(?:旱災|旱季|乾旱|第\s*4\s*月|4\s*月|作物壓力)[^。\n]{0,120}(?:價格|物價)[^。\n]{0,24}(?:飆升|高漲|最高|最差|最壞)/u,
    /(?:旱災|旱季|乾旱|第\s*4\s*月|4\s*月|作物壓力)[^。\n]{0,120}(?:囤貨|倒賣|高價賣出|賣出|出售|獲利|利潤|回報)/u,
    /(?:賣出|出售)[^。；;\n]{0,55}(?:旱災|旱季|乾旱|第\s*4\s*月|4\s*月|作物壓力)/u,
  ],
  ja: [
    /(?:干ばつ|乾季|第?4月)[^。\n]{0,120}(?:価格|物価)[^。\n]{0,24}(?:高騰|上昇|最高|最悪)/u,
    /(?:干ばつ|乾季|第?4月)[^。\n]{0,120}(?:備蓄|高値で売|高騰期に売|利益|稼ぐ)/u,
    /(?:高値で売|高騰期に売)[^。；;\n]{0,55}(?:干ばつ|乾季|第?4月)/u,
  ],
  ko: [
    /(?:가뭄|건기|4월|4번째\s*달)[^\n]{0,100}(?:가격|물가)[^\n]{0,24}(?:급등|상승|최고|최악)/u,
    /(?:가뭄|건기|4월|4번째\s*달)[^.\n]{0,100}(?:비축|비싸게\s*판매|고가\s*판매|급등기|최고가)/u,
    /연중\s*(?:최악|최고)[^.\n]{0,24}(?:가격|판매)/u,
    /작물\s*(?:부담|스트레스)[^.\n]{0,36}(?:판매|수익)/u,
    /(?:작물\s*보호|보호\s*작물)[^.\n]{0,36}(?:고가|판매\s*시점|판매분)/u,
    /달력[^.\n]{0,36}(?:가장\s*큰|최대)[^.\n]{0,18}수익/u,
  ],
  es: [
    /(?:sequ[ií]a|mes\s*4|temporada\s+seca)[^.\n]{0,120}(?:precio(?:s)?[^.\n]{0,24}(?:sube|subida|dispara|alto|peor)|acumula|vende\s+caro|arbitraje|ganar|beneficio|provecho)/iu,
    /(?:acumula|vende\s+caro|ganar|beneficio|provecho|subida\s+de\s+(?:la\s+)?sequ[ií]a)[^.\n]{0,120}(?:sequ[ií]a|mes\s*4|temporada\s+seca)/iu,
  ],
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
const semanticFamilyPatterns = [
  ["ja-weather-unsupported-damage", /(?:雷雨[^。\n]{0,40}農地[^。\n]{0,20}破壊|農地を破壊|豪雨[^。\n]{0,40}低地[^。\n]{0,20}浸水|低地が浸水)/u],
  ["raw-economic-causality", /(?:4\s*月前[^。\n]{0,35}作物防[护護][^。\n]{0,20}大有赚头|雷暴[^。\n]{0,55}降低自动化的运行成本|雷雨[^。\n]{0,55}自動化の運用コストを下げる|뇌우[^.\n]{0,55}자동화 운영비를 줄임|tormentas[^.\n]{0,75}reduce los costes de la automatización)/iu],
  ["en-flat-field-weather-causality", /(?:(?:flat|horizontal|single[- ]level|one[- ]level)[^.\n]{0,50}(?:field|plot)[^.\n]{0,70}(?:drought|storm)[^.\n]{0,35}(?:risk|magnet|target|wipe|destroy)|(?:drought|storm)[^.\n]{0,70}(?:target|seek|wipe|destroy|attract)[^.\n]{0,55}(?:flat|horizontal|single[- ]level|one[- ]level)[^.\n]{0,20}(?:field|plot))/iu],
  ["zh-flat-field-weather-causality", /(?:(?:平坦|平地|單層|单层|單一|单一|一大片|一整片)[^。\n]{0,36}(?:田地|農田|农田|地塊|地块|田)[^。\n]{0,55}(?:旱災|旱灾|乾旱|干旱|風暴|风暴|暴風|暴风)[^。\n]{0,28}(?:風險|风险|靶子|標靶|目标|目標|全毀|全毁|摧毀|摧毁|吸引)|(?:旱災|旱灾|乾旱|干旱|風暴|风暴|暴風|暴风)[^。\n]{0,55}(?:摧毀|摧毁|吸引|鎖定|锁定|瞄準|瞄准|毀掉|毁掉)[^。\n]{0,36}(?:平坦|平地|單層|单层|單一|单一)[^。\n]{0,18}(?:田地|農田|农田|地塊|地块|田))/u],
  ["ja-flat-field-weather-causality", /(?:(?:平ら|一枚畑|単層|一段|単一|水平)[^。\n]{0,50}(?:畑|農地|区画)[^。\n]{0,60}(?:干ばつ|嵐|暴風)[^。\n]{0,28}(?:リスク|的|標的|全滅|壊滅|引き寄せ)|(?:干ばつ|嵐|暴風)[^。\n]{0,60}(?:狙(?:う|って)|全滅させ(?:る|て)|壊滅させ(?:る|て)|引き寄せ(?:る|て))[^。\n]{0,45}(?:平ら|一枚畑|単層|一段|単一|水平))/u],
  ["ko-flat-field-weather-causality", /(?:평평한|평지|단층|한\s*판)[^.\n]{0,60}(?:가뭄\s*위험|폭풍의\s*표적|폭풍\s*하나로\s*전멸)/u],
  ["es-flat-field-weather-causality", /(?:(?:campo|parcela)[^.\n]{0,35}(?:plano|llano|un\s+solo\s+nivel|una\s+sola\s+capa)[^.\n]{0,70}(?:sequ[ií]a|tormenta)[^.\n]{0,30}(?:riesgo|im[aá]n|objetivo|borra|destruye|atrae)|(?:sequ[ií]a|tormenta)[^.\n]{0,70}(?:busca|borra|destruye|atrae|apunta)[^.\n]{0,50}(?:campo|parcela)[^.\n]{0,30}(?:plano|llano|un\s+solo\s+nivel|una\s+sola\s+capa))/iu],
  ["en-broad-threat-benefit", /(?:(?:every|each|all|any)[^.\n]{0,45}(?:threat|storm|extreme weather|weather event)[^.\n]{0,65}(?:advantage|bonus|benefit|reward)|(?:advantage|bonus|benefit|reward)[^.\n]{0,65}(?:every|each|all|any)[^.\n]{0,45}(?:threat|storm|weather)|weather[^.\n]{0,35}(?:bonus|advantage)[^.\n]{0,30}(?:not|rather than)[^.\n]{0,20}disaster)/iu],
  ["zh-broad-threat-benefit", /(?:(?:每一|每种|每種|所有|任何)[^。\n]{0,40}(?:威胁|威脅|风暴|風暴|极端天气|極端天氣)[^。\n]{0,65}(?:优势|優勢|红利|紅利|奖励|獎勵|获利|獲利)|(?:优势|優勢|红利|紅利|奖励|獎勵|获利|獲利)[^。\n]{0,65}(?:每一|每种|每種|所有|任何)[^。\n]{0,40}(?:威胁|威脅|风暴|風暴|天气|天氣)|(?:天气|天氣)[^。\n]{0,45}(?:不是|并非|而非)[^。\n]{0,22}(?:灾难|災難)[^。\n]{0,30}(?:红利|紅利|优势|優勢))/u],
  ["ja-broad-threat-benefit", /(?:(?:すべて|各|あらゆる)[^。\n]{0,40}(?:脅威|嵐|異常気象|天候)[^。\n]{0,65}(?:アドバンテージ|ボーナス|利益|恩恵)|(?:アドバンテージ|ボーナス|利益|恩恵)[^。\n]{0,65}(?:すべて|各|あらゆる)[^。\n]{0,40}(?:脅威|嵐|異常気象|天候)|天候[^。\n]{0,45}(?:災害ではなく|災害でなく)[^。\n]{0,25}(?:ボーナス|アドバンテージ))/u],
  ["ko-broad-threat-benefit", /(?:(?:모든|각|어떤|어느)[^.\n]{0,45}(?:위협|폭풍|극한\s*날씨|날씨)[^.\n]{0,65}(?:이점|장점|보너스|혜택|수익)|(?:이점|장점|보너스|혜택|수익)[^.\n]{0,65}(?:모든|각|어떤|어느)[^.\n]{0,45}(?:위협|폭풍|극한\s*날씨|날씨)|날씨[^.\n]{0,45}(?:재난이\s*아니라|위협이\s*아니라)[^.\n]{0,25}(?:보너스|이점|장점))/u],
  ["es-broad-threat-benefit", /(?:(?:cada|tod[oa]s?|cualquier)[^.\n]{0,45}(?:amenaza|tormenta|clima\s+extremo|fen[oó]meno)[^.\n]{0,65}(?:ventaja|bonus|bono|beneficio|provecho)|(?:ventaja|bonus|bono|beneficio|provecho)[^.\n]{0,65}(?:cada|tod[oa]s?|cualquier)[^.\n]{0,45}(?:amenaza|tormenta|clima|fen[oó]meno)|(?:clima|tiempo)[^.\n]{0,45}(?:no\s+(?:es|sea)|en\s+vez\s+de)[^.\n]{0,25}(?:desastre|amenaza)[^.\n]{0,25}(?:bonus|bono|ventaja))/iu],
  ["ko-drought-profit-benefit", /(?:Harsh Dry Season|가뭄|건기)[^.\n]{0,90}(?:수익|이익)(?:\s*(?:내기|보기|기회))?/u],
  ["es-drought-profit-benefit", /(?:aprovecha(?:r)?(?:\s+el)?\s+(?:momento\s+de\s+la\s+)?sequ[ií]a|sac(?:o|ar)\s+provecho\s+de\s+la\s+sequ[ií]a|gan(?:a|ar)\s+con[^.\n]{0,80}Harsh Dry Season|benefici(?:o|arse)[^.\n]{0,60}sequ[ií]a)/iu],
  ["zh-shop-crop-pressure", /(?:(?:商店|店铺|店舖|店內|店内)[^。\n]{0,45}(?:作物|农产品|農產品|农货|農貨)[^。\n]{0,45}(?:压力|壓力|紧张|緊張|吃紧|吃緊|短缺)|(?:作物|农产品|農產品|农货|農貨)[^。\n]{0,45}(?:压力|壓力|紧张|緊張|吃紧|吃緊|短缺)[^。\n]{0,45}(?:商店|店铺|店舖|店內|店内))/u],
  ["en-whole-layer-destruction", /(?:(?:storm|acid rain)[^.\n]{0,70}(?:wipe|destroy|erase|ruin)[^.\n]{0,30}(?:whole|entire)[ -](?:layer|tier)|(?:whole|entire)[ -](?:layer|tier)[^.\n]{0,70}(?:wiped|destroyed|erased|ruined)[^.\n]{0,30}(?:storm|acid rain))/iu],
  ["zh-whole-layer-destruction", /(?:(?:风暴|風暴|酸雨)[^。\n]{0,55}(?:毁掉|毀掉|摧毁|摧毀|全毁|全毀|清空)[^。\n]{0,25}(?:整层|整層|全层|全層)|(?:整层|整層|全层|全層)[^。\n]{0,55}(?:被)?(?:风暴|風暴|酸雨)[^。\n]{0,25}(?:毁掉|毀掉|摧毁|摧毀|全毁|全毀|清空))/u],
  ["ja-whole-layer-destruction", /(?:(?:嵐|酸性雨)[^。\n]{0,55}(?:一層|層全体)[^。\n]{0,25}(?:全滅|壊滅|破壊|消し去)|(?:一層|層全体)[^。\n]{0,55}(?:嵐|酸性雨)[^。\n]{0,25}(?:全滅|壊滅|破壊|消し去))/u],
  ["ko-whole-layer-destruction", /(?:(?:폭풍|산성비)[^.\n]{0,55}(?:한\s*층|층\s*전체)[^.\n]{0,25}(?:전멸|파괴|쓸어버)|(?:한\s*층|층\s*전체)[^.\n]{0,55}(?:폭풍|산성비)[^.\n]{0,25}(?:전멸|파괴|쓸어버))/u],
  ["es-whole-layer-destruction", /(?:(?:tormenta|lluvia\s+ácida)[^.\n]{0,70}(?:borra|destruye|arrasa|elimina|acaba)[^.\n]{0,35}(?:(?:capa|nivel)\s+(?:entera|completa)|tod[oa]\s+un[ao]?\s+(?:capa|nivel))|(?:capa|nivel)\s+(?:entera|completa)[^.\n]{0,70}(?:tormenta|lluvia\s+ácida)[^.\n]{0,30}(?:borra|destruye|arrasa|elimina)|(?:capa|nivel)\s+(?:entera|completa)[^.\n]{0,45}(?:borra|destruye|arrasa|elimina|queda\s+destruid[oa]|acaba\s+por\s+completo)[^.\n]{0,45}(?:tormenta|lluvia\s+ácida)|tod[oa]\s+un[ao]?\s+(?:capa|nivel)[^.\n]{0,45}(?:destruid[oa]|arrasad[oa]|eliminad[oa]))/iu],
  ["en-weather-profit-frame", /(?:weather\s+timing[^.\n]{0,60}(?:profit|math|returns?)[^.\n]{0,30}(?:completely|entirely)|(?:profit|math|returns?)[^.\n]{0,60}weather\s+timing|(?:storm|extreme weather)[^.\n]{0,45}(?:powers?\s+clever\s+farms?|guarantees?\s+(?:farm\s+)?success)|community[- ]verified\s+(?:for\s+)?1\.0)/iu],
  ["zh-weather-profit-frame", /(?:(?:天气|天氣)[^。\n]{0,45}(?:收益|利润|利潤|回报|回報)[^。\n]{0,25}(?:完全|彻底|徹底)(?:改变|改變)|(?:聪明|聰明)农场|(?:社区|社區|社群)(?:已经|已經)(?:验证|驗證)(?:过|過)?的(?:打法|方法))/u],
  ["ja-weather-profit-frame", /(?:(?:天候|天気)[^。\n]{0,45}(?:収支|利益|儲け)[^。\n]{0,25}(?:根本|完全)(?:に)?変え|賢い農場|コミュニティが検証済みの方法)/u],
  ["ko-weather-profit-frame", /(?:(?:날씨|기상)[^.\n]{0,45}(?:수익|이익|수지)[^.\n]{0,30}(?:완전히|통째로)\s*(?:바꾸|바꿉|변화)|영리한\s*농장|커뮤니티가\s*이미\s*검증한\s*방법)/u],
  ["es-weather-profit-frame", /(?:(?:timing|momento)\s+del\s+clima[^.\n]{0,55}(?:beneficio|rentabilidad|cálculo|lo\s+cambia\s+todo)|(?:beneficio|rentabilidad|cálculo)[^.\n]{0,55}(?:timing|momento)\s+del\s+clima|granjas?\s+inteligentes?|verificad[oa]\s+por\s+la\s+comunidad)/iu],
  ["community-profit-guidance", /(?:community[^.\n]{0,55}(?:consensus|agree|recommend|favo(?:u)?rite|verified)[^.\n]{0,70}(?:profit|money|return|margin|loop|processing)|(?:社区|社區|社群)[^。\n]{0,55}(?:共识|共識|公认|公認|推荐|推薦|验证|驗證)[^。\n]{0,70}(?:获利|獲利|赚钱|賺錢|收益|利润|利潤|回报|回報|路线|路線|循环|循環)|コミュニティ[^。\n]{0,55}(?:合意|おすすめ|推奨|検証)[^。\n]{0,70}(?:利益|収益|稼|ループ)|커뮤니티[^.\n]{0,55}(?:의견|합의|추천|검증)[^.\n]{0,70}(?:수익|이익|돈|루프)|(?:comunidad|consenso)[^.\n]{0,55}(?:coincide|recomienda|verifica|acuerda)[^.\n]{0,70}(?:beneficio|rentabilidad|ganar|dinero|ruta|bucle))/iu],
];
const contentIntegrityPatterns = [
  ...semanticFamilyPatterns,
  ["es-farming-malformed", /(?:turbinas\s+automatizaci[oó]ns|cultivoss|cultivosr)/iu],
  ["ko-game-name-drift", /도록\s*타운|도로크\s*타운/u],
  ["zh-cn-farming-intro-malformed", /学会计什么/u],
  ["zh-tw-farming-intro-malformed", /學會計什麼/u],
  ["ko-farming-grammar-malformed", /(?:커집습니다|커짐하고)/u],
  ["ko-automation-particle", /농업 자동화이/u],
  ["en-update-log-grammar-malformed", /not a selected highlights/iu],
  ["es-automation-mojibake", /automatizaciÃ(?:³|\u00b3)n|automatizaciÃ/i],
  ["hj-garbled-mojibake", /锟斤拷/u],
  ["unsourced-18183-numbers", /18183/u],
  ["fabricated-12-no-system-gift", /(?:Gabryl|Gerald|Kel|Kuma|Licca|Lightman|Loveyer|Mira|Paiea|Pike|Shylock|Witch)[^.\n。]{0,60}\b(?:loves|likes|dislikes)\b(?=\s+(?:(?:a|an|the)\s+)?[A-Z])/iu],
  ["unsupported-money-quantitative", /(?:processing|procesad[oa]|加工|處理|加工品|가공)[^.。\n]{0,100}10\s*[-–—]\s*20\s*%|10\s*[-–—]\s*20\s*%[^.。\n]{0,100}(?:processing|procesad[oa]|加工|處理|加工品|가공)/iu],
  ["unsupported-money-upgrade-multiplier", /(?:backpack|mochila|背包|リュック|배낭)[^.。\n]{0,100}(?:roughly\s+)?(?:double|doubles|2x|twofold|两倍|兩倍|2\s*倍|두\s*배|duplica)/iu],
  ["unsupported-money-level-two-rod", /(?:level|nivel|等级|等級|レベル|레벨)\s*2[^.。\n]{0,35}(?:rod|caña|鱼竿|魚竿|釣り竿|낚싯대)/iu],
  ["unsupported-money-compounding", /(?:(?:income|profit|margin|收益|利润|利潤|利益|収益|수익|이익|beneficio|margen)[^.。\n]{0,50}(?:compound|compounds|compounding|复利|複利|累积|累積|積み上|복리|누적|acumula|compuest[oa])|(?:compound|compounds|compounding|复利|複利|累积|累積|積み上|복리|누적|acumula|compuest[oa])[^.。\n]{0,50}(?:income|profit|margin|收益|利润|利潤|利益|収益|수익|이익|beneficio|margen))/iu],
];
const semanticSourceFaults = {
  "semantic-drought-source": "作物压力上升后卖出库存，就能从第 4 月旱灾获利。作物壓力升高時賣出庫存，可從旱災獲利。",
  "semantic-flat-en-source": "A one-level horizontal field attracts storms and creates a drought risk.",
  "semantic-flat-source": "嵐が狙うのは平らな一枚畑なので、単層の配置は避ける。",
  "semantic-benefit-source": "이점으로 만들 수 있는 것은 모든 극한 날씨 위협입니다.",
  "semantic-shop-pressure-source": "作物供应变少以后，商店里的农产品压力会明显增加。",
  "semantic-whole-layer-source": "Acid rain can erase an entire tier of crops; storms destroy a whole layer too.",
  "semantic-weather-profit-source": "Weather timing changes the profit math completely, a community-verified advantage for clever farms.",
};
const removedGameplayPattern = /(?:Lightman[^.\n。]{0,90}(?:tutorial|rod|教程|鱼竿|魚竿|チュートリアル|竿|튜토리얼|낚싯대|caña)|13\s*(?:tank-only|aquatic|fish)[^.\n]{0,90}(?:parent|pair|breed)|(?:specific|predetermined)\s+(?:breeding\s+)?(?:parents|pairs)|(?:13\s*种鱼缸|特定亲本|特定親本|水槽限定13種|特定の親|수조\s*전용\s*13종|특정\s*부모|13\s*especies[^.\n]{0,70}(?:padres|parejas)))/iu;
const unsupportedPhasePattern = /(?:two[- ](?:stage|phase)|automation[^.\n]{0,70}(?:(?:two separate|initial and later) phases|(?:first|initial) phase[^.\n]{0,45}(?:second|later) phase)|两阶段|两个(?:阶段|环节)|先[^。\n]{0,35}再[^。\n]{0,35}(?:两个环节|分为两步)|兩階段|兩個(?:階段|環節)|先[^。\n]{0,35}再[^。\n]{0,35}(?:兩個環節|分為兩步)|二段階|前半[^。\n]{0,35}後半[^。\n]{0,35}分か|2단계|앞 단계[^.\n]{0,35}뒤 단계|(?:dos|dos distintas)\s+(?:etapas|fases)|fase inicial[^.\n]{0,45}(?:otra|fase) posterior)/iu;
const unsupportedAutomationPatterns = [
  ["phase", unsupportedPhasePattern],
  ["order-en", /(?:energy|power)\s*(?:first|→|->)[^.\n]{0,70}stations?\s*(?:second|next|→|->)[^.\n]{0,70}drones?\s*(?:last|finally|then)|automation[^.\n]{0,110}build[^.\n]{0,35}(?:in )?(?:this|the) order/iu],
  ["architecture-en", /automation[^.\n]{0,80}(?:has|uses|consists? of|is divided into)\s*(?:two|three|2|3)\s*(?:parts?|layers?|stages?|phases?)/iu],
  ["timing-en", /early[-–— ]*mid(?:[- ]game)?[^\n]{0,180}mid[- ]game[^\n]{0,180}(?:late[- ]game|endgame)/iu],
  ["consensus-en", /(?:(?:most players|community (?:consensus|reports?|agrees?|recommends?))[^.\n]{0,170}(?:automation|automate|drone station)|(?:automation|automate|drone station)[^.\n]{0,170}(?:most players|community (?:consensus|reports?|agrees?|recommends?)))/iu],
  ["order-zh", /先[^。\n]{0,25}(?:能源|电力|電力|供能)[^。\n]{0,35}再[^。\n]{0,25}(?:站点|站點|基地|无人机站|無人機站)[^。\n]{0,35}(?:然后|然後|最后|最後|再让|再讓)[^。\n]{0,25}(?:无人机|無人機)/u],
  ["architecture-zh", /(?:自动化|自動化)[^。\n]{0,80}(?:分为|分為|有|包括|由)[^。\n]{0,20}(?:两|兩|三|2|3)(?:个|個)?(?:部分|层|層|阶段|階段|环节|環節|步骤|步驟)/u],
  ["timing-zh", /前期[-至到–— ]*中期[^\n]{0,180}中期[^\n]{0,180}(?:后期|後期|终局|終局)/u],
  ["consensus-zh", /(?:多数玩家|多數玩家|社区共识|社群共識|社区报告中最常见|社群報告中最常見)[^。\n]{0,180}(?:自动化|自動化|无人机|無人機)/u],
  ["order-ja", /(?:まず|最初に)[^。\n]{0,25}(?:エネルギー|電力)[^。\n]{0,40}(?:次に|その後)[^。\n]{0,25}(?:基地|ステーション)[^。\n]{0,40}(?:そして|最後に)[^。\n]{0,20}ドローン/u],
  ["architecture-ja", /オートメーション[^。\n]{0,70}(?:2|3|二|三)(?:つの)?(?:層|段階|部分|フェーズ)/u],
  ["timing-ja", /序盤[～~-–— ]*中盤[^\n]{0,180}中盤[^\n]{0,180}(?:終盤|エンドゲーム)/u],
  ["consensus-ja", /コミュニティ[^。\n]{0,90}(?:報告|合意|推奨)[^。\n]{0,120}(?:オートメーション|自動化|ドローン)/u],
  ["order-ko", /(?:먼저|우선)[^.\n]{0,25}(?:에너지|전력)[^.\n]{0,40}(?:다음|그 다음)[^.\n]{0,25}(?:기지|스테이션)[^.\n]{0,40}(?:마지막|그 후)[^.\n]{0,20}드론/u],
  ["architecture-ko", /자동화[^.\n]{0,70}(?:2|3|두|세)\s*(?:개)?\s*(?:층|단계|부분|페이즈)/u],
  ["timing-ko", /초[-–—~ ]*중반[^\n]{0,180}중반[^\n]{0,180}(?:후반|엔드게임)/u],
  ["consensus-ko", /커뮤니티[^.\n]{0,90}(?:보고|합의|추천)[^.\n]{0,120}(?:자동화|드론)/u],
  ["order-es", /energ[ií]a\s+primero[^.\n]{0,60}estaciones?\s+despu[eé]s[^.\n]{0,60}(?:drones?\s+(?:al final|por último)|luego[^.\n]{0,20}drones?)/iu],
  ["architecture-es", /automatizaci[oó]n[^.\n]{0,80}(?:tiene|consta de|se divide en)\s*(?:dos|tres|2|3)\s*(?:partes|capas|etapas|fases)/iu],
  ["timing-es", /inicio[-–— ]*medio[^\n]{0,180}medio[^\n]{0,180}(?:final|fin del juego)/iu],
  ["consensus-es", /(?:comunidad|consenso)[^.\n]{0,90}(?:coincide|informa|recomienda)[^.\n]{0,130}(?:automatizaci[oó]n|drones?)/iu],
];
const claimLocales = ["en", "zh-CN", "zh-TW", "ja", "ko", "es"];
const automationCorePatterns={
  en:/\b(?:automation|automated|automatic farming)\b/iu,"zh-CN":/(?:自动化|自动作业)/u,"zh-TW":/(?:自動化|自動作業)/u,
  ja:/(?:オートメーション|自動化|自動作業)/u,ko:/(?:농업 자동화|자동화|자동 작업)/u,es:/(?:automatizaci[oó]n|tareas autom[aá]ticas)/iu,
};
const droneStationPatterns={en:/\bdrone stations?\b/iu,"zh-CN":/无人机站/u,"zh-TW":/無人機站/u,ja:/ドローン基地/u,ko:/드론 기지/u,es:/\bestaciones? de drones?\b/iu};
const claimLexicons = {
  en: {
    auto:/\b(?:automation|automated|automatic farming|drone stations?|work ?stations?)\b/iu,
    power:/\b(?:power grid|energy grid|grid power|energy|electricity|power|solar|wind)\b/iu,
    station:/\b(?:(?:work|farm|drone) ?stations?|bases?)\b/iu,
    drone:/\b(?:drones?|drone crews?|drone fleet)\b/iu,
    relation:/(?:→|->|\b(?:first|before|then|next|after|finally|last|follow(?:s|ing)?|lead(?:s)? to|progress(?:es)? through|unlock(?:s|ed)?|open(?:s|ed)?|enable(?:s|d)?|powers|powered|feed(?:s)?|drive(?:s)?|require(?:s|d)?|depend(?:s|ed)?|must|only after|once)\b)/iu,
    orderCausality:/(?:→|->|\bfirst\b[^.!?]{0,120}\b(?:then|next|finally|last)\b|\b(?:then|next)\b[^.!?]{0,120}\b(?:finally|last)\b|\bin (?:this|the) order\b|\b(?:build|progress(?:es)?)\b[^.!?]{0,80}\bsequence\b)/iu,
    prerequisite:/\b(?:prerequisite|precondition|required before|must (?:be|come|finish)|need(?:s|ed)? to .* before|only after)\b/iu,
    dependency:/\b(?:depend(?:s|ed|ency)?|requir(?:e|es|ed)|rel(?:y|ies) on|powered by|drives?|feeds?|leads? to|unlocks?|enables?)\b/iu,
    architecture:/\b(?:architecture|stack|layers?|tiers?|stages?|phases?|pipeline|chain|whole system|fixed system|standard system|technology tree|tech tree)\b/iu,
    techTree:/\b(?:technology|tech) tree\b/iu,
    early:/\b(?:early(?: game)?|opening stretch|first stretch|beginning|starting days?)\b/iu,
    mid:/\b(?:mid(?:dle)?[- ]?game|midpoint|middle stretch|halfway)\b/iu,
    late:/\b(?:late(?: game)?|endgame|ending stretch|final stretch|near the ending)\b/iu,
    community:/\b(?:players?|community)\b/iu,
    general:/\b(?:most|many|generally|usually|widely|consensus|standard|common|agree(?:s|d)?|recommend(?:s|ed)?|report(?:s|ed)?|treat(?:s|ed) as)\b/iu,
    route:/\b(?:route|roadmap|path|order|sequence|way)\b/iu,
    rare:/\b(?:(?:rare|exceptional|uncommon|trophy|scarce) (?:fish|catch|haul)|(?:fish|catch) of exceptional rarity)\b/iu,
    parts:/\b(?:(?:advanced|high[- ]grade|high[- ]level) (?:drone |tool )?(?:parts?|components?)|(?:drone|tool) (?:parts?|components?))\b/iu,
    direct:/\b(?:drop(?:s|ped)?|yield(?:s|ed)?|give(?:s|n)?|provide(?:s|d)?|produce(?:s|d)?|turn(?:s|ed)? into|become(?:s)?|straight into|directly|immediately)\b/iu,
    upgrade:/\b(?:(?:next )?(?:drone |tool )?(?:upgrade|improvement|build)s?)\b/iu,
    fund:/\b(?:fund(?:s|ed)?|financ(?:e|es|ed)|pay(?:s|ing)? for|cover(?:s|ed)?|afford(?:s|ed)?|straight to|convert(?:s|ed)? .* value|worth enough)\b/iu,
    hands:/\b(?:hands[- ]on|playtest(?:ed|ing)?|tested ourselves|testing ourselves|real[- ]device test|real hardware test|on-device test)\b/iu,
    realDevice:/\b(?:real[- ]device|real hardware|physical device|on-device)\b/iu,
    progress:/\b(?:currently|right now|now testing|in progress|being edited|we are|we have|our current|version 1\.0|1\.0 build)\b/iu,
    persona:/\b(?:we|our|this guide|this site|the site|our team)\b/iu,
    automationBoundary:/\b(?:do(?:es)? not|not|no|without)\b[^.!?]{0,70}\b(?:infer|imply|establish|show|claim|dependency|prerequisite|order|sequence|progression|technology tree)\b|\b(?:separate|independent) components?\b|\b(?:separately|independently) (?:list|name|describe)s?\b/iu,
    testBoundary:/\b(?:not|never|have not|has not|without)\b[^.!?]{0,70}\b(?:hands[- ]on|playtest|tested|testing|verified)\b|\b(?:pending source verification|awaiting source verification|source verification pending)\b/iu,
  },
  "zh-CN": {
    auto:/(?:自动化|自动作业|无人机站|工作站)/u,
    power:/(?:供能|能源|电力|电网|太阳能|风力)/u,
    station:/(?:工作站|站点|基地|无人机站)/u,
    drone:/无人机/u,
    relation:/(?:→|->|前置|依赖|必须|需要|先|再|然后|之后|才(?:能|会)|解锁|开放|带来|通向|驱动|供给)/u,
    prerequisite:/(?:前置|先决|必须先|需要先|完成[^。]{0,25}才|只有[^。]{0,25}后)/u,
    dependency:/(?:依赖|取决于|驱动|供给|带动|通向|解锁|开放)/u,
    architecture:/(?:架构|体系|固定|标准|层|阶段|环节|链路|整条|全套|科技树)/u,
    techTree:/科技树/u,
    early:/(?:前期|开局|起步阶段|最初阶段)/u,
    mid:/(?:中期|中段|流程过半|中盘)/u,
    late:/(?:后期|终局|结局前|收尾阶段)/u,
    community:/(?:玩家|社区|社群)/u,
    general:/(?:多数|大多数|普遍|通常|公认|共识|主流|一致|标准|都认为|常见)/u,
    route:/(?:路线|路径|顺序|流程|打法|路线图)/u,
    rare:/(?:稀有|罕见|珍稀|极品|特殊)[^。！？\n]{0,18}(?:鱼|渔获|捕获)/u,
    parts:/(?:高级|高阶)[^。！？\n]{0,18}(?:无人机|工具)?[^。！？\n]{0,12}(?:部件|零件|组件|配件)|(?:无人机|工具)(?:部件|零件|组件|配件)/u,
    direct:/(?:掉落|产出|直接(?:得到|获得|变成)|换来|变成|给出|带来|立刻|马上)/u,
    upgrade:/(?:下一次|下一项|下一轮)?[^。！？\n]{0,12}(?:无人机|工具)?(?:升级|强化|改造)/u,
    fund:/(?:资助|支付|提供资金|筹够|覆盖|抵掉|直接换成|价值直接|足够支付)/u,
    hands:/(?:实测|亲测|试玩|上手测试|实机|真机)/u,
    realDevice:/(?:实机|真机|真实设备)/u,
    progress:/(?:正在|当前|目前|已经|整理中|测试中|1\.0)/u,
    persona:/(?:我们|本站|本指南|编辑组|团队)/u,
    automationBoundary:/(?:不|未|没有|不据此)[^。！？\n]{0,40}(?:推断|表示|代表|建立|声称|依赖|前置|顺序|科技树)|(?:分别|独立)列出/u,
    testBoundary:/(?:未|没有|尚未|未经|未由|不声称|不代表)[^。！？\n]{0,45}(?:实测|亲测|试玩|实机|测试)|(?:实测|亲测|试玩|实机|测试)前|(?:待|仍待)[^。！？\n]{0,35}(?:来源|资料)[^。！？\n]{0,20}(?:核对|核实)/u,
  },
  "zh-TW": {
    auto:/(?:自動化|自動作業|無人機站|工作站)/u,
    power:/(?:供能|能源|電力|電網|太陽能|風力)/u,
    station:/(?:工作站|站點|基地|無人機站)/u,
    drone:/無人機/u,
    relation:/(?:→|->|前置|依賴|必須|需要|先|再|然後|之後|才(?:能|會)|解鎖|開放|帶來|通向|驅動|供給)/u,
    prerequisite:/(?:前置|先決|必須先|需要先|完成[^。]{0,25}才|只有[^。]{0,25}後)/u,
    dependency:/(?:依賴|取決於|驅動|供給|帶動|通向|解鎖|開放)/u,
    architecture:/(?:架構|體系|固定|標準|層|階段|環節|鏈路|整條|全套|科技樹)/u,
    techTree:/科技樹/u,
    early:/(?:前期|開局|起步階段|最初階段)/u,
    mid:/(?:中期|中段|流程過半|中盤)/u,
    late:/(?:後期|終局|結局前|收尾階段)/u,
    community:/(?:玩家|社區|社群)/u,
    general:/(?:多數|大多數|普遍|通常|公認|共識|主流|一致|標準|都認為|常見)/u,
    route:/(?:路線|路徑|順序|流程|打法|路線圖)/u,
    rare:/(?:稀有|罕見|珍稀|極品|特殊)[^。！？\n]{0,18}(?:魚|漁獲|捕獲)/u,
    parts:/(?:高級|高階)[^。！？\n]{0,18}(?:無人機|工具)?[^。！？\n]{0,12}(?:部件|零件|組件|配件)|(?:無人機|工具)(?:部件|零件|組件|配件)/u,
    direct:/(?:掉落|產出|直接(?:得到|獲得|變成)|換來|變成|給出|帶來|立刻|馬上)/u,
    upgrade:/(?:下一次|下一項|下一輪)?[^。！？\n]{0,12}(?:無人機|工具)?(?:升級|強化|改造)/u,
    fund:/(?:資助|支付|提供資金|籌夠|覆蓋|抵掉|直接換成|價值直接|足夠支付)/u,
    hands:/(?:實測|親測|試玩|上手測試|實機|真機)/u,
    realDevice:/(?:實機|真機|真實裝置|真實設備)/u,
    progress:/(?:正在|當前|目前|已經|整理中|測試中|1\.0)/u,
    persona:/(?:我們|本站|本指南|編輯組|團隊)/u,
    automationBoundary:/(?:不|未|沒有|不據此)[^。！？\n]{0,40}(?:推斷|表示|代表|建立|聲稱|依賴|前置|順序|科技樹)|(?:分別|獨立)列出/u,
    testBoundary:/(?:未|沒有|尚未|未經|未由|不聲稱|不代表)[^。！？\n]{0,45}(?:實測|親測|試玩|實機|測試)|(?:實測|親測|試玩|實機|測試)前|(?:待|仍待)[^。！？\n]{0,35}(?:來源|資料)[^。！？\n]{0,20}(?:核對|核實)/u,
  },
  ja: {
    auto:/(?:オートメーション|自動化|自動作業|ドローン基地|作業ステーション)/u,
    power:/(?:電力網|送電網|電力|エネルギー|太陽光|風力)/u,
    station:/(?:作業ステーション|ステーション|基地|ドローン基地)/u,
    drone:/ドローン/u,
    relation:/(?:→|->|前提|必須|必要|まず|先に|次に|その後|最後に|してから|経て|解放|開放|依存|駆動|つながる|導く)/u,
    prerequisite:/(?:前提|必須|必要条件|先に[^。]{0,25}(?:必要|ないと)|終えてから|済ませてから)/u,
    dependency:/(?:依存|駆動|つながる|導く|解放|必要とする)/u,
    architecture:/(?:アーキテクチャ|構成|固定|標準|層|段階|フェーズ|スタック|チェーン|テックツリー)/u,
    techTree:/(?:テックツリー|(?:一つ|ひとつ|一個|単一)の(?:技術)?ツリー)/u,
    early:/(?:序盤|開始直後|冒頭|初期)/u,
    mid:/(?:中盤|中ほど|折り返し|中期)/u,
    late:/(?:終盤|エンドゲーム|結末前|最後の区間)/u,
    community:/(?:プレイヤー|コミュニティ)/u,
    general:/(?:多く|大半|一般に|通常|定番|標準|合意|総意|主流|一致|推奨)/u,
    route:/(?:ルート|順番|順序|経路|ロードマップ|進め方)/u,
    rare:/(?:レア|希少|珍しい|特別な)[^。！？\n]{0,18}(?:魚|釣果|獲物|キャッチ)/u,
    parts:/(?:高級|上位|高度)[^。！？\n]{0,18}(?:ドローン|道具)?[^。！？\n]{0,12}(?:部品|パーツ|コンポーネント)|(?:ドローン|道具)(?:部品|パーツ)/u,
    direct:/(?:落とす|ドロップ|生み出す|直接(?:得る|入手)|そのまま|直結|変わる|手に入る|すぐ)/u,
    upgrade:/(?:次の)?[^。！？\n]{0,12}(?:ドローン|道具)?(?:強化|アップグレード|改造)/u,
    fund:/(?:資金|費用を賄う|支払える|まかなえる|直接回せる|価値がそのまま|一匹で)/u,
    hands:/(?:実機|実地テスト|プレイテスト|手元で検証|実際にプレイ)/u,
    realDevice:/(?:実機|実端末|実際の端末)/u,
    progress:/(?:現在|いま|編集中|検証中|テスト中|1\.0)/u,
    persona:/(?:当サイト|本ガイド|私たち|編集部|チーム)/u,
    automationBoundary:/(?:推測しません|示しません|意味しません|依存関係はない|順序では(?:ない|ありません)|別々|個別に列挙)/u,
    testBoundary:/(?:検証してい(?:ない|ません)|テストしてい(?:ない|ません)|実機確認してい(?:ない|ません)|未検証|出典確認待ち|資料との照合待ち)/u,
  },
  ko: {
    auto:/(?:농업 자동화|자동화|자동 작업|드론 기지|작업 스테이션)/u,
    power:/(?:전력망|전력|에너지|태양광|풍력)/u,
    station:/(?:작업 스테이션|스테이션|기지|드론 기지)/u,
    drone:/드론/u,
    relation:/(?:→|->|전제|필수|필요|먼저|다음|그 후|마지막|이후|해금|잠금 해제|의존|구동|이어지|거쳐)/u,
    orderCausality:/(?:→|->|먼저[^.!?。\n]{0,120}(?:다음|그 다음|마지막)|(?:다음|그 다음)[^.!?。\n]{0,120}마지막|(?:이|그)\s*순서(?:로|대로)|순서대로)/u,
    prerequisite:/(?:전제|필수 조건|먼저[^.]{0,25}(?:완성|구축|필요)|끝내야|완료해야)/u,
    dependency:/(?:의존|구동|이어지|해금|필요로|공급해야)/u,
    architecture:/(?:아키텍처|구조|고정|표준|층|단계|페이즈|스택|체인|테크 트리)/u,
    techTree:/테크\s*트리/u,
    early:/(?:초반|시작 구간|초기)/u,
    mid:/(?:중반|중간 지점|절반)/u,
    late:/(?:후반|엔드게임|결말 직전|마지막 구간)/u,
    community:/(?:플레이어|커뮤니티)/u,
    general:/(?:대부분|많은|보통|일반적으로|정석|표준|합의|주류|일치|추천)/u,
    route:/(?:루트|경로|순서|로드맵|진행법)/u,
    rare:/(?:희귀|특별한|보기 드문)[^.!?。\n]{0,18}(?:물고기|어획|낚은 것|캐치)/u,
    parts:/(?:고급|상급)[^.!?。\n]{0,18}(?:드론|도구)?[^.!?。\n]{0,12}(?:부품|컴포넌트)|(?:드론|도구)\s*부품/u,
    direct:/(?:드롭|떨어뜨|산출|직접(?:얻|주)|그대로|바로|변하|손에 넣)/u,
    upgrade:/(?:다음)?[^.!?。\n]{0,12}(?:드론|도구)?(?:업그레이드|강화|개조)/u,
    fund:/(?:자금|비용을 충당|값을 치르|지불|바로 돌리|가치가 곧|한 마리로)/u,
    hands:/(?:실기기|실제 기기|직접 플레이|플레이테스트|직접 테스트)/u,
    realDevice:/(?:실기기|실제 기기|물리 기기)/u,
    progress:/(?:현재|지금|진행 중|편집 중|테스트 중|1\.0)/u,
    persona:/(?:우리|이 가이드|이 사이트|편집팀|팀)/u,
    automationBoundary:/(?:추론하지|의미하지|나타내지|뜻하지|의존 관계가 아니|순서가 아니|별도|각각 설명)/u,
    testBoundary:/(?:테스트하지 않았|검증하지 않았|직접 확인하지 않았|미검증|출처 확인 대기|자료 확인 대기)/u,
  },
  es: {
    auto:/(?:automatizaci[oó]n|tareas autom[aá]ticas|estaciones? de drones?|estaciones? de trabajo)/iu,
    power:/(?:red el[eé]ctrica|red de energ[ií]a|energ[ií]a|electricidad|solar|e[oó]lica)/iu,
    station:/(?:estaciones? de trabajo|estaciones?|bases?|estaciones? de drones?)/iu,
    drone:/drones?/iu,
    relation:/(?:→|->|\b(?:requisito|prerrequisito|primero|antes|despu[eé]s|luego|al final|solo tras|una vez|desbloquea|abre|depende|alimenta|impulsa|conduce a|requiere)\b)/iu,
    prerequisite:/\b(?:prerrequisito|requisito previo|debe .* antes|hay que .* antes|solo tras|hasta que .* no)\b/iu,
    dependency:/\b(?:depende|requiere|alimenta|impulsa|conduce a|desbloquea|abre paso|necesita)\b/iu,
    architecture:/\b(?:arquitectura|estructura|fij[oa]|est[aá]ndar|capas?|etapas?|fases?|pila|cadena|sistema completo|[aá]rbol tecnol[oó]gico)\b/iu,
    techTree:/[aá]rbol (?:de tecnolog[ií]a|tecnol[oó]gico)/iu,
    early:/\b(?:inicio|temprano|tramo inicial|primeros d[ií]as)\b/iu,
    mid:/\b(?:mitad|medio juego|punto medio|tramo central)\b/iu,
    late:/\b(?:final|fin del juego|tramo final|antes del desenlace)\b/iu,
    community:/\b(?:jugadores?|comunidad)\b/iu,
    general:/\b(?:mayor[ií]a|muchos|normalmente|generalmente|est[aá]ndar|consenso|habitual|coincide|recomienda|considera)\b/iu,
    route:/\b(?:ruta|camino|orden|secuencia|hoja de ruta|forma)\b/iu,
    rare:/\b(?:(?:pez|peces|captura|capturas) (?:rar[oa]s?|excepcional(?:es)?|inusual(?:es)?)|(?:rar[oa]s?|excepcional(?:es)?) (?:pez|peces|captura|capturas))\b/iu,
    parts:/\b(?:(?:piezas?|componentes?) (?:avanzad[oa]s?|de alto nivel)(?: de dron| de herramienta)?|(?:piezas?|componentes?) de (?:dron|herramienta))\b/iu,
    direct:/\b(?:sueltan?|dejan?|dan|producen?|entregan?|se convierten? en|directamente|al instante|de inmediato)\b/iu,
    upgrade:/\b(?:pr[oó]xima )?(?:mejora|actualizaci[oó]n|build|mejora del dron|mejora de herramienta)\b/iu,
    fund:/\b(?:financian?|pagan?|cubren?|permiten costear|va directo a|convierte .* valor|basta para|costea)\b/iu,
    hands:/\b(?:prueba pr[aá]ctica|pruebas? de primera mano|hemos probado|estamos probando|playtest|prueba en dispositivo real|hardware real)\b/iu,
    realDevice:/\b(?:dispositivo real|hardware real|equipo f[ií]sico)\b/iu,
    progress:/\b(?:ahora|actualmente|en curso|estamos|hemos|editando|probando|versi[oó]n 1\.0|1\.0)\b/iu,
    persona:/\b(?:nosotros|hemos|estamos|esta gu[ií]a|este sitio|nuestro equipo)\b/iu,
    automationBoundary:/\b(?:no|sin)\b[^.!?]{0,70}\b(?:inferir|infiere|establecer|establece|implicar|implica|dependencia|prerrequisito|orden|secuencia|[aá]rbol tecnol[oó]gico)\b|\bcomponentes separados\b/iu,
    testBoundary:/\b(?:no hemos|no se ha|sin haber|a[uú]n no)\b[^.!?]{0,70}\b(?:probado|prueba|verificado)|\b(?:pendiente de verificar con fuentes|pendiente de comprobaci[oó]n de fuentes)\b/iu,
  },
};
const decodeClaimText = value => String(value)
  .replace(/&amp;/giu,"&").replace(/&quot;/giu,'"').replace(/&#(?:39|x27);/giu,"'")
  .replace(/&lt;/giu,"<").replace(/&gt;/giu,">").replace(/\s+/gu," ").trim();
const sentenceClaimUnits = (value, locale="en") => {
  const text = decodeClaimText(value);
  if (!text) return [];
  try {
    const segmenter = new Intl.Segmenter(locale,{granularity:"sentence"});
    return [...segmenter.segment(text)].map(item=>item.segment.trim()).filter(Boolean);
  } catch {
    return text.split(/(?<=[.!?。！？；;])\s*/u).map(item=>item.trim()).filter(Boolean);
  }
};
const collectStringLeaves = (value, out=[]) => {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStringLeaves(item,out);
  else if (value && typeof value === "object") for (const item of Object.values(value)) collectStringLeaves(item,out);
  return out;
};
const quotedSourceStrings = text => {
  const out=[];
  for (let i=0;i<text.length;i+=1) {
    const quote=text[i];
    if (quote!=="\"" && quote!=="'") continue;
    let escaped=false, value="", closed=false;
    for (i+=1;i<text.length;i+=1) {
      const ch=text[i];
      if (escaped) { value+=ch; escaped=false; continue; }
      if (ch==="\\") { escaped=true; continue; }
      if (ch===quote) { closed=true; break; }
      value+=ch;
    }
    if (closed && value.trim()) out.push(value);
  }
  return out;
};
const quotedSourceTokens = text => {
  const out=[];
  for (let i=0;i<text.length;i+=1) {
    const start=i, quote=text[i];
    if (quote!=="\"" && quote!=="'") continue;
    let escaped=false, value="", closed=false;
    for (i+=1;i<text.length;i+=1) {
      const ch=text[i];
      if (escaped) { value+=ch; escaped=false; continue; }
      if (ch==="\\") { escaped=true; continue; }
      if (ch===quote) { closed=true; break; }
      value+=ch;
    }
    if (closed && value.trim()) out.push({value,start});
  }
  return out;
};
const lastMatch = (text, regex) => {
  let found=null;
  for (const match of text.matchAll(regex)) found=match;
  return found;
};
const pythonSourceRecords = ({text,rel,slugs,defaultLocale="en"}) => quotedSourceTokens(text).map(token => {
  const prefix=text.slice(0,token.start);
  const variableLocale=lastMatch(prefix,/(?:^|\n)\s*(EN|ZH_TW|ZHTW|ZH|JA|KO|ES)(?:_[A-Z0-9]+)?(?:\.update)?\s*(?:=|\()/gmu);
  const keyedLocale=lastMatch(prefix,/["'](en|zh-CN|zh-TW|ja|ko|es)["']\s*:/gu);
  const variableMap={EN:"en",ZH:"zh-CN",ZH_TW:"zh-TW",ZHTW:"zh-TW",JA:"ja",KO:"ko",ES:"es"};
  const variableAt=variableLocale?.index ?? -1, keyedAt=keyedLocale?.index ?? -1;
  const locale=variableAt>keyedAt ? variableMap[variableLocale[1]] : (keyedLocale?.[1] || defaultLocale);
  const routeMatch=lastMatch(prefix,new RegExp(`["'](${slugs.map(item=>item.replace(/[.*+?^${}()|[\\]\\]/g,"\\$&")).join("|")})["']\\s*(?::|\\])`,"gu"));
  const slug=routeMatch?.[1];
  const route=slug ? `${locale==="en"?"":`${locale}/`}${slug}.html` : `${locale==="en"?"":`${locale}/`}index.html`;
  return {values:[token.value],locale,route,layer:"source",source:`${rel}:quoted-string`};
});
const claimUnitsOf = (input, locale="en") => {
  const values=Array.isArray(input)?input:[input];
  return values.flatMap(value=>sentenceClaimUnits(value,locale));
};
const claimFamilyHit = (input, localeHint="") => {
  const locales=localeHint?[localeHint]:claimLocales;
  for (const locale of locales) {
    const lex=claimLexicons[locale];
    if (!lex) continue;
    for (const unit of claimUnitsOf(input,locale)) {
      const powerHit=lex.power.test(unit), stationHit=lex.station.test(unit), droneHit=lex.drone.test(unit);
      const componentCount=Number(powerHit)+Number(stationHit)+Number(droneHit && !droneStationPatterns[locale].test(unit));
      const automationNamed=automationCorePatterns[locale].test(unit);
      const automationContext=lex.auto.test(unit) || componentCount>=2;
      const automationBoundary=lex.automationBoundary.test(unit);
      const hit = family => ({family,locale,excerpt:unit.replace(/\s+/gu," ").slice(0,280)});
      if (!automationBoundary && automationContext) {
        if (/(?:→|->)/u.test(unit) && lex.relation.test(unit) && componentCount>=2) return hit("automation-arrow");
        if (lex.techTree.test(unit) && (lex.auto.test(unit) || componentCount>=1)) return hit("automation-technology-tree");
        if (lex.prerequisite.test(unit) && componentCount>=2) return hit("automation-prerequisite");
        if (lex.dependency.test(unit) && componentCount>=2) return hit("automation-dependency");
        if ((lex.orderCausality || lex.relation).test(unit) && componentCount>=2) return hit("automation-order");
        if (lex.early.test(unit) && lex.mid.test(unit) && lex.late.test(unit)) return hit("automation-timing");
        if (lex.community.test(unit) && lex.general.test(unit) && (lex.route.test(unit) || lex.relation.test(unit) || componentCount>=2)) return hit("automation-consensus");
        if (lex.architecture.test(unit) && (componentCount>=2 || (automationNamed && /(?:2|3|two|three|两|兩|二|三|두|세|dos|tres)/iu.test(unit)))) return hit("automation-architecture");
      }
      if (lex.rare.test(unit) && lex.direct.test(unit) && lex.parts.test(unit)) return hit("rare-direct-parts");
      if (lex.rare.test(unit) && lex.upgrade.test(unit) && (lex.fund.test(unit) || lex.direct.test(unit))) return hit("rare-upgrade-return");
      if (!lex.testBoundary.test(unit) && lex.hands.test(unit) && (lex.progress.test(unit) || lex.persona.test(unit) || lex.realDevice.test(unit)))
        return hit(lex.realDevice.test(unit)?"hands-on-real-device":"hands-on-ongoing");
    }
  }
  return null;
};
const unsupportedAutomationHit = (text, locale="") => {
  const semantic=claimFamilyHit(text,locale);
  if (semantic && semantic.family.startsWith("automation-")) return semantic;
  for (const [family, pattern] of unsupportedAutomationPatterns) {
    const hit = String(text).match(pattern);
    if (hit) return {family, excerpt:hit[0].replace(/\s+/g," ").slice(0,260)};
  }
  return null;
};
const rareFishPatterns = [
  ["direct-drop-en", /rare (?:fish|catch(?:es)?)[^.!?\n]{0,100}(?:drop|yield|give)[^.!?\n]{0,70}(?:advanced|high[- ]grade)[^.!?\n]{0,35}(?:drone |tool )?(?:parts?|components?)/iu],
  ["upgrade-return-en", /rare (?:fish|catch(?:es)?)[^.!?\n]{0,110}(?:fund|finance|pay for|cover)[^.!?\n]{0,55}(?:upgrades?|builds?)/iu],
  ["direct-drop-zh", /稀有[鱼魚][^。！？\n]{0,100}(?:掉落|产出|產出)[^。！？\n]{0,70}(?:高级|高級|高阶)[^。！？\n]{0,35}(?:部件|零件)/u],
  ["upgrade-return-zh", /稀有[鱼魚][^。！？\n]{0,110}(?:资助|資助|支付|提供资金|提供資金)[^。！？\n]{0,55}(?:升级|升級|强化|強化)/u],
  ["direct-drop-ja", /レア魚[^。！？\n]{0,100}(?:高級|高度)[^。！？\n]{0,45}(?:部品|パーツ)[^。！？\n]{0,35}(?:落と|ドロップ)/u],
  ["upgrade-return-ja", /レア魚[^。！？\n]{0,110}(?:資金|賄う|費用)[^。！？\n]{0,55}(?:強化|アップグレード|ビルド)/u],
  ["direct-drop-ko", /희귀(?:어|한\s*물고기)[^.!。?\n]{0,100}(?:고급|상급)[^.!。?\n]{0,45}부품[^.!。?\n]{0,35}(?:드롭|떨어뜨린)/u],
  ["upgrade-return-ko", /희귀(?:어|한\s*물고기)[^.!。?\n]{0,110}(?:자금|비용|충당)[^.!。?\n]{0,55}(?:업그레이드|강화|빌드)/u],
  ["direct-drop-es", /peces? raros?[^.!?\n]{0,100}(?:sueltan|dejan|dan)[^.!?\n]{0,70}(?:piezas|componentes)[^.!?\n]{0,35}(?:avanzad[oa]s?|de alto nivel)/iu],
  ["upgrade-return-es", /peces? raros?[^.!?\n]{0,110}(?:financian|pagan|cubren|dan fondos)[^.!?\n]{0,55}(?:mejoras?|builds?)/iu],
];
const rareFishClaimHit = (text, locale="") => {
  const semantic=claimFamilyHit(text,locale);
  if (semantic && semantic.family.startsWith("rare-")) return semantic;
  for (const [family, pattern] of rareFishPatterns) {
    const hit = String(text).match(pattern);
    if (hit) return {family, excerpt:hit[0].replace(/\s+/g," ").slice(0,260)};
  }
  return null;
};
const routeLocale = rel => (String(rel).replaceAll("\\","/").match(/^(zh-CN|zh-TW|ja|ko|es)\//u) || [])[1] || "en";
const claimGuardHit = (input, locale) => claimFamilyHit(input, locale)
  || unsupportedAutomationHit(input, locale)
  || rareFishClaimHit(input, locale);
const scanClaimRecords = ({values, locale, route, layer, source}) => {
  for (const value of values) for (const unit of sentenceClaimUnits(value, locale)) {
    const hit=claimGuardHit(unit,locale);
    if (!hit) continue;
    fail(`unsupported-claim-${hit.family}-${layer}`,
      `${locale}:${route}:${layer}:${source}:${hit.excerpt || decodeClaimText(unit).slice(0,280)}`);
  }
};
const scanSourceLanguageRecords = ({values,locale,route,layer,source}) => {
  for (const value of values) {
    const hit=String(value).match(/(?:커집습니다|커짐하고)/u);
    if (hit) fail("ko-farming-grammar-malformed-source",`${locale}:${route}:${layer}:${source}:${hit[0]}`);
  }
};
const stripMarkup = value => decodeClaimText(String(value).replace(/<[^>]+>/gu," "));
const htmlClaimRecords = (html, layer) => {
  if (layer === "visible") {
    const body=html.replace(/<script[\s\S]*?<\/script>/giu," ")
      .replace(/<style[\s\S]*?<\/style>/giu," ")
      .replace(/<details[^>]*class="[^"]*(?:faq|harvest-faq)[^"]*"[^>]*>[\s\S]*?<\/details>/giu," ");
    return [...body.matchAll(/>([^<>]+)</gu)].map(match=>decodeClaimText(match[1])).filter(Boolean);
  }
  if (layer === "metadata") return [
    ...(html.match(/<title>[\s\S]*?<\/title>/giu)||[]).map(stripMarkup),
    ...[...html.matchAll(/<meta\s+[^>]*content="([^"]*)"[^>]*>/giu)].map(match=>decodeClaimText(match[1])),
  ];
  if (layer === "faq") return (html.match(/<details[^>]*class="[^"]*(?:faq|harvest-faq)[^"]*"[^>]*>[\s\S]*?<\/details>/giu)||[]).map(stripMarkup);
  if (layer === "jsonld") return [...html.matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/giu)]
    .flatMap(match=>{ try { return collectStringLeaves(JSON.parse(match[1])); } catch { return [match[1]]; } });
  return [];
};
const staleZhTwMoneyMetaPattern = /(?:區分社群技巧與官方事實|介紹加工、釣魚和前期優先事項)/u;
const independentFaults = {
  "evidence-ja-weather-source": {layer:"source", rel:"ja/weather.html", text:"雷雨で農地を破壊し、豪雨で低地が浸水する。"},
  "evidence-ja-weather-visible": {layer:"visible", rel:"ja/weather.html", text:"雷雨で農地を破壊し、豪雨で低地が浸水する。"},
  "evidence-ja-weather-metadata": {layer:"metadata", rel:"ja/weather.html", text:"雷雨で農地を破壊し、豪雨で低地が浸水する。"},
  "evidence-ja-weather-jsonld": {layer:"jsonld", rel:"ja/weather.html", text:"雷雨で農地を破壊し、豪雨で低地が浸水する。"},
  "evidence-economic-zh-profitable": {layer:"source", rel:"zh-CN/weather.html", text:"4 月前准备作物防护大有赚头。"},
  "evidence-economic-zh-cost": {layer:"source", rel:"zh-CN/make-money.html", text:"雷暴能给农场充电，这能降低自动化的运行成本。"},
  "evidence-economic-ja-cost": {layer:"source", rel:"ja/make-money.html", text:"雷雨で農場に充電すると自動化の運用コストを下げる。"},
  "evidence-economic-ko-cost": {layer:"source", rel:"ko/make-money.html", text:"뇌우가 농장 전력 충전 — 자동화 운영비를 줄임."},
  "evidence-economic-es-cost": {layer:"source", rel:"es/make-money.html", text:"Las tormentas cargan la energía y reduce los costes de la automatización."},
  "evidence-gameplay-source": {layer:"source", rel:"make-money.html", text:"The Lightman tutorial gives a free rod and 13 tank-only species need specific parents."},
  "evidence-gameplay-visible": {layer:"visible", rel:"make-money.html", text:"The Lightman tutorial gives a free rod and 13 tank-only species need specific parents."},
  "evidence-gameplay-metadata": {layer:"metadata", rel:"make-money.html", text:"The Lightman tutorial gives a free rod and 13 tank-only species need specific parents."},
  "evidence-gameplay-faq": {layer:"faq", rel:"make-money.html", text:"Does the Lightman tutorial give a free rod and do 13 tank-only species need specific parents?"},
  "evidence-gameplay-jsonld": {layer:"jsonld", rel:"make-money.html", text:"The Lightman tutorial gives a free rod and 13 tank-only species need specific parents."},
  "evidence-season-missing": {layer:"remove-visible", rel:"zh-TW/make-money.html", text:"季節規劃"},
  "evidence-wind-missing": {layer:"remove-visible", rel:"ja/make-money.html", text:"風力発電"},
  "evidence-zh-tw-fallback": {layer:"visible", rel:"zh-TW/make-money.html", text:"季节提示：看天气预报——雷暴蓄电、雨水免费灌溉。"},
  "matrix-ja-reverse-source": {layer:"source", rel:"ja/how-to-play.html", text:"嵐が狙って壊滅させるのは水平な畑です。"},
  "matrix-ja-reverse-visible": {layer:"visible", rel:"ja/how-to-play.html", text:"嵐が狙って壊滅させるのは水平な畑です。"},
  "matrix-ja-reverse-metadata": {layer:"metadata", rel:"ja/how-to-play.html", text:"嵐が狙って壊滅させるのは水平な畑です。"},
  "matrix-ja-reverse-jsonld": {layer:"jsonld", rel:"ja/how-to-play.html", text:"嵐が狙って壊滅させるのは水平な畑です。"},
  "matrix-ko-benefit-source": {layer:"source", rel:"ko/weather.html", text:"보너스는 모든 극한 날씨 위협에서 나옵니다."},
  "matrix-ko-benefit-visible": {layer:"visible", rel:"ko/weather.html", text:"보너스는 모든 극한 날씨 위협에서 나옵니다."},
  "matrix-ko-benefit-metadata": {layer:"metadata", rel:"ko/weather.html", text:"보너스는 모든 극한 날씨 위협에서 나옵니다."},
  "matrix-ko-benefit-jsonld": {layer:"jsonld", rel:"ko/weather.html", text:"보너스는 모든 극한 날씨 위협에서 나옵니다."},
  "matrix-es-benefit-source": {layer:"source", rel:"es/weather.html", text:"La ventaja nace de todas las amenazas del clima extremo."},
  "matrix-es-benefit-visible": {layer:"visible", rel:"es/weather.html", text:"La ventaja nace de todas las amenazas del clima extremo."},
  "matrix-es-benefit-metadata": {layer:"metadata", rel:"es/weather.html", text:"La ventaja nace de todas las amenazas del clima extremo."},
  "matrix-es-benefit-jsonld": {layer:"jsonld", rel:"es/weather.html", text:"La ventaja nace de todas las amenazas del clima extremo."},
  "matrix-es-passive-layer-source": {layer:"source", rel:"es/how-to-play.html", text:"Una capa completa queda destruida por una tormenta."},
  "matrix-es-passive-layer-visible": {layer:"visible", rel:"es/how-to-play.html", text:"Una capa completa queda destruida por una tormenta."},
  "matrix-es-passive-layer-metadata": {layer:"metadata", rel:"es/how-to-play.html", text:"Una capa completa queda destruida por una tormenta."},
  "matrix-es-passive-layer-jsonld": {layer:"jsonld", rel:"es/how-to-play.html", text:"Una capa completa queda destruida por una tormenta."},
  "natural-zh-shop-pressure": {layer:"visible", rel:"zh-CN/weather.html", text:"店内农货吃紧，会让作物承受更大压力。"},
  "natural-es-whole-tier": {layer:"jsonld", rel:"es/how-to-play.html", text:"Una capa completa queda destruida por una tormenta."},
  "natural-es-community-profit": {layer:"source", rel:"es/make-money.html", text:"La comunidad coincide en que procesar pescado maximiza el beneficio."},
  "natural-es-mojibake": {layer:"metadata", rel:"es/automation.html", text:"Guía de automatizaciÃ³n agrícola"},
  "language-zh-cn-intro": {layer:"source", rel:"zh-CN/farming.html", text:"学会计什么、何时种。"},
  "language-zh-tw-intro": {layer:"visible", rel:"zh-TW/farming.html", text:"學會計什麼、何時種。"},
  "language-ko-grammar": {layer:"metadata", rel:"ko/farming.html", text:"작물 부담이 커집습니다."},
  "language-ko-connector-source": {layer:"source", rel:"ko/how-long-to-beat.html", locale:"ko", text:"작물 부담이 커짐하고 작물이 시듦"},
  "language-en-grammar": {layer:"jsonld", rel:"update-log.html", text:"This is not a selected highlights."},
  "global-gameplay-literal-source": {layer:"source", rel:"how-to-play.html", text:"The Lightman tutorial gives a free rod."},
  "global-gameplay-paraphrase-visible": {layer:"visible", rel:"fishing.html", text:"Thirteen aquatic species require predetermined breeding pairs."},
  "global-source-mismatch-literal-source": {layer:"source", rel:"automation.html", text:"Official two-stage farming automation."},
  "global-source-mismatch-paraphrase-faq": {layer:"faq", rel:"automation.html", text:"Does automation proceed in two separate phases?"},
  "global-season-duplicate": {layer:"visible", rel:"make-money.html", text:"<h2>Harsh Dry Season (Month 4)</h2>"},
  "global-season-wrong-source": {layer:"visible", rel:"make-money.html", text:"<span>1.00.03-OFFICIAL</span>"},
  "global-zh-tw-money-metadata": {layer:"metadata", rel:"zh-TW/make-money.html", text:"區分社群技巧與官方事實，介紹加工、釣魚和前期優先事項。"},
  "global-source-label-fallback": {layer:"visible", rel:"ja/make-money.html", text:"Official Doloc Town 1.0 release notes"},
  "automation-localization-status-fallback": {layer:"visible", rel:"ja/automation.html", text:"Official automation status"},
  "automation-localization-source-fallback": {layer:"visible", rel:"ko/automation.html", text:"Official 1.0 announcement"},
  "automation-localization-reference-fallback": {layer:"visible", rel:"es/automation.html", text:"This English reference explains automation."},
};

// Fishing recipes are intentionally fail-closed. This guard is route-scoped so
// the legitimate crop gene-system breeding explanation remains publishable.
const fishingRecipeFixtures = {
  en: "Raise four lantern bass alongside four glowing eels in one tank; one in two batches succeeds.",
  "zh-CN": "在鱼缸里混养四条灯笼鲈鱼和四条荧光鳗鱼，成功率为二分之一。",
  "zh-TW": "在魚缸裡混養四條燈籠鱸魚和四條螢光鰻魚，成功率為二分之一。",
  ja: "水槽でランタンスズキ4匹と光るウナギ4匹を一緒に育てると、成功確率は二分の一です。",
  ko: "수조에서 랜턴 배스 4마리와 발광 뱀장어 4마리를 함께 키우면 둘 중 하나가 성공합니다.",
  es: "Pon cuatro lubinas linterna y cuatro anguilas brillantes en el tanque; una de cada dos tandas tiene éxito.",
};
const fishingRecipeSignals = {
  en: {
    exclusive: /\b(?:breed|breeding|breeding[- ]only|fish[- ]tank|parent fish)\b/iu,
    count: /\b(?:\d+|one|two|three|four|five|six)\s+(?:[a-z-]+\s+){0,2}(?:fish|bass|eels?|salmon|cod|pike|sardine|tuna|loach|carp)\b/iu,
    action: /\b(?:raise|rear|keep|place|put|stock|mix|combine|alongside|together)\b/iu,
    probability: /(?:\d+(?:[.,]\d+)?\s*%|chance|probabilit|one\s+in\s+(?:two|four)|one\s+out\s+of|half)/iu,
  },
  "zh-CN": {
    exclusive: /(?:鱼缸[^。\n]{0,40}(?:繁殖|养殖)|繁殖(?:专属|限定|概率|几率|要求|亲本)|只能(?:繁殖|养殖))/u,
    count: /(?:[一二三四五六两]|\d+)\s*条[^。\n]{0,35}(?:鱼|鳗|鲈|鲑|鳕|狗鱼|泥鳅)/u,
    action: /(?:混养|一起养|放入|养在|搭配|组合)/u,
    probability: /(?:\d+(?:[.,]\d+)?\s*%|成功率|概率|几率|二分之一|四分之一)/u,
  },
  "zh-TW": {
    exclusive: /(?:魚缸[^。\n]{0,40}(?:繁殖|養殖)|繁殖(?:專屬|限定|概率|機率|要求|親本)|只能(?:繁殖|養殖))/u,
    count: /(?:[一二三四五六兩]|\d+)\s*條[^。\n]{0,35}(?:魚|鰻|鱸|鮭|鱈|狗魚|泥鰍)/u,
    action: /(?:混養|一起養|放入|養在|搭配|組合)/u,
    probability: /(?:\d+(?:[.,]\d+)?\s*%|成功率|概率|機率|二分之一|四分之一)/u,
  },
  ja: {
    exclusive: /(?:水槽[^。\n]{0,40}繁殖|繁殖(?:限定|確率|条件|親魚)|繁殖させ)/u,
    count: /(?:\d+|一|二|三|四|五|六)匹[^。\n]{0,35}(?:魚|ウナギ|スズキ|サケ|タラ|マグロ)/u,
    action: /(?:一緒に育て|組み合わせ|水槽に入れ|混ぜ|同時に飼)/u,
    probability: /(?:\d+(?:[.,]\d+)?\s*%|成功確率|確率|二分の一|四分の一)/u,
  },
  ko: {
    exclusive: /(?:수조[^.\n]{0,40}번식|번식(?:\s*전용|\s*확률|\s*조건|\s*요구|\s*부모)|번식해야)/u,
    count: /(?:\d+|한|두|세|네|다섯|여섯)\s*마리[^.\n]{0,35}(?:물고기|뱀장어|배스|연어|대구|참치)/u,
    action: /(?:함께 키우|같이 키우|수조에 넣|섞어|조합)/u,
    probability: /(?:\d+(?:[.,]\d+)?\s*%|성공률|확률|둘 중 하나|넷 중 하나)/u,
  },
  es: {
    exclusive: /(?:tanque[^.\n]{0,45}(?:cr[ií]a|criar|reproduc)|(?:cr[ií]a|criar|reproducci[oó]n)[^.\n]{0,45}(?:peces|padres|tanque|probabilidad)|solo\s+cr[ií]a)/iu,
    count: /\b(?:\d+|un[oa]?|dos|tres|cuatro|cinco|seis)\s+(?:peces|lubinas|anguilas|salmones|bacalaos|lucios|sardinas|atunes|lochas|carpas)\b/iu,
    action: /\b(?:pon|mete|cr[ií]a|combina|mezcla|mant[eé]n|junta)\b/iu,
    probability: /(?:\d+(?:[.,]\d+)?\s*%|probabilidad|una?\s+de\s+cada\s+(?:dos|cuatro)|mitad)/iu,
  },
};
const fishingRecipeHit = (text, locale) => {
  const s = fishingRecipeSignals[locale];
  if (!s) return null;
  const prose = String(text).replace(/https?:\/\/[^\s"']+/giu, " ");
  const exclusive = prose.match(s.exclusive);
  if (exclusive) return exclusive[0];
  const countHit = prose.match(s.count), actionHit = prose.match(s.action), probabilityHit = prose.match(s.probability);
  return countHit && actionHit && probabilityHit ? `${countHit[0]} | ${actionHit[0]} | ${probabilityHit[0]}` : null;
};
const fishingRecipeAnyHit = text => {
  for (const locale of Object.keys(fishingRecipeSignals)) {
    const hit = fishingRecipeHit(text, locale);
    if (hit) return {locale, hit};
  }
  return null;
};
const fishingRecipeFaults = {};
const fishingRecipeFaultNames = [];
for (const [locale, text] of Object.entries(fishingRecipeFixtures)) {
  const keyLocale = locale.toLowerCase().replaceAll("-", "-");
  const rel = locale === "en" ? "fishing.html" : `${locale}/fishing.html`;
  for (const layer of ["source", "effective", "visible", "metadata", "jsonld"]) {
    const name = `fishing-recipe-${keyLocale}-${layer}`;
    fishingRecipeFaultNames.push(name);
    fishingRecipeFaults[name] = {layer, rel, locale, text};
  }
}
fishingRecipeFaults["ko-automation-particle"] = {layer:"source", rel:"ko/faq.html", locale:"ko", text:"농업 자동화이 농장 드론 기지를 구동합니다."};
const automationPhaseFixtures = {
  en: { structural:"Official two-stage farming automation.", natural:"Automation begins in an initial phase and moves to a later phase." },
  "zh-CN": { structural:"官方公告介绍两阶段农业自动化。", natural:"农业自动化先完成供能，再进入无人机作业，分为两个环节。" },
  "zh-TW": { structural:"官方公告介紹兩階段農業自動化。", natural:"農業自動化先完成供能，再進入無人機作業，分為兩個環節。" },
  ja: { structural:"公式情報は二段階の農業オートメーションを説明します。", natural:"農業オートメーションは前半と後半に分かれます。" },
  ko: { structural:"공식 공지는 2단계 농업 자동화를 설명합니다.", natural:"농업 자동화는 앞 단계와 뒤 단계로 나뉩니다." },
  es: { structural:"Los avisos describen automatización agrícola en dos etapas.", natural:"La automatización comienza en una fase inicial y continúa en otra posterior." },
};
const automationPhaseFaults = {};
const automationPhaseFaultNames = [];
for (const [locale, fixture] of Object.entries(automationPhaseFixtures)) {
  const rel = locale === "en" ? "automation.html" : `${locale}/automation.html`;
  for (const [suffix, text] of [["raw-structural", fixture.structural], ["raw-natural", fixture.natural]]) {
    const name = `automation-phase-${locale.toLowerCase()}-${suffix}`;
    automationPhaseFaultNames.push(name);
    automationPhaseFaults[name] = {layer:"source", rel, locale, text};
  }
  for (const layer of ["effective", "visible", "metadata", "faq", "jsonld"]) {
    const name = `automation-phase-${locale.toLowerCase()}-${layer}`;
    automationPhaseFaultNames.push(name);
    automationPhaseFaults[name] = {layer, rel, locale, text:fixture.natural};
  }
}
const coreClaimFixtures = {
  en:{prerequisite:"The power grid must be live before work stations can release the drone crews.",architecture:"A fixed automation stack groups the power grid, work stations and drone crews into three layers.",timing:"Automated plots begin in the opening stretch, expand around the midpoint and finish in the final stretch.",consensus:"Players widely call the power-grid and work-station plan the standard automation route.",direct:"An exceptional catch immediately yields high-grade drone components.",upgrade:"A trophy fish pays for the next drone upgrade outright."},
  "zh-CN":{prerequisite:"供电网必须先接通，工作站才会开放无人机作业。",architecture:"固定自动化架构把供电网、工作站与无人机分成三层。",timing:"自动化在开局阶段起步、流程过半时扩张，并在收尾阶段完成。",consensus:"玩家普遍把供电网与工作站方案称为标准自动化路线。",direct:"一条珍稀鱼会立刻产出高级无人机部件。",upgrade:"一次罕见渔获足够支付下一次无人机升级。"},
  "zh-TW":{prerequisite:"供電網必須先接通，工作站才會開放無人機作業。",architecture:"固定自動化架構把供電網、工作站與無人機分成三層。",timing:"自動化在開局階段起步、流程過半時擴張，並在收尾階段完成。",consensus:"玩家普遍把供電網與工作站方案稱為標準自動化路線。",direct:"一條珍稀魚會立刻產出高級無人機部件。",upgrade:"一次罕見漁獲足夠支付下一次無人機升級。"},
  ja:{prerequisite:"電力網を先に完成させないと、作業ステーションからドローンを解放できません。",architecture:"固定された自動化アーキテクチャは、電力網・作業ステーション・ドローンを三層に分けます。",timing:"自動化は序盤に始まり、中盤で広がり、最後の区間で完成します。",consensus:"プレイヤーの多くは、電力網と作業ステーションの案を標準の自動化ルートと呼びます。",direct:"珍しい獲物はすぐに高級ドローン部品を生み出します。",upgrade:"珍しい獲物一匹で次のドローン強化費用をまかなえます。"},
  ko:{prerequisite:"전력망을 먼저 완성해야 작업 스테이션에서 드론을 해금할 수 있습니다.",architecture:"고정 자동화 구조는 전력망·작업 스테이션·드론을 세 개 층으로 묶습니다.",timing:"자동화는 초반에 시작해 중간 지점에서 확장하고 마지막 구간에 완성됩니다.",consensus:"대부분의 플레이어는 전력망과 작업 스테이션 구성을 표준 자동화 루트라고 부릅니다.",direct:"특별한 어획은 바로 고급 드론 부품을 줍니다.",upgrade:"희귀한 물고기 한 마리로 다음 드론 업그레이드 비용을 충당합니다."},
  es:{prerequisite:"La red eléctrica debe estar lista antes de que las estaciones de trabajo desbloqueen los drones.",architecture:"Una arquitectura fija de automatización agrupa la red eléctrica, las estaciones de trabajo y los drones en tres capas.",timing:"La automatización empieza en el tramo inicial, crece en el punto medio y termina en el tramo final.",consensus:"La mayoría de jugadores considera estándar la ruta de automatización con red eléctrica y estaciones de trabajo.",direct:"Una captura excepcional entrega al instante componentes avanzados de dron.",upgrade:"Una captura excepcional convierte al instante su valor en la próxima mejora del dron."},
};
const coreLayerByFamily={prerequisite:"source",architecture:"effective",timing:"visible",consensus:"metadata",direct:"faq",upgrade:"jsonld"};
const coreExpectedFamily={prerequisite:"automation-prerequisite",architecture:"automation-architecture",timing:"automation-timing",consensus:"automation-consensus",direct:"rare-direct-parts",upgrade:"rare-upgrade-return"};
const coreRouteByFamily={prerequisite:"automation",architecture:"farming",timing:"how-to-play",consensus:"automation",direct:"fishing",upgrade:"fishing"};
const residualClaimFixtures = {
  en:{arrow:"Power grid → work stations → drone crews is the automation route.",prerequisite:"Work stations are a prerequisite for the drone fleet in this automation plan.",dependency:"Automation depends on the power network to operate drone stations.",techTree:"Farm stations and drones make up the complete automation technology tree.",ongoing:"This guide is currently hands-on testing the version 1.0 achievement list.",realDevice:"Our team is editing the checklist after a playtest on real hardware."},
  "zh-CN":{arrow:"供电网 → 工作站 → 无人机是自动化路线。",prerequisite:"工作站是这套自动化方案启用无人机的前置条件。",dependency:"自动化依赖供电网来驱动无人机站。",techTree:"农场站点与无人机组成完整的自动化科技树。",ongoing:"本站正在对 1.0 成就清单做上手测试。",realDevice:"编辑组正在真机试玩后整理这份清单。"},
  "zh-TW":{arrow:"供電網 → 工作站 → 無人機是自動化路線。",prerequisite:"工作站是這套自動化方案啟用無人機的前置條件。",dependency:"自動化依賴供電網來驅動無人機站。",techTree:"農場站點與無人機組成完整的自動化科技樹。",ongoing:"本站正在對 1.0 成就清單做上手測試。",realDevice:"編輯組正在真機試玩後整理這份清單。"},
  ja:{arrow:"電力網 → 作業ステーション → ドローンが自動化ルートです。",prerequisite:"作業ステーションは自動化でドローンを使う前提です。",dependency:"オートメーションは電力網に依存してドローン基地を駆動します。",techTree:"農場ステーションとドローンが完全な自動化テックツリーを構成します。",ongoing:"本ガイドは現在、1.0実績一覧をプレイテスト中です。",realDevice:"編集部は実機でテストしながら一覧を編集中です。"},
  ko:{arrow:"전력망 → 작업 스테이션 → 드론이 자동화 루트입니다.",prerequisite:"작업 스테이션은 자동화에서 드론을 쓰기 위한 전제 조건입니다.",dependency:"자동화는 전력망에 의존해 드론 기지를 구동합니다.",techTree:"농장 스테이션과 드론이 완전한 자동화 테크 트리를 이룹니다.",ongoing:"이 가이드는 현재 1.0 업적 목록을 직접 테스트 중입니다.",realDevice:"편집팀은 실제 기기에서 플레이테스트하며 목록을 편집 중입니다."},
  es:{arrow:"Red eléctrica → estaciones de trabajo → drones es la ruta de automatización.",prerequisite:"Las estaciones de trabajo son el prerrequisito para usar drones en esta automatización.",dependency:"La automatización depende de la red eléctrica para impulsar las estaciones de drones.",techTree:"Las estaciones agrícolas y los drones forman el árbol tecnológico completo de automatización.",ongoing:"Esta guía está haciendo ahora una prueba práctica de la lista de logros del 1.0.",realDevice:"Nuestro equipo edita la lista tras una prueba en hardware real."},
};
const residualExpectedFamily={arrow:"automation-arrow",prerequisite:"automation-prerequisite",dependency:"automation-dependency",techTree:"automation-technology-tree",ongoing:"hands-on-ongoing",realDevice:"hands-on-real-device"};
const claimLayers = ["source","effective","visible","metadata","faq","jsonld"];
const contentClaimFaults = {}, contentClaimFaultNames = [], residualClaimFaultNames=[];
for (const [locale,fixtures] of Object.entries(coreClaimFixtures)) for (const [family,text] of Object.entries(fixtures)) {
  const layer=coreLayerByFamily[family], slug=coreRouteByFamily[family];
  const name=`claim-matrix-${locale.toLowerCase()}-${family}-${layer}`;
  contentClaimFaultNames.push(name);
  contentClaimFaults[name]={layer,locale,rel:`${locale==="en"?"":`${locale}/`}${slug}.html`,text,expectedFamily:coreExpectedFamily[family]};
}
for (const [localeIndex,[locale,fixtures]] of Object.entries(residualClaimFixtures).entries()) {
  let familyIndex=0;
  for (const [family,text] of Object.entries(fixtures)) {
    const layer=claimLayers[(localeIndex+familyIndex)%claimLayers.length];
    const slug=family==="ongoing"?"achievements":family==="realDevice"?"fishing":"automation";
    const name=`claim-proof-${locale.toLowerCase()}-${family}-${layer}`;
    residualClaimFaultNames.push(name);
    contentClaimFaults[name]={layer,locale,rel:`${locale==="en"?"":`${locale}/`}${slug}.html`,text,expectedFamily:residualExpectedFamily[family]};
    familyIndex+=1;
  }
}
const naturalJapaneseTreeFixtures = [
  "農業オートメーションと農場ドローン基地は一つのツリーです。",
  "農業オートメーションと農場ドローン基地はひとつのツリーです。",
  "農業オートメーションと農場ドローン基地は一個の技術ツリーです。",
  "農業オートメーションと農場ドローン基地は単一のツリーです。",
];
const safeChronologyFixtures = {
  en:{rel:"automation.html",text:"After Early Access, the official 1.0 notes list solar power, wind power, farming automation and drone stations."},
  ko:{rel:"ko/automation.html",text:"앞서 해보기 이후 공식 1.0 공지는 태양광, 풍력, 농업 자동화와 드론 기지를 나열합니다."},
};
contentClaimFaults["natural-ja-one-tree-source"]={layer:"source",locale:"ja",rel:"ja/how-long-to-beat.html",text:naturalJapaneseTreeFixtures[0],expectedFamily:"automation-technology-tree"};
residualClaimFaultNames.push("natural-ja-one-tree-source");
const matrixCoverage=(faultNames,expectedCount,label)=>{
  if(faultNames.length!==expectedCount) throw new Error(`${label} fault count ${faultNames.length} != ${expectedCount}`);
};
matrixCoverage(contentClaimFaultNames,36,"core-claim");
matrixCoverage(residualClaimFaultNames.filter(name=>name!=="natural-ja-one-tree-source"),36,"residual-claim");
for (const family of Object.keys(residualExpectedFamily)) {
  const specs=residualClaimFaultNames.filter(name=>name.includes(`-${family}-`)).map(name=>contentClaimFaults[name]);
  if (new Set(specs.map(spec=>spec.locale)).size!==6 || new Set(specs.map(spec=>spec.layer)).size!==6)
    throw new Error(`residual ${family} must cover six locales and six layers`);
}
Object.assign(independentFaults, fishingRecipeFaults, automationPhaseFaults, contentClaimFaults);
const fishingRecipeFault = fishingRecipeFaults[fault];
const automationPhaseFault = automationPhaseFaults[fault];
const contentClaimFault = contentClaimFaults[fault];
const extractBalancedObject = (text, openAt) => {
  let depth = 0, quote = "", escaped = false;
  for (let i = openAt; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === "{") depth += 1;
    else if (ch === "}" && --depth === 0) return text.slice(openAt, i + 1);
  }
  return "";
};
const rawFishingFragments = buildRawText => {
  const fragments = [];
  const marker = /(?:(?:ZH|JA|KO|ES)\["fishing"\]\s*=|"fishing"\s*:)\s*\{/g;
  for (const match of buildRawText.matchAll(marker)) {
    const openAt = match.index + match[0].lastIndexOf("{");
    const fragment = extractBalancedObject(buildRawText, openAt);
    if (fragment) fragments.push(fragment);
  }
  return fragments;
};
const semanticFamilyCodes = new Set(semanticFamilyPatterns.map(([code]) => code));
const nonSemanticIntegrityPatterns = contentIntegrityPatterns.filter(([code]) => !semanticFamilyCodes.has(code));

const disabled = fs.mkdtempSync(path.join(os.tmpdir(),"doloc-amz-off-"));
const enabled = fs.mkdtempSync(path.join(os.tmpdir(),"doloc-amz-on-"));
let semanticFileCount = 0;
let generatedVisibleFileCount = 0;
let generatedJsonLdBlockCount = 0;
let trackedSourceInventory = [];
const semanticInventory = {
  locales: ["en", "zh-CN", "zh-TW", "ja", "ko", "es"],
  families: ["drought-commercial-correlation", "flat-field-weather-causality", "broad-threat-benefit", "shop-crop-pressure", "whole-layer-destruction", "weather-profit-advantage", "community-profit-guidance"],
  source: {files: 7, hits: 0},
  generated_visible: {files: 0, hits: 0},
  generated_metadata: {documents: 0, hits: 0},
  generated_jsonld: {blocks: 0, hits: 0},
};
const evidenceLayerInventory = {raw:0,effective:0,visible:0,metadata:0,faq:0,jsonld:0};
const fishingRecipeInventory = {
  source: {documents:0, recipe_hits:0, structural_rows:0},
  effective: {documents:0, recipe_hits:0, structural_rows:0},
  generated_visible: {documents:0, recipe_hits:0, structural_rows:0},
  generated_metadata: {documents:0, recipe_hits:0},
  generated_jsonld: {documents:0, recipe_hits:0},
};
const safeChronologyInventory = {source:[], effective:[]};
try {
  generate(disabled,false); generate(enabled,true);
  const offFiles=walk(disabled), onFiles=walk(enabled);
  const independentFault = independentFaults[fault];
  if (independentFault && !["source", "effective"].includes(independentFault.layer)) {
    const target = offFiles.find(file => path.relative(disabled, file) === path.normalize(independentFault.rel));
    if (!target) fail("fault-target-missing", `${fault}:${independentFault.rel}`);
    else if (independentFault.layer === "visible") fs.appendFileSync(target, `<p>${independentFault.text}</p>`);
    else if (independentFault.layer === "metadata") fs.appendFileSync(target, `<meta name="description" content="${independentFault.text}">`);
    else if (independentFault.layer === "jsonld") fs.appendFileSync(target, `<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"FAQPage",name:independentFault.text})}</script>`);
    else if (independentFault.layer === "faq") fs.appendFileSync(target, `<details class="faq"><summary>${independentFault.text}</summary></details>`);
    else if (independentFault.layer === "remove-visible") fs.writeFileSync(target, fs.readFileSync(target,"utf8").replaceAll(independentFault.text, ""));
  }
  if (fault === "default-module-leak") {
    fs.appendFileSync(offFiles[0], '<aside class="amazon-gear">fault fixture</aside>');
  }
  if (fault === "ko-unsupported-semantics") {
    const target = offFiles.find(file => path.relative(disabled, file) === path.join("ko", "make-money.html"));
    fs.appendFileSync(target, "<p>4월 가뭄 전 작물을 비축하고 작물 부담 증가기에 판매하면 달력에서 가장 큰 수익 기회입니다.</p>");
  }
  if (fault === "es-corruption") {
    const target = offFiles.find(file => path.relative(disabled, file) === path.join("es", "how-to-play.html"));
    fs.appendFileSync(target, "<p>no protege los cultivosr antes del mes 4</p>");
  }
  if (fault === "ko-flat-field-causality") {
    const target = offFiles.find(file => path.relative(disabled, file) === path.join("ko", "how-to-play.html"));
    fs.appendFileSync(target, "<p>평평한 한 판 밭은 가뭄 위험이자 폭풍의 표적입니다.</p>");
  }
  if (fault === "ko-drought-profit-residue") {
    const target = offFiles.find(file => path.relative(disabled, file) === path.join("ko", "weather.html"));
    fs.appendFileSync(target, "<p>Harsh Dry Season 대비로 수익 내기.</p>");
  }
  if (fault === "es-drought-benefit") {
    const target = offFiles.find(file => path.relative(disabled, file) === path.join("es", "weather.html"));
    fs.appendFileSync(target, '<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","name":"¿Cómo saco provecho de la sequía?"}</script>');
  }
  if (fault === "es-farming-malformed") {
    const target = offFiles.find(file => path.relative(disabled, file) === path.join("es", "farming.html"));
    fs.appendFileSync(target, '<p>Construye turbinas automatizacións para proteger los cultivoss.</p><script type="application/ld+json">{"text":"cultivoss"}</script>');
  }
  if (fault === "fabricated-12-gift-data") {
    const target = offFiles.find(file => path.relative(disabled, file) === "gifts.html");
    fs.appendFileSync(target, "<p>Gabryl loves a Fern Fossil and Licca likes Copper Ingot.</p>");
  }
  if (fault === "ko-name-drift") {
    const target = offFiles.find(file => path.relative(disabled, file) === path.join("ko", "make-money.html"));
    fs.appendFileSync(target, '<script type="application/ld+json">{"headline":"도록 타운 돈 버는 가이드"}</script>');
  }
  if (fault === "semantic-drought-visible") {
    const target = offFiles.find(file => path.relative(disabled, file) === path.join("zh-TW", "weather.html"));
    fs.appendFileSync(target, "<p>趁作物壓力升高賣出庫存，就能從旱災獲利。</p>");
  }
  if (fault === "semantic-drought-jsonld") {
    const target = offFiles.find(file => path.relative(disabled, file) === path.join("zh-CN", "weather.html"));
    fs.appendFileSync(target, '<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","name":"旱灾期间怎样通过卖出作物获利？"}</script>');
  }
  if (fault === "semantic-flat-visible") {
    const target = offFiles.find(file => path.relative(disabled, file) === path.join("es", "how-to-play.html"));
    fs.appendFileSync(target, "<p>Las tormentas buscan los campos de un solo nivel y los destruyen.</p>");
  }
  if (fault === "semantic-flat-zh-tw-visible") {
    const target = offFiles.find(file => path.relative(disabled, file) === path.join("zh-TW", "how-to-play.html"));
    fs.appendFileSync(target, "<p>單層平坦田地會吸引風暴並造成旱災風險。</p>");
  }
  if (fault === "semantic-flat-jsonld") {
    const target = offFiles.find(file => path.relative(disabled, file) === path.join("zh-CN", "how-to-play.html"));
    fs.appendFileSync(target, '<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","name":"风暴会摧毁平坦田地吗？"}</script>');
  }
  if (fault === "semantic-benefit-visible") {
    const target = offFiles.find(file => path.relative(disabled, file) === path.join("es", "weather.html"));
    fs.appendFileSync(target, "<p>Obtén una ventaja de cualquier amenaza meteorológica.</p>");
  }
  if (fault === "semantic-benefit-jsonld") {
    const target = offFiles.find(file => path.relative(disabled, file) === path.join("ko", "weather.html"));
    fs.appendFileSync(target, '<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","name":"날씨는 재난이 아니라 보너스인가요?"}</script>');
  }
  if (fault === "semantic-shop-pressure-visible") {
    const target = offFiles.find(file => path.relative(disabled, file) === path.join("zh-TW", "weather.html"));
    fs.appendFileSync(target, "<p>旱季讓商店裡的農產品供應緊張，作物壓力會升高。</p>");
  }
  if (fault === "semantic-shop-pressure-jsonld") {
    const target = offFiles.find(file => path.relative(disabled, file) === path.join("zh-CN", "weather.html"));
    fs.appendFileSync(target, '<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","name":"商店里的农产品短缺会增加作物压力吗？"}</script>');
  }
  if (fault === "semantic-whole-layer-visible") {
    const target = offFiles.find(file => path.relative(disabled, file) === path.join("es", "how-to-play.html"));
    fs.appendFileSync(target, "<p>Una capa completa queda bajo una tormenta que destruye todo el nivel.</p>");
  }
  if (fault === "semantic-whole-layer-jsonld") {
    const target = offFiles.find(file => path.relative(disabled, file) === path.join("ja", "how-to-play.html"));
    fs.appendFileSync(target, '<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","name":"一層全体が嵐で壊滅しますか？"}</script>');
  }
  if (fault === "semantic-weather-profit-visible") {
    const target = offFiles.find(file => path.relative(disabled, file) === path.join("ko", "make-money.html"));
    fs.appendFileSync(target, "<p>날씨 타이밍이 수익 곡선을 완전히 바꾸는 커뮤니티 검증판입니다.</p>");
  }
  if (fault === "semantic-weather-profit-jsonld") {
    const target = offFiles.find(file => path.relative(disabled, file) === path.join("es", "automation.html"));
    fs.appendFileSync(target, '<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","name":"¿El timing del clima cambia todo el cálculo de beneficios?"}</script>');
  }
  const persistentSourceText = ["data/build_content.py", "data/site.base.json", "data/site.json"]
    .map(rel => fs.readFileSync(path.join(root, rel), "utf8")).join("\n");
  for (const url of genericNewsHubSources) if (persistentSourceText.includes(url)) fail("generic-news-hub-source", url);
  for (const url of Object.values(canonicalSources)) if (!persistentSourceText.includes(url)) fail("canonical-announcement-source-missing", url);
  const sourceData = JSON.parse(fs.readFileSync(path.join(root, "data/site.json"), "utf8"));
  const contentLocales = ["en", "zh-CN", "zh-TW", "ja", "ko", "es"];
  const localizedPageView = (slug, locale) => {
    const page = sourceData.pages?.find(item => item.slug === slug);
    return locale === "en" ? page : page?.i18n?.[locale];
  };
  for (const locale of contentLocales) for (const page of sourceData.pages || []) {
    const rel=`${locale==="en"?"":`${locale}/`}${page.slug}.html`;
    const values=collectStringLeaves(localizedPageView(page.slug,locale)||{});
    if (contentClaimFault?.layer==="effective" && contentClaimFault.locale===locale && contentClaimFault.rel===rel)
      values.push(contentClaimFault.text);
    if (automationPhaseFault?.layer==="effective" && automationPhaseFault.locale===locale && automationPhaseFault.rel===rel)
      values.push(automationPhaseFault.text);
    scanClaimRecords({values,locale,route:rel,layer:"effective",source:"data/site.json"});
  }
  for (const [locale,spec] of Object.entries(safeChronologyFixtures)) {
    const record={
      values:collectStringLeaves({sections:[{body:spec.text}]}),
      locale,route:spec.rel,layer:"effective",source:"safe-chronology:effective-extractor",
    };
    scanClaimRecords(record);
    safeChronologyInventory.effective.push(`${locale}:${spec.rel}`);
  }
  const automationSafeBoundaries = [
    "Official 1.0 notes describe farming automation and drone stations.",
    "Patch 1.00.03 lists drone failures in certain situations as a known issue.",
    "官方 1.0 公告介绍农业自动化；1.00.03 列出特定情况下的无人机失效。",
    "公式 1.0 情報は農業オートメーションを説明し、1.00.03 はドローン不具合を既知事項としています。",
    "공식 1.0 공지는 농업 자동화를 설명하며 1.00.03은 특정 상황의 드론 실패를 알려진 문제로 명시합니다.",
    "Los avisos oficiales describen automatización agrícola; 1.00.03 enumera fallos de drones en ciertas situaciones.",
  ];
  for (const boundary of automationSafeBoundaries) if (unsupportedAutomationHit(boundary)) fail("automation-phase-negative-control", boundary);
  for (const [locale, fixtures] of Object.entries(coreClaimFixtures)) for (const [family, fixture] of Object.entries(fixtures)) {
    const hit=claimFamilyHit(fixture,locale), expected=coreExpectedFamily[family];
    if (!hit || hit.family!==expected) fail("core-claim-fixture-undetected",`${locale}:${family}:${hit?.family||"none"}`);
  }
  for (const [locale, fixtures] of Object.entries(residualClaimFixtures)) for (const [family, fixture] of Object.entries(fixtures)) {
    const hit=claimFamilyHit(fixture,locale), expected=residualExpectedFamily[family];
    if (!hit || hit.family!==expected) fail("residual-claim-fixture-undetected",`${locale}:${family}:${hit?.family||"none"}`);
  }
  for (const fixture of naturalJapaneseTreeFixtures) {
    const hit=claimFamilyHit(fixture,"ja");
    if (!hit || hit.family!=="automation-technology-tree") fail("natural-ja-tree-fixture-undetected",`${hit?.family||"none"}:${fixture}`);
  }
  for (const safe of [
    "Upgrade the rod before targeting rare fish.", "挑战稀有鱼前先核对鱼竿要求。", "レア魚を狙う前に竿の要件を確認します。",
    "희귀어를 노리기 전에 낙싯대 요구 사항을 확인하세요.", "Mejora la caña antes de buscar peces raros.",
    "Crop gene breeding combines parent traits; it is unrelated to fishing catches.",
    "The official notes list solar power and drone stations as separate components, not a dependency.",
    "This is not hands-on verified; source review is still pending.",
    "Named community testers describe their own device results; this site does not claim a hands-on test.",
    "Verify the requirement on your own device before spending parts.",
    "After Early Access, the official 1.0 notes separately list solar power, wind power, farming automation and drone stations.",
    ...Object.values(safeChronologyFixtures).map(spec=>spec.text),
    "抢先体验结束后，官方 1.0 公告分别列出太阳能、风力、农业自动化与无人机站。",
    "搶先體驗結束後，官方 1.0 公告分別列出太陽能、風力、農業自動化與無人機站。",
    "早期アクセス終了後、公式1.0情報は太陽光、風力、農業オートメーション、ドローン基地を別々に列挙しています。",
    "앞서 해보기 종료 후 공식 1.0 공지는 태양광, 풍력, 농업 자동화와 드론 기지를 별도로 나열합니다.",
    "Tras el Acceso anticipado, las notas oficiales del 1.0 enumeran por separado energía solar, eólica, automatización y estaciones de drones.",
  ]) if (rareFishClaimHit(safe) || unsupportedAutomationHit(safe)) fail("content-claim-negative-control", safe);
  const automationPage = sourceData.pages?.find(item => item.slug === "automation");
  const automationLocalization = {
    "zh-CN":{heading:"官方自动化状态",labels:["Steam 官方商店——太阳能、风力与农业自动化","多洛可小镇官方 1.0 公告索引","多洛可小镇官方 1.00.03 补丁说明"]},
    "zh-TW":{heading:"官方自動化狀態",labels:["Steam 官方商店——太陽能、風力與農業自動化","多洛可小鎮官方 1.0 公告索引","多洛可小鎮官方 1.00.03 更新說明"]},
    ja:{heading:"公式オートメーション情報",labels:["Steam 公式ストア——太陽光・風力発電と農業自動化","ドロックタウン公式 1.0 発表一覧","ドロックタウン公式パッチ 1.00.03"]},
    ko:{heading:"공식 자동화 상태",labels:["Steam 공식 상점——태양광·풍력 발전과 농업 자동화","돌록 타운 공식 1.0 공지 목록","돌록 타운 공식 패치 1.00.03"]},
    es:{heading:"Estado oficial de la automatización",labels:["Tienda oficial de Steam: energía solar, eólica y automatización agrícola","Índice oficial de anuncios 1.0 de Doloc Town","Parche oficial 1.00.03 de Doloc Town"]},
  };
  const automationEnglishFallback = /Official automation status|Official Steam page \(Farming Automation\)|Official 1\.0 announcement|Official Doloc Town patch 1\.00\.03|English (?:automation )?(?:reference|guide)/i;
  for (const [locale, expected] of Object.entries(automationLocalization)) {
    const view = localizedPageView("automation", locale) || {};
    const status = (view.sections || []).find(section => section.tag === "OFFICIAL-AUTOMATION");
    if (status?.heading !== expected.heading) fail("automation-status-localization-data", `${locale}:${status?.heading || "missing"}`);
    for (const [index, label] of expected.labels.entries())
      if (automationPage?.sources?.[index]?.labels?.[locale] !== label) fail("automation-source-localization-data", `${locale}:${index}`);
    if (automationEnglishFallback.test(JSON.stringify(view))) fail("automation-reference-localization-data", locale);
    const rel = `${locale}/automation.html`, html = fs.readFileSync(path.join(disabled, rel), "utf8");
    if (!html.includes(expected.heading)) fail("automation-status-localization-visible", locale);
    for (const label of expected.labels) if (!html.includes(label)) fail("automation-source-localization-visible", `${locale}:${label}`);
    if (automationEnglishFallback.test(html)) fail("automation-reference-localization-visible", locale);
  }
  const fishingSourceUrl = "https://doloctown.huijiwiki.com/wiki/%E9%92%93%E9%B1%BC";
  const fishingPage = sourceData.pages?.find(item => item.slug === "fishing");
  const fishingCommunitySource = fishingPage?.sources?.find(source => source.url === fishingSourceUrl);
  if (!fishingCommunitySource) fail("fishing-community-deep-source", fishingSourceUrl);
  for (const locale of contentLocales) {
    const fishingView = localizedPageView("fishing", locale);
    if (/18183/u.test(JSON.stringify(fishingView || {}))) fail("fishing-stale-source-identity", locale);
    const expectedLabel = locale === "en" ? fishingCommunitySource?.label : fishingCommunitySource?.labels?.[locale];
    if (!expectedLabel || !/Doloc Town Huiji Wiki/i.test(expectedLabel)) fail("fishing-community-source-label", locale);
  }
  for (const page of sourceData.pages || []) for (const source of page.sources || []) {
    if (/patch 1\.00\.03/i.test(source.label || "") && source.url !== canonicalSources.patch) fail("patch-source-identity", `${page.slug}:${source.url}`);
    if (/1\.0 release notes/i.test(source.label || "") && source.url !== canonicalSources.release) fail("release-source-identity", `${page.slug}:${source.url}`);
  }
  const localeSpecs = {
    en:{season:/Season Planning/i,wind:/wind power/i,unsupported:/(?:Lightman[^.\n]{0,80}(?:tutorial|rod)|13\s+tank-only[^.\n]{0,80}(?:parent|breed)|specific parents)/iu},
    "zh-CN":{season:/季节规划/u,wind:/风力/u,unsupported:/(?:Lightman[^。\n]{0,60}(?:教程|鱼竿)|繁殖[^。\n]{0,45}(?:亲本|父母|配对)|特定亲本)/u},
    "zh-TW":{season:/季節規劃/u,wind:/風力/u,unsupported:/(?:Lightman[^。\n]{0,60}(?:教程|魚竿)|繁殖[^。\n]{0,45}(?:親本|父母|配對)|特定親本)/u},
    ja:{season:/季節計画/u,wind:/風力/u,unsupported:/(?:Lightman[^。\n]{0,60}(?:チュートリアル|竿)|繁殖[^。\n]{0,45}(?:親|ペア)|特定の親|水槽限定13種)/u},
    ko:{season:/계절 계획/u,wind:/풍력/u,unsupported:/(?:Lightman[^.\n]{0,60}(?:튜토리얼|낚싯대)|번식[^.\n]{0,45}(?:부모|쌍)|특정 부모|수조 전용 13종)/u},
    es:{season:/Planificaci[oó]n estacional/iu,wind:/e[oó]lica/iu,unsupported:/(?:Lightman[^.\n]{0,70}(?:tutorial|caña)|(?:criar|reproducci[oó]n)[^.\n]{0,50}(?:padres|parejas)|padres espec[ií]ficos|13 especies)/iu},
  };
  const makeMoney = (locale) => {
    const page=sourceData.pages.find(p=>p.slug==="make-money");
    return locale==="en" ? page : page?.i18n?.[locale];
  };
  const buildRaw=fs.readFileSync(path.join(root,"data/build_content.py"),"utf8");
  const baseRaw=JSON.parse(fs.readFileSync(path.join(root,"data/site.base.json"),"utf8"));
  const fishingViewOf = (data, locale) => {
    const page = data.pages?.find(item => item.slug === "fishing");
    return locale === "en" ? page : page?.i18n?.[locale];
  };
  const inspectFishingView = (view, locale, layer, rel, injected = "") => {
    const inventory = fishingRecipeInventory[layer];
    inventory.documents += 1;
    if (!view) { fail("fishing-view-missing", `${layer}:${rel}`); return; }
    let structuralRows = 0;
    for (const section of view.sections || []) {
      for (const attrs of section.rowAttrs || []) {
        if (attrs?.how === "breed" || attrs?.period === "breed") structuralRows += 1;
      }
      for (const row of section.rows || []) {
        if (fishingRecipeHit(JSON.stringify(row), locale)) structuralRows += 1;
      }
    }
    inventory.structural_rows += structuralRows;
    if (structuralRows) fail("fishing-recipe-structural-row", `${layer}:${rel}:${structuralRows}`);
    const hit = fishingRecipeHit(`${JSON.stringify(view)} ${injected}`, locale);
    if (hit) {
      inventory.recipe_hits += 1;
      fail("fishing-recipe-semantic", `${layer}:${rel}:${locale}:${hit}`);
    }
  };
  inspectFishingView(fishingViewOf(baseRaw, "en"), "en", "source", "data/site.base.json");
  const rawFishing = rawFishingFragments(buildRaw);
  for (let index = 0; index < rawFishing.length; index += 1) {
    fishingRecipeInventory.source.documents += 1;
    const hit = fishingRecipeAnyHit(rawFishing[index]);
    if (hit) {
      fishingRecipeInventory.source.recipe_hits += 1;
      fail("fishing-recipe-raw-source", `data/build_content.py#${index + 1}:${hit.locale}:${hit.hit}`);
    }
  }
  if (fishingRecipeFault?.layer === "source" && fishingRecipeFault.locale) {
    fishingRecipeInventory.source.documents += 1;
    const hit = fishingRecipeHit(fishingRecipeFault.text, fishingRecipeFault.locale);
    if (hit) {
      fishingRecipeInventory.source.recipe_hits += 1;
      fail("fishing-recipe-fault-source", `${fishingRecipeFault.locale}:${hit}`);
    }
  }
  for (const locale of Object.keys(fishingRecipeFixtures)) {
    const injected = fishingRecipeFault?.layer === "effective" && fishingRecipeFault.locale === locale ? fishingRecipeFault.text : "";
    inspectFishingView(fishingViewOf(sourceData, locale), locale, "effective", `${locale}:data/site.json`, injected);
  }
  const genePageText = JSON.stringify(sourceData.pages?.find(item => item.slug === "gene-system") || {});
  if (!/breed stronger crops|培育更强种子|強い種子|더 강한 작물|criar semillas más fuertes/iu.test(genePageText)) {
    fail("gene-breeding-negative-control-missing", "gene-system");
  }
  const extraAt=buildRaw.indexOf("_EXTRA = {");
  const rawMakeMoney = {en:JSON.stringify(baseRaw.pages.find(p=>p.slug==="make-money"))};
  const ordered=["zh-CN","ja","ko","es"];
  for (let i=0;i<ordered.length;i++) {
    const start=buildRaw.indexOf(` "${ordered[i]}": {`,extraAt);
    const end=i+1<ordered.length?buildRaw.indexOf(` "${ordered[i+1]}": {`,start):buildRaw.indexOf("\n}\n\n# 注入",start);
    const localeBlock=buildRaw.slice(start,end);
    rawMakeMoney[ordered[i]]=localeBlock.slice(localeBlock.indexOf('  "make-money": {'));
  }
  if (independentFault?.layer==="source" && fault==="evidence-gameplay-source") rawMakeMoney.en += independentFault.text;
  for (const [locale,spec] of Object.entries(localeSpecs)) {
    const effective=JSON.stringify(makeMoney(locale) || {});
    evidenceLayerInventory.effective += 1;
    if (spec.unsupported.test(effective)) fail("make-money-unsupported-effective",locale);
    if (!spec.season.test(effective)) fail("season-planning-effective-missing",locale);
    if (!spec.wind.test(effective)) fail("wind-power-effective-missing",locale);
    const faq=JSON.stringify((makeMoney(locale)?.sections||[]).filter(s=>s.type==="faq"));
    evidenceLayerInventory.faq += 1;
    if (spec.unsupported.test(faq)) fail("make-money-unsupported-faq-effective",locale);
    if (rawMakeMoney[locale]) {
      evidenceLayerInventory.raw += 1;
      if (spec.unsupported.test(rawMakeMoney[locale])) fail("make-money-unsupported-raw",locale);
    }
    const rel=locale==="en"?"make-money.html":`${locale}/make-money.html`;
    const file=offFiles.find(f=>path.relative(disabled,f)===path.normalize(rel));
    if (!file) { fail("make-money-generated-missing",locale); continue; }
    const html=fs.readFileSync(file,"utf8");
    const visible=html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ");
    const metadata=[...(html.match(/<title>[\s\S]*?<\/title>/gi)||[]),...(html.match(/<meta\s+[^>]*content="[^"]*"[^>]*>/gi)||[])].join(" ");
    const faqVisible=(html.match(/<details class="faq">[\s\S]*?<\/details>/gi)||[]).join(" ");
    const jsonld=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)].map(m=>m[1]).join(" ");
    for (const [layer,text] of Object.entries({visible,metadata,faq:faqVisible,jsonld})) {
      evidenceLayerInventory[layer] += 1;
      if (spec.unsupported.test(text)) fail(`make-money-unsupported-${layer}`,locale);
    }
    if (!spec.season.test(visible)) fail("season-planning-visible-missing",locale);
    if (!spec.wind.test(visible)) fail("wind-power-visible-missing",locale);
  }
  const makeMoneyPage=sourceData.pages.find(p=>p.slug==="make-money");
  if (!(makeMoneyPage.sources||[]).some(s=>s.url===canonicalSources.store)) fail("wind-primary-source-missing","make-money");
  const expectedZhTwMoneyMeta = "多洛可小鎮資源規劃指南：依官方資料安排任務、加工設備、釣魚、作物防護、澆水與農場供電，具體數值以遊戲內顯示為準。";
  if (makeMoneyPage.i18n?.["zh-TW"]?.metaDescription !== expectedZhTwMoneyMeta) fail("zh-tw-money-metadata-contract", makeMoneyPage.i18n?.["zh-TW"]?.metaDescription || "missing");
  const localizedSourceLabels = {
    "zh-CN":{[canonicalSources.store]:"Steam 官方商店——太阳能、风力与农业自动化",[canonicalSources.patch]:"多洛可小镇官方 1.00.03 补丁说明",[canonicalSources.release]:"多洛可小镇官方 1.0 正式版公告"},
    "zh-TW":{[canonicalSources.store]:"Steam 官方商店——太陽能、風力與農業自動化",[canonicalSources.patch]:"多洛可小鎮官方 1.00.03 更新說明",[canonicalSources.release]:"多洛可小鎮官方 1.0 正式版公告"},
    ja:{[canonicalSources.store]:"Steam 公式ストア——太陽光・風力発電と農業自動化",[canonicalSources.patch]:"ドロックタウン公式パッチ 1.00.03",[canonicalSources.release]:"ドロックタウン公式 1.0 リリース発表"},
    ko:{[canonicalSources.store]:"Steam 공식 상점——태양광·풍력 발전과 농업 자동화",[canonicalSources.patch]:"돌록 타운 공식 패치 1.00.03",[canonicalSources.release]:"돌록 타운 공식 1.0 출시 공지"},
    es:{[canonicalSources.store]:"Tienda oficial de Steam: energía solar, eólica y automatización agrícola",[canonicalSources.patch]:"Parche oficial 1.00.03 de Doloc Town",[canonicalSources.release]:"Anuncio oficial del lanzamiento 1.0 de Doloc Town"},
  };
  for (const [locale, labels] of Object.entries(localizedSourceLabels)) {
    for (const [url, expected] of Object.entries(labels)) {
      const source=makeMoneyPage.sources?.find(item=>item.url===url);
      if (source?.labels?.[locale] !== expected) fail("localized-source-label-data", `${locale}:${url}`);
      const rel=`${locale}/make-money.html`, html=fs.readFileSync(path.join(disabled,rel),"utf8");
      if (!html.includes(expected)) fail("localized-source-label-visible", `${locale}:${url}`);
    }
    const localizedHtml=fs.readFileSync(path.join(disabled,`${locale}/make-money.html`),"utf8");
    for (const fallback of ["Official Steam store — solar and wind power","Official Doloc Town patch 1.00.03","Official Doloc Town 1.0 release notes"])
      if (localizedHtml.includes(fallback)) fail("source-label-english-fallback",`${locale}:${fallback}`);
  }
  for (const locale of localeSpecs ? Object.keys(localeSpecs) : []) {
    const rel=locale==="en"?"make-money.html":`${locale}/make-money.html`;
    const html=fs.readFileSync(path.join(disabled,rel),"utf8");
    const headingCount=count(html,">Harsh Dry Season (Month 4)</h2>");
    if (headingCount!==1) fail("season-block-count",`${locale}:${headingCount}`);
    if (count(html,"1.0-OFFICIAL")!==1 || html.includes("1.00.03-OFFICIAL")) fail("season-source-tag",locale);
  }
  const simplifiedFallback=/(?:季节提示|看天气预报|雷暴蓄电|雨水免费灌溉|种子|嫩芽|生长|收获|页面|深度拆解|快速答案|搜索攻略|联系我们|我们通常)/u;
  for (const file of offFiles.filter(f=>path.relative(disabled,f).startsWith(`zh-TW${path.sep}`))) {
    const html=fs.readFileSync(file,"utf8");
    const visible=html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ");
    if (simplifiedFallback.test(visible)) fail("zh-tw-simplified-fallback",path.relative(disabled,file));
  }
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
  trackedSourceInventory = [
    {rel:"data/build_content.py",kind:"python",status:"canonical-authoring"},
    {rel:"data/site.base.json",kind:"json",status:"canonical-authoring"},
    {rel:"data/zh_p12.py",kind:"python",status:"canonical-import"},
    {rel:"data/gifts_pages.py",kind:"python",status:"canonical-import"},
    {rel:"data/gifts-raw.json",kind:"json",status:"canonical-import"},
    {rel:"data/gifts-raw-hj-1.0.json",kind:"json",status:"canonical-import"},
    {rel:"data/site.json",kind:"json",status:"generated-effective"},
    {rel:"data/build_base.py",kind:"python",status:"legacy-generator-excluded-but-hygiene-scanned"},
  ];
  const semanticSourceFiles = trackedSourceInventory.map(item=>path.join(root,item.rel));
  const generatedFiles = walk(disabled);
  semanticFileCount = semanticSourceFiles.length + generatedFiles.length;
  const forbidden = [
    ["unsafe-mod-advice", /DTMAPI.{0,100}(subscribe|install|订阅|訂閱|購読|구독|Suscríbete)|(?:dependencies|依赖|依賴|依存|의존성).{0,40}(first|先|먼저)/i],
    ["new-year-beast-mistranslation", /New Year Beast.{0,20}(difficulty|难度|難度|난이도|dificultad)/i],
    ["self-backing", /(?:is|provides|contains|offers|publishes)(?![^.\n]{0,15}\bnot\b)[^.\n]{0,30}(?:a\s+)?complete[^.\n]{0,30}(?:change|log)|完整.{0,20}(?:变更|變更)|完全.{0,20}(?:変更|ログ)|완전한.{0,20}(?:변경|로그)|registro completo|site (?:like this )?is the reliable source|本站.{0,20}可靠|本網站.{0,20}可靠|このガイド.{0,20}情報源|이 가이드.{0,20}출처|sitio .*fuente fiable/i],
    ["spanish-corruption", /(?:turbinas\s+automatizaci[oó]ns|cultivoss|cultivosr)/iu]
  ];
  const scanSemantic = (text, layer, rel) => {
    const drought=droughtHit(text);
    if (drought) {
      semanticInventory[layer].hits += 1;
      fail(`drought-arbitrage-${layer}`,`${rel}:${drought.locale}:${drought.excerpt}`);
    }
    for (const [code,re] of semanticFamilyPatterns) if(re.test(text)) {
      semanticInventory[layer].hits += 1;
      fail(`${code}-${layer}`, rel);
    }
  };
  const semanticSourceFaultSpecs = {
    "semantic-drought-source":{locale:"zh-CN",rel:"zh-CN/weather.html",text:semanticSourceFaults["semantic-drought-source"]},
    "semantic-flat-en-source":{locale:"en",rel:"how-to-play.html",text:semanticSourceFaults["semantic-flat-en-source"]},
    "semantic-flat-source":{locale:"ja",rel:"ja/how-to-play.html",text:semanticSourceFaults["semantic-flat-source"]},
    "semantic-benefit-source":{locale:"ko",rel:"ko/weather.html",text:semanticSourceFaults["semantic-benefit-source"]},
    "semantic-shop-pressure-source":{locale:"zh-CN",rel:"zh-CN/weather.html",text:semanticSourceFaults["semantic-shop-pressure-source"]},
    "semantic-whole-layer-source":{locale:"en",rel:"how-to-play.html",text:semanticSourceFaults["semantic-whole-layer-source"]},
    "semantic-weather-profit-source":{locale:"en",rel:"make-money.html",text:semanticSourceFaults["semantic-weather-profit-source"]},
  };
  const sourceFaultSpec = contentClaimFault?.layer==="source" ? contentClaimFault
    : semanticSourceFaultSpecs[fault] || (independentFault?.layer==="source" ? independentFault : null);
  const appendSourceFixture = (text,spec) => {
    if (!spec) return text;
    const localeVar={en:"EN", "zh-CN":"ZH", "zh-TW":"ZH_TW", ja:"JA", ko:"KO", es:"ES"}[spec.locale || routeLocale(spec.rel)];
    const slug=String(spec.rel).replaceAll("\\","/").split("/").at(-1).replace(/\.html$/u,"");
    return `${text}\n${localeVar}_AUDIT = ${JSON.stringify({[slug]:{body:spec.text}},null,2)}\n`;
  };
  const faultedBuildRaw=appendSourceFixture(buildRaw,sourceFaultSpec);
  const safeChronologyBuildRaw=Object.entries(safeChronologyFixtures).reduce(
    (text,[locale,spec])=>appendSourceFixture(text,{...spec,locale}),faultedBuildRaw,
  );
  const sourceEntries = semanticSourceFiles.map(file => {
    const rel=path.relative(root,file);
    return {rel,text:rel==="data/build_content.py"?faultedBuildRaw:fs.readFileSync(file,"utf8")};
  });
  for (const {rel,text} of sourceEntries) {
    scanSemantic(text, "source", rel);
    if (removedGameplayPattern.test(text)) fail("removed-gameplay-source", rel);
    for (const [code,re] of forbidden) if(re.test(text)) fail(code,rel);
    for (const [code,re] of nonSemanticIntegrityPatterns) if(re.test(text)) fail(code,rel);
  }
  const slugs=(sourceData.pages||[]).map(page=>page.slug);
  for (const spec of [
    {rel:"data/build_content.py",text:faultedBuildRaw,defaultLocale:"en"},
    {rel:"data/zh_p12.py",text:fs.readFileSync(path.join(root,"data/zh_p12.py"),"utf8"),defaultLocale:"zh-CN"},
    {rel:"data/gifts_pages.py",text:fs.readFileSync(path.join(root,"data/gifts_pages.py"),"utf8"),defaultLocale:"en"},
    {rel:"data/build_base.py",text:fs.readFileSync(path.join(root,"data/build_base.py"),"utf8"),defaultLocale:"en"},
  ]) for (const record of pythonSourceRecords({...spec,slugs})) { scanClaimRecords(record); scanSourceLanguageRecords(record); }
  const chronologySourceRecords=pythonSourceRecords({text:safeChronologyBuildRaw,rel:"data/build_content.py",slugs,defaultLocale:"en"});
  for (const [locale,spec] of Object.entries(safeChronologyFixtures)) {
    const record=chronologySourceRecords.find(item=>item.locale===locale && item.route===spec.rel && item.values.includes(spec.text));
    if (!record) fail("safe-chronology-source-extractor-missing",`${locale}:${spec.rel}`);
    else {
      scanClaimRecords(record);
      safeChronologyInventory.source.push(`${locale}:${spec.rel}`);
    }
  }
  const baseData=JSON.parse(fs.readFileSync(path.join(root,"data/site.base.json"),"utf8"));
  scanClaimRecords({values:collectStringLeaves({site:baseData.site,game:baseData.game}),locale:"en",route:"index.html",layer:"source",source:"data/site.base.json:json-leaf"});
  for (const page of baseData.pages||[]) scanClaimRecords({values:collectStringLeaves(page),locale:"en",route:`${page.slug}.html`,layer:"source",source:"data/site.base.json:json-leaf"});
  scanClaimRecords({values:collectStringLeaves(JSON.parse(fs.readFileSync(path.join(root,"data/gifts-raw.json"),"utf8"))),locale:"en",route:"gifts.html",layer:"source",source:"data/gifts-raw.json:json-leaf"});
  for (const locale of contentLocales) for (const page of sourceData.pages || []) {
    const rel=`${locale==="en"?"":`${locale}/`}${page.slug}.html`;
    scanClaimRecords({values:collectStringLeaves(localizedPageView(page.slug,locale)||{}),locale,route:rel,layer:"source",source:"data/site.json"});
  }
  const buildBaseRaw=fs.readFileSync(path.join(root,"data/build_base.py"),"utf8");
  if (buildRaw.includes("build_base") || /from\s+build_base\s+import|import\s+build_base/u.test(buildRaw)) fail("legacy-source-exclusion", "data/build_base.py must remain outside the canonical import graph");
  if (/hands-on (?:play|verification)|solar\s*\+\s*wind\s*(?:→|->)\s*drone/iu.test(buildBaseRaw)) fail("legacy-source-hygiene", "data/build_base.py contains the excluded stale claim family");
  for (const file of generatedFiles) {
    const rel = path.relative(disabled, file);
    const html = fs.readFileSync(file, "utf8");
    const visible = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<details[^>]*class="[^"]*(?:faq|harvest-faq)[^"]*"[^>]*>[\s\S]*?<\/details>/gi," ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;/gi, " ");
    const metadata = [
      ...(html.match(/<title>[\s\S]*?<\/title>/gi) || []),
      ...(html.match(/<meta\s+[^>]*content="[^"]*"[^>]*>/gi) || []),
    ].join(" ");
    const faqLayer = (html.match(/<details[^>]*class="[^"]*(?:faq|harvest-faq)[^"]*"[^>]*>[\s\S]*?<\/details>/gi) || []).join(" ");
    const jsonLd = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)].map(match => match[1]);
    generatedVisibleFileCount += 1;
    generatedJsonLdBlockCount += jsonLd.length;
    semanticInventory.generated_visible.files += 1;
    semanticInventory.generated_metadata.documents += 1;
    semanticInventory.generated_jsonld.blocks += jsonLd.length;
    const route = rel.split(path.sep).join("/");
    const fishingLocale = route === "fishing.html" ? "en" : (route.match(/^(zh-CN|zh-TW|ja|ko|es)\/fishing\.html$/) || [])[1];
    if (fishingLocale) {
      fishingRecipeInventory.generated_visible.documents += 1;
      const structuralRows = (html.match(/data-(?:how|period)="breed"/g) || []).length;
      fishingRecipeInventory.generated_visible.structural_rows += structuralRows;
      if (structuralRows) fail("fishing-recipe-generated-structural-row", `${route}:${structuralRows}`);
      const visibleHit = fishingRecipeHit(visible, fishingLocale);
      if (visibleHit) {
        fishingRecipeInventory.generated_visible.recipe_hits += 1;
        fail("fishing-recipe-generated-visible", `${route}:${visibleHit}`);
      }
      fishingRecipeInventory.generated_metadata.documents += 1;
      const metadataHit = fishingRecipeHit(metadata, fishingLocale);
      if (metadataHit) {
        fishingRecipeInventory.generated_metadata.recipe_hits += 1;
        fail("fishing-recipe-generated-metadata", `${route}:${metadataHit}`);
      }
      fishingRecipeInventory.generated_jsonld.documents += jsonLd.length;
      for (const block of jsonLd) {
        const jsonLdHit = fishingRecipeHit(block, fishingLocale);
        if (jsonLdHit) {
          fishingRecipeInventory.generated_jsonld.recipe_hits += 1;
          fail("fishing-recipe-generated-jsonld", `${route}:${jsonLdHit}`);
        }
      }
      if (/18183/u.test(`${visible} ${metadata} ${jsonLd.join(" ")}`)) fail("fishing-stale-source-generated", route);
      const expectedFishingLabel = fishingLocale === "en" ? fishingCommunitySource?.label : fishingCommunitySource?.labels?.[fishingLocale];
      if (!expectedFishingLabel || !html.includes(expectedFishingLabel)) fail("fishing-community-source-visible", route);
    }
    scanSemantic(visible, "generated_visible", rel);
    scanSemantic(metadata, "generated_metadata", rel);
    for (const block of jsonLd) scanSemantic(block, "generated_jsonld", rel);
    if (removedGameplayPattern.test(visible) || removedGameplayPattern.test(metadata) || jsonLd.some(block=>removedGameplayPattern.test(block))) fail("removed-gameplay-generated",rel);
    const claimLocale=routeLocale(route);
    for (const layer of ["visible","metadata","faq","jsonld"])
      scanClaimRecords({values:htmlClaimRecords(html,layer),locale:claimLocale,route,layer,source:"generated-html"});
    if (rel===path.join("zh-TW","make-money.html") && (staleZhTwMoneyMetaPattern.test(metadata) || !metadata.includes(expectedZhTwMoneyMeta))) fail("zh-tw-money-metadata-generated",rel);
    for (const [code,re] of forbidden) if(re.test(html)) fail(code,rel);
    for (const [code,re] of nonSemanticIntegrityPatterns) if(re.test(html)) fail(code,rel);
  }
  const badKoAutomationParticle = /농업 자동화이/u;
  const expectedKoAutomation = "공식 자료는 농업 자동화, 농장 드론 기지와 파종·육성·수확 작업을 각각 설명하며 구성 요소 간 의존 관계는 추론하지 않습니다.";
  if (badKoAutomationParticle.test(buildRaw) || badKoAutomationParticle.test(JSON.stringify(sourceData))) fail("ko-automation-particle-source", "persistent");
  if (!buildRaw.includes(expectedKoAutomation)) fail("ko-automation-particle-raw-correction-missing", "data/build_content.py");
  if (!JSON.stringify(sourceData.pages?.find(page => page.slug === "faq")?.i18n?.ko || {}).includes(expectedKoAutomation)) fail("ko-automation-particle-effective-correction-missing", "faq:ko");
  for (const rel of [path.join("ko", "index.html"), path.join("ko", "faq.html")]) {
    const html = fs.readFileSync(path.join(disabled, rel), "utf8");
    const visible = html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ");
    if (badKoAutomationParticle.test(visible) || !visible.includes(expectedKoAutomation)) fail("ko-automation-particle-visible", rel);
  }
  const koFaqHtml = fs.readFileSync(path.join(disabled, "ko", "faq.html"), "utf8");
  const koFaqJsonLd = [...koFaqHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)].map(match => match[1]).join(" ");
  if (badKoAutomationParticle.test(koFaqJsonLd) || !koFaqJsonLd.includes(expectedKoAutomation)) fail("ko-automation-particle-jsonld", "ko/faq.html");
  for (const [locale,fixture] of Object.entries(faultFixtures)) {
    const hit=droughtHit(fixture);
    if (!hit || hit.locale!==locale) fail(`fault-injection-${locale}`,hit?`misclassified:${hit.locale}`:"not detected");
  }
  for (const [locale,fixture] of Object.entries(safeBoundaries)) if(droughtHit(fixture)) fail(`boundary-false-positive-${locale}`,fixture);
  // ---------- G4 privacy / commercial disclosure (six locales) ----------
  // Every privacy page must distinguish the services actually injected in the
  // default build (GA4 and Adsterra) from configured-but-gated AdSense. It must
  // disclose data categories, purposes, controls and provider policy links,
  // without claiming active AdSense serving or an obtained consent state.
  const privacyLocales = ["en", "zh-CN", "zh-TW", "ja", "ko", "es"];
  const privacyRel = lang => lang === "en" ? "privacy.html" : `${lang}/privacy.html`;
  const INJECTED_PROVIDERS = {
    ga4: /googletagmanager\.com\/gtag\/js/
  };
  const DISCLOSED_PROVIDERS = {
    ga4: ["Google Analytics", "GA4"],
    adsense: ["Google AdSense"],
    adsterra: ["Adsterra", "effectivecpmnetwork"]
  };
  const ABSOLUTE_PATTERNS = {
    en: [/\banonymous\b/i, /\bpersonally identifiable information\b/i, /do not collect (?:names?|email)/i],
    "zh-CN": [/匿名/, /个人身份信息/, /不收集任何个人/],
    "zh-TW": [/匿名/, /個人身分資訊/, /不收集任何個人/],
    ja: [/匿名/, /個人情報は収集/, /個人情報を収集/],
    ko: [/익명/, /개인 식별 정보/, /개인정보를 수집/],
    es: [/anónim/i, /información personal identificable/i, /no recopilamos (?:nombres|correos)/i]
  };
  const AFFIRMATIVE_CONSENT = {
    en: /(?:we|this site|our site)[^.\n]{0,40}(?:have|has) (?:obtained|received) (?:your )?consent/i,
    "zh-CN": /已(?:获得|取得)您的同意/,
    "zh-TW": /已(?:獲得|取得)您的同意/,
    ja: /同意を得(?:ました|ています|ております)/,
    ko: /동의를 (?:받았습니다|획득했습니다)/,
    es: /hemos obtenido tu consentimiento|se ha obtenido consentimiento/i
  };
  const PURPOSE_PATTERNS = {
    en: /analytics.{0,40}advertising|advertising.{0,40}analytics/is,
    "zh-CN": /分析.{0,40}(?:广告|廣告)/,
    "zh-TW": /分析.{0,40}(?:廣告|广告)/,
    ja: /分析.{0,40}広告/,
    ko: /분석.{0,40}광고/,
    es: /análisis.{0,40}publicidad|publicidad.{0,40}análisis/is
  };
  const ADSENSE_GATED = {
    en: /AdSense.{0,220}(?:gated off|unless).{0,180}(?:serving|provider readiness).{0,120}(?:certified CMP readiness)/is,
    "zh-CN": /AdSense.{0,220}(?:只有|条件).{0,180}(?:投放|服务商就绪).{0,120}(?:认证 CMP 就绪)/is,
    "zh-TW": /AdSense.{0,220}(?:只有|條件).{0,180}(?:投放|服務商就緒).{0,120}(?:認證 CMP 就緒)/is,
    ja: /AdSense.{0,320}配信.{0,120}プロバイダー準備.{0,120}認定 CMP 準備/is,
    ko: /AdSense.{0,320}게재.{0,120}공급자 준비.{0,120}인증 CMP 준비/is,
    es: /AdSense.{0,220}(?:bloqueado|salvo que).{0,180}(?:publicación|preparación del proveedor).{0,120}(?:CMP certificado)/is
  };
  const ADSENSE_NOT_SERVING = {
    en: /does not mean that AdSense ads are currently serving/i,
    "zh-CN": /不代表 AdSense 广告目前正在投放/,
    "zh-TW": /已設定不代表目前正在投放/,
    ja: /設定済みでも現在の配信を意味しません/,
    ko: /설정만으로 현재 게재 중이라는 뜻은 아닙니다/,
    es: /estar configurado no significa que publique anuncios ahora/i
  };
  const OPT_OUT_URL = "https://tools.google.com/dlpage/gaoptout";
  const POLICY_URLS = [
    "https://policies.google.com/privacy",
    "https://adsterra.com/privacy-policy/",
    "https://developers.google.com/fonts/faq",
    "https://www.cloudflare.com/privacypolicy/"
  ];
  // Absolute-wording checks run on visible prose (scripts/styles/tags and their
  // attributes stripped) plus the meta description. This avoids false positives
  // from attributes such as the AdSense script's crossorigin="anonymous" while
  // still catching claims inside the indexed meta description.
  const privacyTextOf = html => html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ").trim();
  const metaDescOf = html => (html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [, ""])[1];
  const checkPrivacy = (lang, html) => {
    const out = [];
    for (const [name, re] of Object.entries(INJECTED_PROVIDERS)) if (!re.test(html)) out.push(`injected-${name}-missing`);
    if ((html.match(/<meta name="google-adsense-account" content="ca-pub-4174270222899193" \/>/g) || []).length !== 1) out.push("adsense-account-meta-count");
    if (/googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/.test(html)) out.push("adsense-serving-default-on");
    const prose = privacyTextOf(html);
    const desc = metaDescOf(html);
    for (const [name, tokens] of Object.entries(DISCLOSED_PROVIDERS)) {
      for (const token of tokens) if (!prose.includes(token)) out.push(`disclose-${name}-missing:${token}`);
    }
    for (const re of ABSOLUTE_PATTERNS[lang]) {
      if (re.test(prose) || re.test(desc)) out.push(`forbidden-absolute:${re}`);
    }
    if (!PURPOSE_PATTERNS[lang].test(prose)) out.push("purpose-missing");
    if (!ADSENSE_GATED[lang].test(prose)) out.push("adsense-gates-missing");
    if (!ADSENSE_NOT_SERVING[lang].test(prose)) out.push("adsense-status-misleading");
    if (["en","zh-CN"].includes(lang) && !html.includes(OPT_OUT_URL)) out.push("ga-optout-missing");
    for (const url of POLICY_URLS) if (!html.includes(url)) out.push(`policy-link-missing:${url}`);
    if (AFFIRMATIVE_CONSENT[lang].test(prose)) out.push("forbidden-consent-claim");
    return out;
  };
  const ABSOLUTE_FIXTURES = {
    en: " We collect anonymous data and no personally identifiable information.",
    "zh-CN": " 我们收集匿名数据，不收集任何个人身份信息。",
    "zh-TW": " 我們收集匿名資料，不收集任何個人身分資訊。",
    ja: " 匿名データを収集し、個人情報は一切収集しません。",
    ko: " 익명 데이터를 수집하며 개인 식별 정보를 수집하지 않습니다.",
    es: " Recopilamos datos anónimos y ninguna información personal identificable."
  };
  const CONSENT_FIXTURES = {
    en: " We have obtained your consent for third-party tracking.",
    "zh-CN": " 我们已获得您的同意进行第三方跟踪。",
    "zh-TW": " 我們已獲得您的同意進行第三方追蹤。",
    ja: " 第三者によるトラッキングについて同意を得ました。",
    ko: " 제3자 추적에 대해 동의를 받았습니다.",
    es: " Hemos obtenido tu consentimiento para el rastreo de terceros."
  };
  for (const lang of privacyLocales) {
    const rel = privacyRel(lang);
    const file = path.join(disabled, rel);
    if (!fs.existsSync(file)) { fail("privacy-page-missing", rel); continue; }
    const html = fs.readFileSync(file, "utf8");
    for (const code of checkPrivacy(lang, html)) fail(code, `${rel}:${code}`);
    // Fault injection: each language must prove the assertions can fail.
    const dropped = html.replace(/AdSense/g, "AD-REPLACED");
    const dropFaults = checkPrivacy(lang, dropped).filter(c => c.startsWith("disclose-adsense"));
    if (!dropFaults.length) fail("privacy-fault-provider", `${rel}:dropping AdSense was not detected`);
    const anonFaults = checkPrivacy(lang, html + ABSOLUTE_FIXTURES[lang]).filter(c => c.startsWith("forbidden-absolute"));
    if (!anonFaults.length) fail("privacy-fault-absolute", `${rel}:absolute wording was not detected`);
    const consentFaults = checkPrivacy(lang, html + CONSENT_FIXTURES[lang]).filter(c => c.startsWith("forbidden-consent"));
    if (!consentFaults.length) fail("privacy-fault-consent", `${rel}:invented consent was not detected`);
  }

} finally { fs.rmSync(disabled,{recursive:true,force:true}); fs.rmSync(enabled,{recursive:true,force:true}); }
const negativeFixtureExitCodes = {};
if (!fault && !failures.length) {
  const negativeFixtureNames = [
    "default-module-leak", "ko-unsupported-semantics", "es-corruption", "ko-flat-field-causality",
    "ko-drought-profit-residue", "es-drought-benefit", "es-farming-malformed", "ko-name-drift",
    "fabricated-12-gift-data",
    "semantic-drought-source", "semantic-drought-visible", "semantic-drought-jsonld",
    "semantic-flat-en-source", "semantic-flat-source", "semantic-flat-visible", "semantic-flat-zh-tw-visible", "semantic-flat-jsonld",
    "semantic-benefit-source", "semantic-benefit-visible", "semantic-benefit-jsonld",
    "semantic-shop-pressure-source", "semantic-shop-pressure-visible", "semantic-shop-pressure-jsonld",
    "semantic-whole-layer-source", "semantic-whole-layer-visible", "semantic-whole-layer-jsonld",
    "semantic-weather-profit-source", "semantic-weather-profit-visible", "semantic-weather-profit-jsonld",
    "matrix-ja-reverse-source", "matrix-ja-reverse-visible", "matrix-ja-reverse-metadata", "matrix-ja-reverse-jsonld",
    "matrix-ko-benefit-source", "matrix-ko-benefit-visible", "matrix-ko-benefit-metadata", "matrix-ko-benefit-jsonld",
    "matrix-es-benefit-source", "matrix-es-benefit-visible", "matrix-es-benefit-metadata", "matrix-es-benefit-jsonld",
    "matrix-es-passive-layer-source", "matrix-es-passive-layer-visible", "matrix-es-passive-layer-metadata", "matrix-es-passive-layer-jsonld",
    "natural-zh-shop-pressure", "natural-es-whole-tier", "natural-es-community-profit", "natural-es-mojibake",
    "language-zh-cn-intro", "language-zh-tw-intro", "language-ko-grammar", "language-ko-connector-source", "language-en-grammar",
    "evidence-ja-weather-source", "evidence-ja-weather-visible", "evidence-ja-weather-metadata", "evidence-ja-weather-jsonld",
    "evidence-economic-zh-profitable", "evidence-economic-zh-cost", "evidence-economic-ja-cost", "evidence-economic-ko-cost", "evidence-economic-es-cost",
    "evidence-gameplay-source", "evidence-gameplay-visible", "evidence-gameplay-metadata", "evidence-gameplay-faq", "evidence-gameplay-jsonld",
    "evidence-season-missing", "evidence-wind-missing", "evidence-zh-tw-fallback",
    "global-gameplay-literal-source", "global-gameplay-paraphrase-visible",
    "global-source-mismatch-literal-source", "global-source-mismatch-paraphrase-faq",
    "global-season-duplicate", "global-season-wrong-source", "global-zh-tw-money-metadata", "global-source-label-fallback",
    "automation-localization-status-fallback", "automation-localization-source-fallback", "automation-localization-reference-fallback",
    ...fishingRecipeFaultNames, ...automationPhaseFaultNames, ...contentClaimFaultNames, ...residualClaimFaultNames, "ko-automation-particle",
  ];
  const childResults=new Map();
  let childIndex=0;
  const childWorker=async()=>{
    while (childIndex<negativeFixtureNames.length) {
      const name=negativeFixtureNames[childIndex++];
      const result=await new Promise(resolve=>{
        const child=spawn(process.execPath,[auditScript,root],{env:{...process.env,DOLOC_AMAZON_AUDIT_FAULT:name}});
        let stdout="",stderr="";
        child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
        child.stdout.on("data",chunk=>{stdout+=chunk;}); child.stderr.on("data",chunk=>{stderr+=chunk;});
        child.on("error",error=>resolve({status:null,stdout,stderr:`${stderr}${error.message}`}));
        child.on("close",status=>resolve({status,stdout,stderr}));
      });
      childResults.set(name,result);
    }
  };
  await Promise.all(Array.from({length:Math.min(6,negativeFixtureNames.length)},()=>childWorker()));
  for (const name of negativeFixtureNames) {
    const result=childResults.get(name);
    negativeFixtureExitCodes[name] = result.status;
    if (!Number.isInteger(result.status) || result.status <= 0) fail("negative-fixture-did-not-fail", name);
    const claimSpec=contentClaimFaults[name];
    if (claimSpec) {
      let child;
      try { child=JSON.parse(result.stdout); } catch { fail("negative-fixture-invalid-output",name); continue; }
      const expectedCode=`unsupported-claim-${claimSpec.expectedFamily}-${claimSpec.layer}`;
      const expectedRoute=claimSpec.rel.replaceAll("\\","/");
      const matched=(child.failures||[]).some(item=>item.code===expectedCode
        && String(item.detail).includes(`${claimSpec.locale}:${expectedRoute}:${claimSpec.layer}:`));
      if (!matched) fail("negative-fixture-wrong-failure",`${name}:${expectedCode}:${claimSpec.locale}:${expectedRoute}:${claimSpec.layer}`);
    }
    if (name==="language-ko-connector-source") {
      let child;
      try { child=JSON.parse(result.stdout); } catch { fail("negative-fixture-invalid-output",name); continue; }
      const matched=(child.failures||[]).some(item=>item.code==="ko-farming-grammar-malformed-source" && String(item.detail).includes("ko:ko/how-long-to-beat.html:source:data/build_content.py:quoted-string:"));
      if (!matched) fail("negative-fixture-wrong-failure",`${name}:ko-farming-grammar-malformed-source:ko:ko/how-long-to-beat.html:source`);
    }
  }
}
console.log(JSON.stringify({disabled_pages:"all",enabled_fixture_pages:"all",semantic_locales:Object.keys(droughtPatterns),semantic_files:semanticFileCount,semantic_source_files:trackedSourceInventory.length,tracked_source_inventory:trackedSourceInventory,generated_visible_files:generatedVisibleFileCount,generated_jsonld_blocks:generatedJsonLdBlockCount,semantic_inventory:semanticInventory,evidence_layer_inventory:evidenceLayerInventory,fishing_recipe_inventory:fishingRecipeInventory,fishing_recipe_faults:fishingRecipeFaultNames,automation_phase_faults:automationPhaseFaultNames,content_claim_faults:contentClaimFaultNames,residual_claim_faults:residualClaimFaultNames,automation_claim_families:unsupportedAutomationPatterns.map(([family])=>family),rare_fish_claim_families:rareFishPatterns.map(([family])=>family),safe_chronology_inventory:safeChronologyInventory,gene_breeding_negative_control:"preserved_and_route_scoped",automation_generic_negative_control:"preserved",fault_injections:Object.keys(faultFixtures),source_boundaries:Object.keys(safeBoundaries),content_integrity_rules:contentIntegrityPatterns.map(([code])=>code),negative_fixture_exit_codes:negativeFixtureExitCodes,failures},null,2));
process.exit(failures.length?1:0);
