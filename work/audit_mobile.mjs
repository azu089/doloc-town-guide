// 移动端 375px 审计 + 内页 + 多语言
import { spawn } from 'child_process';
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9555 + Math.floor(Math.random()*200);
const proc = spawn(chrome, [`--headless=new`, `--remote-debugging-port=${port}`, '--no-sandbox', '--disable-gpu', '--window-size=375,812', 'about:blank'], {stdio:'ignore'});
await new Promise(r=>setTimeout(r,2500));
const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const tab = tabs.find(t=>t.type==='page');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
let id=0; const pending={};
function send(method,params={}){ return new Promise(res=>{ const i=++id; pending[i]=res; ws.send(JSON.stringify({id:i,method,params})); }); }
ws.onmessage = e=>{ const m=JSON.parse(e.data); if(m.id&&pending[m.id]){ pending[m.id](m.result); delete pending[m.id]; } };
await new Promise(res=>ws.onopen=res);
await send('Page.enable'); await send('Runtime.enable');
const check = async (path,label)=>{
  await send('Page.navigate',{url:`http://127.0.0.1:8899${path}`});
  await new Promise(r=>setTimeout(r,2500));
  const r = await send('Runtime.evaluate',{expression:`(()=>{
    const q=s=>document.querySelector(s); const qa=s=>Array.from(document.querySelectorAll(s));
    return {
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      h1: q('h1')?.innerText.slice(0,40),
      cards: qa('.file-card, .grow-card').length,
      toc: qa('.toc a').length,
      images: qa('img').length,
      imgsOverflow: qa('img').some(i=>i.getBoundingClientRect().right > document.documentElement.clientWidth+1),
      navW: q('.nav')?.scrollWidth > q('.nav')?.clientWidth,
      lang: q('.lang-dd')?.innerText.trim().slice(0,20),
    };
  })()`,returnByValue:true});
  console.log(label, JSON.stringify(r.result.value));
};
await check('/', 'HOME-375:');
await check('/how-to-play', 'H2P-375:');
await check('/zh-CN/', 'ZH-375:');
await check('/es/how-to-play', 'ES-H2P-375:');
await check('/automation', 'AUTO-375:');
proc.kill();
