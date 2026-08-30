# -*- coding: utf-8 -*-
"""
FotMob client (primary data source).

Verified public endpoints (no key required):
  GET /api/data/leagues?id={leagueId}          -> full season fixtures, table, meta
  GET /api/data/matchDetails?matchId={matchId} -> stadium, referee, attendance, …
  GET /api/data/allLeagues                     -> league catalogue

Team logo:   https://images.fotmob.com/image_resources/logo/teamlogo/{id}_small.png
League logo: https://images.fotmob.com/image_resources/logo/leaguelogo/{id}.png
"""
import calendar
import json
import time

from httpx import get, get_json

BASE = "https://www.fotmob.com"
IMG = "https://images.fotmob.com/image_resources"


def league(league_id):
    """Full league payload for the current season."""
    d = get_json(f"{BASE}/api/data/leagues?id={league_id}")
    if not d or not isinstance(d, dict) or "fixtures" not in d:
        raise RuntimeError(f"FotMob returned no league data for id={league_id}")
    return d


def match_info(match_id):
    """Compact extraction of the parts we need from matchDetails."""
    d = get_json(f"{BASE}/api/data/matchDetails?matchId={match_id}")
    if not isinstance(d, dict) or d.get("error"):
        raise RuntimeError(f"FotMob returned no match data for id={match_id}")
    mf = (d.get("content") or {}).get("matchFacts") or {}
    info = mf.get("infoBox") or {}
    stadium = info.get("Stadium") or {}
    referee = info.get("Referee") or {}
    return {
        "venue": {
            "name": stadium.get("name") or "",
            "city": stadium.get("city") or "",
            "country": stadium.get("country") or "",
            "lat": stadium.get("lat"),
            "lng": stadium.get("long"),
            "cap": stadium.get("capacity"),
            "surface": stadium.get("surface") or "",
        },
        "referee": (referee.get("text") or "").strip(),
        "attendance": info.get("Attendance"),
    }


def team_logo_url(team_id):
    return f"{IMG}/logo/teamlogo/{team_id}_small.png"


def broadcast_channels(match_id, attempts=3):
    """
    Global broadcast channel list for one match, read from the public
    match page (no dedicated API endpoint exists).  Returns a compact
    list [{"n": name, "c": country}, …]; empty list when the rights are
    not published yet (typical for matches more than ~7 days away).

    FotMob occasionally serves a page whose SSR payload has an empty
    broadcastChannels array (cold cache / bot scoring), so an empty
    first answer is retried a couple of times before we accept it.
    """
    import time as _time
    for attempt in range(attempts):
        html = None
        try:
            status, body = get(f"{BASE}/match/{match_id}", accept="text/html,*/*")
            if status != 200:
                raise RuntimeError(f"HTTP {status}")
            html = body.decode("utf-8", "replace")
        except Exception:
            _time.sleep(1.2 * (attempt + 1))
            continue
        key = '"broadcastChannels":'
        i = html.find(key)
        if i < 0:
            _time.sleep(1.2 * (attempt + 1))
            continue
        s = html[i + len(key):]
        if not s.startswith("["):
            _time.sleep(1.2 * (attempt + 1))
            continue
        # balanced-bracket scan (string-aware) — the array is embedded
        # in a much larger JSON blob, so we must find its true end
        depth, end, instr, escp = 0, -1, False, False
        for j, ch in enumerate(s):
            if instr:
                if escp:
                    escp = False
                elif ch == "\\":
                    escp = True
                elif ch == '"':
                    instr = False
                continue
            if ch == '"':
                instr = True
            elif ch == "[":
                depth += 1
            elif ch == "]":
                depth -= 1
                if depth == 0:
                    end = j
                    break
        if end < 0:
            _time.sleep(1.2 * (attempt + 1))
            continue
        try:
            arr = json.loads(s[:end + 1])
        except Exception:
            _time.sleep(1.2 * (attempt + 1))
            continue
        out, seen = [], set()
        for c in arr:
            if not isinstance(c, dict):
                continue
            n = str(c.get("channelName") or "").strip()
            if not n:
                continue
            co = str(c.get("countryName") or "").strip()
            key2 = (n, co)
            if key2 in seen:
                continue
            seen.add(key2)
            out.append({"n": n, "c": co})
        if out or attempt == attempts - 1:
            return out  # real answer (or last attempt's empty)
        _time.sleep(1.2 * (attempt + 1))
    return []


def league_logo_url(league_id):
    return f"{IMG}/logo/leaguelogo/{league_id}.png"


def match_url(match_id):
    return f"{BASE}/match/{match_id}"


# --------------------------------------------------------------------------
# Normalisation helpers
# --------------------------------------------------------------------------

def norm_fixtures(d):
    """
    Flatten FotMob league payload into:
      {season, color, teams:{id:{name,short}}, matches:[…]}
    Each match: {id, round, roundName, utc, home, away,
                 finished, started, cancelled, score, reason}
    """
    det = d.get("details") or {}
    fixtures = d.get("fixtures") or {}
    allm = fixtures.get("allMatches") or []

    teams = {}

    def reg(t):
        if not t or not t.get("id"):
            return
        tid = str(t["id"])
        teams[tid] = {
            "name": t.get("name") or t.get("shortName") or tid,
            "short": t.get("shortName") or t.get("name") or tid,
        }
        return tid

    # canonical order & extra info from the standings table (when present)
    table_teams = []
    for block in (d.get("overview") or {}).get("table") or []:
        for row in ((block.get("data") or {}).get("table") or {}).get("all") or []:
            if row.get("id"):
                table_teams.append(str(row["id"]))
                reg(row)
            # standings rows carry crest urls implicitly by id

    matches = []
    for m in allm:
        st = m.get("status") or {}
        home = reg(m.get("home"))
        away = reg(m.get("away"))
        utc = st.get("utcTime")  # e.g. 2026-08-30T16:05:00Z  (may be None)
        ts = None
        if utc:
            try:
                ts = calendar.timegm(time.strptime(utc[:19], "%Y-%m-%dT%H:%M:%S")) * 1000
            except Exception:
                ts = None
        reason = (st.get("reason") or {}).get("short") or ""
        matches.append({
            "id": str(m["id"]),
            "round": str(m.get("round") or ""),
            "roundName": m.get("roundName"),
            "utc": utc,
            "ts": ts,
            "home": home,
            "away": away,
            "finished": bool(st.get("finished")),
            "started": bool(st.get("started")),
            "cancelled": bool(st.get("cancelled")),
            "awarded": bool(st.get("awarded")),
            "score": st.get("scoreStr") or "",
            "reason": reason,
            "pageUrl": m.get("pageUrl") or "",
        })

    return {
        "season": det.get("selectedSeason") or "",
        "color": det.get("leagueColor") or "",
        "name": det.get("name") or "",
        "ccode": det.get("country") or "",
        "teams": teams,
        "tableTeams": table_teams,
        "matches": matches,
    }
