import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen, Request

BASE = Path(__file__).resolve().parents[1]
DATA_DIR = BASE / "centro-mundial-2026" / "data"
OUT = DATA_DIR / "market_odds.json"
DIAG = DATA_DIR / "market_odds_diagnostic.json"
API_KEY = os.environ.get("THE_ODDS_API_KEY", "").strip()
SPORT_KEY = os.environ.get("THE_ODDS_SPORT_KEY", "soccer_fifa_world_cup")
REGIONS = os.environ.get("THE_ODDS_REGIONS", "us,eu,uk")
MARKETS = os.environ.get("THE_ODDS_MARKETS", "h2h")
ODDS_FORMAT = os.environ.get("THE_ODDS_FORMAT", "decimal")


def now():
    return datetime.now(timezone.utc).isoformat()


def write_json(path, payload):
    txt = json.dumps(payload, ensure_ascii=False, indent=2)
    if not txt.strip():
        raise RuntimeError(f"Refusing to write empty JSON to {path}")
    path.write_text(txt + "\n", encoding="utf-8")


def placeholder(reason):
    return {"updated_at": now(), "mode": "placeholder", "source": "The Odds API", "sport_key": SPORT_KEY, "note": "Cuotas informativas. No constituyen recomendación de apuesta.", "warning": reason, "matches": []}


def diagnostic(ok, message, status_code=None, events=0, headers=None, compact_events=0):
    return {"checked_at": now(), "ok": ok, "message": message, "status_code": status_code, "sport_key": SPORT_KEY, "regions": REGIONS, "markets": MARKETS, "odds_format": ODDS_FORMAT, "has_api_key": bool(API_KEY), "events_received": events, "compact_events": compact_events, "headers": headers or {}}


def fetch_json(url):
    req = Request(url, headers={"User-Agent": "centro-mundial-2026/1.0"})
    with urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8")), r.status, dict(r.headers)


def imp(price):
    try:
        p = float(price)
        return 1 / p if p > 0 else None
    except Exception:
        return None


def compact_event(item):
    outcomes = {}
    bookmakers_used = []
    latest = None
    for b in item.get("bookmakers", []):
        title = b.get("title") or b.get("key")
        for m in b.get("markets", []):
            if m.get("key") != "h2h":
                continue
            latest = max([x for x in [latest, m.get("last_update"), b.get("last_update")] if x], default=latest)
            seen = False
            for o in m.get("outcomes", []):
                name = o.get("name")
                price = o.get("price")
                if name is None or price is None:
                    continue
                outcomes.setdefault(name, []).append(float(price))
                seen = True
            if seen and title not in bookmakers_used:
                bookmakers_used.append(title)
    summary = []
    for name, prices in outcomes.items():
        avg_price = sum(prices) / len(prices)
        best_price = max(prices)
        summary.append({"name": name, "avg_price": round(avg_price, 3), "best_price": round(best_price, 3), "bookmakers": len(prices), "raw_probability": imp(avg_price)})
    total = sum(x["raw_probability"] for x in summary if x["raw_probability"] is not None)
    for x in summary:
        x["raw_probability"] = round(x["raw_probability"] * 100, 1) if x["raw_probability"] is not None else None
        x["normalized_probability"] = round((x["raw_probability"] / 100) / total * 100, 1) if total and x["raw_probability"] is not None else None
    return {"api_id": item.get("id"), "commence_time": item.get("commence_time"), "home_team": item.get("home_team"), "away_team": item.get("away_team"), "bookmakers_count": len(bookmakers_used), "bookmakers_sample": bookmakers_used[:8], "last_update": latest, "outcomes": sorted(summary, key=lambda x: 0 if x["name"] == item.get("home_team") else 1 if x["name"] == "Draw" else 2)}


def main():
    if not API_KEY:
        msg = "Falta secreto THE_ODDS_API_KEY."
        write_json(OUT, placeholder(msg)); write_json(DIAG, diagnostic(False, msg)); print(msg); return 0
    url = f"https://api.the-odds-api.com/v4/sports/{SPORT_KEY}/odds/?" + urlencode({"apiKey": API_KEY, "regions": REGIONS, "markets": MARKETS, "oddsFormat": ODDS_FORMAT, "dateFormat": "iso"})
    try:
        data, status, headers = fetch_json(url)
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:500]
        msg = f"HTTP {e.code}: {body}"
        write_json(OUT, placeholder(msg)); write_json(DIAG, diagnostic(False, msg, e.code)); print(msg); return 0
    except (URLError, TimeoutError, json.JSONDecodeError, Exception) as e:
        msg = f"Error consultando The Odds API: {type(e).__name__}: {e}"
        write_json(OUT, placeholder(msg)); write_json(DIAG, diagnostic(False, msg)); print(msg); return 0
    if not isinstance(data, list):
        msg = f"Respuesta inesperada de The Odds API: {type(data).__name__}"
        write_json(OUT, placeholder(msg)); write_json(DIAG, diagnostic(False, msg, status, 0, headers)); print(msg); return 0
    matches = [compact_event(x) for x in data]
    out = {"updated_at": now(), "mode": "api_compact", "source": "The Odds API", "sport_key": SPORT_KEY, "regions": REGIONS, "markets": MARKETS, "odds_format": ODDS_FORMAT, "note": "Cuotas informativas. No constituyen recomendación de apuesta. Probabilidades normalizadas calculadas desde cuotas promedio decimales.", "matches": matches}
    write_json(OUT, out)
    write_json(DIAG, diagnostic(True, "Consulta completada y compactada.", status, len(data), headers, len(matches)))
    print(f"Wrote compact odds for {len(matches)} matches")
    return 0


if __name__ == "__main__":
    sys.exit(main())
