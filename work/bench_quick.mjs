// 快速对标截图（headless chrome）
import { execSync } from 'child_process';
import fs from 'fs';
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const targets={
  'sv-wiki':'https://stardewvalleywiki.com/Stardew_Valley_Wiki',
  'game8':'https://game8.co/games/Doloc-Town',
  'fandom':'https://doloctown.fandom.com/wiki/Doloc_Town_Wiki',
  'mejoress':'https://www.mejoress.com/en/doloc-town-guide/',
};
for (const [name,url] of Object.entries(targets)) {
  const out=`/Users/azu/Documents/热词游戏站/sites/doloc-town/work/bench-${name}.png`;
  try {
    execSync(`"${chrome}" --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=1440,1800 --screenshot="${out}" --virtual-time-budget=6000 "${url}" 2>/dev/null`, {timeout:45000});
    console.log(name, fs.existsSync(out)?fs.statSync(out).size:'FAIL');
  } catch(e){ console.log(name,'ERR'); }
}
