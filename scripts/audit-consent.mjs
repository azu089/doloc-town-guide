#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(import.meta.url);
const root = path.resolve(process.argv[2] || path.join(path.dirname(script), ".."));
const pub = path.join(root, "public");
const fault = process.env.DOLOC_CONSENT_AUDIT_FAULT || "";
const failures = [];
const fail = (code, detail) => failures.push({ code, detail });
const count = (text, needle) => needle ? text.split(needle).length - 1 : 0;
const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    entry.isDirectory() ? walk(file, out) : entry.name.endsWith(".html") && out.push(file);
  }
  return out;
};

const eligible = new Set([
  "cooking.html", "fishing.html", "mods.html", "gifts.html",
  "ko/cooking.html", "ko/fishing.html", "ko/exploration.html",
]);
const providerHost = "pl30754261.effectivecpmnetwork.com";
const providerContainer = "container-b77bc61705d2dcbe2c5239c8553cdb1a";
const gaHost = "www.googletagmanager.com/gtag/js";

function inject(relative, html) {
  if (relative !== "cooking.html") return html;
  if (fault === "no-choice-network") {
    return html.replace("</head>", `<script src="https://${gaHost}?id=G-FAULT"></script></head>`);
  }
  if (fault === "reject-network") {
    return html.replace(
      "document.querySelector('[data-consent-reject]').addEventListener('click',function(){persist({analytics:false,advertising:false});});",
      "document.querySelector('[data-consent-reject]').addEventListener('click',function(){persist({analytics:true,advertising:true});});",
    );
  }
  if (fault === "duplicate-provider") {
    return html
      .replace("gaLoaded||document.getElementById('doloc-ga4-script')", "false")
      .replace("adLoaded||document.getElementById('doloc-adsterra-script')", "false");
  }
  if (fault === "focus-escape") {
    return html
      .replace("<dialog id=\"consent-dialog-", "<section id=\"consent-dialog-")
      .replace("</dialog>", "</section>")
      .replace("if(!dialog.open)dialog.showModal();", "dialog.hidden=false;");
  }
  if (fault === "navigation-escape-ownership") {
    return html.replace("||!banner.contains(document.activeElement)", "");
  }
  return html;
}

if (!fs.existsSync(pub)) fail("missing-public", pub);
const rows = failures.length ? [] : walk(pub).map(file => {
  const relative = path.relative(pub, file).split(path.sep).join("/");
  return { relative, html: inject(relative, fs.readFileSync(file, "utf8")) };
});

if (rows.length && rows.length !== 169) fail("html-count", rows.length);
for (const { relative, html } of rows) {
  const initialOptional = [...html.matchAll(/<script[^>]+src=["']([^"']*(?:googletagmanager|effectivecpmnetwork)[^"']*)["']/gi)];
  if (initialOptional.length) fail("no-choice-network", `${relative}:${initialOptional.map(x => x[1]).join(",")}`);
  for (const token of ["data-consent-accept", "data-consent-reject", "data-consent-settings", "data-consent-withdraw", "data-consent-dialog"]) {
    if (count(html, token) < 1) fail("control-missing", `${relative}:${token}`);
  }
  if (!html.includes("aria-controls=\"consent-dialog-") || !html.includes("aria-expanded=\"false\""))
    fail("settings-a11y", relative);
  if (!html.includes("<dialog id=\"consent-dialog-") ||
      !html.includes("if(!dialog.open)dialog.showModal();") ||
      !html.includes("dialog.addEventListener('cancel',function(e){e.preventDefault();close();});") ||
      !html.includes("dialog.addEventListener('keydown',function(e){if(e.key!=='Tab')return;"))
    fail("focus-boundary", relative);
  if (!html.includes("document.querySelector('[data-consent-reject]').addEventListener('click',function(){persist({analytics:false,advertising:false});});"))
    fail("reject-not-blocking", relative);
  if (!html.includes("document.querySelector('[data-consent-accept]').addEventListener('click',function(){persist({analytics:true,advertising:true});});"))
    fail("accept-not-loading", relative);
  if (!html.includes("gaLoaded||document.getElementById('doloc-ga4-script')") ||
      !html.includes("adLoaded||document.getElementById('doloc-adsterra-script')"))
    fail("duplicate-load-guard", relative);
  if (!html.includes("banner.hidden||!banner.contains(document.activeElement)") ||
      !html.includes("function closeNavigationDetails(details, restoreFocus)") ||
      !html.includes("if (restoreFocus && summary) summary.focus();"))
    fail("navigation-escape-ownership", relative);
  const footer = (html.match(/<footer class="site-footer">[\s\S]*?<\/footer>/) || [""])[0];
  if (footer.includes(providerHost) || footer.includes(providerContainer)) fail("footer-provider-leak", relative);
  if (eligible.has(relative)) {
    if (count(html, providerHost) !== 1) fail("eligible-provider-config", `${relative}:${count(html, providerHost)}`);
    if (count(html, `id="${providerContainer}"`) !== 1) fail("eligible-provider-container", `${relative}:${count(html, `id="${providerContainer}"`)}`);
  } else {
    if (html.includes(providerHost)) fail("ineligible-provider-config", relative);
    if (html.includes(`id="${providerContainer}"`)) fail("ineligible-provider-container", relative);
  }
}

const privacyMarkers = {
  "privacy.html": { boundary: "first-party preference control", cookie: "cookies or similar identifiers" },
  "zh-CN/privacy.html": { boundary: "本站自有的偏好控制", cookie: "Cookie 或类似标识符" },
  "zh-TW/privacy.html": { boundary: "本站自有的偏好控制", cookie: "Cookie 或類似識別碼" },
  "ja/privacy.html": { boundary: "本サイト独自の設定機能", cookie: "Cookie や類似識別子" },
  "ko/privacy.html": { boundary: "사이트 자체 선택 설정", cookie: "쿠키나 유사 식별자" },
  "es/privacy.html": { boundary: "control propio de preferencias", cookie: "cookies o identificadores similares" },
};
const policyUrls = [
  "https://policies.google.com/privacy",
  "https://adsterra.com/privacy-policy/",
];
for (const [relative, markers] of Object.entries(privacyMarkers)) {
  const html = rows.find(row => row.relative === relative)?.html || "";
  for (const token of ["Google Analytics", "GA4", "Adsterra", "effectivecpmnetwork", markers.cookie, markers.boundary]) {
    if (!html.includes(token)) fail("privacy-disclosure", `${relative}:${token}`);
  }
  for (const url of policyUrls) if (!html.includes(url)) fail("privacy-policy-link", `${relative}:${url}`);
  const visible = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  if (/anonymous data|no personally identifiable|匿名数据|匿名資料|匿名データ|익명 데이터|datos anónimos/i.test(visible))
    fail("absolute-privacy-claim", relative);
}

const negative = {};
if (!fault && !failures.length) {
  for (const name of ["no-choice-network", "reject-network", "duplicate-provider", "focus-escape", "navigation-escape-ownership"]) {
    const result = spawnSync(process.execPath, [script, root], {
      env: { ...process.env, DOLOC_CONSENT_AUDIT_FAULT: name },
      encoding: "utf8",
    });
    negative[name] = result.status;
    if (result.status === 0) fail("negative-fixture-did-not-fail", name);
  }
}

console.log(JSON.stringify({
  status: failures.length ? "fail" : "pass",
  html_pages: rows.length,
  eligible_provider_pages: [...eligible].length,
  privacy_locales: Object.keys(privacyMarkers).length,
  negative_fixture_exit_codes: negative,
  failures,
}, null, 2));
process.exit(failures.length ? 1 : 0);
