#!/usr/bin/env node
/* 本地验证用 dev server：支持 clean URL（/foo -> /foo.html） */
const http = require("http");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "public");
const MIME = {".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".svg":"image/svg+xml",".xml":"application/xml",".txt":"text/plain",".webp":"image/webp",".ico":"image/x-icon",".json":"application/json"};
http.createServer((req, res) => {
  let p = decodeURIComponent((req.url||"/").split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  let fp = path.normalize(path.join(ROOT, p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end("403"); return; }
  if (!fs.existsSync(fp) && !path.extname(fp)) fp += ".html";
  if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404, {"Content-Type":"text/plain"}); res.end("404"); return; }
  res.writeHead(200, {"Content-Type": MIME[path.extname(fp).toLowerCase()] || "application/octet-stream"});
  fs.createReadStream(fp).pipe(res);
}).listen(8899, () => console.log("KTS dev server on http://127.0.0.1:8899"));
