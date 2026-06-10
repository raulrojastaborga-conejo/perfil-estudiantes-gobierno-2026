import json
import os
import pathlib
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, timezone

OUT_DIR = pathlib.Path("centro-mundial-2026/data")
KEY = os.environ.get("BALLDONTLIE_API_KEY")
BASE_URL = os.environ.get("BALLDONTLIE_FIFA_BASE_URL", "https://fifa.balldontlie.io")


def now():
    return datetime.now(timezone.utc).isoformat()


def write_json(name, data):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated_at": now(),
        "source": "Balldontlie FIFA",
        "base_url": BASE_URL,
        "data": data,
    }
    (OUT_DIR / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def call(path, params=None):
    if not KEY:
        raise RuntimeError("Falta BALLDONTLIE_API_KEY")
    url = BASE_URL.rstrip("/") + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url)
    req.add_header("Authorization", KEY)
    req.add_header("X-API-KEY", KEY)
    req.add_header("Accept", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return {"ok": True, "status": r.status, "url": url, "body": json.loads(r.read().decode("utf-8"))}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        return {"ok": False, "status": e.code, "url": url, "error": body[:1000]}
    except Exception as e:
        return {"ok": False, "url": url, "error": str(e)}


def main():
    endpoints = {
        "status": "/",
        "teams": "/teams",
        "players": "/players",
        "matches": "/matches",
        "games": "/games",
        "standings": "/standings",
        "lineups": "/lineups",
        "events": "/events",
        "rosters": "/rosters"
    }
    results = {}
    for name, path in endpoints.items():
        results[name] = call(path, {"season": 2026}) if name != "status" else call(path)
    write_json("balldontlie_diagnostic.json", results)


if __name__ == "__main__":
    main()
