#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
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
  ["ko-game-name-drift", /도록 타운/u],
  ["zh-cn-farming-intro-malformed", /学会计什么/u],
  ["zh-tw-farming-intro-malformed", /學會計什麼/u],
  ["ko-farming-grammar-malformed", /커집습니다/u],
  ["en-update-log-grammar-malformed", /not a selected highlights/iu],
  ["es-automation-mojibake", /automatizaciÃ(?:³|\u00b3)n|automatizaciÃ/i],
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
  "language-en-grammar": {layer:"jsonld", rel:"update-log.html", text:"This is not a selected highlights."},
};
const semanticFamilyCodes = new Set(semanticFamilyPatterns.map(([code]) => code));
const nonSemanticIntegrityPatterns = contentIntegrityPatterns.filter(([code]) => !semanticFamilyCodes.has(code));

const disabled = fs.mkdtempSync(path.join(os.tmpdir(),"doloc-amz-off-"));
const enabled = fs.mkdtempSync(path.join(os.tmpdir(),"doloc-amz-on-"));
let semanticFileCount = 0;
let generatedVisibleFileCount = 0;
let generatedJsonLdBlockCount = 0;
const semanticInventory = {
  locales: ["en", "zh-CN", "zh-TW", "ja", "ko", "es"],
  families: ["drought-commercial-correlation", "flat-field-weather-causality", "broad-threat-benefit", "shop-crop-pressure", "whole-layer-destruction", "weather-profit-advantage", "community-profit-guidance"],
  source: {files: 3, hits: 0},
  generated_visible: {files: 0, hits: 0},
  generated_metadata: {documents: 0, hits: 0},
  generated_jsonld: {blocks: 0, hits: 0},
};
const evidenceLayerInventory = {raw:0,effective:0,visible:0,metadata:0,faq:0,jsonld:0};
try {
  generate(disabled,false); generate(enabled,true);
  const offFiles=walk(disabled), onFiles=walk(enabled);
  const independentFault = independentFaults[fault];
  if (independentFault && independentFault.layer !== "source") {
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
  const semanticSourceFiles = [
    path.join(root,"data/build_content.py"),
    path.join(root,"data/site.base.json"),
    path.join(root,"data/site.json"),
  ];
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
  const sourceEntries = semanticSourceFiles.map(file => ({rel:path.relative(root,file), text:fs.readFileSync(file,"utf8")}));
  if (semanticSourceFaults[fault]) sourceEntries.push({rel:`fault-source:${fault}`, text:semanticSourceFaults[fault]});
  if (independentFault?.layer === "source") sourceEntries.push({rel:`fault-source:${fault}`, text:independentFault.text});
  for (const {rel,text} of sourceEntries) {
    scanSemantic(text, "source", rel);
    for (const [code,re] of forbidden) if(re.test(text)) fail(code,rel);
    for (const [code,re] of nonSemanticIntegrityPatterns) if(re.test(text)) fail(code,rel);
  }
  for (const file of generatedFiles) {
    const rel = path.relative(disabled, file);
    const html = fs.readFileSync(file, "utf8");
    const visible = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;/gi, " ");
    const metadata = [
      ...(html.match(/<title>[\s\S]*?<\/title>/gi) || []),
      ...(html.match(/<meta\s+[^>]*content="[^"]*"[^>]*>/gi) || []),
    ].join(" ");
    const jsonLd = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)].map(match => match[1]);
    generatedVisibleFileCount += 1;
    generatedJsonLdBlockCount += jsonLd.length;
    semanticInventory.generated_visible.files += 1;
    semanticInventory.generated_metadata.documents += 1;
    semanticInventory.generated_jsonld.blocks += jsonLd.length;
    scanSemantic(visible, "generated_visible", rel);
    scanSemantic(metadata, "generated_metadata", rel);
    for (const block of jsonLd) scanSemantic(block, "generated_jsonld", rel);
    for (const [code,re] of forbidden) if(re.test(html)) fail(code,rel);
    for (const [code,re] of nonSemanticIntegrityPatterns) if(re.test(html)) fail(code,rel);
  }
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
  for (const name of [
    "default-module-leak", "ko-unsupported-semantics", "es-corruption", "ko-flat-field-causality",
    "ko-drought-profit-residue", "es-drought-benefit", "es-farming-malformed", "ko-name-drift",
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
    "language-zh-cn-intro", "language-zh-tw-intro", "language-ko-grammar", "language-en-grammar",
    "evidence-ja-weather-source", "evidence-ja-weather-visible", "evidence-ja-weather-metadata", "evidence-ja-weather-jsonld",
    "evidence-economic-zh-profitable", "evidence-economic-zh-cost", "evidence-economic-ja-cost", "evidence-economic-ko-cost", "evidence-economic-es-cost",
    "evidence-gameplay-source", "evidence-gameplay-visible", "evidence-gameplay-metadata", "evidence-gameplay-faq", "evidence-gameplay-jsonld",
    "evidence-season-missing", "evidence-wind-missing", "evidence-zh-tw-fallback",
  ]) {
    const result = spawnSync(process.execPath, [auditScript, root], {
      env: { ...process.env, DOLOC_AMAZON_AUDIT_FAULT: name },
      encoding: "utf8",
    });
    negativeFixtureExitCodes[name] = result.status;
    if (!Number.isInteger(result.status) || result.status <= 0) fail("negative-fixture-did-not-fail", name);
  }
}
console.log(JSON.stringify({disabled_pages:"all",enabled_fixture_pages:"all",semantic_locales:Object.keys(droughtPatterns),semantic_files:semanticFileCount,semantic_source_files:3,generated_visible_files:generatedVisibleFileCount,generated_jsonld_blocks:generatedJsonLdBlockCount,semantic_inventory:semanticInventory,evidence_layer_inventory:evidenceLayerInventory,fault_injections:Object.keys(faultFixtures),source_boundaries:Object.keys(safeBoundaries),content_integrity_rules:contentIntegrityPatterns.map(([code])=>code),negative_fixture_exit_codes:negativeFixtureExitCodes,failures},null,2));
process.exit(failures.length?1:0);
