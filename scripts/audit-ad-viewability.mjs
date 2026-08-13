#!/usr/bin/env node
/**
 * Doloc-only Native Banner experiment audit.
 *
 * This intentionally lives outside scripts/lib/: files in scripts/lib are
 * synchronized byte-for-byte from packages/site-kit and may not contain
 * site-specific policy.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || ".");
const pub = path.join(root, "public");
const cfgPath = path.join(root, "data", "site.json");
const cssPath = path.join(root, "templates", "style.css");
const failures = [];
const fail = (code, detail) => failures.push({ code, detail });
const countOf = (text, needle) => needle ? text.split(needle).length - 1 : 0;

const cohort = new Map([
  ["cooking.html", { section: 4, label: "Advertisement" }],
  ["fishing.html", { section: 6, label: "Advertisement" }],
  ["mods.html", { section: 3, label: "Advertisement" }],
  ["gifts.html", { section: 5, label: "Advertisement" }],
  ["ko/cooking.html", { section: 4, label: "광고" }],
  ["ko/fishing.html", { section: 6, label: "광고" }],
  ["ko/exploration.html", { section: 4, label: "광고" }]
]);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file, out);
    else if (entry.name.endsWith(".html")) out.push(file);
  }
  return out;
}

if (!fs.existsSync(pub)) fail("missing-public", pub);
if (!fs.existsSync(cfgPath)) fail("missing-config", cfgPath);
if (!fs.existsSync(cssPath)) fail("missing-css", cssPath);

let checkedPages = 0;
let checkedEligible = 0;
if (!failures.length) {
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")).site;
  const ad = cfg.adsterra || "";
  const providerSrc = (ad.match(/src="([^"]*effectivecpmnetwork\.com[^"]*)"/) || [])[1];
  const containerId = (ad.match(/id="([^"]+)"/) || [])[1];

  if (cfg.domain !== "doloctownguides.com") fail("wrong-domain", cfg.domain || "missing");
  if (!providerSrc || !containerId) fail("ad-config-invalid", "expected one provider script and container id");
  if (/(popunder|smartlink|social bar|adult ads|interstitial|auto-audio)/i.test(ad))
    fail("ad-forbidden-format", "provider config contains a forbidden format");

  const htmlFiles = walk(pub);
  const seenEligible = new Set();
  for (const file of htmlFiles) {
    const rel = path.relative(pub, file).split(path.sep).join("/");
    const html = fs.readFileSync(file, "utf8");
    const expected = cohort.get(rel);
    const slotCount = countOf(html, 'class="native-ad-slot"');
    const footer = (html.match(/<footer class="site-footer">[\s\S]*?<\/footer>/) || [""])[0];
    checkedPages++;

    if (providerSrc && countOf(html, providerSrc) !== 1)
      fail("ad-provider-count", `${rel} (script=${countOf(html, providerSrc)})`);
    if (containerId && countOf(html, `id="${containerId}"`) !== 1)
      fail("ad-container-count", `${rel} (container=${countOf(html, `id="${containerId}"`)})`);

    if (expected) {
      seenEligible.add(rel);
      checkedEligible++;
      if (slotCount !== 1) fail("ad-cohort-slot", `${rel} (slot=${slotCount})`);
      if (providerSrc && footer.includes(providerSrc)) fail("ad-eligible-footer", rel);
      const slot = (html.match(/<aside class="native-ad-slot"[\s\S]*?<\/aside>/) || [""])[0];
      if (!slot.includes(`aria-label="${expected.label}"`) ||
          !slot.includes(`<span class="native-ad-label">${expected.label}</span>`))
        fail("ad-label", rel);
      if (!slot.includes('data-ad-placement="article-mid-late"') ||
          !slot.includes('data-experiment="doloc-native-ad-viewability-20260814"'))
        fail("ad-metadata", rel);
      const anchor = `id="sec-${expected.section}"`;
      const next = `id="sec-${expected.section + 1}"`;
      const anchorIndex = html.indexOf(anchor);
      const slotIndex = html.indexOf('class="native-ad-slot"');
      const nextIndex = html.indexOf(next);
      if (!(anchorIndex >= 0 && anchorIndex < slotIndex && slotIndex < nextIndex))
        fail("ad-anchor", `${rel} (expected after section ${expected.section})`);
      if (/class="[^"]*native-ad-slot[^"]*reveal|class="[^"]*reveal[^"]*native-ad-slot/.test(html))
        fail("ad-motion-class", rel);
    } else {
      if (slotCount !== 0) fail("ad-cohort-leak", rel);
      if (providerSrc && !footer.includes(providerSrc)) fail("ad-footer-missing", rel);
    }
  }

  for (const rel of cohort.keys()) {
    if (!seenEligible.has(rel)) fail("ad-cohort-page-missing", rel);
  }

  const css = fs.readFileSync(cssPath, "utf8");
  for (const token of [
    "--ad-slot-reserve:clamp(180px,32vw,260px)",
    ".native-ad-slot",
    "max-inline-size:100%",
    ".native-ad-label"
  ]) {
    if (!css.includes(token)) fail("ad-css-contract", token);
  }
  const authored = (css.match(/\.native-ad-slot[^}]*\{[^}]*\}/g) || []).join("\n") +
    (css.match(/\.native-ad-label[^}]*\{[^}]*\}/g) || []).join("\n");
  if (/(animation|transition|position\s*:\s*(fixed|sticky))/i.test(authored))
    fail("ad-motion-position", "slot/label must stay static");
}

const result = {
  root,
  checked_pages: checkedPages,
  eligible_pages: checkedEligible,
  expected_eligible_pages: cohort.size,
  failures
};
console.log(JSON.stringify(result, null, 2));
process.exit(failures.length ? 1 : 0);
