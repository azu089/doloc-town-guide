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
} finally { fs.rmSync(disabled,{recursive:true,force:true}); fs.rmSync(enabled,{recursive:true,force:true}); }
console.log(JSON.stringify({disabled_pages:"all",enabled_fixture_pages:"all",failures},null,2));
process.exit(failures.length?1:0);
