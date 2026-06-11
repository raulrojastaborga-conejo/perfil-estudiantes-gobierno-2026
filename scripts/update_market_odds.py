import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen, Request

BASE = Path(__file__).resolve().parents[1]
OUT = BASE / "centro-mundial-2026" / "data" / "market_odds.json"
API_KEY = os.environ.get("THE_ODDS_API_KEY", "").strip()

# The Odds API sport keys can change by availability. Keep this configurable.
SPORT_KEY = os.environ.get("THE_ODDS_SPORT_KEY", "soccer_fifa_world_cup")
REGIONS = os.environ.get("THE_ODDS_REGIONS", "us,eu,uk")
MARKETS = os.environ.get("THE_ODDS_MARKETS", "h2h")
ODDS_FORMAT = os.environ.get("THE_ODDS_FORMAT", "decimal")


def fetch_json(url):
    req = Request(url, headers={"User-Agent": "centro-mundial-2026/1.0"})
    with urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def implied_probability(price):
    try:
        p = float(price)
        if p <= 0:
            return None
        return 1 / p
    except Exception:
        return None


def normalize_h2h(outcomes):
    raw = []
    for o in outcomes:
        prob = implied_probability(o.get("price"))
        raw.append({"name": o.get("name"), "price": o.get("price"), "raw_probability": prob})
    total = sum(x["raw_probability"] for x in raw if x["raw_probability"] is not None)
    for x in raw:
        x["normalized_probability"] = round((x["raw_probability"] / total) * 100, 1) if total and x["raw_probability"] is not None else None
        if x["raw_probability"] is not None:
            x["raw_probability"] = round(x["raw_probability"] * 100, 1)
    return raw


def build_placeholder(reason):
    return {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "mode": "placeholder",
        "source": "The Odds API",
        "sport_key": SPORT_KEY,
        "note": "Cuotas informativas. No constituyen recomendación de apuesta.",
        "warning": reason,
        "matches": []
    }


def main():
    if not API_KEY:
        OUT.write_text(json.dumps(build_placeholder("Falta secreto THE_ODDS_API_KEY."), ensure_ascii=False, indent=2), encoding="utf-8")
        print("Missing THE_ODDS_API_KEY; wrote placeholder.")
        return 0

    params = urlencode({
        "apiKey": API_KEY,
        "regions": REGIONS,
        "markets": MARKETS,
        "oddsFormat": ODDS_FORMAT,
        "dateFormat": "iso"
    })
    url = f"https://api.the-odds-api.com/v4/sports/{SPORT_KEY}/odds/?{params}"

    try:
        data = fetch_json(url)
    except Exception as e:
        OUT.write_text(json.dumps(build_placeholder(f"Error consultando The Odds API: {e}"), ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"API error: {e}")
        return 0

    matches = []
    for item in data if isinstance(data, list) else []:
        bookmakers = []
        for b in item.get("bookmakers", []):
            markets = []
            for m in b.get("markets", []):
                outcomes = m.get("outcomes", [])
                markets.append({
                    "key": m.get("key"),
                    "last_update": m.get("last_update"),
                    "outcomes": normalize_h2h(outcomes) if m.get("key") == "h2h" else outcomes
                })
            bookmakers.append({
                "key": b.get("key"),
                "title": b.get("title"),
                "last_update": b.get("last_update"),
                "markets": markets
            })
        matches.append({
            "api_id": item.get("id"),
            "sport_key": item.get("sport_key"),
            "commence_time": item.get("commence_time"),
            "home_team": item.get("home_team"),
            "away_team": item.get("away_team"),
            "bookmakers": bookmakers
        })

    out = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "mode": "api",
        "source": "The Odds API",
        "sport_key": SPORT_KEY,
        "regions": REGIONS,
        "markets": MARKETS,
        "odds_format": ODDS_FORMAT,
        "note": "Cuotas informativas. No constituyen recomendación de apuesta. Probabilidades normalizadas calculadas desde cuotas decimales e incluyen aproximación al retirar margen agregado.",
        "matches": matches
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(matches)} market odds matches to {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
