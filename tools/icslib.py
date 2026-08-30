# -*- coding: utf-8 -*-
"""
RFC 5545 calendar feed builder (shared by feed generation).

Every feed and every event carries an explicit data-source attribution
(FotMob primary / 365scores secondary), as required for this project.
"""
import datetime as dt

PRODID = "-//League Calendars//Fixture Feeds//AR"
CRLF = "\r\n"


def esc(text):
    """Escape a text value per RFC 5545 §3.3.11."""
    if text is None:
        return ""
    return (str(text).replace("\\", "\\\\").replace(";", "\\;")
            .replace(",", "\\,").replace("\r\n", "\\n").replace("\n", "\\n"))


def fold(line):
    """Fold content lines at 75 octets (RFC 5545 §3.1)."""
    out = []
    raw = line.encode("utf-8")
    while len(raw) > 75:
        cut = 75
        while cut > 1 and (raw[cut] & 0xC0) == 0x80:  # don't split utf-8
            cut -= 1
        out.append(raw[:cut].decode("utf-8"))
        raw = b" " + raw[cut:]
    out.append(raw.decode("utf-8"))
    return CRLF.join(out)


def prop(name, value, params=""):
    if params:
        return fold(f"{name}{params}:{value}")
    return fold(f"{name}:{value}")


def ics_dt_utc(ms):
    """epoch-ms -> 20260830T160500Z"""
    d = dt.datetime.fromtimestamp(ms / 1000, tz=dt.timezone.utc)
    return d.strftime("%Y%m%dT%H%M%SZ")


def ics_date(ms):
    d = dt.datetime.fromtimestamp(ms / 1000, tz=dt.timezone.utc)
    return d.strftime("%Y%m%d")


def ics_stamp():
    return dt.datetime.now(tz=dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")


AR_DAYS = ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة",
           "السبت", "الأحد"]
AR_MONTHS = ["", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
             "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]


def tv_names(tv, which="n"):
    """
    Broadcaster list ([{"n": ar, "e": en}, …] or [[ar, en], …]) →
    [names] for the requested language key.  Capped at 8.
    """
    out = []
    for c in list(tv or [])[:8]:
        if isinstance(c, dict):
            n = str(c.get(which) or c.get("n") or "")
        else:
            n = str(c[0] if which == "n" else (c[1] if len(c) > 1 else c[0]))
        if n:
            out.append(n)
    return out


def ar_date(d):
    """UTC datetime → 'الأربعاء 2 سبتمبر 2026'."""
    return f"{AR_DAYS[d.weekday()]} {d.day} {AR_MONTHS[d.month]} {d.year}"


def match_event(m, *, league_name_en, league_name_ar, matchday_label_en,
                matchday_label_ar, home, away, source_key="fotmob"):
    """
    m: dict with id, ts (ms|null), round, score, status, venue{...},
       referee, attendance, leagueColor?
    home/away: dict(name_en, name_ar)
    Returns list of ics lines (unfolded pieces already folded).
    """
    lines = []
    lines.append("BEGIN:VEVENT")
    lines.append(f"UID:fotmob-{m['id']}@league-calendars")
    lines.append(f"DTSTAMP:{ics_stamp()}")

    tbd = m.get("ts") is None
    if tbd:
        # all-day placeholder on the matchday (or today if unknown)
        ms = m.get("tsDate") or m.get("ts") or (dt.datetime.now(tz=dt.timezone.utc).timestamp() * 1000)
        lines.append(prop("DTSTART", ics_date(ms), ";VALUE=DATE"))
        lines.append(prop("DTEND", ics_date(ms + 86400000), ";VALUE=DATE"))
    else:
        lines.append(f"DTSTART:{ics_dt_utc(m['ts'])}")
        lines.append(f"DTEND:{ics_dt_utc(m['ts'] + 2 * 3600 * 1000)}")

    # ---- summary --------------------------------------------------------
    sep = " v " if m.get("cancelled") else " vs "
    score = f" ({m['score']})" if (m.get("finished") and m.get("score")) else ""
    cancelled_tag_en = " [POSTPONED]" if m.get("cancelled") else ""
    cancelled_tag_ar = " [مؤجلة]" if m.get("cancelled") else ""
    tbd_tag_en = " ⏳" if tbd else ""
    summary = esc(f"{home['name_en']}{sep}{away['name_en']}{score} — "
                  f"{league_name_en}{cancelled_tag_en}{tbd_tag_en}")
    lines.append(prop("SUMMARY", summary))

    # ---- location -------------------------------------------------------
    v = m.get("venue") or {}
    loc_bits = [b for b in (v.get("name"), v.get("city"), v.get("country")) if b]
    if loc_bits:
        lines.append(prop("LOCATION", esc(", ".join(loc_bits))))
        if isinstance(v.get("lat"), (int, float)) and isinstance(v.get("lng"), (int, float)):
            lines.append(f"GEO:{float(v['lat']):.6f};{float(v['lng']):.6f}")

    # ---- url ------------------------------------------------------------
    lines.append(prop("URL", f"https://www.fotmob.com/match/{m['id']}"))

    # ---- description: two clean language blocks (Apple-friendly) --------
    d = dt.datetime.fromtimestamp(m["ts"] / 1000, tz=dt.timezone.utc) if not tbd else None
    riyadh = d.astimezone(dt.timezone(dt.timedelta(hours=3))) if d else None
    score_txt = f" ({m['score']})" if (m.get("finished") and m.get("score")) else ""
    tv_ar = tv_names(m.get("tv"), "n")
    tv_en = tv_names(m.get("tv"), "e")
    rows = []

    # -- Arabic block --
    rows.append(f"⚽ {home['name_ar']} × {away['name_ar']}{score_txt}")
    rows.append(f"🏆 {league_name_ar} — {matchday_label_ar}")
    if d:
        rows.append(f"🗓 {ar_date(d)} · {riyadh.strftime('%H:%M')} بتوقيت الرياض")
    else:
        rows.append("🗓 يُعلن عن الموعد لاحقاً")
    if v.get("name"):
        loc_ar = "، ".join(x for x in (v.get("name"), v.get("city")) if x)
        if loc_ar:
            rows.append(f"🏟 {loc_ar}")
    if tv_ar:
        rows.append("📺 " + "، ".join(tv_ar))
    if m.get("referee"):
        rows.append(f"⚖️ الحكم: {m['referee']}")
    if m.get("attendance"):
        rows.append(f"👥 الحضور: {int(m['attendance']):,}")
    if m.get("cancelled"):
        rows.append("⚠️ مباراة مؤجلة — قد يتغير موعدها")

    rows.append("—————")

    # -- English block --
    rows.append(f"⚽ {home['name_en']} v {away['name_en']}{score_txt}")
    rows.append(f"🏆 {league_name_en} — {matchday_label_en}")
    if d:
        rows.append(f"🗓 {d.strftime('%a %d %b %Y')} · {d.strftime('%H:%M')} UTC")
    else:
        rows.append("🗓 Date & time TBD")
    if v.get("name"):
        loc_en = ", ".join(x for x in (v.get("name"), v.get("city")) if x)
        if loc_en:
            rows.append(f"🏟 {loc_en}")
    if tv_en:
        rows.append("📺 " + ", ".join(tv_en))
    if m.get("referee"):
        rows.append(f"Referee: {m['referee']}")
    if m.get("attendance"):
        rows.append(f"Attendance: {int(m['attendance']):,}")
    if m.get("cancelled"):
        rows.append("⚠️ Postponed — details will update")

    rows.append("—————")
    rows.append("📚 المصدر: FotMob · 365scores — تحديث تلقائي")
    rows.append("📚 Data: FotMob + 365scores — auto-updated")
    desc = CRLF.join(rows).replace(CRLF, "\\n")
    lines.append(prop("DESCRIPTION", desc))

    # ---- status ---------------------------------------------------------
    # A scheduled fixture with a published kickoff time is CONFIRMED;
    # only date-TBD placeholders stay TENTATIVE.
    if m.get("cancelled"):
        lines.append("STATUS:CANCELLED")
    elif m.get("ts"):
        lines.append("STATUS:CONFIRMED")
    else:
        lines.append("STATUS:TENTATIVE")
    lines.append("TRANSP:OPAQUE")

    # ---- reminders (VALARM) ----------------------------------------------
    # 1) 24 hours before  2) 30 minutes before — both carry the TV channel
    tv_note = (" — 📺 " + "، ".join(tv_ar)) if tv_ar else ""
    tv_note_en = (" | TV: " + ", ".join(tv_en)) if tv_en else ""
    lines.append("BEGIN:VALARM")
    lines.append(f"TRIGGER:-P1D")
    lines.append(prop("ACTION", "DISPLAY"))
    lines.append(prop("DESCRIPTION",
                      esc(f"⏰ غداً: {home['name_ar']} ضد {away['name_ar']} — {league_name_ar}"
                          f"{tv_note} | Tomorrow: {home['name_en']} vs {away['name_en']}"
                          f"{tv_note_en}")))
    lines.append("END:VALARM")
    lines.append("BEGIN:VALARM")
    lines.append("TRIGGER:-PT30M")
    lines.append(prop("ACTION", "DISPLAY"))
    lines.append(prop("DESCRIPTION",
                      esc(f"⚽ تبدأ المباراة بعد 30 دقيقة: {home['name_ar']} × {away['name_ar']}"
                          f"{tv_note} | Kick-off in 30 min: {home['name_en']} vs {away['name_en']}"
                          f"{tv_note_en}")))
    lines.append("END:VALARM")

    lines.append("END:VEVENT")
    return lines


def calendar(name_en, name_ar, desc_en, desc_ar, events_lines, ttl="PT6H"):
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:{PRODID}",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        prop("X-WR-CALNAME", esc(name_en + " | " + name_ar)),
        prop("X-WR-CALDESC", esc(desc_en + "  •  " + desc_ar)),
        "X-WR-TIMEZONE:UTC",
        f"REFRESH-INTERVAL;VALUE=DURATION:{ttl}",
        f"X-PUBLISHED-TTL:{ttl}",
        f"X-SOURCE-PRIMARY:FotMob (https://www.fotmob.com)",
        f"X-SOURCE-SECONDARY:365scores (https://www.365scores.com)",
    ]
    lines.extend(events_lines)
    lines.append("END:VCALENDAR")
    return CRLF.join(lines) + CRLF
