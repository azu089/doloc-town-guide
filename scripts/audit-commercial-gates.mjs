#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generator = path.join(root, "scripts", "generate.js");
const expectedPublisher = "pub-4174270222899193";
const expectedClient = `ca-${expectedPublisher}`;
const trackedGamersGate = "https://www.gamersgate.com/product/doloc-town/?aff=01352e74c147aa8c9ae9c2793e51726c1e005035";
const adsterraHost = "pl30754261.effectivecpmnetwork.com";
const adsterraContainer = "container-b77bc61705d2dcbe2c5239c8553cdb1a";
const auditScript = fileURLToPath(import.meta.url);
const fault = process.env.DOLOC_COMMERCIAL_AUDIT_FAULT || "";
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "doloc-commercial-"));
const out = path.join(temp, "public");

const count = (text, needle) => text.split(needle).length - 1;
const anchorRows = html => [...html.matchAll(/<a\s[^>]*>/g)].map(match => {
  const tag = match[0];
  const attr = name => (tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i")) || [])[1] || "";
  return { tag, index: match.index, href: attr("href"), rel: attr("rel") };
});
const linkPlacementAt = (html, index) => {
  const storeStart = html.lastIndexOf('<section class="store-compare', index);
  const storeEnd = storeStart >= 0 ? html.indexOf("</section>", storeStart) : -1;
  if (storeStart >= 0 && index < storeEnd) return "store_compare";
  const sourceStart = html.lastIndexOf('<div class="sources reveal">', index);
  const sourceEnd = sourceStart >= 0 ? html.indexOf("</div>", sourceStart) : -1;
  if (sourceStart >= 0 && index < sourceEnd) return "source_list";
  return "content";
};
const trackedGamersGateAnchor = anchor => {
  try {
    const url = new URL(anchor.href.replaceAll("&amp;", "&"));
    return url.hostname === "www.gamersgate.com" && url.pathname === "/product/doloc-town/" &&
      url.searchParams.get("aff") === "01352e74c147aa8c9ae9c2793e51726c1e005035";
  } catch (_) { return false; }
};
const filesUnder = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const file = path.join(dir, entry.name);
  return entry.isDirectory() ? filesUnder(file) : [file];
}).sort();
const injectFault = (relative, html) => {
  if (fault === "footer-provider-leak" && relative === "index.html")
    return html.replace("</footer>", `<script src="https://${adsterraHost}/fault.js"></script></footer>`);
  if (fault === "ordinary-link-event-pollution" && relative === "index.html")
    return html.replace('href="https://store.steampowered.com/app/2285550/Doloc_Town/" target="_blank" rel="noopener"',
      'href="https://store.steampowered.com/app/2285550/Doloc_Town/" target="_blank" rel="sponsored nofollow noopener"');
  if (fault === "zh-section-schema-loss" && relative === "zh-CN/how-to-play.html")
    return html.replace(/<details class="harvest-faq">[\s\S]*?<\/details>/, "").replace('"@type":"FAQPage"', '"@type":"FAQPageFault"');
  if (fault === "one-anchor-sponsored-rel-loss" && relative === "where-to-buy.html")
    return html.replace(`href="${trackedGamersGate}" target="_blank" rel="sponsored nofollow noopener"`,
      `href="${trackedGamersGate}" target="_blank" rel="nofollow noopener"`);
  if (fault === "placement-collapse" && relative === "where-to-buy.html")
    return html.replace("if (a.closest('.sources')) return 'source_list';", "if (a.closest('.sources')) return 'store_compare';");
  if (fault === "payload-param-loss" && relative === "where-to-buy.html")
    return html.replace(",\n            link_placement: placementOf(a)", "");
  if (fault === "consent-bypass" && relative === "where-to-buy.html")
    return html.replace("window.DOLOC_CONSENT_ANALYTICS === true && typeof window.gtag", "typeof window.gtag");
  return html;
};
const htmlRows = () => filesUnder(out).filter(file => file.endsWith(".html")).map(file => {
  const relative = path.relative(out, file).split(path.sep).join("/");
  return { relative, html: injectFault(relative, fs.readFileSync(file, "utf8")) };
});
const treeHash = () => {
  const hash = crypto.createHash("sha256");
  for (const file of filesUnder(out)) {
    hash.update(path.relative(out, file)); hash.update("\0"); hash.update(fs.readFileSync(file)); hash.update("\0");
  }
  return hash.digest("hex");
};
const build = fixture => {
  const env = { ...process.env, TZ: "UTC", DOLOC_OUTPUT_DIR: out, DOLOC_LASTMOD_PATH: path.join(temp, "lastmod.json") };
  delete env.DOLOC_AMAZON_FIXTURE;
  delete env.DOLOC_ADSENSE_FIXTURE;
  delete env.NODE_ENV;
  if (fixture) { env.NODE_ENV = "test"; env.DOLOC_ADSENSE_FIXTURE = "enabled"; }
  const result = spawnSync(process.execPath, [generator], { cwd: root, env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout || "generator failed");
  return result.stdout.trim();
};
const configPaths = [path.join(root, "data", "site.base.json"), path.join(root, "data", "site.json")];
for (const file of configPaths) {
  const site = JSON.parse(fs.readFileSync(file, "utf8")).site;
  assert.equal(site.adsenseId, expectedPublisher, `${path.basename(file)} publisher must remain raw pub-`);
  assert.deepEqual(site.adsenseServing, { enabled: false, providerReady: false, certifiedCmpReady: false },
    `${path.basename(file)} production gates must all default false`);
  assert.equal(site.contentUpdatedAt, "2026-08-14", `${path.basename(file)} content date changed`);
}

const eligible = new Set(["cooking.html","fishing.html","mods.html","gifts.html","ko/cooking.html","ko/fishing.html","ko/exploration.html"]);
const privacyPages = ["privacy.html","zh-CN/privacy.html","zh-TW/privacy.html","ja/privacy.html","ko/privacy.html","es/privacy.html"];
const whereToBuyPages = new Set(["where-to-buy.html","zh-CN/where-to-buy.html","zh-TW/where-to-buy.html","ja/where-to-buy.html","ko/where-to-buy.html","es/where-to-buy.html"]);

const decisionScriptFrom = html => {
  const block = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map(match => match[1])
    .find(script => script.includes("affiliate_click") && script.includes("function placementOf"));
  assert(block, "decision events runtime script missing");
  return block;
};
const executeDecisionClick = ({ html, anchor, consent }) => {
  const listeners = {};
  const events = [];
  const placement = linkPlacementAt(html, anchor.index);
  const mockAnchor = {
    href: anchor.href.replaceAll("&amp;", "&"),
    rel: anchor.rel,
    closest(selector) {
      if (selector === "a[href]") return this;
      if (selector === ".store-compare") return placement === "store_compare" ? {} : null;
      if (selector === ".sources") return placement === "source_list" ? {} : null;
      return null;
    },
  };
  const document = { addEventListener(name, listener) { listeners[name] = listener; } };
  const window = {
    DOLOC_CONSENT_ANALYTICS: consent,
    gtag(name, event, params) { events.push({ name, event, params }); },
  };
  vm.runInNewContext(decisionScriptFrom(html), {
    document, window, URL,
    location: { href: "https://doloctownguides.com/where-to-buy?campaign=private#stores", origin: "https://doloctownguides.com", pathname: "/where-to-buy" },
  });
  assert.equal(typeof listeners.click, "function", "decision click listener missing");
  const click = () => listeners.click({ target: mockAnchor });
  click();
  return { events, window, click };
};

const assertDecisionEvents = rows => {
  const html = rows.find(row => row.relative === "where-to-buy.html")?.html || "";
  const anchors = anchorRows(html);
  const pick = (host, placement) => anchors.find(anchor => {
    try { return new URL(anchor.href.replaceAll("&amp;", "&")).hostname.includes(host) && linkPlacementAt(html, anchor.index) === placement; }
    catch (_) { return false; }
  });
  const gamersGateStore = pick("gamersgate.com", "store_compare");
  const gamersGateSource = pick("gamersgate.com", "source_list");
  assert(gamersGateStore && gamersGateSource, "representative GamersGate placement anchors missing");
  const assertEvent = (anchor, expectedName, expectedPlacement) => {
    assert(anchor, `${expectedPlacement} representative anchor missing`);
    const { events } = executeDecisionClick({ html, anchor, consent: true });
    assert.equal(events.length, 1, `${expectedPlacement} accepted click event count`);
    const event = events[0];
    assert.equal(event.name, "event", `${expectedPlacement} gtag command`);
    assert.equal(event.event, expectedName, `${expectedPlacement} event classification`);
    assert.deepEqual(Object.keys(event.params).sort(), ["link_domain", "link_placement", "link_url", "page_path"],
      `${expectedPlacement} payload params`);
    assert.equal(event.params.link_placement, expectedPlacement, `${expectedPlacement} link_placement`);
    assert.equal(event.params.page_path, "/where-to-buy", `${expectedPlacement} query-free page_path`);
    assert(!/[?#]/.test(event.params.link_url), `${expectedPlacement} query/hash leaked into link_url`);
    assert(!event.params.link_url.includes("aff="), `${expectedPlacement} affiliate identifier leaked into link_url`);
  };
  assertEvent(gamersGateStore, "affiliate_click", "store_compare");
  assertEvent(gamersGateSource, "affiliate_click", "source_list");
  for (const host of ["store.steampowered.com", "humblebundle.com", "greenmangaming.com"])
    assertEvent(pick(host, "store_compare"), "outbound_click", "store_compare");

  for (const consent of [undefined, false]) {
    const run = executeDecisionClick({ html, anchor: gamersGateStore, consent });
    assert.equal(run.events.length, 0, `${String(consent)} analytics consent must emit zero events`);
    run.window.DOLOC_CONSENT_ANALYTICS = true;
    assert.equal(run.events.length, 0, `${String(consent)} analytics consent must not queue replay`);
  }
  const withdrawn = executeDecisionClick({ html, anchor: gamersGateStore, consent: true });
  assert.equal(withdrawn.events.length, 1, "accepted analytics click missing before withdrawal");
  withdrawn.window.DOLOC_CONSENT_ANALYTICS = false;
  withdrawn.click();
  assert.equal(withdrawn.events.length, 1, "withdrawn analytics consent must emit zero new events");
  withdrawn.window.DOLOC_CONSENT_ANALYTICS = true;
  assert.equal(withdrawn.events.length, 1, "withdrawn analytics consent must not queue replay");
};

const assertOutput = fixture => {
  const rows = htmlRows();
  assert.equal(rows.length, 169, "HTML route count changed");
  const sitemap = fs.readFileSync(path.join(out, "sitemap.xml"), "utf8");
  assert.equal(count(sitemap, "<loc>"), 168, "indexable route count changed");
  let adSlots = 0, adProviders = 0, gamersGateLinks = 0;
  for (const { relative, html } of rows) {
    assert.equal(count(html, `<meta name="google-adsense-account" content="${expectedClient}" />`), 1,
      `AdSense account meta count changed in ${relative}`);
    assert.equal(count(html, "pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"), fixture ? 1 : 0,
      `AdSense script count changed in ${relative}`);
    assert.equal(html.includes("client=pub-"), false, `raw pub leaked as script client in ${relative}`);
    assert.equal(html.includes("client=ca-ca-pub-"), false, `double ca prefix in ${relative}`);
    if (fixture) assert.equal(count(html, `client=${expectedClient}`), 1, `fixture client count changed in ${relative}`);
    assert.equal(count(html, adsterraHost), eligible.has(relative) ? 1 : 0, `Adsterra cohort/config leaked in ${relative}`);
    assert.equal(count(html, `id="${adsterraContainer}"`), eligible.has(relative) ? 1 : 0, `Adsterra container leaked in ${relative}`);
    assert.equal(/<script[^>]+src=["'][^"']*(?:googletagmanager|effectivecpmnetwork)/i.test(html), false,
      `optional provider makes an initial script request in ${relative}`);
    const footer = (html.match(/<footer class="site-footer">[\s\S]*?<\/footer>/) || [""])[0];
    assert.equal(footer.includes(adsterraHost) || footer.includes(adsterraContainer), false, `provider leaked into footer in ${relative}`);
    for (const anchor of html.match(/<a\s[^>]*>/g) || []) {
      if (/href="https:\/\/store\.steampowered\.com\//i.test(anchor))
        assert.equal(/rel="[^"]*sponsored/i.test(anchor), false, `ordinary Steam link marked sponsored in ${relative}`);
    }
    for (const token of ["data-consent-accept", "data-consent-reject", "data-consent-settings", "data-consent-withdraw"])
      assert(html.includes(token), `consent control ${token} missing in ${relative}`);
    assert.equal(count(html, 'class="amazon-gear"'), 0, `Amazon default module leaked in ${relative}`);
    assert.equal(html.includes("cozysimhub20-20"), false, `Amazon tag leaked in ${relative}`);
    adSlots += count(html, 'class="native-ad-slot"');
    adProviders += count(html, adsterraHost);
    const gamersGateAnchors = anchorRows(html).filter(trackedGamersGateAnchor);
    gamersGateLinks += gamersGateAnchors.length;
    for (const anchor of gamersGateAnchors)
      assert.equal(anchor.rel, "sponsored nofollow noopener", `GamersGate rel changed in ${relative}`);
    if (whereToBuyPages.has(relative)) {
      assert.equal(gamersGateAnchors.length, 2, `GamersGate anchor count changed in ${relative}`);
      assert.deepEqual(gamersGateAnchors.map(anchor => linkPlacementAt(html, anchor.index)).sort(), ["source_list", "store_compare"],
        `GamersGate placements changed in ${relative}`);
    } else assert.equal(gamersGateAnchors.length, 0, `GamersGate anchor leaked outside where-to-buy in ${relative}`);
  }
  assert.equal(adSlots, 7, "bounded Adsterra eligible-page cohort changed");
  assert.equal(adProviders, 7, "Adsterra output must be bounded to seven pages");
  assert.equal(gamersGateLinks, 12, "GamersGate tracked-link coverage changed");
  assertDecisionEvents(rows);
  for (const relative of ["zh-CN/how-to-play.html", "zh-TW/how-to-play.html"]) {
    const html = rows.find(row => row.relative === relative)?.html || "";
    assert(count(html, 'class="harvest-faq"') === 5, `five FAQ details missing in ${relative}`);
    assert(count(html, 'class="season-tl"') === 4, `structured 1.0 timeline missing in ${relative}`);
    assert(html.includes("RMB") && html.includes("LMB") && html.includes("Space") && html.includes("R "), `drone controls missing in ${relative}`);
    const jsonBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
    const flat = jsonBlocks.flatMap(value => Array.isArray(value) ? value : [value]);
    const faq = flat.find(value => value && value["@type"] === "FAQPage");
    assert.equal(faq?.mainEntity?.length, 5, `FAQPage JSON-LD parity missing in ${relative}`);
  }
  for (const relative of privacyPages) {
    const html = rows.find(row => row.relative === relative)?.html || "";
    assert(/Google Analytics|GA4/.test(html) && html.includes("Adsterra") && html.includes("effectivecpmnetwork"),
      `active-provider disclosure changed in ${relative}`);
    assert(html.includes("data-consent-accept") && html.includes("data-consent-reject") && html.includes("data-consent-settings"),
      `consent controls missing in ${relative}`);
  }
  assert.equal(fs.readFileSync(path.join(out, "ads.txt"), "utf8"),
    `google.com, ${expectedPublisher}, DIRECT, f08c47fec0942fa0\n`, "ads.txt raw publisher record changed");
  return { rows, adSlots, adProviders, gamersGateLinks };
};

try {
  const build1 = build(false); const baseline = assertOutput(false); const defaultHash = treeHash();
  const build2 = build(false); assertOutput(false); assert.equal(treeHash(), defaultHash, "default builds differ");
  const fixture1 = build(true); assertOutput(true); const fixtureHash = treeHash();
  const fixture2 = build(true); assertOutput(true); assert.equal(treeHash(), fixtureHash, "fixture builds differ");
  build(false); assertOutput(false); assert.equal(treeHash(), defaultHash, "fixture round-trip changed default output");
  const source = fs.readFileSync(generator, "utf8");
  assert(source.includes("affiliate ? 'affiliate_click' : 'outbound_click'"), "decision-event classification changed");
  assert(source.includes("window.DOLOC_CONSENT_ANALYTICS === true"), "pre-consent event gate missing");
  assert(source.includes("link_placement: placementOf(a)"), "link_placement payload missing");
  const negative = {};
  if (!fault) {
    const negativeFixtures = {
      "footer-provider-leak": "Adsterra cohort/config leaked in index.html",
      "ordinary-link-event-pollution": "ordinary Steam link marked sponsored in index.html",
      "zh-section-schema-loss": "five FAQ details missing in zh-CN/how-to-play.html",
      "one-anchor-sponsored-rel-loss": "GamersGate rel changed in where-to-buy.html",
      "placement-collapse": "source_list link_placement",
      "payload-param-loss": "store_compare payload params",
      "consent-bypass": "undefined analytics consent must emit zero events",
    };
    for (const [name, expectedReason] of Object.entries(negativeFixtures)) {
      const result = spawnSync(process.execPath, [auditScript], {
        cwd: root,
        env: { ...process.env, DOLOC_COMMERCIAL_AUDIT_FAULT: name },
        encoding: "utf8",
      });
      negative[name] = result.status;
      assert.notEqual(result.status, 0, `negative fixture did not exit nonzero: ${name}`);
      assert(`${result.stdout}\n${result.stderr}`.includes(expectedReason), `negative fixture failed for unexpected reason: ${name}`);
    }
  }
  console.log(JSON.stringify({ status: "pass", locales: 6, htmlPages: baseline.rows.length, indexablePages: 168,
    defaultServingScripts: 0, fixtureScriptsPerPage: 1, amazonDefaultModules: 0,
    adsterraEligiblePages: baseline.adSlots, adsterraProviderConfigPages: baseline.adProviders,
    gamersGateTrackedLinks: baseline.gamersGateLinks, defaultTreeSha256: defaultHash, fixtureTreeSha256: fixtureHash,
    negativeFixtureExitCodes: negative, builds: [build1, build2, fixture1, fixture2] }, null, 2));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
