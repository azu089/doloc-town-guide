#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
    gamersGateLinks += count(html, trackedGamersGate);
    if (html.includes(trackedGamersGate)) assert(html.includes('rel="sponsored nofollow noopener"'), `GamersGate rel changed in ${relative}`);
  }
  assert.equal(adSlots, 7, "bounded Adsterra eligible-page cohort changed");
  assert.equal(adProviders, 7, "Adsterra output must be bounded to seven pages");
  assert.equal(gamersGateLinks, 12, "GamersGate tracked-link coverage changed");
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
  const negative = {};
  if (!fault) {
    for (const name of ["footer-provider-leak", "ordinary-link-event-pollution", "zh-section-schema-loss"]) {
      const result = spawnSync(process.execPath, [auditScript], {
        cwd: root,
        env: { ...process.env, DOLOC_COMMERCIAL_AUDIT_FAULT: name },
        encoding: "utf8",
      });
      negative[name] = result.status;
      assert.notEqual(result.status, 0, `negative fixture did not exit nonzero: ${name}`);
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
