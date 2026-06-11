#!/usr/bin/env python3
"""
Diagnóstico inicial para alineaciones, lesiones y sanciones del Centro Mundial 2026.

Este script NO publica alineaciones oficiales ni lesiones automáticamente.
Su objetivo es validar infraestructura, leer fuentes configuradas y generar un reporte
que permita activar fuentes de forma controlada más adelante.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from urllib import request, robotparser
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "centro-mundial-2026" / "data"
SOURCES_FILE = DATA / "scraping_sources.json"
DIAG_FILE = DATA / "lineups_availability_diagnostic.json"
LINEUPS_FILE = DATA / "lineups.json"
AVAILABILITY_FILE = DATA / "player_availability.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def load_json(path: Path, fallback):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def can_fetch(url: str, user_agent: str = "CentroMundial2026Bot") -> dict:
    if not url:
        return {"ok": False, "reason": "sin_url"}
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    rp = robotparser.RobotFileParser()
    try:
        rp.set_url(robots_url)
        rp.read()
        return {"ok": bool(rp.can_fetch(user_agent, url)), "robots_url": robots_url}
    except Exception as exc:
        return {"ok": None, "robots_url": robots_url, "reason": f"robots_no_verificado: {exc}"}


def quick_probe(url: str) -> dict:
    if not url:
        return {"ok": False, "reason": "sin_url"}
    try:
        req = request.Request(url, headers={"User-Agent": "CentroMundial2026Bot/0.1"})
        with request.urlopen(req, timeout=20) as resp:
            sample = resp.read(500).decode("utf-8", errors="replace")
            return {"ok": True, "status": resp.status, "sample": sample[:300]}
    except Exception as exc:
        return {"ok": False, "reason": str(exc)}


def ensure_base_files() -> None:
    if not LINEUPS_FILE.exists():
        LINEUPS_FILE.write_text(json.dumps({
            "updated_at": None,
            "mode": "initial_manual_structure",
            "note": "Base para alineaciones por partido.",
            "matches": []
        }, ensure_ascii=False, indent=2), encoding="utf-8")
    if not AVAILABILITY_FILE.exists():
        AVAILABILITY_FILE.write_text(json.dumps({
            "updated_at": None,
            "mode": "initial_manual_structure",
            "note": "Base para disponibilidad de jugadores.",
            "items": []
        }, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    ensure_base_files()
    sources_payload = load_json(SOURCES_FILE, {"sources": []})
    diagnostics = []
    for source in sources_payload.get("sources", []):
        item = {
            "name": source.get("name"),
            "type": source.get("type"),
            "enabled": source.get("enabled", False),
            "url": source.get("url", ""),
            "robots": None,
            "probe": None,
            "publish_mode": "diagnostic_only"
        }
        if source.get("enabled") and source.get("url"):
            item["robots"] = can_fetch(source["url"])
            if item["robots"].get("ok") is not False:
                item["probe"] = quick_probe(source["url"])
        diagnostics.append(item)

    out = {
        "updated_at": now_iso(),
        "mode": "diagnostic_only",
        "summary": {
            "sources_total": len(sources_payload.get("sources", [])),
            "sources_enabled": sum(1 for s in sources_payload.get("sources", []) if s.get("enabled")),
            "lineups_items": len(load_json(LINEUPS_FILE, {"matches": []}).get("matches", [])),
            "availability_items": len(load_json(AVAILABILITY_FILE, {"items": []}).get("items", []))
        },
        "diagnostics": diagnostics,
        "next_steps": [
            "Agregar fuentes específicas permitidas para alineaciones o disponibilidad.",
            "Mantener publicación automática desactivada hasta validar calidad de fuente.",
            "Publicar como oficial solo con FIFA, federación, reporte oficial o API confiable."
        ]
    }
    DIAG_FILE.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(out["summary"], ensure_ascii=False))


if __name__ == "__main__":
    main()
