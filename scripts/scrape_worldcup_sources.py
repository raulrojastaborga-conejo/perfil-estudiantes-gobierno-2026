import json
import pathlib
import re
import urllib.request
import urllib.robotparser
from datetime import datetime, timezone
from html.parser import HTMLParser

ROOT = pathlib.Path(".")
DATA = ROOT / "centro-mundial-2026" / "data"
SOURCES = DATA / "sources.json"
OUT = DATA / "scrape_diagnostic.json"

class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip = False
    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "noscript"}:
            self.skip = True
    def handle_endtag(self, tag):
        if tag in {"script", "style", "noscript"}:
            self.skip = False
    def handle_data(self, data):
        if not self.skip:
            text = data.strip()
            if text:
                self.parts.append(text)
    def text(self):
        return "\n".join(self.parts)

def now():
    return datetime.now(timezone.utc).isoformat()

def can_fetch(url):
    try:
        from urllib.parse import urlparse
        p = urlparse(url)
        robots_url = f"{p.scheme}://{p.netloc}/robots.txt"
        rp = urllib.robotparser.RobotFileParser()
        rp.set_url(robots_url)
        rp.read()
        return rp.can_fetch("CentroMundialBot/0.1", url)
    except Exception:
        return None

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "CentroMundialBot/0.1 contacto: proyecto personal educativo"})
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read().decode("utf-8", errors="replace")
        return raw

def summarize_text(text):
    lines = [x.strip() for x in text.splitlines() if x.strip()]
    joined = "\n".join(lines)
    keywords = ["Chile", "fixture", "group", "Group", "squads", "plantillas", "horario", "schedule", "injury", "lesion"]
    hits = []
    for k in keywords:
        c = joined.lower().count(k.lower())
        if c:
            hits.append({"keyword": k, "count": c})
    dates = sorted(set(re.findall(r"2026[-–/]\d{1,2}[-–/]\d{1,2}|\d{1,2}\s+de\s+[A-Za-zÁÉÍÓÚáéíóúñÑ]+\s+de\s+2026|\d{1,2}\s+[A-Za-z]+\s+2026", joined)))[:40]
    return {"line_count": len(lines), "keywords": hits, "sample_dates": dates, "sample_text": "\n".join(lines[:40])[:3000]}

def main():
    sources = json.loads(SOURCES.read_text(encoding="utf-8"))
    results = {"updated_at": now(), "mode": "diagnostic_only", "sources": []}
    for s in sources:
        if not s.get("enabled", True):
            continue
        item = {"id": s["id"], "name": s["name"], "url": s["url"], "type": s.get("type"), "robots_allowed": can_fetch(s["url"])}
        try:
            html = fetch(s["url"])
            parser = TextExtractor()
            parser.feed(html)
            item["ok"] = True
            item["summary"] = summarize_text(parser.text())
        except Exception as e:
            item["ok"] = False
            item["error"] = str(e)
        results["sources"].append(item)
    OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")

if __name__ == "__main__":
    main()
