/* ==========================================================================
   Live match module — polls 365scores every 60s (client-side, CORS-open).
   Provides: current minute, live score, status AND in-play events
   (goals, cards, substitutions) for in-play matches of the app's
   competitions, plus change events for in-match notifications.
   Data source: 365scores (https://www.365scores.com) — MENA view.
   ========================================================================== */
(function (global) {
  "use strict";

  var POLL_MS = 60 * 1000;
  var API = "https://webws.365scores.com/web/games/current/" +
            "?appTypeId=5&langId=27&timezoneName=Etc/UTC&userCountryId=122&competitions=";
  var GAME_API = "https://webws.365scores.com/web/game/" +
            "?appTypeId=5&langId=27&timezoneName=Etc/UTC&userCountryId=122&gameId=";
  var SG_LIVE = 3;   // statusGroup 3 = in play
  var ENRICH_MAX = 12;   // per-cycle cap on detail fetches

  var compSlug = {};     // c365 id → league slug (from A7D)
  var state = {};        // "slug|ts" → {min, hs, as, txt, evs, ...}
  var events = [];       // change events for the current poll
  var subs = [];
  var timer = null;
  var polling = false;

  function key(slug, ts) { return slug + "|" + ts; }

  function buildCompMap() {
    var D = global.A7D;
    if (!D || !D.lgs) return false;
    compSlug = {};
    D.lgs.forEach(function (l) { if (l.z) compSlug[l.z] = l.i; });
    return Object.keys(compSlug).length > 0;
  }

  function parseMs(iso) {
    if (!iso) return 0;
    try { return new Date(iso).getTime(); } catch (e) { return 0; }
  }

  /* ---- events of one game → compact list ------------------------------
     ev = {m: "62'", id: eventType id, nm: raw name (ar), sub: subTypeName,
           side: "h"|"a", maj: isMajor}
     ids seen: 1 goal · 2 yellow · 1000 substitution (red/VAR unmapped →
     the app falls back to the raw Arabic/English name text).           */
  function mapEvents(g) {
    var homeId = g.homeCompetitor && g.homeCompetitor.id;
    return (g.events || []).slice().sort(function (a, b) {
      return (a.order || 0) - (b.order || 0);
    }).map(function (e) {
      var t = e.eventType || {};
      return {
        m: e.gameTimeDisplay || "",
        id: t.id,
        nm: t.name || "",
        sub: e.subTypeName || "",
        side: (e.competitorId === homeId) ? "h" : "a",
        maj: !!e.isMajor
      };
    });
  }

  function notifySubs() {
    subs.forEach(function (fn) { try { fn(events, state); } catch (e) {} });
  }

  function handle(d) {
    events = [];
    var games = (d && d.games) || [];
    var next = {};
    var liveGames = [];
    games.forEach(function (g) {
      if (g.statusGroup !== SG_LIVE) return;
      var slug = compSlug[g.competitionId];
      var ts = parseMs(g.startTime);
      if (!slug || !ts) return;
      var h = g.homeCompetitor || {}, a = g.awayCompetitor || {};
      var k = key(slug, ts);
      var info = {
        min: g.gameTimeDisplay || (g.statusText || ""),
        hs: (h.score === undefined || h.score === null) ? "" : String(h.score),
        as: (a.score === undefined || a.score === null) ? "" : String(a.score),
        txt: g.statusText || "",
        gid: g.id,
        slug: slug, ts: ts
      };
      /* the list endpoint has no events — but test payloads may carry them */
      if (g.events) info.evs = mapEvents(g);
      next[k] = info;
      liveGames.push(g);
      var prev = state[k];
      if (prev) {
        if (prev.hs !== info.hs || prev.as !== info.as) {
          events.push({ type: "goal", key: k, info: info, prev: prev });
        }
      } else {
        events.push({ type: "kickoff", key: k, info: info });
      }
    });
    // matches that were live and are no longer → ended
    Object.keys(state).forEach(function (k) {
      if (!next[k]) events.push({ type: "ended", key: k, info: null });
    });
    state = next;
    if (events.length || Object.keys(state).length) notifySubs();
    enrich(liveGames);
  }

  /* ---- per-game detail fetch: the events timeline ----------------------
     Fires subscribers again (with no change events) once details land so
     the UI can patch the timeline without waiting for the next poll.   */
  function enrich(games) {
    games.slice(0, ENRICH_MAX).forEach(function (g) {
      var k = key(compSlug[g.competitionId], parseMs(g.startTime));
      if (!g.id || !state[k]) return;
      fetch(GAME_API + g.id)
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var gm = (d && d.game) || null;
          var info = state[k];
          if (!gm || !info) return;
          var evs = mapEvents(gm);
          if (info.evs && info.evs.length === evs.length) return;  // unchanged
          info.evs = evs;
          if (gm.statusText) info.txt = gm.statusText;
          events = [];
          notifySubs();
        })
        .catch(function () {});
    });
  }

  function poll() {
    if (!global.document || global.document.hidden) return;
    if (!Object.keys(compSlug).length && !buildCompMap()) return;
    if (polling) return;
    polling = true;
    fetch(API + Object.keys(compSlug).join(","))
      .then(function (r) { return r.json(); })
      .then(function (d) { polling = false; handle(d); })
      .catch(function () { polling = false; });
  }

  global.A7LIVE = {
    /** live info for a match (league slug + kickoff ms) or null */
    info: function (slug, ts) {
      return state[key(slug, ts)] || null;
    },
    /** all currently live matches: [{slug, ts, min, hs, as, txt, evs}] */
    all: function () {
      return Object.keys(state).map(function (k) { return state[k]; });
    },
    /** subscribe fn(events, stateMap) — called on every change */
    onChange: function (fn) { if (typeof fn === "function") subs.push(fn); },
    /** (re)start polling — safe to call multiple times */
    start: function () {
      buildCompMap();
      poll();
      if (timer) clearInterval(timer);
      timer = setInterval(poll, POLL_MS);
    },
    /** one immediate refresh (e.g. when the tab becomes visible) */
    refresh: poll,
    _handle: handle,      // test hook: inject a full games payload
    _enrich: enrich       // test hook: inject detail fetches
  };
})(window);
