/* ==========================================================================
   Client-side .ics builder (RFC 5545) — mirrors tools/icslib.py
   Every calendar + every event embeds the data-source attribution
   (FotMob primary / 365scores secondary).
   ========================================================================== */
(function (global) {
  "use strict";

  var CRLF = "\r\n";
  var enc = new TextEncoder();

  function esc(text) {
    if (text === null || text === undefined) return "";
    return String(text)
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  }

  function fold(line) {
    var bytes = enc.encode(line), out = [];
    while (bytes.length > 75) {
      var cut = 75;
      while (cut > 1 && (bytes[cut] & 0xC0) === 0x80) cut--;
      out.push(new TextDecoder().decode(bytes.subarray(0, cut)));
      bytes = bytes.subarray(cut);
      var pre = [32].concat(Array.from(bytes));
      bytes = new Uint8Array(pre);
    }
    out.push(new TextDecoder().decode(bytes));
    return out.join(CRLF);
  }

  function prop(name, value, params) {
    return fold(name + (params || "") + ":" + value);
  }

  function p2(n) { return n < 10 ? "0" + n : "" + n; }
  function dtUTC(ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + p2(d.getUTCMonth() + 1) + p2(d.getUTCDate()) +
      "T" + p2(d.getUTCHours()) + p2(d.getUTCMinutes()) + p2(d.getUTCSeconds()) + "Z";
  }
  function dUTC(ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + p2(d.getUTCMonth() + 1) + p2(d.getUTCDate());
  }

  var WD_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MO_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var WD_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  var MO_AR = ["", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
               "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

  /** broadcaster list [[ar, en], …] → names in the requested language */
  function tvNames(tv, idx) {
    if (!tv || !tv.length) return [];
    var out = [];
    for (var i = 0; i < tv.length && i < 8; i++) {
      var c = tv[i] || [];
      var n = String(c[idx] || c[0] || "");
      if (n) out.push(n);
    }
    return out;
  }

  function arDate(d) {
    return WD_AR[d.getUTCDay()] + " " + d.getUTCDate() + " " +
      MO_AR[d.getUTCMonth() + 1] + " " + d.getUTCFullYear();
  }

  /**
   * m: hydrated match:
   * { id, ts(ms|null), tbd, round, roundLabelEn, roundLabelAr, home:{en,ar}, away:{en,ar},
   *   score, finished, live, cancelled, venue:{n,c,co,la,lo,cp,su}, referee, attendance,
   *   leagueEn, leagueAr }
   */
  function matchEvent(m) {
    var L = [];
    L.push("BEGIN:VEVENT");
    L.push("UID:fotmob-" + m.id + "@league-calendars");
    L.push("DTSTAMP:" + dtUTC(Date.now()));

    if (m.tbd || !m.ts) {
      var ms = m.ts || Date.now();
      L.push(prop("DTSTART", dUTC(ms), ";VALUE=DATE"));
      L.push(prop("DTEND", dUTC(ms + 86400000), ";VALUE=DATE"));
    } else {
      L.push("DTSTART:" + dtUTC(m.ts));
      L.push("DTEND:" + dtUTC(m.ts + 2 * 3600 * 1000));
    }

    var sep = m.cancelled ? " v " : " vs ";
    var score = (m.finished && m.score) ? " (" + m.score + ")" : "";
    var tagEn = (m.cancelled ? " [POSTPONED]" : "") + (m.tbd ? " ⏳" : "");
    var tagAr = m.cancelled ? " [مؤجلة]" : "";
    L.push(prop("SUMMARY", esc(m.home.en + sep + m.away.en + score + " — " + m.leagueEn + tagEn)));

    var v = m.venue || {};
    if (v.n) {
      L.push(prop("LOCATION", esc([v.n, v.c, v.co].filter(Boolean).join(", "))));
      if (typeof v.la === "number" && typeof v.lo === "number") {
        L.push("GEO:" + Number(v.la).toFixed(6) + ";" + Number(v.lo).toFixed(6));
      }
    }

    L.push(prop("URL", "https://www.fotmob.com/match/" + m.id));

    var rows = [];
    var scoreTxt = (m.finished && m.score) ? " (" + m.score + ")" : "";
    var tvAr = tvNames(m.tv, 0);
    var tvEn = tvNames(m.tv, 1);
    var tvNoteAr = tvAr.length ? " — 📺 " + tvAr.join("، ") : "";
    var tvNoteEn = tvEn.length ? " | TV: " + tvEn.join(", ") : "";

    // -- Arabic block --
    rows.push("⚽ " + m.home.ar + " × " + m.away.ar + scoreTxt);
    rows.push("🏆 " + m.leagueAr + " — " + m.roundLabelAr);
    if (m.tbd || !m.ts) {
      rows.push("🗓 يُعلن عن الموعد لاحقاً");
    } else {
      var d = new Date(m.ts);
      var riyadh = new Date(m.ts + 3 * 3600 * 1000);
      rows.push("🗓 " + arDate(d) + " · " + p2(riyadh.getUTCHours()) + ":" +
        p2(riyadh.getUTCMinutes()) + " بتوقيت الرياض");
    }
    if (v.n) {
      rows.push("🏟 " + v.n + (v.c ? "، " + v.c : ""));
    }
    if (tvAr.length) rows.push("📺 " + tvAr.join("، "));
    if (m.referee) rows.push("⚖️ الحكم: " + m.referee);
    if (m.attendance) rows.push("👥 الحضور: " + Number(m.attendance).toLocaleString("en-US"));
    if (m.cancelled) rows.push("⚠️ مباراة مؤجلة — قد يتغير موعدها");

    rows.push("—————");

    // -- English block --
    rows.push("⚽ " + m.home.en + " v " + m.away.en + scoreTxt);
    rows.push("🏆 " + m.leagueEn + " — " + m.roundLabelEn);
    if (m.tbd || !m.ts) {
      rows.push("🗓 Date & time TBD");
    } else {
      var d2 = new Date(m.ts);
      rows.push("🗓 " + WD_EN[d2.getUTCDay()] + " " + p2(d2.getUTCDate()) + " " +
        MO_EN[d2.getUTCMonth()] + " " + d2.getUTCFullYear() + " · " +
        p2(d2.getUTCHours()) + ":" + p2(d2.getUTCMinutes()) + " UTC");
    }
    if (v.n) {
      rows.push("🏟 " + v.n + (v.c ? ", " + v.c : ""));
    }
    if (tvEn.length) rows.push("📺 " + tvEn.join(", "));
    if (m.referee) rows.push("Referee: " + m.referee);
    if (m.attendance) rows.push("Attendance: " + Number(m.attendance).toLocaleString("en-US"));
    if (m.cancelled) rows.push("⚠️ Postponed — details will update");

    rows.push("—————");
    rows.push("📚 المصدر: FotMob · 365scores — تحديث تلقائي");
    rows.push("📚 Data: FotMob + 365scores — auto-updated");
    L.push(prop("DESCRIPTION", esc(rows.join("\n"))));

    /* a scheduled fixture with a published kickoff is CONFIRMED;
       only date-TBD placeholders stay TENTATIVE */
    L.push("STATUS:" + (m.cancelled ? "CANCELLED" : (m.ts ? "CONFIRMED" : "TENTATIVE")));
    L.push("TRANSP:OPAQUE");

    L.push("BEGIN:VALARM");
    L.push("TRIGGER:-P1D");
    L.push(prop("ACTION", "DISPLAY"));
    L.push(prop("DESCRIPTION", esc("⏰ غداً: " + m.home.ar + " ضد " + m.away.ar + " — " + m.leagueAr +
      tvNoteAr + " | Tomorrow: " + m.home.en + " vs " + m.away.en + tvNoteEn)));
    L.push("END:VALARM");
    L.push("BEGIN:VALARM");
    L.push("TRIGGER:-PT30M");
    L.push(prop("ACTION", "DISPLAY"));
    L.push(prop("DESCRIPTION", esc("⚽ تبدأ المباراة بعد 30 دقيقة: " + m.home.ar + " × " + m.away.ar +
      tvNoteAr + " | Kick-off in 30 min: " + m.home.en + " vs " + m.away.en + tvNoteEn)));
    L.push("END:VALARM");

    L.push("END:VEVENT");
    return L;
  }

  function calendar(nameEn, nameAr, descEn, descAr, events) {
    var L = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//League Calendars//Fixture Feeds//AR",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      prop("X-WR-CALNAME", esc(nameEn + " | " + nameAr)),
      prop("X-WR-CALDESC", esc(descEn + "  •  " + descAr)),
      "X-WR-TIMEZONE:UTC",
      "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
      "X-PUBLISHED-TTL:PT6H",
      "X-SOURCE-PRIMARY:FotMob (https://www.fotmob.com)",
      "X-SOURCE-SECONDARY:365scores (https://www.365scores.com)"
    ];
    events.forEach(function (ev) { ev.forEach(function (line) { L.push(line); }); });
    L.push("END:VCALENDAR");
    return L.join(CRLF) + CRLF;
  }

  function download(filename, text) {
    var blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }

  global.A7ICS = {
    esc: esc, fold: fold, prop: prop, dtUTC: dtUTC, tvNames: tvNames,
    matchEvent: matchEvent, calendar: calendar, download: download
  };
})(window);
