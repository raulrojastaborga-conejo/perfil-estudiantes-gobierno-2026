#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import html
import math
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse, parse_qs, unquote
from urllib.request import Request, urlopen

BASE = Path(__file__).resolve().parents[1]
CONFIG = BASE / "data" / "busquedas-ia.json"
PRODUCTS = BASE / "data" / "productos.json"
STATUS = BASE / "data" / "actualizacion-ia.json"

ALLOWED_DOMAINS = ["mercadolibre.cl", "falabella.com", "ripley.cl", "paris.cl", "dbs.cl", "maicao.cl", "preunic.cl"]
BAD_PATH_PARTS = ["/shop/", "/category/", "/categor", "/listado", "/ofertas", "/search", "/tienda", "/cart", "/login", "/ayuda", "/help", "/seller", "/brand", "/browse"]


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def get(url: str, accept: str = "text/html") -> str | None:
    req = Request(url, headers={"User-Agent": "Mozilla/5.0 DatoBBBSearch/1.1", "Accept": accept, "Accept-Language": "es-CL,es;q=0.9"})
    try:
        with urlopen(req, timeout=25) as r:
            return r.read().decode("utf-8", errors="replace")
    except (HTTPError, URLError, TimeoutError) as e:
        print(f"AVISO: no pude leer {url}: {e}")
        return None


def clean(s: str) -> str:
    s = html.unescape(s or "")
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def is_product_url(url: str) -> bool:
    if not url.startswith("http"):
        return False
    parsed = urlparse(url)
    host = parsed.netloc.lower().replace("www.", "")
    path = parsed.path.lower().rstrip("/") or "/"
    if not any(d in host for d in ALLOWED_DOMAINS):
        return False
    if path == "/" or any(x in path for x in BAD_PATH_PARTS):
        return False
    if "mercadolibre.cl" in host:
        return "mlc" in path or "articulo" in host
    if "falabella.com" in host:
        return "/product/" in path or "/producto/" in path
    if "ripley.cl" in host:
        return "/producto/" in path or "/p/" in path
    if "paris.cl" in host:
        return "/producto" in path or "/p/" in path
    if any(d in host for d in ["dbs.cl", "maicao.cl", "preunic.cl"]):
        return len(path.split("/")) >= 3 and not path.endswith("/productos")
    return False


def normalize_url(url: str) -> str:
    url = html.unescape(url).strip()
    if "url=" in url and "google" in url:
        qs = parse_qs(urlparse(url).query)
        if qs.get("url"):
            url = qs["url"][0]
    url = unquote(url).split("#", 1)[0]
    return url


def search_brave(query: str) -> list[str]:
    key = os.getenv("BRAVE_SEARCH_API_KEY")
    if not key:
        return []
    url = "https://api.search.brave.com/res/v1/web/search?" + urlencode({"q": query, "country": "CL", "search_lang": "es", "count": 15})
    req = Request(url, headers={"Accept": "application/json", "X-Subscription-Token": key})
    try:
        with urlopen(req, timeout=25) as r:
            data = json.loads(r.read().decode("utf-8"))
    except Exception as e:
        print(f"AVISO Brave: {e}")
        return []
    return [normalize_url(x.get("url", "")) for x in data.get("web", {}).get("results", [])]


def search_tavily(query: str) -> list[str]:
    key = os.getenv("TAVILY_API_KEY")
    if not key:
        return []
    body = json.dumps({"api_key": key, "query": query, "search_depth": "basic", "max_results": 15, "include_answer": False}).encode("utf-8")
    req = Request("https://api.tavily.com/search", data=body, headers={"Content-Type": "application/json"})
    try:
        with urlopen(req, timeout=25) as r:
            data = json.loads(r.read().decode("utf-8"))
    except Exception as e:
        print(f"AVISO Tavily: {e}")
        return []
    return [normalize_url(x.get("url", "")) for x in data.get("results", [])]


def search_duckduckgo_lite(query: str) -> list[str]:
    page = get("https://lite.duckduckgo.com/lite/?" + urlencode({"q": query}))
    if not page:
        return []
    found = []
    for href in re.findall(r'href="([^"]+)"', page):
        href = normalize_url(href)
        if href.startswith("//"):
            href = "https:" + href
        if "uddg=" in href:
            qs = parse_qs(urlparse(href).query)
            if qs.get("uddg"):
                href = normalize_url(qs["uddg"][0])
        found.append(href)
    return found


def search_web(query: str) -> list[str]:
    variants = [
        query + " precio oferta Chile producto",
        query + " site:articulo.mercadolibre.cl OR site:falabella.com/falabella-cl/product OR site:ripley.cl/producto OR site:paris.cl/producto",
        query + " site:dbs.cl OR site:maicao.cl OR site:preunic.cl producto precio",
    ]
    urls = []
    for full_query in variants:
        for provider in [search_brave, search_tavily, search_duckduckgo_lite]:
            for url in provider(full_query):
                if is_product_url(url) and url not in urls:
                    urls.append(url)
    return urls[:16]


def meta(page: str, prop: str) -> str:
    patterns = [rf'<meta[^>]+property=["\']{re.escape(prop)}["\'][^>]+content=["\']([^"\']+)', rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']{re.escape(prop)}["\']', rf'<meta[^>]+name=["\']{re.escape(prop)}["\'][^>]+content=["\']([^"\']+)']
    for p in patterns:
        m = re.search(p, page, flags=re.I | re.S)
        if m:
            return clean(m.group(1))
    return ""


def extract_price(page: str) -> int:
    candidates = []
    patterns = [r'product:price:amount["\'][^>]+content=["\']([0-9\.]+)', r'"price"\s*:\s*"?([0-9\.]{4,})', r'\$\s*([0-9\.]{4,})']
    for pat in patterns:
        for m in re.findall(pat, page, flags=re.I | re.S):
            n = int(re.sub(r"\D", "", str(m)) or 0)
            if 1000 <= n <= 300000:
                candidates.append(n)
    return min(candidates) if candidates else 0


def score(price: int, category: str, title: str) -> dict[str, int]:
    limits = {"ropa": [8000, 15000, 25000], "make-up": [5000, 9000, 15000], "capilar": [5000, 9000, 14000], "zapatos": [12000, 20000, 35000]}.get(category, [8000, 15000, 25000])
    barato = 5 if price <= limits[0] else 4 if price <= limits[1] else 3 if price <= limits[2] else 2
    tl = title.lower()
    bueno = 4 if any(x in tl for x in ["maybelline", "loreal", "garnier", "dove", "nike", "adidas", "bata", "skechers"]) else 3
    bonito = 4 if any(x in tl for x in ["elegante", "blazer", "negro", "nude", "rosa", "oficina", "glow", "moderno", "zapato", "zapatilla"]) else 3
    return {"bueno": bueno, "bonito": bonito, "barato": barato}


def product_from_url(url: str, category: str, subcategory: str) -> dict[str, Any] | None:
    if not is_product_url(url):
        return None
    page = get(url)
    if not page:
        return None
    title = meta(page, "og:title") or meta(page, "twitter:title")
    image = meta(page, "og:image") or meta(page, "twitter:image")
    price = extract_price(page)
    if not title or not price:
        return None
    r = score(price, category, title)
    bbb = round(r["bueno"] * 0.4 + r["barato"] * 0.4 + r["bonito"] * 0.2, 1)
    return {"id": "ia-" + str(abs(hash(url))), "name": title[:160], "category": category, "subcategory": subcategory, "store": urlparse(url).netloc.replace("www.", ""), "price": price, "old_price": None, "discount": 0, "image": image, "url": url, "updated_at": date.today().isoformat(), "ratings": r, "bbb": bbb, "source_method": "busqueda_ia_web"}


def load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default
    except Exception:
        return default


def main() -> None:
    config = load_json(CONFIG, [])
    existing = load_json(PRODUCTS, [])
    existing_valid = [p for p in existing if is_product_url(str(p.get("url", ""))) and not str(p.get("id", "")).startswith("demo-")]
    collected = []
    status = {"updated_at": now(), "queries": len(config), "urls_found": 0, "products_found": 0, "existing_before": len(existing), "existing_valid": len(existing_valid), "notes": []}
    for item in config:
        urls = search_web(item["query"])
        status["urls_found"] += len(urls)
        for url in urls:
            p = product_from_url(url, item["category"], item["subcategory"])
            if p:
                collected.append(p)
    by_url = {p.get("url"): p for p in existing_valid if p.get("url")}
    for p in collected:
        by_url[p["url"]] = p
    final = list(by_url.values())
    final.sort(key=lambda p: (-(float(p.get("bbb") or 0)), int(p.get("price") or 999999999)))
    PRODUCTS.write_text(json.dumps(final[:150], ensure_ascii=False, indent=2), encoding="utf-8")
    status["products_found"] = len(collected)
    status["final"] = len(final[:150])
    status["notes"].append("Filtro endurecido: se eliminan categorias/shop y demos; solo URLs de producto probable")
    STATUS.write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(status, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
