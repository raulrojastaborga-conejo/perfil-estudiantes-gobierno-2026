import json
import os
import pathlib
import urllib.request
import urllib.error
from datetime import datetime, timezone

BASE_URL = "https://v3.football.api-sports.io"
OUT_DIR = pathlib.Path("centro-mundial-2026/data")
KEY = os.environ.get("API_FOOTBALL_KEY")

# Nota: el ID de la liga/copa del Mundial puede variar según API-Football.
# Este script prueba una búsqueda por nombre y deja archivos de diagnóstico.

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


def write_json(name, data):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source": "API-Football / API-Sports",
        "data": data,
    }
    (OUT_DIR / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    status = {
        "ok": False,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "provider": "API-Football / API-Sports",
        "message": "No ejecutado todavía",
        "files": []
    }
    try:
        leagues = api_get("/leagues", {"search": "World Cup"})
        write_json("api_leagues_worldcup.json", leagues)
        status["files"].append("api_leagues_worldcup.json")

        # Dejamos preparado un archivo live_matches. Si no encontramos copa/season,
        # se conserva la respuesta de diagnóstico para elegir el league id correcto.
        status["ok"] = True
        status["message"] = "Conexión API exitosa. Revisar api_leagues_worldcup.json para confirmar league id y season."
    except Exception as e:
        status["message"] = f"Error consultando API: {e}"

    write_json("api_status.json", status)


if __name__ == "__main__":
    main()
