import json
import pathlib
import re
import urllib.request
from datetime import datetime, timezone, date, time
from zoneinfo import ZoneInfo

DATA = pathlib.Path("centro-mundial-2026/data")
SOURCE_URL = "https://raw.githubusercontent.com/openfootball/worldcup/master/README.md"

MONTHS = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}


def now():
    return datetime.now(timezone.utc).isoformat()


def fetch_text(url):
    req = urllib.request.Request(url, headers={"User-Agent": "CentroMundialBot/0.1"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")


def write_json(name, data):
    DATA.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated_at": now(),
        "source": "OpenFootball worldcup README",
        "source_url": SOURCE_URL,
        "data": data,
    }
    (DATA / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def parse_date_line(line):
    m = re.match(r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Za-z]+)\s+(\d{1,2})$", line.strip())
    if not m:
        return None
    month = MONTHS.get(m.group(2).lower())
    if not month:
        return None
    return date(2026, month, int(m.group(3)))


def parse_time_zone(value):
    m = re.match(r"^(\d{1,2}):(\d{2})\s+UTC([+-]\d+)$", value.strip())
    if not m:
        return None
    hour = int(m.group(1))
    minute = int(m.group(2))
    offset = int(m.group(3))
    return hour, minute, offset


def to_chile_datetime(match_date, hour, minute, offset):
    source_tz = timezone.utc if offset == 0 else timezone.utc
    # Local time with UTC offset converted manually to UTC, then to America/Santiago.
    utc_dt = datetime(match_date.year, match_date.month, match_date.day, hour - offset, minute, tzinfo=timezone.utc)
    cl = utc_dt.astimezone(ZoneInfo("America/Santiago"))
    return cl.isoformat(), cl.strftime("%d-%m-%Y %H:%M")


def parse_fixture_block(text):
    groups = []
    matches = []
    in_block = False
    current_group = None
    current_date = None
    match_no = 1

    for raw in text.splitlines():
        line = raw.strip()
        if line.startswith("= World Cup 2026"):
            in_block = True
            continue
        if in_block and line.startswith("= World Cup 2022"):
            break
        if not in_block or not line:
            continue

        gm = re.match(r"^Group\s+([A-L])\s*\|\s*(.+)$", line)
        if gm:
            teams = [x.strip() for x in re.split(r"\s{2,}|\t+", gm.group(2)) if x.strip()]
            groups.append({"group": gm.group(1), "teams": teams})
            continue

        sm = re.match(r"^▪\s+Group\s+([A-L])$", line)
        if sm:
            current_group = sm.group(1)
            continue

        stage_m = re.match(r"^▪\s+(.+)$", line)
        if stage_m:
            current_group = None
            current_stage = stage_m.group(1)
            continue

        d = parse_date_line(line)
        if d:
            current_date = d
            continue

        mm = re.match(r"^(\d{1,2}:\d{2}\s+UTC[+-]\d+)\s+(.+?)\s+v\s+(.+?)\s+@\s+(.+)$", line)
        if mm and current_date:
            parsed = parse_time_zone(mm.group(1))
            if parsed:
                h, mi, offset = parsed
                iso_cl, label_cl = to_chile_datetime(current_date, h, mi, offset)
            else:
                iso_cl, label_cl = None, "Por validar"
            home = re.sub(r"\s+", " ", mm.group(2).strip())
            away = re.sub(r"\s+", " ", mm.group(3).strip())
            venue = re.sub(r"\s+", " ", mm.group(4).strip())
            matches.append({
                "id": f"OF{match_no:03d}",
                "source_id": f"openfootball_{match_no:03d}",
                "group": current_group,
                "stage": "Group" if current_group else "Knockout",
                "date": current_date.isoformat(),
                "time_source": mm.group(1),
                "datetime_cl": iso_cl,
                "time_cl": label_cl,
                "home": home,
                "away": away,
                "venue": venue,
                "channel": "Chilevisión / señal por confirmar",
                "score_home": None,
                "score_away": None,
                "status": "scheduled"
            })
            match_no += 1
    return groups, matches


def main():
    text = fetch_text(SOURCE_URL)
    groups, matches = parse_fixture_block(text)
    write_json("openfootball_teams.json", {"groups": groups, "count_groups": len(groups)})
    write_json("openfootball_matches.json", {"matches": matches, "count_matches": len(matches)})


if __name__ == "__main__":
    main()
