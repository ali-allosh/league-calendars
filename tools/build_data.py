# -*- coding: utf-8 -*-
"""
Fetch fresh match data and rebuild the site's embedded dataset.

Pipeline (per league, FotMob primary → 365scores fallback):
  1. FotMob league fixtures (whole season, exact UTC kickoff times).
  2. FotMob matchDetails per match → stadium (name/city/geo/capacity),
     referee, attendance.  Cached in tools/data/venues.json so daily
     runs only fetch what is new.
  3. 365scores standings (Arabic) → Arabic team names (fuzzy matched,
     with a curated alias safety net in names.py).
  4. Crests/league logos → resized + base64 into tools/data/crests.json
     (cached) → assets/logos.js.
  5. Everything lands in tools/data/snapshot.json + assets/data.js.

The script is fail-soft: a league that cannot be refreshed keeps its last
good snapshot; the site never ships half-empty.
"""
import base64
import datetime as dt
import io
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import config
import fotmob
import scores365
from names import VENUE_OVERRIDES, alias_ar, best_match, city_ar, country_ar, round_labels, sim

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, config.DATA_DIR)
os.makedirs(DATA, exist_ok=True)

VENUES_CACHE = os.path.join(DATA, "venues.json")
TV_CACHE = os.path.join(DATA, "tv.json")
TV365_CACHE = os.path.join(DATA, "tv365.json")
ARNAMES_CACHE = os.path.join(DATA, "ar_names.json")
CRESTS_CACHE = os.path.join(DATA, "crests.json")
SNAPSHOT = os.path.join(DATA, "snapshot.json")


def log(*a):
    print(*a, flush=True)


def load_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def save_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


# --------------------------------------------------------------------------
# crest handling
# --------------------------------------------------------------------------
try:
    from PIL import Image

    def _logo_data_uri(png_bytes, box):
        try:
            im = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
            im.thumbnail((box, box), Image.LANCZOS)
            buf = io.BytesIO()
            im.save(buf, "PNG", optimize=True)
            return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
        except Exception:
            return None
except Exception:  # Pillow missing -> keep raw png bytes
    def _logo_data_uri(png_bytes, box):
        return "data:image/png;base64," + base64.b64encode(png_bytes).decode()


def placeholder_logo(text, color="#5B6B84"):
    letter = (text or "?").strip()[:1].upper()
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
        f'<circle cx="32" cy="32" r="30" fill="{color}22" stroke="{color}" stroke-width="2"/>'
        f'<text x="32" y="41" font-family="Segoe UI,Arial" font-size="26" font-weight="700" '
        f'fill="{color}" text-anchor="middle">{letter}</text></svg>'
    )
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode()).decode()


def build_crests(leagues_payload, teams_index):
    """teams_index: {team_id: {'en':…}}, leagues_payload: [{fotmob, slug, accent…}]"""
    crests = load_json(CRESTS_CACHE, {})
    changed = False

    jobs = []
    for lg in leagues_payload:
        key = "l" + str(lg["fotmob"])
        if not crests.get(key):
            jobs.append((key, fotmob.league_logo_url(lg["fotmob"])))
    for tid, t in teams_index.items():
        key = "t" + str(tid)
        if not crests.get(key):
            jobs.append((key, fotmob.team_logo_url(tid)))

    if jobs:
        log(f"  logos: fetching {len(jobs)} new images…")

        def dl(job):
            key, url = job
            try:
                raw = __import__("httpx").download(url, retries=3)
                return key, raw
            except Exception as e:
                return key, ("ERR", str(e))

        with ThreadPoolExecutor(max_workers=10) as ex:
            for key, res in ex.map(dl, jobs):
                if isinstance(res, tuple) and res and res[0] == "ERR":
                    log(f"    ! logo {key} failed: {res[1][:60]}")
                    continue
                box = 80 if key.startswith("l") else 48
                uri = _logo_data_uri(res, box)
                if uri:
                    crests[key] = uri
                    changed = True

    if changed:
        save_json(CRESTS_CACHE, crests)
    return crests


# --------------------------------------------------------------------------
# per-league fetch
# --------------------------------------------------------------------------

def fetch_league(cfg, venues_cache, ar_cache, workers):
    slug = cfg["slug"]
    log(f"[{slug}] FotMob league {cfg['fotmob']} …")
    data = fotmob.norm_fixtures(fotmob.league(cfg["fotmob"]))
    matches = data["matches"]
    teams = data["teams"]
    log(f"  {len(matches)} matches, {len(teams)} teams, season {data['season']}")

    # ---- match details (venue / referee / attendance), cached ----------
    todo = []
    for m in matches:
        entry = venues_cache.get(m["id"])
        need = entry is None
        if entry is not None and m["finished"] and not entry.get("fin"):
            need = True  # became finished since last fetch → grab ref/att
        if need:
            todo.append(m)
    if todo:
        log(f"  matchDetails needed for {len(todo)} matches …")
        lock_lists = []

        def work(m):
            try:
                info = fotmob.match_info(m["id"])
                return m["id"], info, None
            except Exception as e:
                return m["id"], None, str(e)

        done = 0
        with ThreadPoolExecutor(max_workers=workers) as ex:
            futs = [ex.submit(work, m) for m in todo]
            for fut in as_completed(futs):
                mid, info, err = fut.result()
                done += 1
                if done % 250 == 0:
                    log(f"    … {done}/{len(todo)}")
                if err:
                    continue
                venues_cache[mid] = {
                    "venue": info["venue"],
                    "ref": info["referee"],
                    "att": info["attendance"],
                    "fin": True if info["referee"] else None,
                }

    # attach
    home_venue = {}
    for m in matches:
        e = venues_cache.get(m["id"])
        v = (e or {}).get("venue") or {}
        if v.get("name"):
            if m["home"]:
                home_venue.setdefault(m["home"], v)
        m["venue"] = v if v.get("name") else None
        m["referee"] = (e or {}).get("ref") or ""
        m["attendance"] = (e or {}).get("att")
        m["source"] = "fotmob"

    # fill missing venues from the same home team's other matches,
    # then from the curated overrides table
    for m in matches:
        if not m["venue"] and m["home"] in home_venue:
            m["venue"] = dict(home_venue[m["home"]])
    for m in matches:
        if not m["venue"] and m["home"] in VENUE_OVERRIDES:
            m["venue"] = dict(VENUE_OVERRIDES[m["home"]])

    # ---- composite TBD pairings ---------------------------------------
    # "Cagliari/Hellas Verona" (winner TBD) is a composite when BOTH sides
    # are known clubs of this competition; a real club whose name simply
    # contains a slash (Bodø/Glimt) passes the check.
    plain_names = [t["name"] for t in teams.values() if "/" not in t["name"]]
    pair_ids = set()
    for tid, t in teams.items():
        nm = t["name"]
        if "/" not in nm:
            continue
        parts = [p.strip() for p in nm.split("/")]
        if len(parts) != 2 or not parts[0] or not parts[1]:
            pair_ids.add(tid)
            continue
        if all(any(sim(p, o) >= 0.8 for o in plain_names if o != nm) for p in parts):
            pair_ids.add(tid)

    # ---- Arabic names (365scores: standings for leagues, games for cups) --
    ar_names = {}
    try:
        s365_en, s365_ar = scores365.team_names(cfg["c365"])
        cands = [(cid, nm) for cid, nm in s365_en.items() if nm]
        # greedy one-to-one assignment: each 365scores club may be claimed by
        # a single team (best score first) — stops "Deportivo Alavés" from
        # stealing "Deportivo de la Coruña" when its own entry is absent.
        pairs = []
        for tid, t in teams.items():
            if tid in pair_ids:
                continue   # composite TBD pairing ("Cagliari/Hellas Verona")
            for cid, nm in cands:
                s = sim(t["name"], nm)
                if s >= 0.75:
                    pairs.append((s, tid, cid))
        pairs.sort(key=lambda x: (-x[0], x[1]))
        claimed_t, claimed_c, assign = set(), set(), {}
        for s, tid, cid in pairs:
            if tid in claimed_t or cid in claimed_c:
                continue
            claimed_t.add(tid)
            claimed_c.add(cid)
            assign[tid] = (cid, s)

        matched = 0
        for tid, t in teams.items():
            if tid in pair_ids or tid in ar_names:
                continue
            curated = alias_ar(t["name"])
            a = assign.get(tid)
            ar365 = s365_ar.get(a[0]) if a else None
            if (a and ar365 and scores365.looks_arabic(ar365)
                    and (a[1] >= 0.8 or not curated)):
                # strong 365scores match (or no curated alternative)
                ar_names[tid] = {"ar": ar365, "src": "365scores"}
                matched += 1
            elif curated:
                # curated names beat weak/confusable fuzzy matches
                ar_names[tid] = {"ar": curated, "src": "alias"}
            elif a and ar365 and scores365.looks_arabic(ar365):
                ar_names[tid] = {"ar": ar365, "src": "365scores"}
                matched += 1
        log(f"  Arabic names via 365scores: {matched}/{len(teams)}")
    except Exception as e:
        log(f"  ! 365scores names failed: {type(e).__name__} {e}")

    for tid, t in teams.items():
        if tid in ar_names or tid in pair_ids:
            continue
        if tid in ar_cache and ar_cache[tid].get("ar"):
            ar_names[tid] = ar_cache[tid]
            continue
        a = alias_ar(t["name"])
        if a:
            ar_names[tid] = {"ar": a, "src": "alias"}
    missing = [t["name"] for tid, t in teams.items() if tid not in ar_names]
    if missing:
        log(f"  ! no Arabic name for: {', '.join(missing[:8])}"
            + (" …" if len(missing) > 8 else ""))

    # matches whose either side is still an undecided pairing
    # ("Mantova/Palermo") carry only a placeholder round date — official
    # sources list them as unscheduled, so we do the same
    for m in matches:
        if m.get("home") in pair_ids or m.get("away") in pair_ids:
            m["ts"] = None

    # ---- team list (prefer standings order, else alphabetical) ---------
    order = [t for t in data["tableTeams"] if t in teams]
    order += sorted([t for t in teams if t not in order],
                    key=lambda x: teams[x]["name"].lower())

    out = {
        "slug": slug,
        "fotmob": cfg["fotmob"],
        "c365": cfg["c365"],
        "u365": cfg.get("u365", ""),
        "cup": bool(cfg.get("cup")),
        "nameEn": cfg["en"],
        "nameAr": cfg["ar"],
        "countryEn": cfg["cen"],
        "countryAr": cfg["car"],
        "ccode": cfg["ccode"],
        "accent": cfg["accent"] or data["color"] or "#2E6BD6",
        "season": data["season"],
        "teams": [{"id": t, "nameEn": teams[t]["name"],
                   "nameAr": (ar_names.get(t) or {}).get("ar") or teams[t]["name"],
                   "pair": t in pair_ids}
                  for t in order],
        "matches": sorted(matches, key=lambda m: (m["ts"] is None, m["ts"] or 0)),
    }
    return out, ar_names


def fallback_365(cfg, cached_league, venues_cache):
    """Near-window fixtures from 365scores (used only if FotMob fails)."""
    out = json.loads(json.dumps(cached_league)) if cached_league else None
    try:
        games = scores365.games(cfg["c365"])
    except Exception as e:
        log(f"  ! 365scores fallback failed too: {e}")
        return out
    if not out:
        return None
    # update cached matches from the live window
    by_key = {}
    for m in out["matches"]:
        by_key[(m["home"], m["away"])] = m
    for g in games:
        pass  # team ids differ between sources; time updates handled by next FotMob success
    return out


# --------------------------------------------------------------------------
# broadcast channels (TV guide)
#
# PRIMARY: 365scores per-game broadcaster lists, requested with the Saudi
# userCountryId so we get the MENA rights view with proper Arabic channel
# names (ثمانية 1، beIN SPORTS HD 1، …).  Each game is fetched in Arabic
# and English; results cached in tools/data/tv365.json.
# FALLBACK: FotMob's per-match "broadcastChannels" (country-mixed, mostly
# English) for matches 365scores doesn't cover.
# Rights are usually announced only ~7 days ahead, so we fetch a rolling
# window (now-12h … now+8d) per run, refreshing at most every 36 hours.
# --------------------------------------------------------------------------

TV_WINDOW_BACK_MS = 12 * 3600 * 1000     # keep today's matches fresh
TV_WINDOW_FWD_MS = 8 * 86400 * 1000      # rights rarely known further out
TV_STALE_MS = 36 * 3600 * 1000           # refetch a match's TV at most every 36h
TV_EMPTY_RETRY_MS = 6 * 3600 * 1000      # empty answers are retried sooner
TV_KEEP_MS = 10 * 86400 * 1000           # prune cache entries older than 10 days


def _norm_channels(chs):
    """Dedup + cap a broadcaster list; entries become {"n": name, "e": name}."""
    seen, out = set(), []
    for c in list(chs or [])[:16]:
        n = (c.get("n") or c.get("name") or "").strip()
        if not n or n.lower() in seen:
            continue
        seen.add(n.lower())
        out.append({"n": n, "e": n})
        if len(out) >= 8:
            break
    return out


def _365_tv_pass(leagues_out, tv365_cache, now_ms, lo, hi):
    """Attach 365scores MENA broadcasters ({"n": ar, "e": en}) where possible."""
    hits = 0
    for lg in leagues_out:
        win = [m for m in lg["matches"]
               if m.get("ts") and lo <= m["ts"] <= hi and not m.get("cancelled")]
        if not win:
            continue
        ar_by_id = {t["id"]: t.get("nameAr") or t.get("nameEn") or ""
                    for t in lg["teams"]}
        try:
            games365 = scores365.tv_games(lg["c365"])
        except Exception:
            continue
        for g in games365:
            if not g["utc"]:
                continue
            try:
                tms = dt.datetime.fromisoformat(
                    g["utc"].replace("Z", "+00:00")).timestamp() * 1000
            except Exception:
                continue
            if tms < lo - 3600000 or tms > hi + 3600000:
                continue
            # the list flag flips on only ~2 days ahead — ignore it
            # entirely: every in-window game gets its MENA broadcasters
            # checked (empty answers are cached and retried every 6h)
            cands = [m for m in win if abs(m["ts"] - tms) <= 120000]
            if not cands:
                continue
            if len(cands) > 1:
                # same kickoff minute — disambiguate by team-name similarity
                def pair_score(m):
                    s = 0.0
                    for mid_, nm365 in ((m["home"], g["home"]), (m["away"], g["away"])):
                        ours = ar_by_id.get(mid_, "")
                        if ours and nm365:
                            s += sim(ours, nm365)
                    return s
                best = max(cands, key=pair_score)
            else:
                best = cands[0]
            if best.get("tv"):
                continue   # already covered by an earlier game entry
            ent = tv365_cache.get(g["id"])
            stale = TV_STALE_MS if (ent and ent.get("ar")) else TV_EMPTY_RETRY_MS
            if not ent or now_ms - ent.get("at", 0) > stale:
                ar = en = None
                for attempt in (1, 2):
                    try:
                        ar, en = scores365.game_tv(g["id"])
                        break
                    except Exception as e:
                        if attempt == 2:
                            log(f"  ! TV365 game {g['id']}: {type(e).__name__} {e}")
                        else:
                            time.sleep(0.8)
                if ar is None:
                    time.sleep(0.4)
                    continue
                ent = {"ar": ar, "en": en,
                       "at": now_ms if ar else now_ms - TV_STALE_MS + TV_EMPTY_RETRY_MS}
                tv365_cache[g["id"]] = ent
            if ent.get("ar"):
                best["tv"] = [{"n": a,
                               "e": (ent["en"][i] if i < len(ent.get("en", [])) else a)}
                              for i, a in enumerate(ent["ar"])]
                best["tvSrc"] = "365scores"
                hits += 1
    return hits


def refresh_tv(leagues_out, tv_cache, tv365_cache, workers=10):
    now_ms = int(time.time() * 1000)
    lo, hi = now_ms - TV_WINDOW_BACK_MS, now_ms + TV_WINDOW_FWD_MS

    # ---- pass 1: 365scores MENA broadcasters (preferred) ----------------
    try:
        n365 = _365_tv_pass(leagues_out, tv365_cache, now_ms, lo, hi)
        log(f"TV guide: 365scores MENA channels → {n365} matches")
    except Exception as e:
        log(f"TV guide: 365scores pass failed ({type(e).__name__} {e})")

    # attach whatever we already know
    targets = []
    for lg in leagues_out:
        for m in lg["matches"]:
            if m.get("tv"):
                continue   # 365scores already covered this match
            if m.get("cancelled") or not m.get("ts"):
                continue
            if not (lo <= m["ts"] <= hi):
                continue
            ent = tv_cache.get(m["id"])
            if ent:
                ch = ent.get("ch") or []
                age = now_ms - ent.get("at", 0)
                stale_limit = TV_EMPTY_RETRY_MS if not ch else TV_STALE_MS
                if ch or age < stale_limit:
                    m["tv"] = ch
                    continue
            targets.append(m)

    log(f"TV guide: {len(targets)} match pages to fetch "
        f"(window ±{(TV_WINDOW_FWD_MS // 86400000)}d) …")

    # matches already served by 365scores keep their (better) channels;
    # cached FotMob entries are normalized to the same {n, e} shape
    for lg in leagues_out:
        for m in lg["matches"]:
            if m.get("tv") and m.get("tvSrc") != "365scores":
                m["tv"] = _norm_channels(m["tv"])
            elif m.get("tvSrc") == "365scores":
                m.pop("tvSrc", None)

    done = [0]

    def work(m):
        try:
            ch = fotmob.broadcast_channels(m["id"])
            return m, ch, None
        except Exception as e:
            return m, None, str(e)

    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = [ex.submit(work, m) for m in targets]
        for fut in as_completed(futs):
            m, ch, err = fut.result()
            done[0] += 1
            if done[0] % 40 == 0:
                log(f"    … TV {done[0]}/{len(targets)}")
            if err:
                continue  # keep old cache entry if we have one
            if ch:
                tv_cache[m["id"]] = {"ch": ch, "at": now_ms}
                m["tv"] = _norm_channels(ch)
            else:
                # rights not published (or still a cold SSR page):
                # cache the empty answer but retry it sooner
                tv_cache[m["id"]] = {"ch": [], "at": now_ms - TV_STALE_MS + TV_EMPTY_RETRY_MS}
                m["tv"] = []

    # ---- prune + stats --------------------------------------------------
    valid_ids = set()
    for lg in leagues_out:
        for m in lg["matches"]:
            valid_ids.add(m["id"])
    for mid in list(tv_cache.keys()):
        ent = tv_cache[mid]
        if mid not in valid_ids and now_ms - ent.get("at", 0) > TV_KEEP_MS:
            del tv_cache[mid]

    with_tv = sum(1 for lg in leagues_out for m in lg["matches"] if m.get("tv"))
    log(f"TV guide: {with_tv} matches carry broadcaster info")


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------

def main():
    workers = 14
    tv_workers = 10
    for i, a in enumerate(sys.argv):
        if a == "--workers":
            workers = int(sys.argv[i + 1])
        if a == "--tv-workers":
            tv_workers = int(sys.argv[i + 1])

    venues_cache = load_json(VENUES_CACHE, {})
    tv_cache = load_json(TV_CACHE, {})
    tv365_cache = load_json(TV365_CACHE, {})
    old_snapshot = load_json(SNAPSHOT, None)
    old_by_slug = {l["slug"]: l for l in (old_snapshot or {}).get("leagues", [])}

    leagues_out = []
    # the Arabic-name cache doubles as the live cross-league registry:
    # names matched for a league are instantly available to the cups that
    # follow in the same run (e.g. FA Cup clubs ← Premier League names)
    all_ar = load_json(ARNAMES_CACHE, {})
    for cfg in config.LEAGUES:
        slug = cfg["slug"]
        try:
            lg, ar_names = fetch_league(cfg, venues_cache, all_ar, workers)
            leagues_out.append(lg)
            all_ar.update(ar_names)
        except Exception as e:
            log(f"  !! FotMob failed for {slug}: {type(e).__name__} {e}")
            if slug in old_by_slug:
                log(f"     -> keeping last good snapshot for {slug}")
                lg = json.loads(json.dumps(old_by_slug[slug]))
                lg = _365_fallback(cfg, lg, venues_cache)
                if lg:
                    leagues_out.append(lg)
            else:
                log(f"     -> {slug} skipped this run")

    if not leagues_out:
        log("FATAL: no league data at all — keeping previous outputs.")
        sys.exit(1)

    # ---- broadcast channels (TV) ----------------------------------------
    try:
        refresh_tv(leagues_out, tv_cache, tv365_cache, workers=tv_workers)
    except Exception as e:
        log(f"! TV guide phase failed (non-fatal): {type(e).__name__} {e}")

    # ---- crests ---------------------------------------------------------
    teams_index = {}
    for lg in leagues_out:
        for t in lg["teams"]:
            teams_index[t["id"]] = {"en": t["nameEn"], "ar": t["nameAr"]}
    log("Fetching logos …")
    crests = build_crests(leagues_out, teams_index)
    for lg in leagues_out:
        key = "l" + str(lg["fotmob"])
        if key not in crests:
            crests[key] = placeholder_logo(lg["nameEn"], lg["accent"])
    for tid, t in teams_index.items():
        key = "t" + tid
        if key not in crests:
            crests[key] = placeholder_logo(t["en"], "#5B6B84")
    save_json(CRESTS_CACHE, crests)

    # ---- persist caches -------------------------------------------------
    save_json(VENUES_CACHE, venues_cache)
    save_json(TV_CACHE, tv_cache)
    save_json(TV365_CACHE, tv365_cache)
    save_json(ARNAMES_CACHE, all_ar)

    # ---- snapshot -------------------------------------------------------
    snapshot = {
        "builtAt": dt.datetime.now(tz=dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sources": config.SOURCES,
        "leagues": leagues_out,
    }
    save_json(SNAPSHOT, snapshot)
    log(f"snapshot.json written ({len(leagues_out)} leagues)")

    # ---- assets/data.js + assets/logos.js ------------------------------
    write_assets(snapshot, crests)
    log("assets/data.js + assets/logos.js written")


def _365_fallback(cfg, lg, vc):
    return fallback_365(cfg, lg, vc)


def write_assets(snapshot, crests):
    # venues dedup
    venues, refs = [], []
    vidx, ridx = {}, {}

    def venue_idx(v):
        if not v or not v.get("name"):
            return None
        key = (v["name"], v.get("city", ""))
        if key not in vidx:
            entry = {
                "n": v["name"], "c": v.get("city", ""),
                "ca": city_ar(v.get("city", "")),
                "co": v.get("country", ""), "coa": country_ar(v.get("country", "")),
            }
            if isinstance(v.get("lat"), (int, float)) and isinstance(v.get("lng"), (int, float)):
                entry["la"] = round(float(v["lat"]), 5)
                entry["lo"] = round(float(v["lng"]), 5)
            if v.get("cap"):
                entry["cp"] = v["cap"]
            if v.get("surface"):
                entry["su"] = v["surface"]
            vidx[key] = len(venues)
            venues.append(entry)
        return vidx[key]

    def ref_idx(r):
        if not r:
            return None
        if r not in ridx:
            ridx[r] = len(refs)
            refs.append(r)
        return ridx[r]

    lgs, tms, mt, tv = [], {}, {}, {}
    F_FIN, F_LIVE, F_CANC, F_AWD, F_TBD = 1, 2, 4, 8, 16

    for lg in snapshot["leagues"]:
        rows = []
        for m in lg["matches"]:
            flags = 0
            if m["finished"]:
                flags |= F_FIN
            if m["started"] and not m["finished"]:
                flags |= F_LIVE
            if m["cancelled"]:
                flags |= F_CANC
            if m["awarded"]:
                flags |= F_AWD
            if m["ts"] is None:
                flags |= F_TBD
            rn = m.get("roundName")
            if rn is None or str(rn).replace(".", "").isdigit() and str(rn) == str(m.get("round")):
                rn = ""
            rows.append([
                m["id"], m["round"], str(rn or ""), m["ts"] or 0, m["home"], m["away"],
                m["score"] or "", venue_idx(m.get("venue")), ref_idx(m.get("referee")),
                m["attendance"] if m["attendance"] else 0, flags,
            ])
            if m.get("tv"):
                tv[m["id"]] = [[c.get("n", ""), c.get("e") or c.get("n", "")]
                               for c in m["tv"] if c.get("n")]
        mt[lg["slug"]] = rows
        lg_entry = {
            "i": lg["slug"], "f": lg["fotmob"], "cc": lg["ccode"], "ac": lg["accent"],
            "n": {"en": lg["nameEn"], "ar": lg["nameAr"]},
            "c": {"en": lg["countryEn"], "ar": lg["countryAr"]},
            "s": lg["season"],
            "u": lg.get("u365", ""),
            "z": lg.get("c365", 0),
            "t": [t["id"] for t in lg["teams"] if not t.get("pair")],
            "m": len(lg["matches"]),
        }
        if lg.get("cup"):
            lg_entry["cup"] = 1
        lgs.append(lg_entry)
        for t in lg["teams"]:
            entry = tms.setdefault(t["id"], {"n": {"en": t["nameEn"], "ar": t["nameAr"]}, "lgs": []})
            if lg["slug"] not in entry["lgs"]:
                entry["lgs"].append(lg["slug"])

    data = {
        "v": 3,
        "builtAt": snapshot["builtAt"],
        "src": {
            "p": "FotMob", "pu": "https://www.fotmob.com",
            "s": "365scores", "su": "https://www.365scores.com",
        },
        "lgs": lgs, "tms": tms, "vs": venues, "rf": refs, "mt": mt,
        "tv": tv,
    }
    os.makedirs(os.path.join(HERE, config.ASSETS_DIR), exist_ok=True)
    with open(os.path.join(HERE, config.ASSETS_DIR, "data.js"), "w", encoding="utf-8") as f:
        f.write("/* Generated by tools/build_data.py — do not edit by hand.\n"
                "   Data source: FotMob (primary) + 365scores (secondary).\n"
                f"   Built: {snapshot['builtAt']} */\n")
        f.write("window.A7D=")
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    with open(os.path.join(HERE, config.ASSETS_DIR, "logos.js"), "w", encoding="utf-8") as f:
        f.write("/* Generated by tools/build_data.py — crest & league logo data URIs. */\n")
        f.write("window.A7L=")
        json.dump(crests, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")


if __name__ == "__main__":
    main()
