# -*- coding: utf-8 -*-
"""Doloc Town 配图生成：Seedream 文生图，废墟田园统一风格，16:9 高清."""
import os, re, json, time, urllib.request, base64, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets" / "images"
ASSETS.mkdir(parents=True, exist_ok=True)

env = open("/Users/azu/Documents/跨境电商AI系统/.env", encoding="utf-8").read()
m = re.search(r"^ARK_API_KEY=(.+)$", env, re.M)
if not m:
    sys.exit("ARK_API_KEY not found")
API_KEY = m.group(1).strip().strip('"').strip("'").strip()

ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/images/generations"
# 5.0 pro 文生图模型（备选 lite）
MODEL_PRO = "doubao-seedream-5-0-pro-260628"
MODEL_LITE = "doubao-seedream-5-0-lite-260128"

STYLE = ("2D game key art for a cozy post-apocalyptic pixel-art farming game, warm moss green and harvest "
         "amber palette with rust-grey ruins, soft morning light, gentle depth of field, detailed pixel-art "
         "textures, cinematic composition, no text, no watermark, no logos, 16:9 widescreen")

PROMPTS = {
  "hero": "A thriving vertical farm built on stacked wooden platforms among post-apocalyptic ruins, drone flying over crops, solar panels and wind turbines, warm golden sunrise, " + STYLE,
  "how-to-play": "A young scavenger with a backpack standing on a ruined rooftop holding a sprouting plant, tools and farming gear around, warm hopeful mood, " + STYLE,
  "farming": "A cozy pixel-art farm plot with seasonal crops, planters on stacked platforms, a sickle and watering can, morning mist, " + STYLE,
  "automation": "A solar panel and wind turbine powering a drone station that waters crops automatically, clean energy wires, bright daylight, " + STYLE,
  "gene-system": "A mysterious gene laboratory in a ruined basement with glowing seed pods in test tubes, botanical DNA strands, teal and amber glow, " + STYLE,
  "fishing": "A calm pond among ruins at golden hour, a pixel-art angler casting a line, fish jumping, reflections, cozy mood, " + STYLE,
  "drone-combat": "A customized combat drone with a laser barrel hovering over wasteland ruins, sparks and energy glow, dynamic angle, " + STYLE,
  "exploration": "A winding path through overgrown ruins toward an ancient city skyline, lanterns and fireflies, adventurous mood, " + STYLE,
  "friendship": "Villagers sharing a meal at a festival table under string lights in a rebuilt town square, warmth and community, " + STYLE,
  "cooking": "A rustic kitchen with a steaming pot, fresh vegetables and fish on a wooden table, cozy lantern light, " + STYLE,
  "ranching": "A small barn with a fence, a cow and chickens in a rebuilt meadow, morning sun, peaceful mood, " + STYLE,
  "characters": "A group of charming pixel-art townsfolk with distinct outfits gathered in a town square, portraits style, warm light, " + STYLE,
  "story": "A mysterious glowing 'Eden' technology core half-buried in ruins, vines growing over it, secrets and wonder, " + STYLE,
  "weather": "A dramatic storm over a farm with lightning striking a tower, rain, a drone sheltering crops, intense sky, " + STYLE,
  "achievements": "A rustic wooden achievement board with medals and ribbons in a rebuilt workshop, trophies on shelves, " + STYLE,
  "mods": "A workbench with tools, computer parts and a workshop blueprint, tinkerer vibe in a cozy ruin workshop, " + STYLE,
  "update-log": "A notebook with a quill pen on a wooden desk, a steam locomotive passing outside a window, changelog mood, " + STYLE,
  "faq": "A cozy town notice board with papers pinned, a villager reading it, morning light, " + STYLE,
  "system-requirements": "A retro computer setup on a wooden desk in a rebuilt room, pixel-art monitor glowing, " + STYLE,
  "steam-deck": "A handheld gaming device resting on a farm fence, the farm and ruins in the background, " + STYLE,
}

def call(prompt, model=MODEL_PRO, retries=3):
    body = json.dumps({"model": model, "prompt": prompt, "size": "1600x900",
                       "response_format": "url", "watermark": False}).encode()
    for i in range(retries):
        try:
            req = urllib.request.Request(ENDPOINT, data=body, method="POST", headers={
                "Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=120) as r:
                data = json.loads(r.read().decode())
            items = data.get("data") or []
            if items:
                return items[0].get("url") or (items[0].get("b64_json") and "data:"+items[0]["b64_json"])
        except Exception as e:
            print(f"  attempt {i+1} failed: {e}")
            time.sleep(8 * (i + 1))
    return None

def download(url, dest):
    if url.startswith("data:"):
        b64 = url.split(",", 1)[1]
        Path(dest).write_bytes(base64.b64decode(b64))
        return True
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        Path(dest).write_bytes(r.read())
    return True

def main():
    todo = dict(PROMPTS)
    # 只生成缺失的
    done = []
    for name, prompt in todo.items():
        dest = ASSETS / f"{name}.jpg"
        if dest.exists() and dest.stat().st_size > 20000:
            print(f"skip {name} (exists)")
            done.append(name)
            continue
        print(f"generating {name} ...")
        url = call(prompt)
        if not url:
            print(f"  FAILED {name}, trying lite model")
            url = call(prompt, model=MODEL_LITE)
        if url:
            download(url, dest)
            print(f"  OK {name} -> {dest.stat().st_size} bytes")
            done.append(name)
        else:
            print(f"  FAILED {name}")
        time.sleep(2)
    print(f"\nDone: {len(done)}/{len(todo)} images")

if __name__ == "__main__":
    main()
