import json
import os
import pathlib
import urllib.parse
import urllib.request
from datetime import datetime, timezone

BASE_URL = "https://v3.football.api-sports.io"
OUT_DIR = pathlib.Path("centro-mundial-2026/data")
KEY = os.environ.get("API_FOOTBALL_KEY")
LEAGUE_ID = 1
SEASON = 2026


def api_get(path, params=None):
    if not KEY:
        raise RuntimeError("Falta API_FOOTBALL_KEY")
    query = ""
    if params:
        query = "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(
        BASE_URL + path + query,
        headers={"x-apisports-key": KEY}
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def write_json(name, data, source="API-Football / API-Sports"):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "data": data,
    }
    (OUT_DIR / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def add_status(status, name, fn):
    try:
        data = fn()
        write_json(name, data)
        status["files"].append(name)
        return data
    except Exception as e:
        status["warnings"].append({"file": name, "error": str(e)})
        return None


def main():
    status = {
        "ok": False,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "provider": "API-Football / API-Sports",
        "league_id": LEAGUE_ID,
        "season": SEASON,
        "message": "Actualización iniciada",
        "files": [],
        "warnings": []
    }

    leagues = add_status(status, "api_leagues_worldcup.json", lambda: api_get("/leagues", {"search": "World Cup"}))
    fixtures = add_status(status, "live_matches.json", lambda: api_get("/fixtures", {"league": LEAGUE_ID, "season": SEASON}))
    standings = add_status(status, "live_standings.json", lambda: api_get("/standings", {"league": LEAGUE_ID, "season": SEASON}))
    odds = add_status(status, "live_odds.json", lambda: api_get("/odds", {"league": LEAGUE_ID, "season": SEASON}))

    prediction_samples = []
    try:
        if fixtures and fixtures.get("response"):
            for item in fixtures["response"][:5]:
                fixture_id = item.get("fixture", {}).get("id")
                if fixture_id:
                    prediction_samples.append(api_get("/predictions", {"fixture": fixture_id}))
        write_json("live_predictions_sample.json", prediction_samples)
        status["files"].append("live_predictions_sample.json")
    except Exception as e:
        status["warnings"].append({"file": "live_predictions_sample.json", "error": str(e)})

    status["ok"] = len(status["files"]) > 0
    status["message"] = "Actualización finalizada. Revisar warnings si algún endpoint no respondió."
    write_json("api_status.json", status)


if __name__ == "__main__":
    main()
