import json
from pathlib import Path
from datetime import datetime

BASE = Path(__file__).resolve().parents[1]
SRC = BASE / "centro-mundial-2026" / "data" / "squads_by_team.json"
OUT = BASE / "centro-mundial-2026" / "data" / "squad_quality_report.json"


def main():
    data = json.loads(SRC.read_text(encoding="utf-8"))
    teams = data.get("teams", {})
    rows = []
    total_players = 0
    total_sd = 0
    total_low = 0

    for team, info in sorted(teams.items(), key=lambda x: (x[1].get("group", ""), x[0])):
        players = info.get("players", [])
        count = len(players)
        sd = [p for p in players if str(p.get("club", "")).lower() == "s/d"]
        low = [p for p in players if str(p.get("confidence", "")).lower() == "baja"]
        total_players += count
        total_sd += len(sd)
        total_low += len(low)
        priority = "alta" if count < 10 or len(sd) >= 3 or len(low) >= 2 else "media" if count < 15 or sd or low else "baja"
        rows.append({
            "team": team,
            "group": info.get("group"),
            "players": count,
            "club_sd": len(sd),
            "confidence_low": len(low),
            "squad_status": info.get("squad_status"),
            "fifa_status": info.get("fifa_status"),
            "audit_priority": priority,
            "players_with_club_sd": [p.get("name") for p in sd],
            "players_with_low_confidence": [p.get("name") for p in low]
        })

    report = {
        "generated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "source": "data/squads_by_team.json",
        "summary": {
            "teams_loaded": len(teams),
            "players_loaded": total_players,
            "teams_under_10_players": sum(1 for r in rows if r["players"] < 10),
            "teams_under_15_players": sum(1 for r in rows if r["players"] < 15),
            "players_with_club_sd": total_sd,
            "players_with_low_confidence": total_low,
            "high_priority_teams": sum(1 for r in rows if r["audit_priority"] == "alta")
        },
        "teams": rows
    }
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
