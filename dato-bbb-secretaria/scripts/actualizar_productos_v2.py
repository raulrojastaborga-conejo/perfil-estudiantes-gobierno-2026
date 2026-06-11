#!/usr/bin/env python3
from __future__ import annotations

import html
import json
import math
import re
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, quote_plus
from urllib.request import Request, urlopen

BASE_DIR = Path(__file__).resolve().parents[1]
OUTPUT = BASE_DIR / "data" / "productos.json"
STATUS = BASE_DIR / "data" / "actualizacion.json"

SEARCHES = [
    {"category": "ropa", "subcategory": "casual", "query": "ropa mujer casual oferta", "limit": 8},
    {"category": "ropa", "subcategory": "vestir", "query": "blazer mujer oferta", "limit": 8},
    {"category": "make-up", "subcategory": "maquillaje", "query": "maquillaje mujer oferta", "limit": 8},
    {"category": "capilar", "subcategory": "tratamiento", "query": "mascarilla capilar oferta", "limit": 8},
    {"category": "zapatos", "subcategory": "formales", "query": "zapatos mujer oficina oferta", "limit": 8},
    {"category": "zapatos", "subcategory": "zapatillas", "query": "zapatillas mujer oferta", "limit": 8},
]

BAD_WORDS = ["usado", "segunda mano", "repuesto", "mayorista", "lote"]
HOME_URLS = {"https://www.mercadolibre.cl/", "https://www.mercadolibre.cl"}


def get(url: str, accept: str) -> str | None:
    req = Request(url, headers={"User-Agent": "DatoBBB/1.0", "Accept": accept})
    try:
        with urlopen(req, timeout=25) as r:
            return r.read().decode("utf-8", errors="replace")
    except (HTTPError, URLError, TimeoutError) as e:
        print(f"AVISO: no se pudo leer {url}: {e}")
        return None


def clean(s: str) -> str:
    s = html.unescape(s or "")
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def money_to_int(s: str) -> int:
    return int(re.sub(r"\D", "", s or "") or 0)


def is_offer(url: str) -> bool:
    return url.startswith("https://") and "mercadolibre.cl" in url and url not in HOME_URLS and "/listado" not in url and len(url) > 35


def pid(url: str) -> str:
    m = re.search(r"MLC[-_]?\d+", url, re.I)
    if m:
        return m.group(0).replace("_", "-").upper()
    return "url-" + str(abs(hash(url)))


def stars(price: int, category: str, title: str, discount: int = 0) -> dict[str, int]:
    limits = {
        "ropa": [8000, 15000, 25000, 40000],
        "make-up": [5000, 9000, 15000, 25000],
        "capilar": [5000, 9000, 14000, 22000],
        "zapatos": [12000, 20000, 35000, 55000],
    }.get(category, [5000, 10000, 20000, 30000])
    barato = 5 if price <= limits[0] else 4 if price <= limits[1] else 3 if price <= limits[2] else 2 if price <= limits[3] else 1
    if discount >= 30:
        barato = min(5, barato + 1)
    title_l = title.lower()
    bueno = 4 if any(x in title_l for x in ["maybelline", "loreal", "garnier", "dove", "nike", "adidas", "bata", "skechers"]) else 3
    bonito = 4 if any(x in title_l for x in ["elegante", "moderno", "blazer", "negro", "rosa", "nude", "taco", "oficina"]) else 3
    return {"bueno": bueno, "bonito": bonito, "barato": barato}


def make_product(raw: dict[str, Any], category: str, subcategory: str, method: str) -> dict[str, Any] | None:
    title = clean(raw.get("title", ""))
    url = html.unescape(raw.get("url") or raw.get("permalink") or "").split("?", 1)[0]
    price = int(raw.get("price") or 0)
    if not title or not price or not is_offer(url):
        return None
    if any(w in title.lower() for w in BAD_WORDS):
        return None
    old_price = raw.get("old_price") or raw.get("original_price")
    old_price = int(old_price) if old_price else None
    discount = math.floor((old_price - price) / old_price * 100) if old_price and old_price > price else 0
    r = stars(price, category, title, discount)
    bbb = round(r["bueno"] * 0.4 + r["barato"] * 0.4 + r["bonito"] * 0.2, 1)
    return {
        "id": raw.get("id") or pid(url),
        "name": title,
        "category": category,
        "subcategory": subcategory,
        "store": "Mercado Libre",
        "price": price,
        "old_price": old_price,
        "discount": discount,
        "image": raw.get("image") or raw.get("thumbnail") or "",
        "url": url,
        "updated_at": date.today().isoformat(),
        "ratings": r,
        "bbb": bbb,
        "source_method": method,
    }


def from_api(search: dict[str, Any]) -> list[dict[str, Any]]:
    url = f"https://api.mercadolibre.com/sites/MLC/search?q={quote_plus(search['query'])}&limit={search['limit']}"
    txt = get(url, "application/json")
    if not txt:
        return []
    try:
        data = json.loads(txt)
    except json.JSONDecodeError:
        return []
    out = []
    for item in data.get("results", []):
        raw = {
            "id": item.get("id"),
            "title": item.get("title"),
            "price": item.get("price"),
            "old_price": item.get("original_price"),
            "url": item.get("permalink"),
            "image": item.get("thumbnail"),
        }
        p = make_product(raw, search["category"], search["subcategory"], "api")
        if p:
            out.append(p)
    return out


def from_public_page(search: dict[str, Any]) -> list[dict[str, Any]]:
    url = f"https://listado.mercadolibre.cl/{quote(search['query'].replace(' ', '-'))}"
    page = get(url, "text/html")
    if not page:
        return []
    out = []
    links = re.findall(r'https://(?:www\.)?(?:articulo\.)?mercadolibre\.cl/[^"\s<>]+', page, flags=re.I)
    for link in links:
        link = html.unescape(link).split("?", 1)[0]
        if not is_offer(link) or any(p["url"] == link for p in out):
            continue
        i = page.find(link)
        block = page[max(0, i - 2000): i + 4000]
        title_m = re.search(r'<h2[^>]*>(.*?)</h2>|title="([^"]{8,160})"|"name"\s*:\s*"([^"]{8,160})"', block, re.S | re.I)
        price_m = re.search(r'andes-money-amount__fraction[^>]*>\s*([0-9\.]+)|"price"\s*:\s*([0-9]{4,})|\$\s*([0-9\.]{4,})', block, re.S | re.I)
        img_m = re.search(r'<img[^>]+src="([^"]+)"', block, re.S | re.I)
        if not title_m or not price_m:
            continue
        title = next(x for x in title_m.groups() if x)
        price = money_to_int(next(x for x in price_m.groups() if x))
        raw = {"title": title, "price": price, "url": link, "image": img_m.group(1) if img_m else ""}
        p = make_product(raw, search["category"], search["subcategory"], "public_page")
        if p:
            out.append(p)
        if len(out) >= int(search["limit"]):
            break
    return out


def load_existing() -> list[dict[str, Any]]:
    try:
        return json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else []
    except Exception:
        return []


def save_status(status: dict[str, Any]) -> None:
    STATUS.write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    existing = load_existing()
    collected = []
    status = {"updated_at": datetime.now(timezone.utc).isoformat(), "api": 0, "public_page": 0, "existing_before": len(existing), "final": len(existing), "notes": []}
    for s in SEARCHES:
        found = from_api(s)
        status["api"] += len(found)
        if not found:
            found = from_public_page(s)
            status["public_page"] += len(found)
        if not found:
            status["notes"].append(f"sin datos nuevos: {s['query']}")
        collected.extend(found)
    if not collected:
        status["notes"].append("se conserva la data anterior")
        save_status(status)
        print(json.dumps(status, ensure_ascii=False, indent=2))
        return
    by_key = {p.get("id") or p.get("url"): p for p in existing if p.get("id") or p.get("url")}
    for p in collected:
        by_key[p.get("id") or p.get("url")] = p
    final = list(by_key.values())
    final.sort(key=lambda p: (-(float(p.get("bbb") or 0)), int(p.get("price") or 999999999)))
    OUTPUT.write_text(json.dumps(final[:120], ensure_ascii=False, indent=2), encoding="utf-8")
    status["final"] = len(final[:120])
    status["notes"].append("data fusionada; no se borro informacion previa")
    save_status(status)
    print(json.dumps(status, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
