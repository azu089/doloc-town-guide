#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Doloc Town price snapshot fetcher (T1 price pilot, 2026-08-18).

Read-only network GETs only:
  - Steam appdetails (https://store.steampowered.com/api/appdetails?appids=2285550)
    for per-region current price / original price / discount % (us, cn, jp, kr, es)
  - Steam store page HTML for the official "Offer ends <date>" promotion deadline
    (the appdetails API does not expose discount_expiration for this app)
  - CheapShark public API (https://www.cheapshark.com/api/1.0) for the tracked
    historical low (cheapestPriceEver + date) and the cheapest current deal

Writes only data/prices.json (the committed snapshot the build reads).
Deterministic field order; every required source must succeed or the script
exits non-zero WITHOUT writing, so CI never commits a broken snapshot.

Usage:
  python3 data/fetch_prices.py            # write data/prices.json
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import zoneinfo
from datetime import date, datetime, timedelta
from pathlib import Path

APPID = "2285550"
NAME = "Doloc Town"
ROOT = Path(__file__).parent
OUT = ROOT / "prices.json"
TZ_SH = zoneinfo.ZoneInfo("Asia/Shanghai")
# CheapShark requires a descriptive UA and rejects generic ones.
UA = "DolocTownGuide/1.0 (doloctownguides.com price snapshot; contact: site@doloctownguides.com)"
# Language -> region mapping used by the site build.
REGIONS = ["us", "cn", "jp", "kr", "es"]
STEAM_URL = f"https://store.steampowered.com/app/{APPID}/Doloc_Town/"
STEAMDB_URL = f"https://steamdb.info/app/{APPID}/"
ITAD_URL = "https://isthereanydeal.com/product/01961f57-3655-7097-a075-9645a29770a9/"
CS_SEARCH_URL = "https://www.cheapshark.com/api/1.0/games?title=" + urllib.parse.quote("Doloc Town")
CS_STORES_URL = "https://www.cheapshark.com/api/1.0/stores"
CS_GAME_URL = "https://www.cheapshark.com/api/1.0/games?id="


def _request(url, binary=False, timeout=25, attempts=4):
    """GET with descriptive UA and retry-with-backoff.

    Steam's public API and store pages are known to drop connections
    intermittently; a short backoff usually recovers them.
    """
    headers = {"User-Agent": UA}
    if not binary:
        headers["Accept"] = "application/json"
    last = None
    for attempt in range(1, attempts + 1):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except Exception as exc:
            last = exc
            if attempt < attempts:
                time.sleep(3 * attempt)
    raise RuntimeError(f"GET failed after {attempts} attempts: {url} ({last})")


def http_json(url, timeout=25):
    return json.loads(_request(url, timeout=timeout).decode("utf-8"))


def http_text(url, timeout=25):
    return _request(url, binary=True, timeout=timeout).decode("utf-8", errors="replace")


def steam_region(cc):
    """Steam appdetails price_overview for one region."""
    url = f"https://store.steampowered.com/api/appdetails?appids={APPID}&l=english&cc={cc}&filters=price_overview,basic"
    doc = http_json(url).get(APPID) or {}
    if not doc.get("success") or not doc.get("data"):
        raise RuntimeError(f"Steam appdetails failed for cc={cc}")
    po = doc["data"].get("price_overview") or {}
    if not po.get("currency"):
        raise RuntimeError(f"Steam appdetails missing price_overview for cc={cc}")
    return {
        "cc": cc,
        "currency": po.get("currency"),
        "initial_cents": po.get("initial"),
        "final_cents": po.get("final"),
        "discount_percent": po.get("discount_percent", 0),
        "initial_formatted": po.get("initial_formatted"),
        "final_formatted": po.get("final_formatted"),
        "discount_expiration": po.get("discount_expiration"),
    }


# 月份匹配：全称与前 3 字母缩略（Jan…Dec）都接受；按前 3 字母归一避免歧义。
_MONTH_ABBR = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}
_MONTH_RE = r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"


def _month_of(name):
    return _MONTH_ABBR.get((name or "")[:3].lower())


def _parse_offer_end(text):
    """从商店页文本解析促销截止日，返回 (month, day, year_or_None) 或 None。

    同时兼容 Steam 页面出现的两种日期形态（G4 P1 price-deadline-parser-format-mismatch）：
      月先日后: "Offer ends August 19" / "Offer ends August 19, 2026" / "Aug 19"
      日先月后: "Offer ends 19 August" / "Offer ends 19 August 2026" / "19 Aug"
    """
    if not text:
        return None
    patterns = [
        # 月先日后（可带逗号与年份）
        re.compile(rf"({_MONTH_RE})\.?\s+(\d{{1,2}}),?\s+(\d{{4}})"),
        # 日先月后（可带年份）
        re.compile(rf"(\d{{1,2}})\s+({_MONTH_RE})\.?,?\s+(\d{{4}})"),
        # 月先日后（无年份）
        re.compile(rf"({_MONTH_RE})\.?\s+(\d{{1,2}})\b"),
        # 日先月后（无年份）
        re.compile(rf"\b(\d{{1,2}})\s+({_MONTH_RE})\.?\b"),
    ]
    for pat in patterns:
        m = pat.search(text)
        if not m:
            continue
        groups = m.groups()
        if groups[0][:1].isdigit():
            day, month_name = int(groups[0]), groups[1]
            year = int(groups[2]) if len(groups) == 3 and groups[2] else None
        else:
            month_name, day = groups[0], int(groups[1])
            year = int(groups[2]) if len(groups) == 3 and groups[2] else None
        month = _month_of(month_name)
        if month:
            return (month, day, year)
    return None


def _resolve_year(month, day, year, data_date):
    """无年份时按促销应在未来/当日推断年份；带年份直接校验合法性。"""
    today = date.fromisoformat(data_date)
    if year is not None:
        try:
            return date(year, month, day)
        except ValueError:
            return None
    for y in (today.year, today.year + 1):
        try:
            candidate = date(y, month, day)
        except ValueError:
            return None
        if candidate >= today - timedelta(days=1):
            return candidate
    return None


def steam_discount_deadline(data_date, regions):
    """Official promotion end date, ISO YYYY-MM-DD.

    Prefers the API's discount_expiration (unix ts) when present; otherwise
    parses the Steam store page countdown ("SPECIAL PROMOTION! Offer ends
    19 August" or "Offer ends August 19"). The store page is fetched without
    an l= parameter, so its language follows Steam's region/UA negotiation;
    the parser therefore accepts both English month-first and day-first
    spellings (full and abbreviated month names).

    Fail-closed: when any region reports an active discount (discount_percent
    > 0) but no end date can be resolved, raises RuntimeError so the run exits
    non-zero and never writes a snapshot that would render a broken "until ."
    deadline on the site.
    """
    for cc in REGIONS:
        exp = regions[cc]["discount_expiration"]
        if exp:
            return datetime.fromtimestamp(int(exp), tz=zoneinfo.ZoneInfo("UTC")).date().isoformat()
    on_sale = any(regions[cc]["discount_percent"] for cc in REGIONS)
    if not on_sale:
        return None  # 无折扣时没有截止日，正常写快照
    try:
        page = http_text(STEAM_URL)
    except Exception as exc:
        raise RuntimeError(f"discount active but store page fetch failed, cannot resolve offer end: {exc}")
    # 优先取主游戏倒计时元素的文本，避免页面其他折扣块干扰；失败则全页回退。
    m = re.search(r'game_purchase_discount_countdown[^>]*>([^<]*)</p>', page)
    parsed = _parse_offer_end(m.group(1)) if m else _parse_offer_end(page)
    if parsed is None:
        raise RuntimeError(
            "discount active but offer-end date could not be parsed from the Steam "
            "store page (expected 'Offer ends <Month> <day>' or '<day> <Month>'); "
            "refusing to write a snapshot with an unknown deadline")
    month, day, year = parsed
    resolved = _resolve_year(month, day, year, data_date)
    if resolved is None:
        raise RuntimeError(f"discount active but offer-end date {month}/{day}/{year} is invalid; refusing to write snapshot")
    return resolved.isoformat()


def cheapshark():
    """Historical low + cheapest current deal via CheapShark."""
    search = http_json(CS_SEARCH_URL)
    entry = next((g for g in search if str(g.get("steamAppID")) == APPID), None)
    if entry is None:
        raise RuntimeError("CheapShark has no entry for Doloc Town (steamAppID 2285550)")
    game_id = str(entry["gameID"])
    details = http_json(CS_GAME_URL + game_id)
    cpe = details.get("cheapestPriceEver") or {}
    deals = details.get("deals") or []
    cheapest = min(deals, key=lambda d: float(d.get("price") or 0)) if deals else None
    store_name = None
    if cheapest:
        try:
            stores = http_json(CS_STORES_URL)
            by_id = {str(s.get("storeID")): s.get("storeName") for s in stores}
            store_name = by_id.get(str(cheapest.get("storeID")))
        except Exception as exc:
            print(f"  [warn] CheapShark stores lookup failed: {exc}")
    cpe_date = None
    if cpe.get("date"):
        cpe_date = datetime.fromtimestamp(int(cpe["date"]), tz=zoneinfo.ZoneInfo("UTC")).date().isoformat()
    return {
        "game_id": game_id,
        "game_url": f"https://www.cheapshark.com/game/{game_id}/{entry.get('internalName', '')}",
        "cheapest_price_ever_usd": float(cpe["price"]) if cpe.get("price") else None,
        "cheapest_price_ever_date": cpe_date,
        "cheapest_now_usd": float(cheapest["price"]) if cheapest else None,
        "cheapest_now_store": store_name,
    }


def build_snapshot():
    now = datetime.now(TZ_SH)
    data_date = now.date().isoformat()
    regions = {}
    for cc in REGIONS:
        regions[cc] = steam_region(cc)
    deadline = steam_discount_deadline(data_date, regions)
    cs = cheapshark()
    snapshot = {
        "appid": APPID,
        "name": NAME,
        "data_date": data_date,
        "fetched_at": now.isoformat(timespec="seconds"),
        "steam": {
            "url": STEAM_URL,
            "discount_deadline": deadline,
            "discount_deadline_source": "steam_api" if any(
                regions[cc]["discount_expiration"] for cc in REGIONS) else "steam_store_page",
            "regions": regions,
        },
        "cheapshark": cs,
        "authority": {
            "steamdb_url": STEAMDB_URL,
            "itad_url": ITAD_URL,
        },
    }
    validate(snapshot)
    return snapshot


def validate(snap):
    """Fail closed: required fields present and internally consistent."""
    assert snap["data_date"] == date.fromisoformat(snap["data_date"]).isoformat(), "data_date invalid"
    for cc, r in snap["steam"]["regions"].items():
        assert cc in REGIONS, f"unexpected region {cc}"
        assert isinstance(r["initial_cents"], int) and isinstance(r["final_cents"], int), f"cents not int ({cc})"
        if r["discount_percent"]:
            expect = round(100 * (1 - r["final_cents"] / r["initial_cents"]))
            if abs(expect - r["discount_percent"]) > 1:
                raise AssertionError(f"discount inconsistency {cc}: {r['discount_percent']}% vs {expect}%")
    cs = snap["cheapshark"]
    assert cs["cheapest_price_ever_usd"] is not None, "missing CheapShark historical low"
    assert cs["cheapest_price_ever_date"], "missing CheapShark historical low date"
    assert snap["authority"]["steamdb_url"] and snap["authority"]["itad_url"], "missing authority links"


def main():
    print(f"fetching price snapshot for {NAME} (appid {APPID}) …")
    snap = build_snapshot()
    tmp = OUT.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(snap, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(OUT)
    print(f"wrote {OUT}")
    print(f"  data_date={snap['data_date']}  fetched_at={snap['fetched_at']}")
    us = snap["steam"]["regions"]["us"]
    print(f"  steam us: {us['initial_formatted']} -> {us['final_formatted']} "
          f"(-{us['discount_percent']}%, deadline {snap['steam']['discount_deadline']})")
    print(f"  cheapshark: cheapest ever US${snap['cheapshark']['cheapest_price_ever_usd']} "
          f"({snap['cheapshark']['cheapest_price_ever_date']}); cheapest now "
          f"US${snap['cheapshark']['cheapest_now_usd']} ({snap['cheapshark']['cheapest_now_store']})")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        print("no snapshot written — previous data/prices.json (if any) is untouched", file=sys.stderr)
        sys.exit(1)
