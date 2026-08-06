// DOM 审计：用 headless chrome CDP 检查关键指标
import { execSync, spawn } from 'child_process';
const url = process.argv[2];
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9333 + Math.floor(Math.random()*200);
const proc = spawn(chrome, [`--headless=new`, `--remote-debugging-port=${port}`, '--no-sandbox', '--disable-gpu', 'about:blank'], {stdio:'ignore'});
await new Promise(r=>setTimeout(r,2500));
const r = await fetch(`http://127.0.0.1:${port}/json`);
const tabs = await r.json();
const tab = tabs.find(t=>t.type==='page');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
let id=0; const pending={};
function send(method,params={}){ return new Promise(res=>{ const i=++id; pending[i]=res; ws.send(JSON.stringify({id:i,method,params})); }); }
ws.onmessage = e=>{ const m=JSON.parse(e.data); if(m.id&&pending[m.id]){ pending[m.id](m.result); delete pending[m.id]; } };
await new Promise(res=>ws.onopen=res);
await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate',{url});
await new Promise(r=>setTimeout(r,3500));
const evalJs = async (expr)=>{ const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true}); return r.result?.value; };
const report = await evalJs(`(()=>{
  const q=s=>document.querySelector(s);
  const qa=s=>Array.from(document.querySelectorAll(s));
  return {
    title: document.title,
    h1: q('h1')?.innerText.slice(0,60),
    navLinks: qa('nav a, nav summary').map(a=>a.innerText.trim()).slice(0,10),
    logo: q('.logo-txt')?.innerText,
    cards: qa('.file-card').length,
    stats: qa('.stat').length,
    heroImg: q('.land-photo img')?.getAttribute('src'),
    hasLangSwitch: !!q('.lang-dd'),
    hasSearch: !!q('.site-search'),
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    jsonLd: qa('script[type="application/ld+json"]').length,
    faqs: qa('details.faq').length,
  };
})()`);
console.log(JSON.stringify(report,null,2));
proc.kill();
