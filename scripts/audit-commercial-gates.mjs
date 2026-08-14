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
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "doloc-commercial-"));
const out = path.join(temp, "public");

const count = (text, needle) => text.split(needle).length - 1;
const filesUnder = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const file = path.join(dir, entry.name);
  return entry.isDirectory() ? filesUnder(file) : [file];
}).sort();
const htmlRows = () => filesUnder(out).filter(file => file.endsWith(".html")).map(file => ({
  relative: path.relative(out, file).split(path.sep).join("/"),
  html: fs.readFileSync(file, "utf8"),
}));
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

const privacyStatus = {
  "privacy.html": "does not mean that AdSense ads are currently serving",
  "zh-CN/privacy.html": "不代表 AdSense 广告目前正在投放",
  "zh-TW/privacy.html": "不代表 AdSense 廣告目前正在投放",
  "ja/privacy.html": "現在 AdSense 広告が配信中であることを意味しません",
  "ko/privacy.html": "현재 AdSense 광고가 게재 중이라는 뜻은 아닙니다",
  "es/privacy.html": "no significa que los anuncios de AdSense se estén publicando ahora",
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
    assert.equal(count(html, adsterraHost), 1, `Adsterra provider count changed in ${relative}`);
    assert.equal(count(html, 'class="amazon-gear"'), 0, `Amazon default module leaked in ${relative}`);
    assert.equal(html.includes("cozysimhub20-20"), false, `Amazon tag leaked in ${relative}`);
    adSlots += count(html, 'class="native-ad-slot"');
    adProviders += count(html, adsterraHost);
    gamersGateLinks += count(html, trackedGamersGate);
    if (html.includes(trackedGamersGate)) assert(html.includes('rel="sponsored nofollow noopener"'), `GamersGate rel changed in ${relative}`);
  }
  assert.equal(adSlots, 7, "bounded Adsterra eligible-page cohort changed");
  assert.equal(adProviders, 169, "Adsterra output coverage changed");
  assert.equal(gamersGateLinks, 12, "GamersGate tracked-link coverage changed");
  for (const [relative, marker] of Object.entries(privacyStatus)) {
    const html = rows.find(row => row.relative === relative)?.html || "";
    assert(html.includes(marker), `AdSense non-serving disclosure missing in ${relative}`);
    assert(/Google Analytics|GA4/.test(html) && html.includes("Adsterra") && html.includes("effectivecpmnetwork"),
      `active-provider disclosure changed in ${relative}`);
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
  console.log(JSON.stringify({ status: "pass", locales: 6, htmlPages: baseline.rows.length, indexablePages: 168,
    defaultServingScripts: 0, fixtureScriptsPerPage: 1, amazonDefaultModules: 0,
    adsterraEligiblePages: baseline.adSlots, adsterraProviderPages: baseline.adProviders,
    gamersGateTrackedLinks: baseline.gamersGateLinks, defaultTreeSha256: defaultHash, fixtureTreeSha256: fixtureHash,
    builds: [build1, build2, fixture1, fixture2] }, null, 2));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
