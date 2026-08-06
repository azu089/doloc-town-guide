import { spawn } from 'child_process';
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9777;
const proc = spawn(chrome, [`--headless=new`, `--remote-debugging-port=${port}`, '--no-sandbox', '--disable-gpu', 'about:blank'], {stdio:'ignore'});
await new Promise(r=>setTimeout(r,2500));
const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const tab = tabs.find(t=>t.type==='page');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
let id=0; const pending={};
function send(method,params={}){ return new Promise(res=>{ const i=++id; pending[i]=res; ws.send(JSON.stringify({id:i,method,params})); }); }
ws.onmessage = e=>{ const m=JSON.parse(e.data); if(m.id&&pending[m.id]){ pending[m.id](m.result); delete pending[m.id]; } };
await new Promise(res=>ws.onopen=res);
await send('Page.enable'); await send('Runtime.enable');
// 真 375 模拟
await send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:2,mobile:true});
const check = async (path,label)=>{
  await send('Page.navigate',{url:`http://127.0.0.1:8899${path}`});
  await new Promise(r=>setTimeout(r,2500));
  const r = await send('Runtime.evaluate',{expression:`(()=>{
    const sw=document.documentElement.scrollWidth, cw=document.documentElement.clientWidth;
    const qa=s=>Array.from(document.querySelectorAll(s));
    return {
      scrollW: sw, clientW: cw,
      overflow: sw > cw,
      heroH: Math.round(document.querySelector('.land-photo')?.getBoundingClientRect().height||0),
      fileCols: getComputedStyle(document.querySelector('.file-grid')||document.body).gridTemplateColumns.split(' ').length,
      navWrap: document.querySelector('.nav') ? document.querySelector('.nav').scrollWidth > document.querySelector('.nav').clientWidth : null,
    };
  })()`,returnByValue:true});
  console.log(label, JSON.stringify(r.result.value));
};
await check('/', 'HOME-375:');
await check('/how-to-play', 'H2P-375:');
await check('/zh-CN/', 'ZH-375:');
proc.kill();
