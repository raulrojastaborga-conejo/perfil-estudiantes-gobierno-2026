#!/usr/bin/env python3
"""
Actualizador experimental de productos Dato BBB.

Versión inicial:
- Consulta la API pública de Mercado Libre Chile.
- Busca productos por categorías definidas.
- Calcula estrellas BBB simples.
- Escribe data/productos.json.

Para producción conviene mejorar:
- historial real de precios,
- listas blancas de marcas,
- exclusión de productos irrelevantes,
- revisión de tiendas adicionales,
- validación manual de categorías.
"""

from __future__ import annotations

import json
import math
import re
from datetime import date
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus
from urllib.request import Request, urlopen

BASE_DIR = Path(__file__).resolve().parents[1]
OUTPUT = BASE_DIR / "data" / "productos.json"

SEARCHES = [
    {"category": "ropa", "subcategory": "casual", "query": "ropa mujer casual oferta", "limit": 8},
    {"category": "ropa", "subcategory": "vestir", "query": "blazer blusa pantalon vestir mujer oferta", "limit": 8},
    {"category": "make-up", "subcategory": "maquillaje", "query": "makeup maquillaje mujer oferta", "limit": 8},
    {"category": "capilar", "subcategory": "tratamiento", "query": "mascarilla shampoo capilar oferta", "limit": 8},
    {"category": "zapatos", "subcategory": "formales", "query": "zapatos mujer oficina oferta", "limit": 8},
    {"category": "zapatos", "subcategory": "zapatillas", "query": "zapatillas mujer oferta", "limit": 8},
]

GOOD_BRANDS = [
    "maybelline", "loreal", "l'oréal", "garnier", "elvive", "revlon", "vogue", "nivea",
    "tresemme", "pantene", "dove", "head", "wella", "kerastase", "kérastase",
    "zara", "h&m", "mango", "basement", "sybilla", "alaniz", "bata", "via uno",
    "azaleia", "skechers", "nike", "adidas", "puma", "new balance"
]

BAD_WORDS = ["usado", "segunda mano", "repuesto", "mayorista", "lote", "pack x 50"]


def fetch_json(url: str) -> dict[str, Any]:
    request = Request(url, headers={"User-Agent": "DatoBBBSecretaria/0.1"})
    with urlopen(request, timeout=25) as response:
        return json.loads(response.read().decode("utf-8"))


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def clamp(value: float, min_value: int = 0, max_value: int = 5) -> int:
    return int(max(min_value, min(max_value, round(value))))


def score_barato(price: int, category: str, discount: int) -> int:
    thresholds = {
        "ropa": [8000, 15000, 25000, 40000],
        "make-up": [5000, 9000, 15000, 25000],
        "capilar": [5000, 9000, 14000, 22000],
        "zapatos": [12000, 20000, 35000, 55000],
    }
    limits = thresholds.get(category, [5000, 10000, 20000, 30000])
    if price <= limits[0]:
        base = 5
    elif price <= limits[1]:
        base = 4
    elif price <= limits[2]:
        base = 3
    elif price <= limits[3]:
        base = 2
    else:
        base = 1
    if discount >= 30:
        base += 1
    elif discount <= 5:
        base -= 0.5
    return clamp(base)


def score_bueno(title: str, sold_quantity: int, rating: float | None) -> int:
    title_lower = title.lower()
    score = 3
    if any(brand in title_lower for brand in GOOD_BRANDS):
        score += 1
    if sold_quantity >= 50:
        score += 1
    if rating and rating >= 4.3:
        score += 1
    if any(word in title_lower for word in BAD_WORDS):
        score -= 2
    return clamp(score)


def score_bonito(title: str, category: str) -> int:
    title_lower = title.lower()
    score = 3
    pretty_words = [
        "elegante", "moderno", "bonito", "glow", "set", "kit", "blazer", "vestido",
        "negro", "nude", "rosa", "cuero", "botin", "botín", "sandalia", "taco", "oficina"
    ]
    if any(word in title_lower for word in pretty_words):
        score += 1
    if category in {"make-up", "ropa", "zapatos"}:
        score += 0.5
    return clamp(score)


def normalize_item(item: dict[str, Any], category: str, subcategory: str) -> dict[str, Any] | None:
    title = clean_text(item.get("title", ""))
    if not title or any(word in title.lower() for word in BAD_WORDS):
        return None

    price = int(item.get("price") or 0)
    if price <= 0:
        return None

    original_price = item.get("original_price")
    old_price = int(original_price) if original_price else None
    discount = 0
    if old_price and old_price > price:
        discount = math.floor((old_price - price) / old_price * 100)

    rating = item.get("reviews", {}).get("rating_average")
    sold_quantity = int(item.get("sold_quantity") or 0)

    ratings = {
        "bueno": score_bueno(title, sold_quantity, rating),
        "bonito": score_bonito(title, category),
        "barato": score_barato(price, category, discount),
    }
    bbb = round(ratings["bueno"] * 0.4 + ratings["barato"] * 0.4 + ratings["bonito"] * 0.2, 1)

    return {
        "id": str(item.get("id")),
        "name": title,
        "category": category,
        "subcategory": subcategory,
        "store": "Mercado Libre",
        "price": price,
        "old_price": old_price,
        "discount": discount,
        "image": item.get("thumbnail") or "",
        "url": item.get("permalink") or "https://www.mercadolibre.cl/",
        "updated_at": date.today().isoformat(),
        "ratings": ratings,
        "bbb": bbb,
    }


def main() -> None:
    products: list[dict[str, Any]] = []
    seen: set[str] = set()

    for search in SEARCHES:
        query = quote_plus(search["query"])
        limit = int(search["limit"])
        url = f"https://api.mercadolibre.com/sites/MLC/search?q={query}&limit={limit}"
        data = fetch_json(url)
        for item in data.get("results", []):
            product = normalize_item(item, search["category"], search["subcategory"])
            if not product or product["id"] in seen:
                continue
            seen.add(product["id"])
            products.append(product)

    products.sort(key=lambda p: (-p["bbb"], p["price"]))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(products, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Actualizados {len(products)} productos en {OUTPUT}")


if __name__ == "__main__":
    main()
