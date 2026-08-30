# -*- coding: utf-8 -*-
"""
Central configuration for League Calendars.

Data sources
------------
Primary   : FotMob   (https://www.fotmob.com)  — fixtures, kickoff times, scores,
             stadiums, referees, attendance, colours, logos.
Secondary : 365scores (https://www.365scores.com) — Arabic team names,
             cross-checking, and a fixtures fallback for the near window.

Add or remove leagues here and everything (site data + ICS feeds) follows.
"""

# slug           unique url-friendly id
# fotmob         FotMob league id
# c365           365scores competition id
# u365           365scores competition URL slug (…/football/competition/{u365})
# en / ar        league display name
# cen / car      country display name
# ccode          country code (used for flags)
# accent         card accent colour (falls back to FotMob leagueColor)
LEAGUES = [
    dict(slug="saudi-pro-league", fotmob=536, c365=649, u365="saudi-league-649",
         en="Saudi Pro League", ar="دوري روشن السعودي",
         cen="Saudi Arabia", car="السعودية", ccode="SA", accent="#00A652"),
    dict(slug="premier-league", fotmob=47, c365=7, u365="premier-league-7",
         en="Premier League", ar="الدوري الإنجليزي الممتاز",
         cen="England", car="إنجلترا", ccode="GB", accent="#963BEB"),
    dict(slug="laliga", fotmob=87, c365=11, u365="laliga-11",
         en="LaLiga", ar="الدوري الإسباني",
         cen="Spain", car="إسبانيا", ccode="ES", accent="#EE3D3D"),
    dict(slug="serie-a", fotmob=55, c365=17, u365="serie-a-17",
         en="Serie A", ar="الدوري الإيطالي",
         cen="Italy", car="إيطاليا", ccode="IT", accent="#2E6BD6"),
    dict(slug="bundesliga", fotmob=54, c365=25, u365="bundesliga-25",
         en="Bundesliga", ar="الدوري الألماني",
         cen="Germany", car="ألمانيا", ccode="DE", accent="#D03B3B"),
    dict(slug="ligue-1", fotmob=53, c365=35, u365="ligue-1-35",
         en="Ligue 1", ar="الدوري الفرنسي",
         cen="France", car="فرنسا", ccode="FR", accent="#0E5B4F"),
    dict(slug="champions-league", fotmob=42, c365=572, u365="uefa-champions-league-572",
         en="UEFA Champions League", ar="دوري أبطال أوروبا",
         cen="Europe", car="أوروبا", ccode="EU", accent="#1B2F86"),
    dict(slug="europa-league", fotmob=73, c365=573, u365="uefa-europa-league-573",
         en="UEFA Europa League", ar="الدوري الأوروبي",
         cen="Europe", car="أوروبا", ccode="EU", accent="#E8622B"),
    dict(slug="egyptian-premier-league", fotmob=519, c365=552, u365="egyptian-premier-league-552",
         en="Egyptian Premier League", ar="الدوري المصري الممتاز",
         cen="Egypt", car="مصر", ccode="EG", accent="#C8102E"),
    dict(slug="afc-champions-league-elite", fotmob=525, c365=623, u365="afc-champions-league-elite-623",
         en="AFC Champions League Elite", ar="دوري أبطال آسيا للنخبة",
         cen="Asia", car="آسيا", ccode="AS", accent="#5B2D8E"),

    # ---- cups (knockout) ----
    dict(slug="saudi-kings-cup", fotmob=9942, c365=5501, u365="kings-cup-5501", cup=True,
         en="King's Cup", ar="كأس خادم الحرمين الشريفين",
         cen="Saudi Arabia", car="السعودية", ccode="SA", accent="#C9A227"),
    dict(slug="fa-cup", fotmob=132, c365=49, u365="fa-cup-49", cup=True,
         en="FA Cup", ar="كأس الاتحاد الإنجليزي",
         cen="England", car="إنجلترا", ccode="GB", accent="#3E5C9A"),
    dict(slug="coppa-italia", fotmob=141, c365=20, u365="coppa-italia-20", cup=True,
         en="Coppa Italia", ar="كأس إيطاليا",
         cen="Italy", car="إيطاليا", ccode="IT", accent="#2E8B6E"),
    dict(slug="copa-del-rey", fotmob=138, c365=13, u365="copa-del-rey-13", cup=True,
         en="Copa del Rey", ar="كأس ملك إسبانيا",
         cen="Spain", car="إسبانيا", ccode="ES", accent="#C0392B"),
]

SOURCES = {
    "primary":   {"key": "fotmob",    "name": "FotMob",   "url": "https://www.fotmob.com"},
    "secondary": {"key": "365scores", "name": "365scores", "url": "https://www.365scores.com"},
}

# Calendar feed refresh hint advertised inside every .ics file
FEED_TTL = "PT6H"

# Site metadata
SITE_TITLE = {"en": "League Calendars", "ar": "تقاويم الدوريات"}

# Paths (relative to repo root)
ROOT = "../"
ASSETS_DIR = ROOT + "assets"
ICS_DIR = ROOT + "ics"
DATA_DIR = "data"
