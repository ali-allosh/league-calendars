# -*- coding: utf-8 -*-
"""
365scores client (secondary data source, https://www.365scores.com).

Verified endpoints (no key required):
  GET /web/standings/?appTypeId=5&langId={L}&…&competitions={C}
      -> league table incl. team names.  langId=27 is Arabic.
  GET /web/games/?…&competitions={C}          -> current round window
  GET /web/games/fixtures/?…&competitions={C} -> upcoming window
  GET /web/games/results/?…&competitions={C}  -> recent results window

Used for: Arabic team names, and as a live fixtures fallback whenever
FotMob cannot be reached for a league.
"""
import re

from httpx import get_json

BASE = "https://webws.365scores.com/web"
ARABIC_LANG = 27
ENGLISH_LANG = 1
SAUDI_COUNTRY = 122    # userCountryId → Middle-East broadcast-rights view
                      # (e.g. Saudi Pro League → ثمانية, EPL → beIN SPORTS)


def _common(lang=ENGLISH_LANG):
    return (f"appTypeId=5&langId={lang}&timezoneName=Etc/UTC&userCountryId=21")


def _common_country(lang=ARABIC_LANG, country=SAUDI_COUNTRY):
    return (f"appTypeId=5&langId={lang}&timezoneName=Etc/UTC&userCountryId={country}")


def standings(competition_id, lang=ARABIC_LANG):
    """{competitor_id: name} for the requested language."""
    d = get_json(f"{BASE}/standings/?{_common(lang)}&competitions={competition_id}",
                 retries=3)
    out = {}
    for st in d.get("standings") or []:
        for row in st.get("rows") or []:
            c = row.get("competitor") or {}
            if c.get("id") and c.get("name"):
                out[str(c["id"])] = c["name"]
    return out


def _games(competition_id, mode, lang):
    d = get_json(f"{BASE}/games/{mode}/?{_common(lang)}&competitions={competition_id}",
                 retries=3)
    return d.get("games") or []


def team_names(competition_id):
    """
    ({competitor_id: en_name}, {competitor_id: ar_name}) for a competition.
    Uses the standings table when there is one (leagues); knockout cups have
    no table, so their names are harvested from the games window instead
    (home/away competitors, matched by id across the two languages).
    """
    en, ar = {}, {}
    try:
        en = standings(competition_id, lang=ENGLISH_LANG)
        ar = standings(competition_id, lang=ARABIC_LANG)
    except Exception:
        en, ar = {}, {}
    if en:
        return en, ar
    for lang, out in ((ENGLISH_LANG, en), (ARABIC_LANG, ar)):
        try:
            for g in games(competition_id, lang=lang):
                for side in ("home", "away"):
                    cid = g.get(side)
                    nm = g.get(side + "Name")
                    if cid and nm:
                        out.setdefault(cid, nm)
        except Exception:
            pass
    return en, ar


def games(competition_id, lang=ENGLISH_LANG):
    """Near-window games (fixtures + results) for a competition."""
    out = []
    seen = set()
    for mode in ("", "fixtures", "results"):
        for g in _games(competition_id, mode, lang):
            if g.get("id") in seen:
                continue
            seen.add(g.get("id"))
            out.append(_norm_game(g))
    return out


def _norm_game(g):
    home = g.get("homeCompetitor") or {}
    away = g.get("awayCompetitor") or {}
    return {
        "id": str(g.get("id") or ""),
        "round": str(g.get("roundNum") or ""),
        "utc": (g.get("startTime") or "").replace("+00:00", "Z") or None,
        "home": str(home.get("id") or ""),
        "homeName": home.get("name") or "",
        "away": str(away.get("id") or ""),
        "awayName": away.get("name") or "",
        "statusGroup": g.get("statusGroup"),   # 2 upcoming, 3 ended
        "statusText": g.get("statusText") or "",
    }


# ---------------------------------------------------------------------------
# TV broadcasters (MENA rights view via userCountryId=122 — Arabic channel
# names like "ثمانية 1" / "beIN SPORTS HD 1", far better for Arab users
# than FotMob's country-mixed lists).
# ---------------------------------------------------------------------------

def tv_games(competition_id):
    """
    Current-window games for a competition, MENA view, Arabic names.
    [{id, utc, home, away, hasTV}]
    """
    out, seen = [], set()
    for mode in ("", "fixtures", "results"):
        try:
            d = get_json(f"{BASE}/games/{mode}/"
                         f"?{_common_country()}&competitions={competition_id}",
                         retries=2)
        except Exception:
            continue
        for g in d.get("games") or []:
            gid = g.get("id")
            if gid in seen:
                continue
            seen.add(gid)
            h = g.get("homeCompetitor") or {}
            a = g.get("awayCompetitor") or {}
            out.append({
                "id": str(gid),
                "utc": (g.get("startTime") or "").replace("+00:00", "Z"),
                "home": h.get("name") or "",
                "away": a.get("name") or "",
                "hasTV": bool(g.get("hasTVNetworks")),
            })
    return out


def game_tv(game_id):
    """
    ([arabic channel names], [english channel names]) for one game.
    Two requests (AR + EN) — both cheap and cached by the caller.
    """
    ar, en = [], []
    for lang, out in ((ARABIC_LANG, ar), (ENGLISH_LANG, en)):
        d = get_json(f"{BASE}/game/?{_common_country(lang)}&gameId={game_id}",
                     retries=2)
        for n in ((d.get("game") or {}).get("tvNetworks")) or []:
            if n.get("name"):
                out.append(n["name"])
    return ar, en


AR = re.compile(r"[\u0600-\u06FF]")


def looks_arabic(s):
    return bool(AR.search(s or ""))
