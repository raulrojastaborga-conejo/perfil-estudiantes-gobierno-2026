import json
import os
import pathlib
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timezone

BASE_URL = "https://v3.football.api-sports.io"
OUT_DIR = pathlib.Path("centro-mundial-2026/data")
KEY = os.environ.get("API_FOOTBALL_KEY")
LEAGUE_ID = 1
SEASON = 2026


def now():
    return datetime.now(timezone.utc).isoformat()


def write_json(name, data, source="API-Football / API-Sports"):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {"updated_at": now(), "source": source, "data": data}
    (OUT_DIR / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def api_get(path, params=None):
    if not KEY:
        raise RuntimeError("Falta API_FOOTBALL_KEY")
    url = BASE_URL + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"x-apisports-key": KEY})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code} en {path}: {body[:500]}")


def try_endpoint(status, filename, path, params):
    try:
        data = api_get(path, params)
        write_json(filename, data)
        status["files"].append(filename)
        return data
    except Exception as e:
        status["warnings"].append({"file": filename, "endpoint": path, "error": str(e)})
        write_json(filename, {"error": str(e), "response": []})
        return None


def main():
    status = {
        "ok": False,
        "updated_at": now(),
        "provider": "API-Football / API-Sports",
        "league_id": LEAGUE_ID,
        "season": SEASON,
        "message": "Actualización iniciada",
        "files": [],
        "warnings": []
    }

    fixtures = None
    try:
        try_endpoint(status, "api_leagues_worldcup.json", "/leagues", {"search": "World Cup"})
        fixtures = try_endpoint(status, "live_matches.json", "/fixtures", {"league": LEAGUE_ID, "season": SEASON})
        try_endpoint(status, "live_standings.json", "/standings", {"league": LEAGUE_ID, "season": SEASON})
        try_endpoint(status, "live_odds.json", "/odds", {"league": LEAGUE_ID, "season": SEASON})

        samples = []
        if fixtures and fixtures.get("response"):
            for item in fixtures["response"][:3]:
                fid = item.get("fixture", {}).get("id")
                if fid:
                    try:
                        samples.append(api_get("/predictions", {"fixture": fid}))
                    except Exception as e:
                        samples.append({"fixture": fid, "error": str(e)})
        write_json("live_predictions_sample.json", samples)
        status["files"].append("live_predictions_sample.json")

        status["ok"] = True
        status["message"] = "Actualización finalizada. Puede haber warnings por endpoints no incluidos en el plan gratis."
    except Exception as e:
        status["message"] = "Error general: " + str(e)
    finally:
        write_json("api_status.json", status)


if __name__ == "__main__":
    main()
