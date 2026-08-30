# -*- coding: utf-8 -*-
"""
Rebuild the subscribe-able .ics calendar feeds from tools/data/snapshot.json.

Outputs (inside the given directory, default ../ics):
  {league-slug}.ics          full-season feed per league
  teams/{teamId}.ics         one feed per club (all its matches)

Every feed embeds full match detail (exact UTC kickoff, stadium + city +
geo + capacity, referee, attendance, score) and an explicit data-source
attribution (FotMob primary / 365scores secondary) in the calendar
properties *and* inside every event description.
"""
import json
import os
import sys

import config
import icslib
from names import round_labels

HERE = os.path.dirname(os.path.abspath(__file__))
SNAPSHOT = os.path.join(HERE, config.DATA_DIR, "snapshot.json")


def log(*a):
    print(*a, flush=True)


def build_events(lg, matches, teams_by_id):
    lines = []
    for m in matches:
        if m.get("ts") is None:
            continue   # unscheduled ("يُعلن لاحقاً") — no fake calendar dates
        home = teams_by_id.get(m["home"])
        away = teams_by_id.get(m["away"])
        if not home or not away:
            continue
        md_en, md_ar = round_labels(m.get("round"), m.get("roundName"), cup=lg.get("cup"))
        mm = dict(m)
        mm["source"] = m.get("source", "fotmob")
        lines += icslib.match_event(
            mm,
            league_name_en=lg["nameEn"], league_name_ar=lg["nameAr"],
            matchday_label_en=md_en, matchday_label_ar=md_ar,
            home={"name_en": home["nameEn"], "name_ar": home["nameAr"]},
            away={"name_en": away["nameEn"], "name_ar": away["nameAr"]},
        )
    return lines


def main():
    out_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, config.ICS_DIR)
    teams_dir = os.path.join(out_dir, "teams")
    os.makedirs(teams_dir, exist_ok=True)

    with open(SNAPSHOT, encoding="utf-8") as f:
        snap = json.load(f)

    built = snap.get("builtAt", "")
    total = 0
    # cross-league index: every match of every team across all competitions
    team_matches = {}
    team_leagues = {}
    for lg in snap["leagues"]:
        teams_by_id = {t["id"]: t for t in lg["teams"]}
        season = lg.get("season", "")

        # ---- league feed -------------------------------------------------
        ev = build_events(lg, lg["matches"], teams_by_id)
        cal = icslib.calendar(
            name_en=f"⚽ {lg['nameEn']} {season} — Fixtures",
            name_ar=f"{lg['nameAr']} {season} — جدول المباريات",
            desc_en=(f"{lg['nameEn']} {season} — all fixtures, exact UTC kickoffs, "
                     f"stadiums & TV. Data: FotMob + 365scores · auto-updated {built}."),
            desc_ar=(f"{lg['nameAr']} {season} — جميع المباريات بتوقيت UTC الدقيق "
                     f"مع الملاعب والقنوات الناقلة. المصدر: FotMob + 365scores · تحديث تلقائي {built}"),
            events_lines=ev, ttl=config.FEED_TTL,
        )
        path = os.path.join(out_dir, f"{lg['slug']}.ics")
        with open(path, "w", encoding="utf-8", newline="") as f:
            f.write(cal)
        total += len(ev)
        log(f"  {lg['slug']}.ics — {len(ev)} events")

        pair_ids = {t["id"] for t in lg["teams"] if t.get("pair")}
        for m in lg["matches"]:
            for tid in (m["home"], m["away"]):
                if tid and tid not in pair_ids:
                    team_matches.setdefault(tid, []).append((lg, m))
                    team_leagues.setdefault(tid, []).append(lg)

    # ---- per-team feeds (all competitions the team plays in) -------------
    for tid, items in team_matches.items():
        t = teams_by_id_global(snap, tid)
        if not t:
            continue
        lgs_of = team_leagues[tid]
        seen = {id(x): x for x in lgs_of}.values()
        lgs_of = list(seen)
        lg_names_en = " & ".join(l["nameEn"] for l in lgs_of)
        lg_names_ar = " و".join(l["nameAr"] for l in lgs_of)
        matches = [m for (l, m) in items]
        ev_t = []
        for lg, m in items:
            tb = {x["id"]: x for x in lg["teams"]}
            ev_t += build_events(lg, [m], tb)
        cal_t = icslib.calendar(
            name_en=f"⚽ {t['nameEn']} — {lg_names_en} Fixtures",
            name_ar=f"{t['nameAr']} — مباريات {lg_names_ar}",
            desc_en=(f"{t['nameEn']} — all matches in {lg_names_en}, exact UTC "
                     f"kickoffs, stadiums & TV. Data: FotMob + 365scores · auto-updated {built}."),
            desc_ar=(f"{t['nameAr']} — جميع المباريات في {lg_names_ar} بتوقيت UTC "
                     f"الدقيق مع الملاعب والقنوات الناقلة. المصدر: FotMob + 365scores · تحديث تلقائي {built}"),
            events_lines=ev_t, ttl=config.FEED_TTL,
        )
        with open(os.path.join(teams_dir, f"{tid}.ics"), "w",
                  encoding="utf-8", newline="") as f:
            f.write(cal_t)

    log(f"Feeds written to {out_dir} ({total} league events + {len(team_matches)} team feeds).")


def teams_by_id_global(snap, tid):
    for lg in snap["leagues"]:
        for t in lg["teams"]:
            if t["id"] == tid:
                return t
    return None


if __name__ == "__main__":
    main()
