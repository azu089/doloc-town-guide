# -*- coding: utf-8 -*-
"""生成 16:9 三档 srcset：-640.jpg / -1280.jpg / 原图 1600w。"""
from PIL import Image
from pathlib import Path
import glob

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets" / "images"

def main():
    made = 0
    for f in sorted(glob.glob(str(ASSETS / "*.jpg"))):
        name = Path(f).name
        if "-640" in name or "-1280" in name:
            continue
        im = Image.open(f)
        if im.size == (1600, 900):
            # 640
            p640 = ASSETS / name.replace(".jpg", "-640.jpg")
            if not p640.exists():
                im.resize((640, 360), Image.LANCZOS).save(p640, "JPEG", quality=82, optimize=True)
                made += 1
            # 1280
            p1280 = ASSETS / name.replace(".jpg", "-1280.jpg")
            if not p1280.exists():
                im.resize((1280, 720), Image.LANCZOS).save(p1280, "JPEG", quality=85, optimize=True)
                made += 1
        print(f"{name}: {im.size}")
    print(f"made {made} srcset variants")

if __name__ == "__main__":
    main()
