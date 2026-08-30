/* ==========================================================================
   League Calendars — app logic
   Arabic/English • RTL/LTR • dark/light • fully static (data from FotMob)
   ========================================================================== */
(function (global) {
  "use strict";

  var D = global.A7D, LG = global.A7L;
  // T() always reads the live language from S (S is hoisted; assigned before first call)
  var T = function (key) { return global.A7I18N.t(key, (typeof S !== "undefined" && S) ? S.lang : "ar"); };
  if (!D) {
    document.addEventListener("DOMContentLoaded", function () {
      document.body.innerHTML = '<div class="fatal">' +
        (global.A7LANG === "en" ? "Could not load match data." : "تعذر تحميل بيانات المباريات.") +
        "</div>";
    });
    return;
  }

  /* ======================== state ======================== */
  var S = {
    lang: store("a7lang") || "ar",
    theme: store("a7theme") || (global.matchMedia &&
      global.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"),
    favs: storeJSON("a7favs", []),
    lgfavs: storeJSON("a7lgfavs", []),      // favourite competitions
    tf: store("a7tf") || "24",              // time format 24/12
    tz: store("a7tz") || "",                // timezone override (IANA)
    notify: store("a7notify") !== "0",      // in-match notifications (default on:
                                            // in-app toasts work without any permission)
    live: store("a7live") !== "0",          // live section + live badges
    fxFilter: "upcoming",   // fixtures status filter per view instance
    feedOK: {}              // cache of feed existence checks
  };

  function store(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function storeJSON(k, d) {
    try { var v = JSON.parse(localStorage.getItem(k) || "null"); return v || d; }
    catch (e) { return d; }
  }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* ======================== data layer ======================== */
  var LEAGUES = D.lgs, TEAMS = D.tms, VENUES = D.vs, REFS = D.rf, MT = D.mt;
  var F_FIN = 1, F_LIVE = 2, F_CANC = 4, F_AWD = 8, F_TBD = 16;

  function lg(id) { for (var i = 0; i < LEAGUES.length; i++) if (LEAGUES[i].i === id) return LEAGUES[i]; return null; }
  function lgByTeam(tid) {
    var t = TEAMS[tid];
    if (!t) return null;
    return lg(t.lgs[0]) || null;
  }
  function lgsOfTeam(tid) {
    var t = TEAMS[tid];
    return t ? (t.lgs || []).map(function (s) { return lg(s); }).filter(Boolean) : [];
  }
  function teamMatchesAll(tid) {
    var out = [];
    lgsOfTeam(tid).forEach(function (l) {
      matchesOf(l.i).forEach(function (m) {
        if (m.homeId === tid || m.awayId === tid) out.push(m);
      });
    });
    out.sort(function (a, b) { return (a.ts || 9e15) - (b.ts || 9e15); });
    return out;
  }
  function teamName(tid) { var t = TEAMS[tid]; return t ? t.n : { en: "?", ar: "?" }; }
  function teamLogo(tid) { return LG && LG["t" + tid] || ""; }
  function lgLogo(l) { return LG && LG["l" + l.f] || ""; }
  function flag(cc) {
    if (!cc || cc.length !== 2 || cc === "EU" || cc === "AS") return "";
    return String.fromCodePoint.apply(null, cc.toUpperCase().split("").map(function (c) {
      return 0x1F1E6 + c.charCodeAt(0) - 65;
    }));
  }

  var ROUND_LABELS = {
    "round of 64": { en: "Round of 64", ar: "دور الـ64" },
    "round of 32": { en: "Round of 32", ar: "دور الـ32" },
    "round of 16": { en: "Round of 16", ar: "دور الـ16" },
    "quarter-finals": { en: "Quarter-Finals", ar: "ربع النهائي" },
    "quarter-final": { en: "Quarter-Final", ar: "ربع النهائي" },
    "semi-finals": { en: "Semi-Finals", ar: "نصف النهائي" },
    "semi-final": { en: "Semi-Final", ar: "نصف النهائي" },
    "final": { en: "Final", ar: "النهائي" },
    "first round": { en: "First Round", ar: "الدور الأول" },
    "second round": { en: "Second Round", ar: "الدور الثاني" },
    "third round": { en: "Third Round", ar: "الدور الثالث" },
    "fourth round": { en: "Fourth Round", ar: "الدور الرابع" },
    "fifth round": { en: "Fifth Round", ar: "الدور الخامس" },
    "sixth round": { en: "Sixth Round", ar: "الدور السادس" },
    "preliminary round": { en: "Preliminary Round", ar: "الدور التمهيدي" },
    "extra preliminary round": { en: "Extra Preliminary Round", ar: "الدور التمهيدي المبكر" },
    "1/64": { en: "Round of 64", ar: "دور الـ64" },
    "1/32": { en: "Round of 32", ar: "دور الـ32" },
    "1/16": { en: "Round of 32", ar: "دور الـ32" },
    "1/8": { en: "Round of 16", ar: "دور الـ16" },
    "1/4": { en: "Quarter-Finals", ar: "ربع النهائي" },
    "1/2": { en: "Semi-Finals", ar: "نصف النهائي" }
  };
  var AR_ORDINALS = { 1: "الأول", 2: "الثاني", 3: "الثالث", 4: "الرابع", 5: "الخامس", 6: "السادس", 7: "السابع", 8: "الثامن" };

  function roundLabels(round, roundName, cup) {
    var r = String(round || "").trim();
    var rn = String(roundName || "").trim();
    var key = (rn && !/^\d+$/.test(rn)) ? rn : r;
    var hit = ROUND_LABELS[String(key).toLowerCase()];
    if (hit) return hit;
    if (/^\d+$/.test(r)) {
      return cup
        ? { en: "Round " + r, ar: "الدور " + (AR_ORDINALS[+r] || r) }
        : { en: "Matchday " + r, ar: "الجولة " + r };
    }
    if (r) return { en: rn || r, ar: rn || r };
    return { en: "Fixtures", ar: "مباريات" };
  }

  function hydrate(row, league) {
    var v = row[7] !== null && row[7] !== undefined ? VENUES[row[7]] : null;
    var flags = row[10] || 0;
    return {
      id: row[0], round: row[1], roundName: row[2] || "", ts: row[3] || 0,
      homeId: row[4], awayId: row[5], score: row[6] || "",
      venue: v, referee: row[8] !== null && row[8] !== undefined ? REFS[row[8]] : "",
      attendance: row[9] || 0,
      finished: !!(flags & F_FIN), live: !!(flags & F_LIVE),
      cancelled: !!(flags & F_CANC), awarded: !!(flags & F_AWD), tbd: !!(flags & F_TBD),
      tv: (D.tv && D.tv[row[0]]) || null,
      league: league,
      home: { id: row[4], en: teamName(row[4]).en, ar: teamName(row[4]).ar },
      away: { id: row[5], en: teamName(row[5]).en, ar: teamName(row[5]).ar },
      rl: roundLabels(row[1], row[2], league && league.cup)
    };
  }

  function matchesOf(slug) {
    var l = lg(slug); if (!l) return [];
    return (MT[slug] || []).map(function (r) { return hydrate(r, l); });
  }

  var NOW = Date.now();
  function isUpcoming(m) { return !m.finished && !m.cancelled && m.ts > NOW - 2.5 * 3600 * 1000; }

  var _allUp = null;
  function allUpcoming() {
    if (_allUp) return _allUp;
    var out = [];
    LEAGUES.forEach(function (l) {
      matchesOf(l.i).forEach(function (m) { if (isUpcoming(m)) out.push(m); });
    });
    out.sort(function (a, b) { return a.ts - b.ts; });
    _allUp = out;
    return out;
  }

  var _nextByTeam = null;
  function nextByTeam() {
    if (_nextByTeam) return _nextByTeam;
    var map = {};
    LEAGUES.forEach(function (l) {
      matchesOf(l.i).forEach(function (m) {
        if (!isUpcoming(m) || !m.ts) return;
        if (!map[m.homeId] || m.ts < map[m.homeId].ts) map[m.homeId] = m;
        if (!map[m.awayId] || m.ts < map[m.awayId].ts) map[m.awayId] = m;
      });
    });
    _nextByTeam = map;
    return map;
  }

  function nextOfLeague(slug) {
    var up = matchesOf(slug).filter(isUpcoming);
    up.sort(function (a, b) { return (a.ts || 9e15) - (b.ts || 9e15); });
    return up[0] || null;
  }

  /* ======================== live matches (365scores) ======================== */
  function liveInfoOf(m) {
    return (global.A7LIVE && m && m.league && m.ts) ? global.A7LIVE.info(m.league.i, m.ts) : null;
  }
  function matchByLiveSlugTs(slug, ts) {
    var l = lg(slug); if (!l) return null;
    var rows = MT[slug] || [];
    for (var i = 0; i < rows.length; i++) {
      if ((rows[i][3] || 0) === ts) return hydrate(rows[i], l);
    }
    return null;
  }
  /* ---- live event → localized label ---------------------------------
     365scores eventType ids: 1 goal · 2 yellow · 1000 substitution;
     red cards / VAR / shootout arrive as names — match on the text.  */
  function evLabel(ev) {
    var nm = (ev && ev.nm) || "", id = ev && ev.id, ic = "•", lbl = nm, sub = "", tk = "";
    if (/حمراء|red/i.test(nm)) { tk = "evRed"; ic = "🟥"; }
    else if (id === 1 || /هدف|goal/i.test(nm)) { tk = "evGoal"; ic = "⚽"; }
    else if (id === 2 || /صفراء|yellow/i.test(nm)) { tk = "evYellow"; ic = "🟨"; }
    else if (id === 1000 || /تبديل|substitution|sub/i.test(nm)) { tk = "evSub"; ic = "🔄"; }
    else if (/فيديو|var/i.test(nm)) { tk = "evVar"; ic = "📺"; }
    if (tk) lbl = T(tk);
    var s = (ev && ev.sub) || "";
    if (id === 1 || /هدف|goal/i.test(nm)) {
      if (/ذاتي|own/i.test(s)) sub = T("evOwnGoal");
      else if (/ترجيح|shootout/i.test(s)) sub = T("evPenShootout");
      else if (/ضائع|missed/i.test(s)) sub = T("evMissedPen");
      else if (/جزاء|penalty/i.test(s)) sub = T("evPenalty");
    }
    return { ic: ic, lbl: lbl, sub: sub };
  }
  /* events timeline for the expand panel (latest first) */
  function eventsTimelineInner(m, li) {
    var evs = (li && li.evs) ? li.evs : [];
    if (!evs.length) return "";
    var rows = evs.slice().reverse().map(function (ev) {
      var L = evLabel(ev);
      var team = ev.side === "h" ? m.home[S.lang] : m.away[S.lang];
      return '<div class="xp-ev' + (ev.maj ? " maj" : "") + '">' +
        '<span class="xp-ev-m" dir="ltr">' + esc(String(ev.m || "")) + '</span>' +
        '<span class="xp-ev-ic">' + L.ic + '</span>' +
        '<span class="xp-ev-tx">' + esc(L.lbl + (L.sub ? " (" + L.sub + ")" : "")) + '</span>' +
        '<span class="xp-ev-team">' + esc(shortName(team)) + '</span></div>';
    }).join("");
    return '<div class="xp-evs-t">' + T("liveEventsT") + '</div>' + rows;
  }
  function eventsTimelineHTML(m) {
    var li = liveInfoOf(m);
    if (!li || !m.league || !m.ts) return "";
    var k = m.league.i + "|" + m.ts;
    /* wrapper always present while live: async events patch into it */
    return '<div class="xp-evs-wrap" data-lv-evs="' + k + '">' + eventsTimelineInner(m, li) + '</div>';
  }
  /* one-line latest major event for the live card */
  function liveEvLine(m, li) {
    var evs = (li && li.evs) ? li.evs.filter(function (e) { return e.maj; }) : [];
    if (!evs.length) return "";
    var ev = evs[evs.length - 1];
    var L = evLabel(ev);
    var team = ev.side === "h" ? m.home[S.lang] : m.away[S.lang];
    return L.ic + " " + esc(String(ev.m || "")) + " " + esc(shortName(team));
  }
    function liveCardHTML(info) {
    var m = matchByLiveSlugTs(info.slug, info.ts);
    if (!m) return "";
    var l = m.league;
    var lkey = info.slug + "|" + info.ts;
    return '<div class="lv-card" role="button" tabindex="0" data-goto-match="' + m.id + '" data-goto-lg="' + l.i + '" style="--lg:' + l.ac + '">' +
      '<span class="lv-min"><span class="dot"></span>' + esc(String(info.min || "•")) + "</span>" +
      '<span class="lv-t">' + esc(m.home[S.lang]) + ' <b class="lv-score" dir="ltr">' + esc(info.hs + " - " + info.as) + "</b> " + esc(m.away[S.lang]) + "</span>" +
      '<span class="lv-ev" data-lv-ev="' + lkey + '">' + liveEvLine(m, info) + "</span>" +
      '<span class="lv-league">' + esc(shortName(nm(l.n))) + "</span>" +
      "</div>";
  }
  function liveSectionHTML() {
    var live = (global.A7LIVE && S.live) ? global.A7LIVE.all() : [];
    var cards = live.map(liveCardHTML).join("");
    return '<section class="live-sec card" id="live-sec">' +
      '<div class="lv-head">' +
        '<h2 class="lv-title"><span class="lv-pulse' + (live.length ? "" : " off") + '"></span>' +
          T("liveSectionT") + (live.length ? ' <span class="lv-count">' + nfmt(live.length) + "</span>" : "") + "</h2>" +
        '<button class="switch' + (S.live ? " on" : "") + '" data-act="livetoggle" role="switch" ' +
          'aria-checked="' + (S.live ? "true" : "false") + '" aria-label="' + T("liveSwitch") + '"><span class="knob"></span></button>' +
      "</div>" +
      (S.live
        ? (cards ? '<div class="lv-list">' + cards + "</div>" : '<div class="lv-none">' + T("liveNoMatches") + "</div>")
        : '<div class="lv-none">' + T("liveSwitch") + " — " + T("setNotifyOff") + "</div>") +
      "</section>";
  }
  function patchLiveDOM(events) {
    var sec = document.getElementById("live-sec");
    /* patch every live node from the CURRENT state — this covers score
       changes and the async arrival of the events timeline alike */
    (global.A7LIVE ? global.A7LIVE.all() : []).forEach(function (i) {
      var k = i.slug + "|" + i.ts;
      var chips = document.querySelectorAll('[data-lv-min="' + k + '"]');
      for (var c = 0; c < chips.length; c++) chips[c].innerHTML = '<span class="dot"></span>' + esc(String(i.min || ""));
      var scores = document.querySelectorAll('[data-lv-score="' + k + '"]');
      for (var s = 0; s < scores.length; s++) scores[s].textContent = i.hs + " - " + i.as;
      var m = matchByLiveSlugTs(i.slug, i.ts);
      if (m) {
        var wraps = document.querySelectorAll('[data-lv-evs="' + k + '"]');
        for (var w = 0; w < wraps.length; w++) wraps[w].innerHTML = eventsTimelineInner(m, i);
        var lines = document.querySelectorAll('[data-lv-ev="' + k + '"]');
        for (var l2 = 0; l2 < lines.length; l2++) lines[l2].innerHTML = liveEvLine(m, i);
      }
    });
    events.forEach(function (ev) {
      /* a match that just kicked off may be rendered as "upcoming" — refresh its view */
      if (ev.type === "kickoff" && ev.info) {
        var r = parseHash();
        if (r.name === "league" && r.slug === ev.info.slug) render({ keepScroll: true });
      }
    });
    if (sec && S.live) sec.outerHTML = liveSectionHTML();
  }
  function fireNotification(title, body, tag) {
    try {
      if ("Notification" in global && Notification.permission === "granted") {
        new Notification(title, { body: body, tag: tag });
      }
    } catch (e) {}
  }
  function liveNotify(events) {
    if (!S.notify) return;
    events.forEach(function (ev) {
      var m, info = ev.info;
      if ((ev.type === "goal" || ev.type === "kickoff") && info) {
        m = matchByLiveSlugTs(info.slug, info.ts);
        if (!m) return;
      }
      if (ev.type === "goal") {
        /* the in-app toast ALWAYS fires — it works even where the browser
           blocks the Notification API (sandboxed previews, iOS Safari…) */
        toast("⚽ " + T("liveGoal") + " — " + esc(m.home[S.lang]) + ' <b dir="ltr">' +
              esc(info.hs + "-" + info.as) + "</b> " + esc(m.away[S.lang]) +
              (info.min ? ' <span class="lv-ev-min">' + esc(String(info.min)) + "</span>" : ""), "ok");
        fireNotification("⚽ " + T("liveGoal") + " — " + m.home[S.lang] + " " + info.hs + "-" + info.as + " " + m.away[S.lang],
                         nm(m.league.n) + " • " + String(info.min || ""), "g-" + ev.key);
      } else if (ev.type === "kickoff") {
        /* kickoff alerts only for favourite teams — avoids noise */
        if (S.favs.indexOf(m.homeId) < 0 && S.favs.indexOf(m.awayId) < 0) return;
        toast("🔔 " + T("liveKickoff") + " — " + esc(m.home[S.lang]) + " × " + esc(m.away[S.lang]), "ok");
        fireNotification("🔔 " + T("liveKickoff"),
                         m.home[S.lang] + " × " + m.away[S.lang] + " • " + nm(m.league.n), "k-" + ev.key);
      }
    });
  }

  /* ---- "kick-off soon" watcher: favourites starting within 15 min -------
     Fires once per match (dedup survives reloads via localStorage).      */
  var SOON_WIN = 15 * 60 * 1000;
  function soonCheck() {
    if (!S.notify) return;
    var now = Date.now();
    allUpcoming().forEach(function (m) {
      if (!m.ts || m.tbd) return;
      var d = m.ts - now;
      if (d <= 0 || d > SOON_WIN) return;
      if (S.favs.indexOf(m.homeId) < 0 && S.favs.indexOf(m.awayId) < 0) return;
      var kk = "a7soon:" + m.id;
      if (store(kk)) return;
      save(kk, "1");
      var mins = Math.max(1, Math.round(d / 60000));
      var body = T("kickoffSoonBody").replace("{m}", mins)
        .replace("{x}", m.home[S.lang] + " × " + m.away[S.lang]);
      toast("🔔 " + T("kickoffSoon") + " — " + esc(body), "ok");
      fireNotification("🔔 " + T("kickoffSoon"), body, "s-" + m.id);
    });
  }
  var PENDING_MATCH = null;
  function gotoMatch(slug, id) {
    if (parseHash().name === "league" && parseHash().slug === slug) {
      revealMatch(id);
    } else {
      PENDING_MATCH = id;
      location.hash = "#/league/" + slug;
    }
  }
  function revealMatch(id) {
    var row = viewRoot.querySelector('.mr[data-id="' + id + '"]');
    if (!row) return;
    if (!row.classList.contains("open")) toggleXp(id);
    setTimeout(function () {
      try { row.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {}
    }, 80);
  }

  /* ======================== formatting ======================== */
  function loc() { return S.lang === "ar" ? "ar-u-nu-latn" : "en-GB"; }
  function tzOpt() { return S.tz ? { timeZone: S.tz } : {}; }
  function fmtDay(ts) {
    try { return new Intl.DateTimeFormat(loc(), Object.assign({ weekday: "long", day: "numeric", month: "long" }, tzOpt())).format(new Date(ts)); }
    catch (e) { return new Date(ts).toDateString(); }
  }
  function fmtDayShort(ts) {
    try { return new Intl.DateTimeFormat(loc(), Object.assign({ day: "numeric", month: "short" }, tzOpt())).format(new Date(ts)); }
    catch (e) { return ""; }
  }
  function fmtTime(ts) {
    try { return new Intl.DateTimeFormat(loc(), Object.assign({ hour: "2-digit", minute: "2-digit", hour12: S.tf === "12" }, tzOpt())).format(new Date(ts)); }
    catch (e) { return ""; }
  }
  function fmtFull(ts) {
    try { return new Intl.DateTimeFormat(loc(), Object.assign({ weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: S.tf === "12" }, tzOpt())).format(new Date(ts)); }
    catch (e) { return new Date(ts).toISOString(); }
  }
  function tzDay(ts) {
    try {
      var f = new Intl.DateTimeFormat("en-GB", Object.assign({ year: "numeric", month: "2-digit", day: "2-digit" }, tzOpt()));
      var o = {};
      f.formatToParts(new Date(ts)).forEach(function (x) { o[x.type] = x.value; });
      return Date.UTC(+o.year, o.month - 1, +o.day);
    } catch (e) { var d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
  }
  function dayDiff(ts) {
    return Math.round((tzDay(ts) - tzDay(Date.now())) / 86400000);
  }
  function relDay(ts) {
    var d = dayDiff(ts);
    if (d === 0) return T("today");
    if (d === 1) return T("tomorrow");
    if (d === -1) return T("yesterday");
    return null;
  }
  function nfmt(n) {
    try { return new Intl.NumberFormat(S.lang === "ar" ? "ar-u-nu-latn" : "en").format(n); }
    catch (e) { return String(n); }
  }
  function updatedNice() {
    var d = new Date(D.builtAt + "Z");
    try {
      return new Intl.DateTimeFormat(loc(), { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
    } catch (e) { return D.builtAt; }
  }
  function nm(nameObj) { return nameObj ? (nameObj[S.lang] || nameObj.en) : ""; }
  function cityOf(v) {
    if (!v) return "";
    if (S.lang === "ar") return v.ca || v.c || "";
    return v.c || v.ca || "";
  }
  function countryOf(v) {
    if (!v) return "";
    if (S.lang === "ar") return v.coa || v.co || "";
    return v.co || "";
  }
  function fmtRiyadh(ts) {
    try {
      return new Intl.DateTimeFormat(loc(), { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Riyadh" }).format(new Date(ts));
    } catch (e) { return ""; }
  }
  function fmtUTCFull(ts) {
    try {
      return new Intl.DateTimeFormat(loc(), { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }).format(new Date(ts)) + " UTC";
    } catch (e) { return ""; }
  }
  function mapsUrl(v) {
    if (!v) return "";
    if (typeof v.la === "number" && typeof v.lo === "number") {
      return "https://www.google.com/maps/search/?api=1&query=" + v.la + "," + v.lo;
    }
    var q = [v.n, v.c, v.co].filter(Boolean).join(" ");
    return q ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q) : "";
  }
  function s365Url(l) {
    if (!l || !l.u) return "https://www.365scores.com";
    return "https://www.365scores.com/" + (S.lang === "ar" ? "ar" : "en") + "/football/competition/" + l.u;
  }
  function countryAr(co) {
    // translate a broadcaster country name for the Arabic UI
    if (!co || S.lang !== "ar") return co || "";
    var map = {
      "saudi arabia": "السعودية", "qatar": "قطر", "great britain": "بريطانيا",
      "united kingdom": "المملكة المتحدة", "usa": "الولايات المتحدة",
      "united states": "الولايات المتحدة", "australia": "أستراليا",
      "canada": "كندا", "new zealand": "نيوزيلندا", "south africa": "جنوب أفريقيا",
      "nigeria": "نيجيريا", "kenya": "كينيا", "ghana": "غانا", "india": "الهند",
      "ireland": "أيرلندا", "northern ireland": "أيرلندا الشمالية",
      "spain": "إسبانيا", "italy": "إيطاليا", "germany": "ألمانيا", "france": "فرنسا",
      "portugal": "البرتغال", "netherlands": "هولندا", "belgium": "بلجيكا",
      "turkey": "تركيا", "türkiye": "تركيا", "egypt": "مصر", "morocco": "المغرب",
      "tunisia": "تونس", "algeria": "الجزائر", "japan": "اليابان",
      "south korea": "كوريا الجنوبية", "china": "الصين", "brazil": "البرازيل",
      "argentina": "الأرجنتين", "mexico": "المكسيك", "singapore": "سنغافورة",
      "hong kong": "هونغ كونغ", "malaysia": "ماليزيا", "indonesia": "إندونيسيا",
      "thailand": "تايلاند", "philippines": "الفلبين", "vietnam": "فيتنام",
      "israel": "إسرائيل", "uzbekistan": "أوزبكستان", "iran": "إيران"
    };
    return map[String(co).trim().toLowerCase()] || co;
  }

  /* ======================== icons ======================== */
  var I = {
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5 5l1.6 1.6M17.4 17.4 19 19M19 5l-1.6 1.6M6.6 17.4 5 19"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 14.2A8.8 8.8 0 0 1 9.8 3.4a8.8 8.8 0 1 0 10.8 10.8Z"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 2.6 4 5.7 4 9s-1.2 6.4-4 9c-2.8-2.6-4-5.7-4-9s1.2-6.4 4-9Z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6L12 16.9 6.6 19.8l1.1-6-4.5-4.2 6.1-.8Z"/></svg>',
    starO: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6L12 16.9 6.6 19.8l1.1-6-4.5-4.2 6.1-.8Z"/></svg>',
    back: '<svg class="flip-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    chev: '<svg class="flip-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>',
    dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7.5 11.5 12 16l4.5-4.5M4.5 20h15"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.5 1.5"/><path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5L12 17"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-5.3-7-11a7 7 0 0 1 14 0c0 5.7-7 11-7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/></svg>',
    apple: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.7-1.8-3.3-1.8-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.3 2.9 2.3 1.2 0 1.6-.7 3-.7 1.4 0 1.8.7 3 .7 1.2 0 2-1.1 2.8-2.2.9-1.3 1.3-2.5 1.3-2.6-.1 0-2.7-1-2.7-3.8ZM14.2 5.9c.6-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.4-.6.7-1.1 1.8-1 2.9 1.1.1 2.2-.6 2.8-1.3Z"/></svg>',
    outlook: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="13" height="14" rx="2" fill="#0F6CBD"/><path d="M12 12.2 3 8v9a2 2 0 0 0 2 2h6z" fill="#0A5CA8" opacity=".6"/><path d="M12 12.2 3 7V7a2 2 0 0 1 2-2h4z" fill="#28A8EA" opacity=".8"/><path d="M9 9h12v6H9z" fill="#fff" opacity="0"/><path d="m21.5 7.6-8.7-3a1 1 0 0 0-1.3.9v11a1 1 0 0 0 1.3.9l8.7-3a1 1 0 0 0 .7-1V8.6a1 1 0 0 0-.7-1Zm-5.3 7.9-1.8.4V8.1l1.8.4c.5.1.8.5.8 1v5c0 .5-.3.9-.8 1Z" fill="#28A8EA"/></svg>',
    gcal: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M4 4h16v16H4z" opacity="0"/><path fill="#4285F4" d="M12 7h10v10H12z" opacity=".9"/><path fill="#34A853" d="M7 7h5v10H7z" opacity=".9"/><path fill="#FBBC04" d="M7 7h5V2H7z" opacity=".9"/><path fill="#EA4335" d="M2 7h5v10H2z" opacity=".9"/><path fill="#4285F4" d="M12 2h5v5h-5z" opacity=".9"/><path fill="#188038" d="M7 12h5v5H7z" opacity=".9"/><path d="M12 12 7 17h5zM12 12l5-5v5z" fill="#1967D2" opacity=".85"/></svg>',
    ics: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" stroke-width="2"/><path d="M3 9h18" stroke="currentColor" stroke-width="2"/><path d="M8 2.5v4M16 2.5v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="8.5" cy="13.5" r="1.1" fill="currentColor"/><circle cx="12" cy="13.5" r="1.1" fill="currentColor"/><circle cx="15.5" cy="13.5" r="1.1" fill="currentColor"/><circle cx="8.5" cy="16.8" r="1.1" fill="currentColor"/><circle cx="12" cy="16.8" r="1.1" fill="currentColor"/></svg>',
    ball: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7.4 15.6 10l-1.4 4.3h-4.8L8 10Z"/><path d="M12 3v4.4M3.4 9.2 8 10M20.6 9.2 16 10M6.6 19.2l3.2-4.9M17.4 19.2l-3.2-4.9"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v4.5A1.5 1.5 0 0 1 17.5 20h-11A1.5 1.5 0 0 1 5 18.5v-11A1.5 1.5 0 0 1 6.5 6H11"/></svg>',
    tv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6.5" width="18" height="12.5" rx="2.4"/><path d="m8.5 2.5 3.5 4 3.5-4"/><path d="M10.4 10.7v4l3.8-2z" fill="currentColor" stroke="none"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h.01a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/></svg>',
    chevD: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>'
  };

  /* ======================== tiny dom helpers ======================== */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function icon(name, cls) { return '<span class="ic ' + (cls || "") + '">' + I[name] + "</span>"; }
  function img(src, cls, alt) {
    return src ? '<img class="' + (cls || "") + '" src="' + src + '" alt="' + (alt || "") + '" loading="lazy" decoding="async">' : '<span class="' + (cls || "") + ' logo-ph"></span>';
  }

  /* ======================== toast ======================== */
  var toastTimer = null;
  function toast(msg, kind, opts) {
    opts = opts || {};
    var root = document.getElementById("toast-root");
    var tEl = el("div", "toast" + (kind ? " " + kind : "") + (opts.link ? " has-link" : ""));
    tEl.innerHTML = icon(kind === "ok" ? "cal" : "clock") + "<span>" + msg + "</span>";
    root.appendChild(tEl);
    requestAnimationFrame(function () { tEl.classList.add("in"); });
    var life = opts.link ? 12000 : 4200;
    setTimeout(function () {
      tEl.classList.remove("in");
      setTimeout(function () { tEl.remove(); }, 350);
    }, life);
  }

  /* ======================== countdown ticker ======================== */
  function tickCountdowns() {
    var nodes = document.querySelectorAll("[data-cd]");
    if (!nodes.length) return;
    var now = Date.now();
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var until = +n.getAttribute("data-cd");
      var fin = n.getAttribute("data-cd-fin") === "1";
      var diff = until - now;
      var d = n.querySelector("[data-u=d]");
      if (d) {
        var h = n.querySelector("[data-u=h]"),
            m = n.querySelector("[data-u=m]"),
            s = n.querySelector("[data-u=s]");
        if (diff <= 0) {
          n.classList.add("cd-over");
          n.innerHTML = fin ? esc(T("finishedLabel")) : "🔴 " + esc(T("liveNow"));
          continue;
        }
        var dd = Math.floor(diff / 86400000),
            hh = Math.floor(diff / 3600000) % 24,
            mm = Math.floor(diff / 60000) % 60,
            ss = Math.floor(diff / 1000) % 60;
        d.textContent = p2s(dd); h.textContent = p2s(hh);
        m.textContent = p2s(mm); s.textContent = p2s(ss);
      } else {
        if (diff <= 0) { n.textContent = fin ? T("finishedLabel") : "🔴 " + T("liveNow"); continue; }
        n.textContent = miniCountdownText(diff);
      }
    }
  }
  setInterval(tickCountdowns, 1000);

  function p2s(n) { return n < 10 ? "0" + n : "" + n; }

  function miniCountdownText(diff) {
    var d = Math.floor(diff / 86400000), h = Math.floor(diff / 3600000) % 24,
        m = Math.floor(diff / 60000) % 60, s = Math.floor(diff / 1000) % 60;
    var out = [];
    if (d) out.push(d + T("d"));
    if (d || h) out.push(h + T("h"));
    if (!d) out.push(m + T("m"));
    return T("startsIn") + " " + out.join(" ");
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ======================== calendar subjects ======================== */
  function feedBase() {
    /* Build the base from location.href, NOT location.origin: inside
       sandboxed iframes the origin is the opaque string "null", while
       location.href still carries the real URL. */
    var proto = location.protocol;
    if (proto !== "http:" && proto !== "https:") return null;
    var href = location.href.split("#")[0].split("?")[0].replace(/index\.html$/, "");
    var m = href.match(/^(.*\/)/);
    return m ? m[1] : null;
  }

  function feedUrl(rel) {
    /* relative link — works on http(s), sub-paths and file:// alike */
    return rel || "";
  }

  function feedExists(rel) {
    if (!feedBase()) return Promise.resolve(false);
    if (S.feedOK.hasOwnProperty(rel)) return Promise.resolve(S.feedOK[rel]);
    return fetch(rel, { method: "HEAD" }).then(function (r) {
      S.feedOK[rel] = r.ok; return r.ok;
    }).catch(function () { S.feedOK[rel] = false; return false; });
  }

  function leagueSubject(l) {
    var ms = matchesOf(l.i);
    return {
      kind: "league", league: l, matches: ms,
      filename: l.i + "-" + String(l.s).replace("/", "-") + ".ics",
      feedRel: "ics/" + l.i + ".ics",
      label: function () { return nm(l.n); }
    };
  }
  function teamSubject(tid) {
    var l = lgByTeam(tid), t = TEAMS[tid];
    var ms = teamMatchesAll(tid);
    return {
      kind: "team", league: l, team: t, teamId: tid, matches: ms,
      filename: "team-" + tid + "-" + (l ? l.i : "fixtures") + ".ics",
      feedRel: "ics/teams/" + tid + ".ics",
      label: function () { return nm(t.n); }
    };
  }

  function buildICS(subj) {
    var l = subj.league, nameEn, nameAr, dEn, dAr;
    if (subj.kind === "team") {
      var tn = subj.team.n;
      var lgsT = lgsOfTeam(subj.teamId);
      var namesEn = lgsT.map(function (x) { return x.n.en; }).join(" & ");
      var namesAr = lgsT.map(function (x) { return x.n.ar; }).join(" و");
      nameEn = "⚽ " + tn.en + " — " + namesEn + " Fixtures";
      nameAr = tn.ar + " — مباريات " + namesAr;
      dEn = "All " + tn.en + " matches (" + namesEn + ") home & away. " +
        "Exact kickoff times (UTC), stadiums, referees. " +
        "Data source: FotMob (fotmob.com). Arabic names: 365scores.com. Auto-refreshed.";
      dAr = "جميع مباريات " + tn.ar + " (" + namesAr + ") بالديار والخارج " +
        "بالتوقيت الدقيق وتفاصيل الملاعب. مصدر البيانات: FotMob (fotmob.com). الأسماء العربية: 365scores.com.";
    } else {
      nameEn = "⚽ " + l.n.en + " " + l.s + " — Fixtures";
      nameAr = l.n.ar + " " + l.s + " — جدول المباريات";
      dEn = "Full " + l.n.en + " " + l.s + " fixture calendar. Exact kickoff times (UTC), " +
        "stadiums, referees. Data source: FotMob (fotmob.com). Arabic names: 365scores.com.";
      dAr = "تقويم كامل لمباريات " + l.n.ar + " " + l.s +
        " بأوقات دقيقة وتفاصيل الملاعب. مصدر البيانات: FotMob (fotmob.com).";
    }
    /* unscheduled ("يُعلن لاحقاً") matches never enter a calendar file:
       a placeholder date would be wrong */
    var events = subj.matches.filter(function (m) { return m.ts && !m.tbd; }).map(function (m) {
      var ml = m.league || l;
      return A7ICS.matchEvent({
        id: m.id, ts: m.ts, tbd: m.tbd, round: m.round,
        roundLabelEn: m.rl.en, roundLabelAr: m.rl.ar,
        home: m.home, away: m.away, score: m.score,
        finished: m.finished, cancelled: m.cancelled,
        venue: m.venue, referee: m.referee, attendance: m.attendance,
        tv: m.tv || null,
        leagueEn: ml.n.en, leagueAr: ml.n.ar
      });
    });
    return A7ICS.calendar(nameEn, nameAr, dEn, dAr, events);
  }

  function dlFallbackToast(msg, feedRel, icsText) {
    /* after a blob download, also surface a plain <a href download> link:
       in sandboxed iframes blob downloads are blocked, but a real link
       still works via click / right-click "save link as…" */
    var hint = isEmbedded() ? '<i class="toast-hint">' + T("dlFallbackHint") + "</i><br>" : "";
    var finish = function (url) {
      if (url) {
        toast(msg + "<br>" + hint +
          '<a class="toast-link" download href="' + url + '">' + icon("dl") + " " + T("directDl") + "</a>",
          "ok", { link: true });
      } else {
        toast(msg, "ok");
      }
    };
    if (icsText) {
      finish("data:text/calendar;charset=utf-8," + encodeURIComponent(icsText));
    } else if (feedRel) {
      finish(feedRel);   /* relative href — never gated on fetch checks */
    } else {
      finish(null);
    }
  }

  function downloadSubject(subj, fmt) {
    A7ICS.download(subj.filename, buildICS(subj));
    var label = subj.label();
    var key = fmt === "outlook" ? "downloadedOfOutlook" : "downloadedOf";
    var msg = T(key).replace("{x}", "<b>" + esc(label) + "</b>");
    dlFallbackToast(msg, subj.feedRel, null);
  }

  function googleSingleUrl(m) {
    var v = m.venue || {};
    var text = m.home.en + " vs " + m.away.en + " — " + m.league.n.en;
    var details = "⚽ " + m.home.ar + " × " + m.away.ar + "\n🏆 " + m.league.n.ar +
      " — " + m.rl.ar + "\n🏟 " + (v.n || "") + (v.c ? ", " + v.c : "") +
      "\nhttps://www.fotmob.com/match/" + m.id +
      "\nData source: FotMob (fotmob.com)";
    var loc = [v.n, v.c, v.co].filter(Boolean).join(", ");
    return "https://calendar.google.com/calendar/render?action=TEMPLATE" +
      "&text=" + encodeURIComponent(text) +
      "&dates=" + A7ICS.dtUTC(m.ts) + "/" + A7ICS.dtUTC(m.ts + 7200000) +
      "&details=" + encodeURIComponent(details) +
      "&location=" + encodeURIComponent(loc) +
      "&ctz=UTC";
  }

  /* ======================== components ======================== */

  function cdBlock(m) {
    var fin = m.finished ? "1" : "0";
    return '<span class="cd" dir="ltr" data-cd="' + m.ts + '" data-cd-fin="' + fin + '">' +
      '<span class="cd-cell"><b data-u="d">--</b><i>' + T("d") + '</i></span>' +
      '<span class="cd-sep">:</span>' +
      '<span class="cd-cell"><b data-u="h">--</b><i>' + T("h") + '</i></span>' +
      '<span class="cd-sep">:</span>' +
      '<span class="cd-cell"><b data-u="m">--</b><i>' + T("m") + '</i></span>' +
      '<span class="cd-sep">:</span>' +
      '<span class="cd-cell"><b data-u="s">--</b><i>' + T("s") + '</i></span>' +
      "</span>";
  }

  function bannerHTML(m, opts) {
    opts = opts || {};
    var l = m.league;
    var v = m.venue || {};
    var venueLine = v.n ? icon("pin") + " " + esc(v.n) + (cityOf(v) ? " — " + esc(cityOf(v)) : "") : "";
    return '' +
      '<div class="banner" style="--lg:' + l.ac + '">' +
        '<div class="banner-glow"></div>' +
        '<div class="banner-top">' +
          '<span class="chip lg-chip">' + img(lgLogo(l), "lg-chip-logo", nm(l.n)) +
            esc(nm(l.n)) + ' • ' + esc(S.lang === "ar" ? m.rl.ar : m.rl.en) + '</span>' +
          (m.live ? '<span class="chip live-chip"><span class="dot"></span>' + T("liveNow") + '</span>' : "") +
          (m.cancelled ? '<span class="chip canc-chip">' + T("postponed") + '</span>' : "") +
        '</div>' +
        '<div class="banner-teams" data-goto-match="' + m.id + '" data-goto-lg="' + l.i + '" tabindex="0" role="button" title="' + T("expandHint") + '">' +
          '<div class="bteam">' + img(teamLogo(m.homeId), "bteam-logo", m.home[S.lang]) +
            '<span class="bteam-name">' + esc(m.home[S.lang]) + '</span></div>' +
          '<div class="bmid">' +
            (m.finished && m.score
              ? '<div class="bscore" dir="ltr">' + esc(m.score) + '</div>'
              : '<div class="btime" dir="ltr">' + (m.tbd ? T("tbd") : fmtTime(m.ts)) + '</div>') +
            '<div class="bdate">' + (m.tbd ? "" : esc(relDay(m.ts) || fmtDay(m.ts))) + '</div>' +
          '</div>' +
          '<div class="bteam">' + img(teamLogo(m.awayId), "bteam-logo", m.away[S.lang]) +
            '<span class="bteam-name">' + esc(m.away[S.lang]) + '</span></div>' +
        '</div>' +
        (m.tbd || m.finished || !m.ts ? "" :
          '<div class="banner-cd">' + '<span class="cd-label">' + T("startsIn") + '</span>' + cdBlock(m) + '</div>') +
        (venueLine ? '<div class="banner-venue">' + venueLine + '</div>' : "") +
        '<div class="banner-actions">' +
          '<button class="btn btn-grad" data-act="remind" data-id="' + m.id + '" data-lg="' + l.i + '">' +
            icon("bell") + T("remindMe") + '</button>' +
          '<a class="btn btn-ghost" target="_blank" rel="noopener" href="' + googleSingleUrl(m) + '">' +
            icon("gcal") + T("addToGoogle") + '</a>' +
        '</div>' +
      '</div>';
  }

  function stripHTML(list) {
    return '<div class="strip">' + list.map(function (m) {
      var l = m.league;
      var chip = m.tbd ? T("tbd") : (relDay(m.ts) || fmtDayShort(m.ts));
      return '<div class="sc" style="--lg:' + l.ac + '" data-goto-match="' + m.id + '" data-goto-lg="' + l.i + '" tabindex="0" role="button">' +
        '<div class="sc-top">' + img(lgLogo(l), "sc-lg", "") + '<span class="sc-lgname">' + esc(shortName(nm(l.n))) + '</span></div>' +
        '<div class="sc-vs">' +
          '<span class="sc-t">' + img(teamLogo(m.homeId), "sc-logo", m.home[S.lang]) + '<b>' + esc(m.home[S.lang]) + '</b></span>' +
          '<span class="sc-x">×</span>' +
          '<span class="sc-t"><b>' + esc(m.away[S.lang]) + '</b>' + img(teamLogo(m.awayId), "sc-logo", m.away[S.lang]) + '</span>' +
        '</div>' +
        '<div class="sc-when">' +
          '<span class="chip chip-sm">' + esc(chip) + '</span>' +
          (m.tbd ? "" : '<span class="sc-time" dir="ltr">' + fmtTime(m.ts) + '</span>') +
          (m.tbd || m.finished ? "" : '<span class="sc-cd" data-cd="' + m.ts + '" data-cd-fin="' + (m.finished ? "1" : "0") + '"></span>') +
        '</div>' +
        (m.ts && !m.tbd ? '<button class="sc-bell" data-act="remind" data-id="' + m.id + '" data-lg="' + l.i + '" title="' + T("remindMe") + '" aria-label="' + T("remindMe") + '">' + I.bell + '</button>' : "") +
        '</div>';
    }).join("") + '</div>';
  }

  function shortName(s) {
    if (!s) return "";
    if (S.lang === "en") return s.length > 16 ? s.slice(0, 15) + "…" : s;
    return s.length > 14 ? s.slice(0, 13) + "…" : s;
  }

  /* ---- format buttons block (Apple / Outlook / ICS / Google) ---- */
  function formatsHTML(subj) {
    var items = [
      { k: "apple", icon: "apple", t: T("fmtApple"), d: T("fmtAppleD"), cls: "fmt-apple" },
      { k: "outlook", icon: "outlook", t: T("fmtOutlook"), d: T("fmtOutlookD"), cls: "fmt-outlook" },
      { k: "ics", icon: "ics", t: T("fmtICS"), d: T("fmtICSD"), cls: "fmt-ics" },
      { k: "google", icon: "gcal", t: T("fmtGoogle"), d: T("fmtGoogleD"), cls: "fmt-google" }
    ];
    return '<section class="card formats">' +
      '<h3 class="card-title">' + icon("dl") + T("downloadCalendar") + '</h3>' +
      '<p class="card-sub">' + T("downloadCalendarSub") + '</p>' +
      '<div class="fmt-grid">' + items.map(function (it) {
        return '<button class="fmt ' + it.cls + '" data-act="fmt" data-fmt="' + it.k + '" data-kind="' + subj.kind + '" ' +
          (subj.kind === "team" ? 'data-team="' + subj.teamId + '"' : 'data-lg="' + subj.league.i + '"') + '>' +
          '<span class="fmt-ic">' + I[it.icon] + '</span>' +
          '<span class="fmt-tx"><b>' + it.t + '</b><i>' + it.d + '</i></span>' +
          icon("dl", "fmt-dl") + "</button>";
      }).join("") + '</div>' +
    '</section>';
  }

  /* ---- fixtures list ---- */
  function fixturesHTML(matches, opts) {
    opts = opts || {};
    var uniqRounds = [];
    var seen = {};
    matches.forEach(function (m) {
      if (!seen[m.round]) { seen[m.round] = 1; uniqRounds.push(m.round); }
    });
    uniqRounds.sort(function (a, b) {
      var na = parseInt(a, 10), nb = parseInt(b, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return String(a).localeCompare(String(b));
    });

    var curRound = null;
    var upcoming = matches.filter(isUpcoming);
    if (upcoming.length) curRound = upcoming[0].round;

    return '<section class="card fixtures" data-fx="' + (opts.key || "x") + '">' +
      '<div class="fx-head">' +
        '<h3 class="card-title">' + icon("cal") + T("fixtures") +
          '<span class="count-chip">' + nfmt(matches.length) + '</span></h3>' +
        '<div class="fx-filters">' +
          ["all", "upcoming", "finished"].map(function (f) {
            return '<button class="fchip' + (f === "upcoming" ? " on" : "") + '" data-fx-filter="' + f + '">' +
              T("filter" + f.charAt(0).toUpperCase() + f.slice(1)) + '</button>';
          }).join("") +
        '</div>' +
      '</div>' +
      '<div class="fx-hint">' + T("expandHint") + '</div>' +
      '<div class="fx-tools">' +
        '<label class="roundsel"><span>' + T("showAllRounds") + '</span>' +
        '<select class="fx-round">' +
          '<option value="">' + T("showAllRounds") + '</option>' +
          uniqRounds.map(function (r) {
            var rl = roundLabels(r, "", opts.cup);
            return '<option value="' + esc(r) + '">' +
              esc(S.lang === "ar" ? rl.ar : rl.en) + '</option>';
          }).join("") +
        '</select></label>' +
      '</div>' +
      '<div class="fx-list"></div>' +
      '<div class="fx-more-wrap"><button class="btn btn-ghost btn-sm fx-more" hidden>' + T("showMore") + '</button></div>' +
    '</section>';
  }

  function activateFixtures(root, matches, opts) {
    opts = opts || {};
    var listEl = root.querySelector(".fx-list"),
        moreBtn = root.querySelector(".fx-more"),
        filterBtns = root.querySelectorAll("[data-fx-filter]"),
        roundSel = root.querySelector(".fx-round"),
        showLeague = !!opts.showLeague,
        hasFuture = matches.some(function (m) { return !m.finished && !m.cancelled; }),
        state = { filter: hasFuture ? "upcoming" : "all", round: "", limit: 80 };

    function rows() {
      return matches.filter(function (m) {
        if (state.round && String(m.round) !== state.round) return false;
        if (state.filter === "upcoming") return !m.finished && !m.cancelled;
        if (state.filter === "finished") return m.finished || m.cancelled;
        return true;
      });
    }

    function render() {
      var rs = rows();
      var show = rs.slice(0, state.limit);
      listEl.innerHTML = show.length ? show.map(function (m) {
        return matchRowHTML(m, showLeague);
      }).join("") : '<div class="fx-empty">' + T("noMatchesFilter") + '</div>';
      moreBtn.hidden = rs.length <= state.limit;
      moreBtn.textContent = rs.length > state.limit ? T("showMore") + " (" + nfmt(rs.length - state.limit) + ")" : T("showLess");
    }

    filterBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        filterBtns.forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        state.filter = b.getAttribute("data-fx-filter");
        state.limit = 80;
        render();
      });
    });
    if (roundSel) roundSel.addEventListener("change", function () {
      state.round = roundSel.value; state.limit = 80; render();
    });
    moreBtn.addEventListener("click", function () {
      if (moreBtn.getAttribute("data-less") === "1") {
        state.limit = 80; moreBtn.removeAttribute("data-less"); render();
        listEl.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        state.limit += 200;
        var rs = rows();
        if (state.limit >= rs.length) { moreBtn.setAttribute("data-less", "1"); }
        render();
      }
    });
    render();
  }

  /* ---- expandable match rows ---- */
  var XP = {};   // matchId -> true (kept open across re-renders)

  function toggleXp(id) {
    if (XP[id]) delete XP[id]; else XP[id] = true;
    var row = document.querySelector('.mr[data-id="' + id + '"]');
    if (row) {
      row.classList.toggle("open", !!XP[id]);
      row.setAttribute("aria-expanded", XP[id] ? "true" : "false");
    }
  }

  var SURFACE_AR = { "grass": "عشب طبيعي", "hybrid grass": "عشب هجين", "artificial turf": "عشب صناعي", "artificial": "صناعي" };

  function surfaceOf(v) {
    if (!v || !v.su) return "";
    if (S.lang !== "ar") return v.su;
    return SURFACE_AR[String(v.su).toLowerCase()] || v.su;
  }

  function xpItem(k, valHtml) {
    if (!valHtml) return "";
    return '<div class="xp-item"><div class="xp-k">' + k + '</div><div class="xp-v">' + valHtml + "</div></div>";
  }

  function tvBlockHTML(m) {
    var l = m.league;
    var list = m.tv || [];
    var head = '<div class="xp-k tv-h">' + icon("tv") + T("tvChannels") +
      (list.length ? '<span class="tv-count">' + nfmt(list.length) + "</span>" : "") + "</div>";
    if (!list.length) {
      return '<div class="xp-tv">' + head + '<div class="tv-none">' + T("tvNone") + "</div></div>";
    }
    var chips = list.map(function (c) {
      var n = esc((S.lang === "ar" ? (c[0] || c[1]) : (c[1] || c[0])) || "");
      return '<span class="tv-chip" style="--lg:' + l.ac + '">' + n + "</span>";
    }).join("");
    return '<div class="xp-tv">' + head + '<div class="tv-chips">' + chips + "</div>" +
      '<div class="xp-note">' + T("tvSourceNote") + "</div></div>";
  }

  function expandPanelHTML(m) {
    var l = m.league, v = m.venue || {};
    var sep = S.lang === "ar" ? "، " : ", ";
    var g = "";

    if (m.ts && !m.tbd) {
      g += xpItem(T("kickoffLocal"), esc(fmtFull(m.ts)));
    }
    g += xpItem(T("leagueLabel"), esc(nm(l.n)) + " • " + esc(l.s));
    g += xpItem(T("roundLabel"), esc(S.lang === "ar" ? m.rl.ar : m.rl.en));

    if (v.n) {
      var vb = [esc(v.n), cityOf(v) ? esc(cityOf(v)) : "", countryOf(v) ? esc(countryOf(v)) : ""].filter(Boolean).join(sep);
      var cap = v.cp ? '<span class="xp-sub">' + T("capacityLabel") + ": " + nfmt(v.cp) + "</span>" : "";
      var su = v.su ? '<span class="xp-sub">' + T("surfaceLabel") + ": " + esc(surfaceOf(v)) + "</span>" : "";
      var maps = mapsUrl(v) ? '<a class="xp-map" target="_blank" rel="noopener" href="' + esc(mapsUrl(v)) + '">' + icon("pin") + T("openInMaps") + "</a>" : "";
      g += xpItem(T("venueLabel"), vb + (cap || su ? '<span class="xp-subs">' + cap + su + "</span>" : "") + maps);
    }
    if (m.referee) g += xpItem(T("refereeLabel"), esc(m.referee));
    if (m.attendance) g += xpItem(T("attendanceLabel"), nfmt(m.attendance));

    var statusTxt = "";
    if (m.cancelled) statusTxt = T("postponed");
    else if (m.finished) statusTxt = T("finishedLabel");
    else if (m.live) statusTxt = T("liveNow");
    else if (m.tbd || !m.ts) statusTxt = T("tbd");
    else statusTxt = esc(relDay(m.ts) || fmtDay(m.ts));
    g += xpItem(T("statusLabel"), (m.finished && m.score ? '<b class="xp-score" dir="ltr">' + esc(m.score) + "</b>" : "") + statusTxt);

    var acts = '<div class="xp-actions">' +
      (m.ts && !m.tbd ? '<button class="btn btn-ghost btn-sm" data-act="remind" data-id="' + m.id + '" data-lg="' + l.i + '">' +
        icon("bell") + T("remindMe") + "</button>" : "") +
      (m.ts && !m.tbd ? '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="' + googleSingleUrl(m) + '">' +
        icon("gcal") + T("addToGoogle") + "</a>" : "") +
      '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://www.fotmob.com/match/' + m.id + '">' +
        icon("ext") + T("moreOnFotmob") + "</a>" +
      '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="' + esc(s365Url(l)) + '">' +
        icon("ext") + T("viewOn365") + "</a>" +
      "</div>";

    return '<div class="xp-grid">' + g + "</div>" + eventsTimelineHTML(m) + tvBlockHTML(m) + acts;
  }

  function matchRowHTML(m, showLeague) {
    var l = m.league, v = m.venue || {};
    var li = liveInfoOf(m);
    var lkey = m.league ? m.league.i + "|" + m.ts : "";
    var status = "";
    if (m.cancelled) {
      status = '<span class="chip st st-canc">' + T("postponed") + '</span>';
    } else if (m.finished) {
      status = '<span class="chip st st-fin">' + T("finishedLabel") + '</span>';
    } else if (li || m.live) {
      status = '<span class="chip st st-live" data-lv-min="' + lkey + '"><span class="dot"></span>' +
        (li && li.min ? esc(String(li.min)) : T("liveNow")) + '</span>';
    } else if (m.tbd || !m.ts) {
      status = '<span class="chip st st-tbd">' + T("tbd") + '</span>';
    } else {
      var rd = relDay(m.ts);
      status = rd ? '<span class="chip st st-day">' + rd + '</span>' : "";
    }
    var mid = m.finished && m.score
      ? '<span class="mr-score" dir="ltr">' + esc(m.score) + '</span>'
      : (li
         ? '<span class="mr-score lv" dir="ltr" data-lv-score="' + lkey + '">' + esc(li.hs + " - " + li.as) + '</span>'
         : (m.tbd || !m.ts ? '<span class="mr-score muted">–</span>'
            : '<span class="mr-score muted" dir="ltr">' + fmtTime(m.ts) + '</span>'));
    var meta = [];
    if (v.n) meta.push(icon("pin") + " " + esc(v.n) + (cityOf(v) ? "، " + esc(cityOf(v)) : ""));
    meta.push(esc(S.lang === "ar" ? m.rl.ar : m.rl.en));
    if (m.tv && m.tv.length) {
      meta.push('<span class="mr-tv" title="' + T("tvChannels") + '">' + icon("tv") + m.tv.length + "</span>");
    }
    var open = !!XP[m.id];
    return '<div class="mr' + (open ? " open" : "") + '" data-id="' + m.id + '" data-lg="' + l.i +
      '" data-xp="1" tabindex="0" role="button" aria-expanded="' + (open ? "true" : "false") +
      '" title="' + T("expandHint") + '">' +
      '<div class="mr-row">' +
        '<div class="mr-side" style="--lg:' + l.ac + '"></div>' +
        '<div class="mr-main">' +
          '<div class="mr-top">' +
            '<span class="mr-date">' + (m.tbd || !m.ts ? "" : esc(fmtDay(m.ts))) + '</span>' +
            status +
            (showLeague ? '<span class="chip st st-lgleague" style="--lg:' + l.ac + '">' + esc(nm(l.n)) + '</span>' : "") +
          '</div>' +
          '<div class="mr-teams">' +
            '<span class="mr-t">' + img(teamLogo(m.homeId), "mr-logo", m.home[S.lang]) + '<b>' + esc(m.home[S.lang]) + '</b></span>' +
            mid +
            '<span class="mr-t"><b>' + esc(m.away[S.lang]) + '</b>' + img(teamLogo(m.awayId), "mr-logo", m.away[S.lang]) + '</span>' +
          '</div>' +
          (meta.length ? '<div class="mr-meta">' + meta.join('<span class="mr-meta-sep">·</span>') + '</div>' : '') +
        '</div>' +
        '<div class="mr-acts">' +
          (m.ts && !m.tbd ? '<button class="ibtn" data-act="remind" data-id="' + m.id + '" data-lg="' + l.i + '" title="' + T("remindMe") + '" aria-label="' + T("remindMe") + '">' + I.bell + '</button>' : "") +
          '<a class="ibtn" target="_blank" rel="noopener" href="https://www.fotmob.com/match/' + m.id + '" title="' + T("viewOnFotmob") + '" aria-label="' + T("viewOnFotmob") + '">' + I.ext + '</a>' +
          '<span class="ibtn mr-chev" aria-hidden="true">' + I.chevD + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="mr-xp"><div class="mr-xp-in">' + expandPanelHTML(m) + '</div></div>' +
    '</div>';
  }

  /* ======================== views ======================== */
  var viewRoot = document.getElementById("view");

  function crumbs(items) {
    return '<nav class="crumbs" aria-label="breadcrumb">' + items.map(function (it, i) {
      return it.href ? '<a href="' + it.href + '">' + esc(it.label) + '</a>' : '<span>' + esc(it.label) + '</span>';
    }).join('<span class="cr-sep">/</span>') + '</nav>';
  }

  /* ---------- home ---------- */
  function renderHome() {
    var stats = [
      [nfmt(LEAGUES.length), T("statLeagues")],
      [nfmt(Object.keys(TEAMS).length), T("statTeams")],
      [nfmt(totalMatches()), T("statMatches")],
      [nfmt(VENUES.length), T("statStadiums")]
    ];
    var up = allUpcoming();
    var favUp = up.filter(function (m) { return S.favs.indexOf(m.homeId) >= 0 || S.favs.indexOf(m.awayId) >= 0; });
    var banner = favUp[0] || up[0];
    var strip = up.filter(function (m) { return m !== banner; }).slice(0, 14);

    var h = '<section class="view" id="home">';
    h += '<div class="hero">' +
      '<div class="kicker"><span class="dot"></span>' + T("heroKicker") + '</div>' +
      '<h1>' + T("heroTitle") + '</h1>' +
      '<p class="hero-sub">' + T("heroSub") + '</p>' +
      '<div class="stats">' + stats.map(function (s) {
        return '<div class="stat"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>';
      }).join("") + '</div></div>';

    h += liveSectionHTML();

    h += '<div class="card search-wrap">' + icon("search", "search-ic") +
      '<input id="q" type="search" placeholder="' + T("searchPlaceholder") + '" autocomplete="off" aria-label="' + T("searchPlaceholder") + '">' +
      '<div id="q-res" class="q-res" hidden></div></div>';

    if (S.favs.length) {
      h += '<section class="myteams"><div class="sec-h"><h2>' + icon("star") + T("myTeams") + '</h2>' +
        '<span class="sec-sub">' + T("myTeamsSub") + '</span></div>' +
        '<div class="fav-row">' + S.favs.map(function (tid) {
          var t = TEAMS[tid]; if (!t) return "";
          var m = nextByTeam()[tid];
          return '<a class="fav-chip" href="#/team/' + tid + '">' + img(teamLogo(tid), "fav-logo") +
            '<span class="fav-nm">' + esc(nm(t.n)) + '</span>' +
            (m && !m.tbd && m.ts ? '<span class="fav-next" dir="ltr">' + fmtDayShort(m.ts) + ' • ' + fmtTime(m.ts) + '</span>' : "") +
            '<button class="fav-x" data-act="unfav" data-id="' + tid + '" title="' + T("favRemove") + '" aria-label="' + T("favRemove") + '">' + I.x + '</button></a>';
        }).join("") + '</div></section>';
    }

    h += '<section class="reminders">' +
      '<div class="sec-h"><h2>' + icon("bell") + T("remindersTitle") + '</h2>' +
      '<span class="sec-sub">' + (S.favs.length ? T("nextMatchOf") + " — " : "") + T("remindersSub") + '</span></div>' +
      (banner ? bannerHTML(banner, {}) : '<div class="card empty">' + T("noUpcoming") + '</div>') +
      (strip.length ? '<div class="strip-wrap"><div class="strip-title">' + T("upcoming") + '</div>' + stripHTML(strip) + '</div>' : "") +
    '</section>';

    h += '<section class="leagues">' +
      '<div class="sec-h"><h2>' + icon("ball") + T("chooseLeague") + '</h2>' +
      '<span class="sec-sub">' + T("chooseLeagueSub") + '</span></div>' +
      '<div class="lg-grid">' + LEAGUES.slice().sort(function (a, b) {
        var fa = S.lgfavs.indexOf(a.i) >= 0 ? 0 : 1, fb = S.lgfavs.indexOf(b.i) >= 0 ? 0 : 1;
        return fa - fb;
      }).map(function (l) {
        var isLgFav = S.lgfavs.indexOf(l.i) >= 0;
        return '<a class="lg-card" href="#/league/' + l.i + '" data-act="lgopen" data-lg="' + l.i + '" style="--lg:' + l.ac + '">' +
          '<button class="lg-star' + (isLgFav ? " on" : "") + '" data-act="lgfav" data-slug="' + l.i + '" aria-label="' + (isLgFav ? T("favRemove") : T("favAdd")) + '">' +
            (isLgFav ? I.star : I.starO) + '</button>' +
          img(lgLogo(l), "lg-logo", nm(l.n)) +
          '<div class="lg-body">' +
            '<div class="lg-name">' + esc(nm(l.n)) + '</div>' +
            '<div class="lg-meta">' + (flag(l.cc) ? flag(l.cc) + " " : "") + esc(nm(l.c)) + ' • ' + esc(l.s) + '</div>' +
            '<div class="lg-chips"><span class="chip chip-sm">' + nfmt(l.t.length) + " " + T("teamsCount") + '</span>' +
            '<span class="chip chip-sm">' + nfmt(l.m) + " " + T("matchesCount") + '</span></div>' +
          '</div>' + icon("chev", "lg-chev") + '</a>';
      }).join("") + '</div></section>';

    h += footerHTML();
    h += '</section>';
    viewRoot.innerHTML = h;
    activateSearch();
  }

  function totalMatches() {
    var n = 0; LEAGUES.forEach(function (l) { n += l.m; }); return n;
  }

  /* ---------- league calendar ---------- */
  function renderLeague(slug) {
    var l = lg(slug);
    if (!l) return renderHome();
    var matches = matchesOf(slug);
    var subj = leagueSubject(l);
    var nm2 = nextOfLeague(slug);

    var h = '<section class="view">';
    h += crumbs([{ label: T("home"), href: "#/" }, { label: nm(l.n) }]);
    h += '<header class="card entity-hero" style="--lg:' + l.ac + '">' +
      img(lgLogo(l), "eh-logo", nm(l.n)) +
      '<div class="eh-body"><h1>' + esc(nm(l.n)) + '</h1>' +
      '<div class="eh-meta">' + (flag(l.cc) ? flag(l.cc) + " " : "") + esc(nm(l.c)) + ' • ' + T("seasonLabel") + ' ' + esc(l.s) +
      ' • ' + nfmt(l.t.length) + " " + T("teamsCount") + ' • ' + nfmt(l.m) + " " + T("matchesCount") + '</div></div></header>';

    if (nm2) h += '<div class="sec-h slim"><h2>' + icon("bell") + T("nextMatch") + '</h2></div>' + bannerHTML(nm2);
    h += formatsHTML(subj);
    h += fixturesHTML(matches, { key: slug, cup: !!l.cup });
    h += footerHTML();
    h += '</section>';
    viewRoot.innerHTML = h;
    activateFixtures(viewRoot, matches, {});
    if (PENDING_MATCH) {
      var pm = PENDING_MATCH;
      PENDING_MATCH = null;
      setTimeout(function () { revealMatch(pm); }, 60);
    }
  }

  /* ---------- teams grid ---------- */
  function renderTeams(slug) {
    var l = lg(slug);
    if (!l) return renderHome();
    var teams = l.t.map(function (tid) { return { id: tid, t: TEAMS[tid] }; })
      .filter(function (x) { return x.t; });
    teams.sort(function (a, b) {
      return nm(a.t.n).localeCompare(nm(b.t.n), S.lang === "ar" ? "ar" : "en");
    });
    var nb = nextByTeam();

    var h = '<section class="view">';
    h += crumbs([{ label: T("home"), href: "#/" }, { label: nm(l.n), href: "#/league/" + l.i }, { label: T("chooseTeam") }]);
    h += '<header class="card entity-hero" style="--lg:' + l.ac + '">' +
      img(lgLogo(l), "eh-logo", nm(l.n)) +
      '<div class="eh-body"><h1>' + esc(nm(l.n)) + '</h1>' +
      '<div class="eh-meta">' + (flag(l.cc) ? flag(l.cc) + " " : "") + esc(nm(l.c)) + ' • ' + esc(l.s) +
      ' • ' + nfmt(teams.length) + " " + T("teamsCount") + '</div></div></header>';

    h += '<div class="sec-h"><h2>' + icon("star") + T("chooseTeam") + '</h2><span class="sec-sub">' + T("chooseTeamSub") + '</span></div>';
    h += '<div class="card search-wrap sm">' + icon("search", "search-ic") +
      '<input id="tq" type="search" placeholder="' + T("searchTeam") + '" autocomplete="off"></div>';
    h += '<div class="t-grid" id="t-grid">' + teams.map(function (x) {
      var m = nb[x.id];
      var isFav = S.favs.indexOf(x.id) >= 0;
      return '<div class="t-card" tabindex="0" role="button" data-goto="#/team/' + x.id + '" style="--lg:' + l.ac + '">' +
        '<button class="t-star' + (isFav ? " on" : "") + '" data-act="fav" data-id="' + x.id + '" aria-label="' + (isFav ? T("favRemove") : T("favAdd")) + '">' +
          (isFav ? I.star : I.starO) + '</button>' +
        img(teamLogo(x.id), "t-logo", nm(x.t.n)) +
        '<div class="t-name">' + esc(nm(x.t.n)) + '</div>' +
        '<div class="t-next">' + (m
          ? T("next") + ': ' + esc(nm(TEAMS[m.homeId === x.id ? m.awayId : m.homeId].n)) +
            (m.tbd || !m.ts ? "" : ' • <span dir="ltr">' + (relDay(m.ts) || fmtDayShort(m.ts)) + " " + fmtTime(m.ts) + '</span>')
          : "") + '</div>' +
      '</div>';
    }).join("") + '</div>';
    h += footerHTML();
    h += '</section>';
    viewRoot.innerHTML = h;

    var tq = document.getElementById("tq");
    var grid = document.getElementById("t-grid");
    tq.addEventListener("input", function () {
      var q = tq.value.trim().toLowerCase();
      var cards = grid.querySelectorAll(".t-card");
      var any = false;
      cards.forEach(function (c) {
        var nmz = c.querySelector(".t-name").textContent.toLowerCase();
        var show = !q || nmz.indexOf(q) >= 0;
        c.style.display = show ? "" : "none";
        if (show) any = true;
      });
      var none = grid.querySelector(".t-none");
      if (!any) {
        if (!none) { none = el("div", "t-none fx-empty"); none.textContent = T("searchNoResults"); grid.appendChild(none); }
      } else if (none) none.remove();
    });
  }

  /* ---------- team page ---------- */
  function renderTeam(tid) {
    var t = TEAMS[tid];
    if (!t) return renderHome();
    var l = lgByTeam(tid);
    var lgsT = lgsOfTeam(tid);
    var subj = teamSubject(tid);
    var ms = subj.matches;
    var nextM = ms.filter(isUpcoming).sort(function (a, b) { return a.ts - b.ts; })[0] || null;
    var isFav = S.favs.indexOf(tid) >= 0;

    var h = '<section class="view">';
    h += crumbs([{ label: T("home"), href: "#/" }, { label: nm(l.n), href: "#/league/" + l.i }, { label: nm(t.n) }]);
    h += '<header class="card entity-hero team-hero" style="--lg:' + l.ac + '">' +
      img(teamLogo(tid), "eh-logo big", nm(t.n)) +
      '<div class="eh-body"><h1>' + esc(nm(t.n)) + '</h1>' +
      '<div class="eh-meta">' + lgsT.map(function (x) {
        return '<a class="lg-link" href="#/league/' + x.i + '">' + img(lgLogo(x), "eh-lgl") + " " + esc(nm(x.n)) + "</a>";
      }).join('<span class="mr-meta-sep">•</span>') + ' • ' + nfmt(ms.length) + " " + T("matchesCount") + '</div></div>' +
      '<button class="btn btn-ghost btn-sm fav-btn' + (isFav ? " on" : "") + '" data-act="fav" data-id="' + tid + '">' +
        (isFav ? icon("star") + T("myTeams") : icon("starO") + T("favAdd")) + '</button></header>';

    if (nextM) h += '<div class="sec-h slim"><h2>' + icon("bell") + T("nextMatch") + '</h2></div>' + bannerHTML(nextM);
    h += formatsHTML(subj);

    if (lgsT.length > 1) {
      h += '<div class="lg-filters" id="team-lgf">' +
        '<button class="fchip on" data-team-lg="*">' + T("filterAll") + '</button>' +
        lgsT.map(function (x) {
          return '<button class="fchip" data-team-lg="' + x.i + '">' + esc(nm(x.n)) + '</button>';
        }).join("") + '</div>';
    }
    h += '<div id="team-fx"></div>';
    h += footerHTML();
    h += '</section>';
    viewRoot.innerHTML = h;

    var fxWrap = document.getElementById("team-fx");
    function mountFx(leagueSlug) {
      var subset = leagueSlug ? ms.filter(function (m) { return m.league.i === leagueSlug; }) : ms;
      fxWrap.innerHTML = fixturesHTML(subset, { key: "team" + tid + (leagueSlug || "") });
      activateFixtures(fxWrap, subset, { showLeague: !leagueSlug });
    }
    mountFx(null);
    var lgf = document.getElementById("team-lgf");
    if (lgf) lgf.addEventListener("click", function (e) {
      var chip = e.target.closest ? e.target.closest("[data-team-lg]") : null;
      if (!chip) return;
      e.preventDefault();
      lgf.querySelectorAll("[data-team-lg]").forEach(function (c) { c.classList.remove("on"); });
      chip.classList.add("on");
      var v = chip.getAttribute("data-team-lg");
      mountFx(v === "*" ? null : v);
    });
  }

  /* ---------- footer ---------- */
  function footerHTML() {
    return '<footer class="foot">' +
      '<div class="foot-grid">' +
        '<div class="foot-col"><b class="foot-brand">' + icon("ball") + T("brand") + '</b>' +
          '<p>' + T("footerAbout") + '</p></div>' +
        '<div class="foot-col"><b>' + T("dataSources") + '</b>' +
          '<ul class="foot-links">' +
            '<li><a href="https://www.fotmob.com" target="_blank" rel="noopener">' + T("sourcePrimary") + '</a></li>' +
            '<li><a href="https://www.365scores.com" target="_blank" rel="noopener">' + T("sourceSecondary") + '</a></li>' +
          '</ul></div>' +
        '<div class="foot-col"><b>' + T("lastUpdate") + '</b>' +
          '<p class="foot-upd" dir="auto">' + esc(updatedNice()) + '</p>' +
          '<p class="foot-note">' + icon("clock") + T("autoUpdateNote") + '</p>' +
          '<p class="foot-note">' + T("localTimeNote") + '</p></div>' +
      '</div>' +
      '<div class="foot-bottom"><span>' + T("disclaimer") + '</span><span>' + T("madeWith") + '</span></div>' +
    '</footer>';
  }

  /* ======================== settings sheet ======================== */
  function segHTML(id, opts, current) {
    return '<div class="seg" id="' + id + '">' + opts.map(function (o) {
      return '<button type="button" class="seg-btn' + (o.v === current ? " on" : "") + '" data-v="' + o.v + '">' + o.t + "</button>";
    }).join("") + "</div>";
  }

  function openSettings() {
    closeSheet();
    var root = document.getElementById("sheet-root");
    var bk = el("div", "sheet-backdrop");
    var sheet = el("div", "sheet settings-sheet");
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    bk.appendChild(sheet);
    root.appendChild(bk);
    requestAnimationFrame(function () { bk.classList.add("in"); });
    document.body.classList.add("sheet-open");
    bk.addEventListener("click", function (e) { if (e.target === bk) closeSheet(); });
    document.addEventListener("keydown", escClose);

    /* re-render the page BEHIND the open sheet, then rebuild the sheet
       contents in place — changing a setting must never close the modal */
    function refreshSheet() {
      var st = sheet.scrollTop;
      render({ keepScroll: true, keepSheet: true });
      buildSettingsContent();
      sheet.scrollTop = st;
    }

    function buildSettingsContent() {
      sheet.setAttribute("aria-label", T("settingsTitle"));

      var TZ = [
        { v: "", ar: "توقيت جهازك", en: "Device timezone" },
        { v: "Asia/Riyadh", ar: "الرياض (GMT+3)", en: "Riyadh (GMT+3)" },
        { v: "GMT", ar: "GMT / UTC", en: "GMT / UTC" },
        { v: "Africa/Cairo", ar: "القاهرة", en: "Cairo" },
        { v: "Asia/Dubai", ar: "دبي", en: "Dubai" },
        { v: "Europe/London", ar: "لندن", en: "London" },
        { v: "Europe/Paris", ar: "باريس", en: "Paris" },
        { v: "America/New_York", ar: "نيويورك", en: "New York" }
      ];

      var favChips = S.favs.map(function (tid) {
        var t = TEAMS[tid]; if (!t) return "";
        return '<span class="fav-mchip">' + img(teamLogo(tid), "fmc-logo", nm(t.n)) + esc(nm(t.n)) +
          '<button class="fmc-x" data-unfav="' + tid + '" aria-label="' + T("favRemove") + '">' + I.x + "</button></span>";
      }).join("");
      var lgChips = S.lgfavs.map(function (slug) {
        var l = lg(slug); if (!l) return "";
        return '<span class="fav-mchip lg" style="--lg:' + l.ac + '">' + esc(nm(l.n)) +
          '<button class="fmc-x" data-unfavlg="' + slug + '" aria-label="' + T("favRemove") + '">' + I.x + "</button></span>";
      }).join("");

      sheet.innerHTML =
        '<div class="sheet-head">' +
          '<span class="so-ic so-full">' + I.gear + "</span>" +
          '<div class="sh-tx"><h3>' + T("settingsTitle") + '</h3></div>' +
          '<button class="ibtn sheet-x" aria-label="' + T("close") + '">' + I.x + "</button></div>" +

        '<div class="set-row"><div class="set-l"><b>' + T("setLanguage") + "</b></div>" +
          segHTML("seg-lang", [{ v: "ar", t: "العربية" }, { v: "en", t: "English" }], S.lang) + "</div>" +

        '<div class="set-row"><div class="set-l"><b>' + T("setTheme") + "</b></div>" +
          segHTML("seg-theme", [{ v: "dark", t: T("themeDark") }, { v: "light", t: T("themeLight") }], S.theme) + "</div>" +

        '<div class="set-row"><div class="set-l"><b>' + T("setTimeFmt") + "</b></div>" +
          segHTML("seg-tf", [{ v: "24", t: T("hour24") }, { v: "12", t: T("hour12") }], S.tf) + "</div>" +

        '<div class="set-row"><div class="set-l"><b>' + T("setTz") + "</b>" +
          '<select id="set-tz" class="set-select">' + TZ.map(function (z) {
            return '<option value="' + z.v + '"' + (S.tz === z.v ? " selected" : "") + ">" + (S.lang === "ar" ? z.ar : z.en) + "</option>";
          }).join("") + "</select></div>" +

        '<div class="set-row"><div class="set-l"><b>' + T("setNotify") + "</b>" +
          '<i class="set-sub">' + T("setNotifySub") + "</i></div>" +
          '<button class="switch' + (S.notify ? " on" : "") + '" id="set-notify" role="switch" aria-checked="' + (S.notify ? "true" : "false") + '"><span class="knob"></span></button></div>' +

        '<div class="set-row col"><div class="set-l"><b>' + T("setFavs") + "</b>" +
          '<i class="set-sub">' + T("setFavsSub") + "</i></div>" +
          '<div class="fav-mgrid">' + (favChips + lgChips || '<span class="lv-none">' + T("noFavs") + "</span>") + "</div></div>";

      sheet.querySelector(".sheet-x").addEventListener("click", closeSheet);

      function segBind(id, fn) {
        var seg = sheet.querySelector("#" + id);
        if (!seg) return;
        seg.addEventListener("click", function (e) {
          var b = e.target.closest ? e.target.closest(".seg-btn") : null;
          if (!b) return;
          seg.querySelectorAll(".seg-btn").forEach(function (x) { x.classList.remove("on"); });
          b.classList.add("on");
          fn(b.getAttribute("data-v"));
          refreshSheet();
        });
      }
      segBind("seg-lang", function (v) { S.lang = v; save("a7lang", v); document.getElementById("lang-btn").textContent = T("langToggle"); });
      segBind("seg-theme", function (v) {
        S.theme = v; save("a7theme", v);
        applyTheme();
        var tb = document.getElementById("theme-btn");
        tb.innerHTML = S.theme === "dark" ? I.sun : I.moon;
      });
      segBind("seg-tf", function (v) { S.tf = v; save("a7tf", v); });

      sheet.querySelector("#set-tz").addEventListener("change", function (e) {
        S.tz = e.target.value;
        save("a7tz", S.tz);
        refreshSheet();
      });

      sheet.querySelector("#set-notify").addEventListener("click", function () {
        var btn = this;
        if (S.notify) {
          S.notify = false; save("a7notify", "0");
          btn.classList.remove("on"); btn.setAttribute("aria-checked", "false");
          return;
        }
        /* in-app alerts need no permission and work everywhere — on by default */
        S.notify = true; save("a7notify", "1");
        btn.classList.add("on"); btn.setAttribute("aria-checked", "true");
        toast(T("notifyInApp"), "ok");
        /* browser-level notifications are a bonus on top of the toasts */
        if ("Notification" in global && Notification.permission === "default") {
          try {
            Notification.requestPermission().then(function (p) {
              if (p === "granted") fireNotification("✅ " + T("settingsTitle"), T("setNotifyOn"));
            }).catch(function () {});
          } catch (e) {}
        }
      });

    }

    /* favourite removal lives on the persistent sheet element (bound once —
       the content above is rebuilt on every settings change) */
    sheet.addEventListener("click", function (e) {
      var uf = e.target.closest ? e.target.closest("[data-unfav]") : null;
      if (uf) { toggleFav(uf.getAttribute("data-unfav"), { keepSheet: true }); refreshSheet(); return; }
      var ul = e.target.closest ? e.target.closest("[data-unfavlg]") : null;
      if (ul) {
        var ix = S.lgfavs.indexOf(ul.getAttribute("data-unfavlg"));
        if (ix >= 0) S.lgfavs.splice(ix, 1);
        save("a7lgfavs", JSON.stringify(S.lgfavs));
        refreshSheet();
      }
    });

    buildSettingsContent();
  }

  /* ======================== league options sheet ======================== */
  function openLeagueSheet(slug) {
    var l = lg(slug);
    if (!l) return;
    closeSheet();
    var root = document.getElementById("sheet-root");
    var bk = el("div", "sheet-backdrop");
    var sheet = el("div", "sheet");
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-label", nm(l.n));
    sheet.innerHTML =
      '<div class="sheet-head">' + img(lgLogo(l), "eh-logo", nm(l.n)) +
        '<div class="sh-tx"><h3>' + esc(nm(l.n)) + '</h3>' +
        '<div class="sh-meta">' + (flag(l.cc) ? flag(l.cc) + " " : "") + esc(nm(l.c)) + ' • ' + esc(l.s) + ' • ' + nfmt(l.m) + " " + T("matchesCount") + '</div></div>' +
        '<button class="ibtn sheet-x" aria-label="' + T("close") + '">' + I.x + '</button></div>' +
      '<div class="sheet-title">' + T("whatToDownload") + '</div>' +
      '<a class="sheet-opt" href="#/league/' + l.i + '">' +
        '<span class="so-ic so-full">' + I.cal + '</span>' +
        '<span class="so-tx"><b>' + T("optFullTitle") + '</b><i>' + T("optFullDesc").replace("{n}", nfmt(l.m)) + '</i></span>' +
        icon("chev") + '</a>' +
      '<a class="sheet-opt" href="#/teams/' + l.i + '">' +
        '<span class="so-ic so-team">' + I.star + '</span>' +
        '<span class="so-tx"><b>' + T("optTeamTitle") + '</b><i>' + T("optTeamDesc").replace("{n}", nfmt(l.t.length)) + '</i></span>' +
        icon("chev") + '</a>';
    bk.appendChild(sheet);
    root.appendChild(bk);
    requestAnimationFrame(function () { bk.classList.add("in"); });
    document.body.classList.add("sheet-open");
    bk.addEventListener("click", function (e) { if (e.target === bk) closeSheet(); });
    sheet.querySelector(".sheet-x").addEventListener("click", closeSheet);
    document.addEventListener("keydown", escClose);
  }
  function escClose(e) { if (e.key === "Escape") closeSheet(); }
  function closeSheet() {
    var root = document.getElementById("sheet-root");
    root.innerHTML = "";
    document.body.classList.remove("sheet-open");
    document.removeEventListener("keydown", escClose);
  }

  /* ======================== search (home) ======================== */
  function activateSearch() {
    var q = document.getElementById("q"), res = document.getElementById("q-res");
    if (!q) return;
    q.addEventListener("input", function () {
      var v = q.value.trim().toLowerCase();
      if (v.length < 1) { res.hidden = true; res.innerHTML = ""; return; }
      var lgs = LEAGUES.filter(function (l) {
        return nm(l.n).toLowerCase().indexOf(v) >= 0 || nm(l.c).toLowerCase().indexOf(v) >= 0 ||
               l.n.en.toLowerCase().indexOf(v) >= 0;
      }).slice(0, 5);
      var tms = [];
      for (var tid in TEAMS) {
        var t = TEAMS[tid];
        if (nm(t.n).toLowerCase().indexOf(v) >= 0 || t.n.en.toLowerCase().indexOf(v) >= 0) tms.push(tid);
        if (tms.length >= 12) break;
      }
      var h = "";
      if (lgs.length) {
        h += '<div class="q-sec">' + T("searchLeagues") + '</div>' + lgs.map(function (l) {
          return '<a class="q-row" data-act="lgopen" data-lg="' + l.i + '" href="#/league/' + l.i + '">' +
            img(lgLogo(l), "q-logo") + '<span>' + esc(nm(l.n)) + '</span>' +
            '<span class="q-meta">' + esc(nm(l.c)) + '</span></a>';
        }).join("");
      }
      if (tms.length) {
        h += '<div class="q-sec">' + T("searchTeams") + '</div>' + tms.map(function (tid) {
          var t = TEAMS[tid], l = lgByTeam(tid);
          return '<a class="q-row" href="#/team/' + tid + '">' + img(teamLogo(tid), "q-logo") +
            '<span>' + esc(nm(t.n)) + '</span><span class="q-meta">' + esc(nm(l.n)) + '</span></a>';
        }).join("");
      }
      res.innerHTML = h || '<div class="q-none">' + T("searchNoResults") + '</div>';
      res.hidden = false;
    });
  }

  /* ======================== download actions ======================== */
  function findMatch(id, slug) {
    var ms = matchesOf(slug);
    for (var i = 0; i < ms.length; i++) if (ms[i].id === String(id)) return ms[i];
    return null;
  }

  function downloadMatchReminder(m) {
    if (!m.ts || m.tbd) { toast(T("tbd"), "err"); return; }
    var l = m.league;
    var ics = A7ICS.calendar(
      "⚽ " + m.home.en + " vs " + m.away.en + " — " + l.n.en,
      m.home.ar + " × " + m.away.ar + " — " + l.n.ar,
      "Match reminder. Kick-off " + new Date(m.ts).toUTCString() +
        ". Stadium: " + ((m.venue || {}).n || "—") +
        ". Data source: FotMob (fotmob.com). Arabic names: 365scores.com.",
      "تذكير بمباراة " + m.home.ar + " و" + m.away.ar + " في " + l.n.ar +
        ". مصدر البيانات: FotMob (fotmob.com). الأسماء العربية: 365scores.com.",
      [A7ICS.matchEvent({
        id: m.id, ts: m.ts, tbd: m.tbd, roundLabelEn: m.rl.en, roundLabelAr: m.rl.ar,
        home: m.home, away: m.away, score: m.score, finished: m.finished,
        cancelled: m.cancelled, venue: m.venue, referee: m.referee,
        attendance: m.attendance, leagueEn: l.n.en, leagueAr: l.n.ar,
        tv: m.tv
      })]
    );
    A7ICS.download("reminder-" + m.id + ".ics", ics);
    dlFallbackToast(T("reminderDone"), null, ics);
  }

  function isEmbedded() {
    /* integrators can force the embedded behaviour with A7FORCE_EMBED */
    if (typeof global.A7FORCE_EMBED === "boolean") return global.A7FORCE_EMBED;
    try { return global.self !== global.top; } catch (e) { return true; }
  }

  function isAppleDevice() {
    var ua = (navigator && (navigator.userAgent || "")) || "";
    return /iPhone|iPad|iPod|Macintosh|Mac OS X/i.test(ua);
  }

  /* ---- per-format "how to add" sheet ---- */
  function fsUrlRow(url) {
    return '<div class="sub-row"><input class="sub-url" readonly dir="ltr" value="' + esc(url) + '">' +
      '<button class="btn btn-ghost btn-sm" data-act="copy">' + icon("copy") + T("copyLink") + '</button></div>';
  }

  function fsFileSection(subj, noteHtml) {
    return '<div class="fs-sec">' +
      '<div class="fs-sec-t">' + icon("dl") + T("fileSectionT") + '</div>' +
      '<div class="fs-actions">' +
        '<button class="btn btn-grad" data-act="fmtfile" data-kind="' + subj.kind + '" ' +
          (subj.kind === "team" ? 'data-team="' + subj.teamId + '"' : 'data-lg="' + subj.league.i + '"') + '>' +
          icon("dl") + T("dlFileNow") + '</button>' +
        '<a class="btn btn-ghost" href="' + esc(feedUrl(subj.feedRel)) + '" download="' + esc(subj.filename) + '">' +
          icon("link") + T("directDl") + '</a>' +
      '</div>' +
      (noteHtml ? '<p class="fs-note">' + noteHtml + '</p>' : "") +
      (isEmbedded() ? '<p class="fs-note warn">' + icon("clock") + T("embeddedNote") + '</p>' : "") +
      '</div>';
  }

  function openFormatSheet(fmt, subj) {
    closeSheet();
    var root = document.getElementById("sheet-root");
    var bk = el("div", "sheet-backdrop");
    var sheet = el("div", "sheet fs-sheet");
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    var base = feedBase();
    var feedUrlAbs = base ? base + subj.feedRel : "";
    var webcal = feedUrlAbs ? feedUrlAbs.replace(/^https/, "webcal") : "";
    var gurl = feedUrlAbs ? "https://calendar.google.com/calendar/render?cid=" + encodeURIComponent(feedUrlAbs) : "";

    var meta = {
      apple:   { icon: I.apple, t: T("fmtApple") },
      google:  { icon: I.gcal, t: T("fmtGoogle") },
      outlook: { icon: I.outlook, t: T("fmtOutlook") },
      ics:     { icon: I.ics, t: T("fmtICS") }
    }[fmt] || { icon: I.cal, t: T("downloadCalendar") };

    var h = '<div class="sheet-head">' +
      '<span class="fs-ic">' + meta.icon + '</span>' +
      '<div class="sh-tx"><h3>' + esc(meta.t) + '</h3>' +
      '<div class="sh-meta">' + esc(subj.label()) + " • " + esc(T("fmtSheetHow")) + '</div></div>' +
      '<button class="ibtn sheet-x" aria-label="' + T("close") + '">' + I.x + '</button></div>';

    if (fmt === "apple") {
      h += '<div class="fs-sec">' +
        '<div class="fs-sec-t">' + icon("link") + T("subSectionT") + '</div>' +
        (webcal ? fsUrlRow(webcal) : '<p class="fs-note">' + T("hostedNote") + '</p>') +
        (webcal ? '<div class="fs-actions"><a class="btn btn-grad" href="' + esc(webcal) + '">' +
          icon("apple") + T("subNowApple") + '</a></div>' : "") +
        '<p class="fs-note">' + T("appleOtherNote") + " " + T("autoUpdatesNote") + '</p>' +
        '</div>';
      h += fsFileSection(subj, T("icsAnyAppNote"));
    } else if (fmt === "google") {
      h += '<div class="fs-sec">' +
        '<div class="fs-sec-t">' + icon("link") + T("subSectionT") + '</div>' +
        (gurl ? '<div class="fs-actions"><a class="btn btn-grad" target="_blank" rel="noopener" href="' + esc(gurl) + '">' +
          icon("gcal") + T("openGoogleNow") + '</a></div>' : "") +
        (feedUrlAbs ? fsUrlRow(feedUrlAbs) : '<p class="fs-note">' + T("hostedNote") + '</p>') +
        '<p class="fs-note">' + T("googleManualNote") + " " + T("autoUpdatesNote") + '</p>' +
        '</div>';
      h += fsFileSection(subj, T("googleHint"));
    } else if (fmt === "outlook") {
      h += '<div class="fs-sec">' +
        '<div class="fs-sec-t">' + icon("link") + T("subSectionT") + '</div>' +
        (feedUrlAbs ? fsUrlRow(feedUrlAbs) : '<p class="fs-note">' + T("hostedNote") + '</p>') +
        '<p class="fs-note">' + T("outlookWebNote") + " " + T("autoUpdatesNote") + '</p>' +
        '</div>';
      h += fsFileSection(subj, T("outlookPcNote"));
    } else {
      h += fsFileSection(subj, T("icsAnyAppNote"));
    }

    sheet.innerHTML = h;
    bk.appendChild(sheet);
    root.appendChild(bk);
    requestAnimationFrame(function () { bk.classList.add("in"); });
    document.body.classList.add("sheet-open");
    bk.addEventListener("click", function (e) { if (e.target === bk) closeSheet(); });
    sheet.querySelector(".sheet-x").addEventListener("click", closeSheet);
    document.addEventListener("keydown", escClose);

  }

  function doFormat(fmt, kind, lgSlug, teamId) {
    var subj = kind === "team" ? teamSubject(teamId) : leagueSubject(lg(lgSlug));
    if (!subj) return;
    var base = feedBase();

    /* ICS / Outlook: file download (or the how-to sheet when embedded) */
    if (fmt === "ics" || fmt === "outlook") {
      if (isEmbedded()) openFormatSheet(fmt, subj);
      else downloadSubject(subj, fmt);
      return;
    }
    /* Apple: webcal:// subscription — fired synchronously to keep the
       user gesture (protocol launches lose it inside a promise) */
    if (fmt === "apple") {
      if (base && !isEmbedded() && isAppleDevice()) {
        location.href = base.replace(/^https/, "webcal") + subj.feedRel;
        toast(T("openedWebcal"));
      } else {
        openFormatSheet("apple", subj);
      }
      return;
    }
    /* Google: add-by-URL — synchronous window.open keeps the gesture */
    if (fmt === "google") {
      if (base && !isEmbedded()) {
        var gurl = "https://calendar.google.com/calendar/render?cid=" +
          encodeURIComponent(base + subj.feedRel);
        var w = null;
        try { w = global.open(gurl, "_blank"); } catch (e) { w = null; }
        if (w) { toast(T("googleOpened")); return; }
      }
      openFormatSheet("google", subj);
    }
  }
  function outlookHint() { return T("downloaded"); }

  /* ======================== router ======================== */
  function parseHash() {
    var h = location.hash.replace(/^#\/?/, "");
    if (!h) return { name: "home" };
    var parts = h.split("/").map(decodeURIComponent);
    if (parts[0] === "league" && parts[1]) return { name: "league", slug: parts[1] };
    if (parts[0] === "teams" && parts[1]) return { name: "teams", slug: parts[1] };
    if (parts[0] === "team" && parts[1]) return { name: "team", id: parts[1] };
    return { name: "home" };
  }

  function render(opts) {
    opts = opts || {};
    var keep = !!opts.keepScroll;
    /* save the scroll position before re-rendering so in-page controls
       (language / favourites) never yank the user back to the top */
    var sy = keep ? (global.scrollY || document.documentElement.scrollTop || 0) : 0;
    NOW = Date.now();
    _allUp = null; _nextByTeam = null;
    if (!opts.keepSheet) closeSheet();
    var r = parseHash();
    if (r.name === "league") renderLeague(r.slug);
    else if (r.name === "teams") renderTeams(r.slug);
    else if (r.name === "team") renderTeam(r.id);
    else renderHome();
    applyLangMeta();
    tickCountdowns();
    if (keep) {
      global.scrollTo({ top: sy, behavior: "instant" });
    } else {
      global.scrollTo({ top: 0, behavior: "instant" });
    }
  }

  function applyLangMeta() {
    document.documentElement.lang = S.lang;
    document.documentElement.dir = S.lang === "ar" ? "rtl" : "ltr";
    var bn = document.getElementById("brand-name"),
        bs = document.getElementById("brand-sub");
    if (bn) bn.textContent = T("brand");
    if (bs) bs.textContent = S.lang === "ar" ? "League Calendars" : "تقاويم الدوريات";
    var r = parseHash();
    var title = T("brand");
    if (r.name === "team" && TEAMS[r.id]) title = nm(TEAMS[r.id].n) + " — " + T("teamFixtures");
    else if (r.name === "league" && lg(r.slug)) title = nm(lg(r.slug).n) + " — " + T("leagueFixturesH");
    else if (r.name === "teams" && lg(r.slug)) title = nm(lg(r.slug).n) + " — " + T("chooseTeam");
    document.title = title + " | " + T("pageLeagueTitle");
  }

  /* ======================== header controls ======================== */
  function bindHeader() {
    var langBtn = document.getElementById("lang-btn"),
        themeBtn = document.getElementById("theme-btn"),
        setBtn = document.getElementById("settings-btn"),
        brand = document.querySelector(".brand");
    if (setBtn) setBtn.addEventListener("click", openSettings);

    function paintThemeBtn() {
      themeBtn.innerHTML = S.theme === "dark" ? I.sun : I.moon;
      themeBtn.title = S.theme === "dark" ? T("themeLight") : T("themeDark");
      themeBtn.setAttribute("aria-label", themeBtn.title);
    }
    langBtn.addEventListener("click", function () {
      S.lang = S.lang === "ar" ? "en" : "ar";
      save("a7lang", S.lang);
      langBtn.textContent = T("langToggle");
      render({ keepScroll: true });
    });
    themeBtn.addEventListener("click", function () {
      /* theme switching must never move the page */
      var sy = global.scrollY || document.documentElement.scrollTop || 0;
      S.theme = S.theme === "dark" ? "light" : "dark";
      save("a7theme", S.theme);
      applyTheme();
      paintThemeBtn();
      global.scrollTo({ top: sy, behavior: "instant" });
    });
    brand.addEventListener("click", function (e) {
      if (location.hash === "" || location.hash === "#/" || location.hash === "#") {
        e.preventDefault(); render();
      }
    });
    paintThemeBtn();
  }

  function applyTheme() {
    document.documentElement.setAttribute("data-theme", S.theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", S.theme === "dark" ? "#070A12" : "#F2F5FA");
  }

  /* ======================== global click delegation ======================== */
  document.addEventListener("click", function (e) {
    var t = e.target;

    /* live section switch */
    var lvT = t.closest ? t.closest("[data-act=livetoggle]") : null;
    if (lvT) {
      S.live = !S.live;
      save("a7live", S.live ? "1" : "0");
      render({ keepScroll: true });
      return;
    }

    /* jump to a match (live card / upcoming strip / banner) */
    var gm = t.closest ? t.closest("[data-goto-match]") : null;
    if (gm && !t.closest("a,button,input,select,textarea,label")) {
      gotoMatch(gm.getAttribute("data-goto-lg"), gm.getAttribute("data-goto-match"));
      return;
    }

    /* league favourite star (inside an <a> card) */
    var lgfav = t.closest ? t.closest("[data-act=lgfav]") : null;
    if (lgfav) {
      e.preventDefault(); e.stopPropagation();
      var s = lgfav.getAttribute("data-slug");
      var ix = S.lgfavs.indexOf(s);
      if (ix >= 0) S.lgfavs.splice(ix, 1); else S.lgfavs.push(s);
      save("a7lgfavs", JSON.stringify(S.lgfavs));
      render({ keepScroll: true });
      return;
    }

    /* expand / collapse a match row — ONLY from the header (.mr-row),
       so the same zone opens and closes; clicks inside the expanded
       details panel never collapse it */
    var mrow = t.closest ? t.closest(".mr-row") : null;
    if (mrow) {
      var wrap = mrow.closest(".mr[data-xp]");
      if (wrap && !t.closest("a,button,input,select,textarea,label")) {
        toggleXp(wrap.getAttribute("data-id"));
        return;
      }
    }

    var unfav = t.closest ? t.closest("[data-act=unfav]") : null;
    if (unfav) { e.preventDefault(); e.stopPropagation(); toggleFav(unfav.getAttribute("data-id")); return; }

    var fav = t.closest ? t.closest("[data-act=fav]") : null;
    if (fav) { e.preventDefault(); e.stopPropagation(); toggleFav(fav.getAttribute("data-id")); return; }

    var goto = t.closest ? t.closest("[data-goto]") : null;
    if (goto) { location.hash = goto.getAttribute("data-goto").replace(/^#/, "#"); return; }

    var lgopen = t.closest ? t.closest("[data-act=lgopen]") : null;
    if (lgopen) { e.preventDefault(); openLeagueSheet(lgopen.getAttribute("data-lg")); return; }

    var remind = t.closest ? t.closest("[data-act=remind]") : null;
    if (remind) {
      e.preventDefault();
      var m = findMatch(remind.getAttribute("data-id"), remind.getAttribute("data-lg"));
      if (m) downloadMatchReminder(m);
      return;
    }

    var fmt = t.closest ? t.closest("[data-act=fmt]") : null;
    if (fmt) {
      e.preventDefault();
      doFormat(fmt.getAttribute("data-fmt"), fmt.getAttribute("data-kind"),
        fmt.getAttribute("data-lg"), fmt.getAttribute("data-team"));
      return;
    }

    /* "download the file now" button inside a format sheet */
    var fmtfile = t.closest ? t.closest("[data-act=fmtfile]") : null;
    if (fmtfile) {
      e.preventDefault();
      var fSubj = fmtfile.getAttribute("data-kind") === "team"
        ? teamSubject(fmtfile.getAttribute("data-team"))
        : leagueSubject(lg(fmtfile.getAttribute("data-lg")));
      if (fSubj) downloadSubject(fSubj, "ics");
      return;
    }

    var copy = t.closest ? t.closest("[data-act=copy]") : null;
    if (copy) {
      var input = copy.closest(".sub-row").querySelector(".sub-url");
      input.select();
      try { document.execCommand("copy"); } catch (err) {}
      if (navigator.clipboard) navigator.clipboard.writeText(input.value).catch(function () {});
      toast(T("copied"), "ok");
      return;
    }
  });

  function toggleFav(tid, opts) {
    var i = S.favs.indexOf(tid);
    if (i >= 0) S.favs.splice(i, 1); else S.favs.push(tid);
    save("a7favs", JSON.stringify(S.favs));
    /* called from the settings sheet the modal must stay open */
    render({ keepScroll: true, keepSheet: !!(opts && opts.keepSheet) });
  }

  /* ======================== keyboard: Enter on rows & team cards ======================== */
  document.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      if (e.target && e.target.classList && e.target.classList.contains("mr") &&
          e.target.getAttribute("data-xp")) {
        toggleXp(e.target.getAttribute("data-id"));
        return;
      }
      var card = e.target.closest ? e.target.closest(".t-card") : null;
      if (card) { location.hash = card.getAttribute("data-goto"); return; }
      var go = e.target.closest ? e.target.closest("[data-goto-match]") : null;
      if (go) gotoMatch(go.getAttribute("data-goto-lg"), go.getAttribute("data-goto-match"));
    }
  });

  /* ======================== boot ======================== */
  applyTheme();
  applyLangMeta();
  document.getElementById("lang-btn").textContent = T("langToggle");
  bindHeader();
  global.addEventListener("hashchange", render);
  render();

  /* live scores + in-match notifications (365scores client-side polling) */
  if (global.A7LIVE) {
    A7LIVE.onChange(function (events) {
      patchLiveDOM(events);
      liveNotify(events);
    });
    A7LIVE.start();
    global.addEventListener("visibilitychange", function () {
      if (!document.hidden) A7LIVE.refresh();
    });
  }

  /* kick-off soon watcher — favourite teams starting within 15 minutes */
  soonCheck();
  setInterval(soonCheck, 60 * 1000);
})(window);
