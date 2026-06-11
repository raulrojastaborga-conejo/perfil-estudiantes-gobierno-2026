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
    path.parent.mkdir(parents=True, exist_ok=True)
    txt = json.dumps(payload, ensure_ascii=False, indent=2)
    if not txt.strip():
        raise RuntimeError(f"Refusing to write empty JSON to {path}")
    path.write_text(txt + "\n", encoding="utf-8")


def placeholder(reason):
    return {
        "updated_at": now(),
        "mode": "placeholder",
        "source": "The Odds API",
        "sport_key": SPORT_KEY,
        "note": "Cuotas informativas. No constituyen recomendación de apuesta.",
        "warning": reason,
        "matches": []
    }


def diagnostic(ok, message, status_code=None, events=0, headers=None):
    return {
        "checked_at": now(),
        "ok": ok,
        "message": message,
        "status_code": status_code,
        "sport_key": SPORT_KEY,
        "regions": REGIONS,
        "markets": MARKETS,
        "odds_format": ODDS_FORMAT,
        "has_api_key": bool(API_KEY),
        "events_received": events,
        "headers": headers or {}
    }


def fetch_json(url):
    req = Request(url, headers={"User-Agent": "centro-mundial-2026/1.0"})
    with urlopen(req, timeout=30) as r:
        body = r.read().decode("utf-8")
        return json.loads(body), r.status, dict(r.headers)


def implied_probability(price):
    try:
        p = float(price)
        return 1 / p if p > 0 else None
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


def main():
    if not API_KEY:
        msg = "Falta secreto THE_ODDS_API_KEY."
        write_json(OUT, placeholder(msg))
        write_json(DIAG, diagnostic(False, msg))
        print(msg)
        return 0

    params = urlencode({"apiKey": API_KEY, "regions": REGIONS, "markets": MARKETS, "oddsFormat": ODDS_FORMAT, "dateFormat": "iso"})
    url = f"https://api.the-odds-api.com/v4/sports/{SPORT_KEY}/odds/?{params}"

    try:
        data, status, headers = fetch_json(url)
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:500]
        msg = f"HTTP {e.code}: {body}"
        write_json(OUT, placeholder(msg))
        write_json(DIAG, diagnostic(False, msg, e.code))
        print(msg)
        return 0
    except (URLError, TimeoutError, json.JSONDecodeError, Exception) as e:
        msg = f"Error consultando The Odds API: {type(e).__name__}: {e}"
        write_json(OUT, placeholder(msg))
        write_json(DIAG, diagnostic(False, msg))
        print(msg)
        return 0

    if not isinstance(data, list):
        msg = f"Respuesta inesperada de The Odds API: {type(data).__name__}"
        write_json(OUT, placeholder(msg))
        write_json(DIAG, diagnostic(False, msg, status, 0, headers))
        print(msg)
        return 0

    matches = []
    for item in data:
        bookmakers = []
        for b in item.get("bookmakers", []):
            markets = []
            for m in b.get("markets", []):
                outcomes = m.get("outcomes", [])
                markets.append({"key": m.get("key"), "last_update": m.get("last_update"), "outcomes": normalize_h2h(outcomes) if m.get("key") == "h2h" else outcomes})
            bookmakers.append({"key": b.get("key"), "title": b.get("title"), "last_update": b.get("last_update"), "markets": markets})
        matches.append({"api_id": item.get("id"), "sport_key": item.get("sport_key"), "commence_time": item.get("commence_time"), "home_team": item.get("home_team"), "away_team": item.get("away_team"), "bookmakers": bookmakers})

    out = {"updated_at": now(), "mode": "api", "source": "The Odds API", "sport_key": SPORT_KEY, "regions": REGIONS, "markets": MARKETS, "odds_format": ODDS_FORMAT, "note": "Cuotas informativas. No constituyen recomendación de apuesta. Probabilidades normalizadas calculadas desde cuotas decimales.", "matches": matches}
    write_json(OUT, out)
    write_json(DIAG, diagnostic(True, "Consulta completada.", status, len(matches), headers))
    print(f"Wrote {len(matches)} market odds matches to {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
