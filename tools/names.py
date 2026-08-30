# -*- coding: utf-8 -*-
"""
Name matching + curated translations.

FotMob gives us English team names; 365scores gives us Arabic ones.
This module pairs them (fuzzy match on the English forms) and adds a
curated alias table + city/country translations for the Arabic UI.
"""
import difflib
import re
import unicodedata

# --------------------------------------------------------------------------
# normalisation
# --------------------------------------------------------------------------
STRIP_WORDS = {
    "fc", "cf", "sc", "afc", "acd", "cdc", "ac", "as", "ss", "ssc", "cd",
    "club", "city", "calcio", "de", "the", "spor", "kulubu", "sk", "bk",
    "if", "sv", "vfl", "vfb", "tsv", "svv", "usc", "bsc", "fbc", "pfc",
}
AR_TOKENS = {"al", "el", "ash", "as", "ad", "an", "ann", "attawon", "abu"}


def norm(s):
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9\u0600-\u06FF ]+", " ", s)
    toks = []
    for t in s.split():
        t = t.strip()
        if not t or t in STRIP_WORDS:
            continue
        toks.append(t)
    # collapse doubled arabic article forms (al hilal / alhilal)
    joined = " ".join(toks)
    return joined


def _tokens(s):
    return set(t for t in norm(s).split() if t)


def _initials(s):
    toks = [t for t in norm(s).split() if t]
    return "".join(t[0] for t in toks)


def sim(a, b):
    """0..1 similarity of two display names."""
    na, nb = norm(a), norm(b)
    if not na or not nb:
        return 0.0
    if na == nb:
        return 1.0
    ta, tb = _tokens(a), _tokens(b)
    jac = len(ta & tb) / max(1, len(ta | tb))
    ratio = difflib.SequenceMatcher(None, na, nb).ratio()
    # containment bonus — only when the shorter name is at least half the
    # longer one ("paris" ⊂ "paris saint germain" must NOT count)
    contains = 0.0
    if na in nb or nb in na:
        shorter, longer = (na, nb) if len(na) <= len(nb) else (nb, na)
        if len(shorter) >= 0.5 * len(longer):
            contains = 1.0
    # acronym match: "PSG" ≡ "Paris Saint-Germain"
    ia, ib = _initials(a), _initials(b)
    ca, cb = na.replace(" ", ""), nb.replace(" ", "")
    if (len(ia) >= 2 and ia == cb) or (len(ib) >= 2 and ib == ca):
        return 0.95
    return max(ratio, jac * 0.95, contains * 0.92)


def best_match(name, candidates, threshold=0.62):
    """candidates: list of (key, candidate_name). Returns key or None."""
    best, best_score = None, 0.0
    for key, cand in candidates:
        sc = sim(name, cand)
        if sc > best_score:
            best, best_score = key, sc
    if best_score >= threshold:
        return best
    return None


# --------------------------------------------------------------------------
# curated aliases: fotmob english name (normalised loosely) -> arabic name
# Used only when automatic 365scores matching fails.
# --------------------------------------------------------------------------
ALIASES = {
    # --- Saudi Pro League ---
    "al hilal": "الهلال",
    "al nassr": "النصر",
    "al ittihad": "الاتحاد",
    "al ahli": "الأهلي",
    "al shabab": "الشباب",
    "al ettifaq": "الاتفاق",
    "al taawoun": "التعاون",
    "al fateh": "الفتح",
    "al khaleej": "الخليج",
    "al qadsiah": "القادسية",
    "al faisaly": "الفيصلي",
    "al okhdood": "الأخدود",
    "al kholood": "الخلود",
    "al hilal saudi fc": "الهلال",
    "al nassr fc": "النصر",
    "al ittihad club": "الاتحاد",
    "al fayha": "الفيحاء",
    "al diriyah": "الدرعية",
    "al diriyah club": "الدرعية",
    "paris saint germain": "باريس سان جيرمان",
    "paris saint germain fc": "باريس سان جيرمان",
    "al taee": "الطائي",
    "al taee fc": "الطائي",
    "al raed": "الرائد",
    "al raed fc": "الرائد",
    "deportivo alaves": "ديبورتيفو ألافيس",
    "deportivo a coruna": "ديبورتيفو لا كورونيا",
    "deportivo de la coruna": "ديبورتيفو لا كورونيا",
    "deportivo la coruna": "ديبورتيفو لا كورونيا",
    "real oviedo": "ريال أوفييدو",
    "real oviedo cf": "ريال أوفييدو",
    "abha": "أبها",
    "al hazem": "الحزم",
    "al hazm": "الحزم",
    "damac": "ضمك",
    "al riyadh": "الرياض",
    "al safa": "الصفا",
    "al najma": "النجمة",
    "al zoufi": "الزوفي",
    "neom": "نيوم",
    "neom sc": "نيوم",
    "al mizan": "الميزان",
    # --- Egypt ---
    "al ahly": "الأهلي",
    "zamalek": "الزمالك",
    "pyramids": "بيراميدز",
    "pyramids fc": "بيراميدز",
    "al masry": "المصري",
    "al masry sc": "المصري",
    "smouha": "سموحة",
    "al ittihad alexandria": "الاتحاد السكندري",
    "ceramica cleopatra": "سيراميكا كليوباترا",
    "modern sport": "مودرن سبورت",
    "modern future": "مودرن فيوتشر",
    "future fc": "فيوتشر",
    "enppi": "إنبي",
    "petrojet": "بتروجيت",
    "petrojet suez": "بتروجيت",
    "national bank of egypt": "البنك الأهلي",
    "national bank": "البنك الأهلي",
    "iski": "إيسكاي؟",
    "zed fc": "زيد",
    "zed": "زيد",
    "wadi degla": "وادي دجلة",
    "wadi degla fc": "وادي دجلة",
    "ghazl el mahalla": "غزل المحلة",
    "abu qir semad": "أبو قير سيماد",
    "abo qir semad": "أبو قير سيماد",
    "asyut petroleum": "أسيوط بتروليوم",
    "al obour": "العاصمة؟",
    "tala ea": "طلائع الجيش",
    "el gouna": "الجونة",
    "el gouna fc": "الجونة",
    "haras el hudood": "حرس الحدود",
    "aldeimbabwe?": "",
    "aswan": "أسوان",
    "aswan fc": "أسوان",
    "sohag": "سوهاج",
    "dakhlia": "الداخلية",
    "magico": "",
    "nogoom": "نجوم",
    "nogoom fc": "نجوم",
    # --- Europe (auto-match normally succeeds; safety net) ---
    "manchester city": "مانشستر سيتي",
    "manchester united": "مانشستر يونايتد",
    "liverpool": "ليفربول",
    "arsenal": "أرسنال",
    "chelsea": "تشيلسي",
    "tottenham hotspur": "توتنهام",
    "newcastle united": "نيوكاسل يونايتد",
    "aston villa": "أستون فيلا",
    "brighton hove albion": "برايتون",
    "brighton and hove albion": "برايتون",
    "west ham united": "وست هام",
    "everton": "إيفرتون",
    "nottingham forest": "نوتنغهام فورست",
    "fulham": "فولهام",
    "crystal palace": "كريستال بالاس",
    "brentford": "برينتفورد",
    "wolverhampton": "وولفرهامبتون",
    "afc bournemouth": "بورنموث",
    "bournemouth": "بورنموث",
    "leeds united": "ليدز يونايتد",
    "burnley": "بيرنلي",
    "sunderland": "سندرلاند",
    "hull city": "هال سيتي",
    "west brom": "وست بروميتش",
    "coventry": "كوفنتري",
    "real madrid": "ريال مدريد",
    "barcelona": "برشلونة",
    "atletico madrid": "أتلتيكو مدريد",
    "athletic club": "أتلتيك بيلباو",
    "athletic bilbao": "أتلتيك بيلباو",
    "real sociedad": "ريال سوسييداد",
    "real betis": "ريال بيتيس",
    "villarreal": "فياريال",
    "valencia": "فالنسيا",
    "sevilla": "إشبيلية",
    "girona": "جيرونا",
    "celta vigo": "سيلتا فيغو",
    "osasuna": "أوساسونا",
    "getafe": "خيتافي",
    "rayo vallecano": "رايو فاييكانو",
    "mallorca": "مايوركا",
    "alaves": "ألافيس",
    "elche": "إلتشي",
    "osasuna?": "",
    "juventus": "يوفنتوس",
    "inter": "إنتر ميلان",
    "internazionale": "إنتر ميلان",
    "inter milan": "إنتر ميلان",
    "ac milan": "ميلان",
    "napoli": "نابولي",
    "roma": "روما",
    "lazio": "لاتسيو",
    "atalanta": "أتالانتا",
    "fiorentina": "فيورنتينا",
    "bologna": "بولونيا",
    "torino": "تورينو",
    "udinese": "أودينيزي",
    "genoa": "جنوى",
    "cagliari": "كالياري",
    "verona": "هيلاس فيرونا",
    "hellas verona": "هيلاس فيرونا",
    "lecce": "ليتشي",
    "parma": "بارما",
    "como": "كومو",
    "como 1907": "كومو",
    "sassuolo": "ساسولو",
    "pisa": "بيزا",
    "cremonese": "كريمونيزي",
    "bayern munich": "بايرن ميونخ",
    "bayern munchen": "بايرن ميونخ",
    "borussia dortmund": "بوروسيا دورتموند",
    "rb leipzig": "لايبزيج",
    "bayer leverkusen": "باير ليفركوزن",
    "eintracht frankfurt": "آينتراخت فرانكفورت",
    "vfb stuttgart": "شتوتغارت",
    "borussia monchengladbach": "بوروسيا مونشنغلادباخ",
    "vfl wolfsburg": "فولفسبورغ",
    "fsv mainz 05": "ماينتس",
    "mainz 05": "ماينتس",
    "werder bremen": "فيردر بريمن",
    "tsg hoffenheim": "هوفنهايم",
    "fc augsburg": "أوغسبورغ",
    "sc freiburg": "فرايبورغ",
    "union berlin": "يونيون برلين",
    "fc st pauli": "سانت باولي",
    "hamburger sv": "هامبورغ",
    "1 fc koln": "كولن",
    "fc koln": "كولن",
    "paris saint germain": "باريس سان جيرمان",
    "psg": "باريس سان جيرمان",
    "marseille": "مارسيليا",
    "olympique lyonnais": "أولمبيك ليون",
    "olympique de marseille": "مارسيليا",
    "as monaco": "موناكو",
    "lille": "ليل",
    "losc lille": "ليل",
    "nice": "نيس",
    "ogc nice": "نيس",
    "rc lens": "لانس",
    "lens": "لانس",
    "stade rennais": "رين",
    "rennes": "رين",
    "olympique de marseille?": "",
    "stade brestois": "بريست",
    "brest": "بريست",
    "toulouse": "تولوز",
    "stade toulousain": "",
    "stade de reims": "ريمس",
    "reims": "ريمس",
    "strasbourg": "ستراسبورغ",
    "rc strasbourg": "ستراسبورغ",
    "nantes": "نانت",
    "fc nantes": "نانت",
    "angers": "أنجيه",
    "le havre": "لهافر",
    "montpellier": "مونبلييه",
    "metz": "ميتز",
    "lorient": "لوريان",
    "auxerre": "أوكسير",
    "paris fc": "باريس",
    "lorient?": "",
    "lyon": "أولمبيك ليون",
    "monaco": "موناكو",
    "leeds": "ليدز يونايتد",
    "burnley?": "",
    "west bromwich albion": "وست بروميتش",
    "stoke city": "ستوك سيتي",
    "sunderland afc": "سندرلاند",
    "ipswich town": "إبسويتش تاون",
    "southampton": "ساوثهامبتون",
    "leicester city": "ليستر سيتي",
    "everton?": "",
}

# --------------------------------------------------------------------------
# cities / countries (EN -> AR) used in the Arabic UI & calendar entries
# --------------------------------------------------------------------------
CITIES = {
    "riyadh": "الرياض", "jeddah": "جدة", "mecca": "مكة المكرمة", "makkah": "مكة المكرمة",
    "dammam": "الدمام", "khobar": "الخبر", "al khobar": "الخبر", "abha": "أبها",
    "buraidah": "بريدة", "ar rass": "الرس", "rass": "الرس", "ha'il": "حائل",
    "hail": "حائل", "tabuk": "تبوك", "taif": "الطائف", "medina": "المدينة المنورة",
    "madina": "المدينة المنورة", "najran": "نجران", "jubail": "الجبيل", "yanbu": "ينبع",
    "king abdullah economic city": "مدينة الملك عبدالله الاقتصادية",
    "london": "لندن", "manchester": "مانشستر", "liverpool": "ليفربول",
    "birmingham": "برمنغهام", "leeds": "ليدز", "newcastle": "نيوكاسل",
    "newcastle upon tyne": "نيوكاسل", "sunderland": "سندرلاند", "brighton": "برايتون",
    "southampton": "ساوثهامبتون", "portsmouth": "بورتسموث", "norwich": "نورويتش",
    "leicester": "ليستر", "nottingham": "نوتنغهام", "wolverhampton": "وولفرهامبتون",
    "bournemouth": "بورنموث", "fulham": "فولهام", "watford": "واتفورد",
    "brentford": "برينتفورد", "luton": "لوتون", "burnley": "بيرنلي",
    "blackburn": "بلاكبيرن", "bolton": "بولتون", "preston": "بريستون",
    "hull": "هال", "sheffield": "شيفيلد", "stoke-on-trent": "ستوك أون ترينت",
    "west bromwich": "وست بروميتش", "middlesbrough": "ميدلزبرة", "derby": "دربي",
    "madrid": "مدريد", "barcelona": "برشلونة", "bilbao": "بيلباو", "sevilla": "إشبيلية",
    "valencia": "فالنسيا", "villarreal": "فياريال", "getafe": "خيتافي",
    "vigo": "فيفو؟", "milan": "ميلانو", "rome": "روما", "naples": "نابولي",
    "turin": "تورينو", "florence": "فلورنسا", "bologna": "بولونيا",
    "genoa": "جنوة", "verona": "فيرونا", "udine": "أوديني", "bergamo": "بيرغامو",
    "empoli": "إمبولي", "parma": "بارما", "como": "كومو", "lecce": "ليتشي",
    "cagliari": "كالياري", "pisa": "بيزا", "venice": "البندقية", "munich": "ميونخ",
    "berlin": "برلين", "dortmund": "دورتموند", "leverkusen": "ليفركوزن",
    "stuttgart": "شتوتغارت", "frankfurt": "فرانكفورت", "leipzig": "لايبزيج",
    "wolfsburg": "فولفسبورغ", "bremen": "بريمن", "mainz": "ماينتس",
    "hoffenheim": "زينسهايم", "augsburg": "أوغسبورغ", "freiburg": "فرايبورغ",
    "hamburg": "هامبورغ", "cologne": "كولونيا", "monchengladbach": "مونشنغلادباخ",
    "paris": "باريس", "marseille": "مارسيليا", "lyon": "ليون", "monaco": "موناكو",
    "lille": "ليل", "nice": "نيس", "lens": "لانس", "rennes": "رين", "nantes": "نانت",
    "strasbourg": "ستراسبورغ", "toulouse": "تولوز", "montpellier": "مونبلييه",
    "brest": "بريست", "reims": "ريمس", "le havre": "لهافر", "angers": "أنجيه",
    "metz": "ميتز", "auxerre": "أوكسير", "cairo": "القاهرة", "alexandria": "الإسكندرية",
    "giza": "الجيزة", "ismailia": "الإسماعيلية", "port said": "بورسعيد",
    "suez": "السويس", "asyut": "أسيوط", "asyut city": "أسيوط", "aswan": "أسوان",
    "luxor": "الأقصر", "mahalla": "المحلة", "el mahalla el kubra": "المحلة الكبرى",
    "doha": "الدوحة", "abu dhabi": "أبوظبي", "dubai": "دبي", "sharjah": "الشارقة",
    "al ain": "العين", "riyadh?": "", "lisbon": "لشبونة", "porto": "بورتو",
    "amsterdam": "أمستردام", "rotterdam": "روتردام", "eindhoven": "أيندهوفن",
    "brussels": "بروكسل", "istanbul": "إسطنبول", "athens": "أثينا",
    "glasgow": "غلاسكو", "edinburgh": "إدنبرة", "vienna": "فيينا", "zurich": "زيورخ",
    "bern": "برن", "basel": "بازل", "moscow": "موسكو", "kyiv": "كييف",
    "warsaw": "وارسو", "prague": "براغ", "budapest": "بودابست",
    "bucharest": "بوخارست", "belgrade": "بلغراد", "zagreb": "زغرب",
    "copenhagen": "كوبنهاغن", "oslo": "أوسلو", "stockholm": "ستوكهولم",
    "gothenburg": "غوتنبرغ", "malmo": "مالمو", "helsinki": "هلسنكي",
    "reykjavik": "ريكيافيك", "torshavn": "تورشافن", "ludogorets": "لودوغورتس",
    "razgrad": "رازغراد", "sofia": "صوفيا", "belgrade?": "", "wolves": "",
}

COUNTRIES = {
    "saudi arabia": "السعودية", "england": "إنجلترا", "spain": "إسبانيا",
    "italy": "إيطاليا", "germany": "ألمانيا", "france": "فرنسا",
    "egypt": "مصر", "qatar": "قطر", "united arab emirates": "الإمارات",
    "turkey": "تركيا", "türkiye": "تركيا", "portugal": "البرتغال",
    "netherlands": "هولندا", "belgium": "بلجيكا", "greece": "اليونان",
    "scotland": "اسكتلندا", "wales": "ويلز", "austria": "النمسا",
    "switzerland": "سويسرا", "denmark": "الدنمارك", "norway": "النرويج",
    "sweden": "السويد", "finland": "فنلندا", "poland": "بولندا",
    "czech republic": "التشيك", "czechia": "التشيك", "croatia": "كرواتيا",
    "serbia": "صربيا", "romania": "رومانيا", "bulgaria": "بلغاريا",
    "hungary": "هنغاريا", "slovakia": "سلوفاكيا", "slovenia": "سلوفينيا",
    "ukraine": "أوكرانيا", "russia": "روسيا", "israel": "إسرائيل",
    "morocco": "المغرب", "tunisia": "تونس", "algeria": "الجزائر",
    "libya": "ليبيا", "jordan": "الأردن", "iraq": "العراق",
    "kuwait": "الكويت", "bahrain": "البحرين", "oman": "عُمان",
    "australia": "أستراليا", "japan": "اليابان", "south korea": "كوريا الجنوبية",
    "china": "الصين", "brazil": "البرازيل", "argentina": "الأرجنتين",
    "usa": "الولايات المتحدة", "united states": "الولايات المتحدة",
    "great britain": "بريطانيا", "united kingdom": "المملكة المتحدة",
    "uk": "بريطانيا",
    "new zealand": "نيوزيلندا", "south africa": "جنوب أفريقيا",
    "nigeria": "نيجيريا", "kenya": "كينيا", "ghana": "غانا",
    "singapore": "سنغافورة", "hong kong": "هونغ كونغ",
    "philippines": "الفلبين", "vietnam": "فيتنام", "taiwan": "تايوان",
    "israel": "إسرائيل", "malta": "مالطا", "cyprus": "قبرص",
    "maldives": "المالديف", "sri lanka": "سريلانكا", "bangladesh": "بنغلاديش",
    "pakistan": "باكستان", "nepal": "نيبال", "myanmar": "ميانمار",
    "cambodia": "كمبوديا", "laos": "لاوس", "brunei": "بروناي",
    "moldova": "مولدوفا", "georgia": "جورجيا", "armenia": "أرمينيا",
    "azerbaijan": "أذربيجان", "belarus": "بيلاروسيا", "estonia": "إستونيا",
    "latvia": "لاتفيا", "lithuania": "ليتوانيا", "albania": "ألبانيا",
    "bosnia and herzegovina": "البوسنة والهرسك", "macedonia": "مقدونيا",
    "north macedonia": "مقدونيا الشمالية", "montenegro": "الجبل الأسود",
    "luxembourg": "لوكسمبورغ", "liechtenstein": "ليختنشتاين",
    "malaysia": "ماليزيا", "thailand": "تايلاند", "indonesia": "إندونيسيا",
    "india": "الهند", "northern ireland": "أيرلندا الشمالية",
    "ireland": "أيرلندا",
}


# --------------------------------------------------------------------------
# cup round labels (knockout competitions)
# --------------------------------------------------------------------------
ROUND_LABELS = {
    "round of 64": ("Round of 64", "دور الـ64"),
    "round of 32": ("Round of 32", "دور الـ32"),
    "round of 16": ("Round of 16", "دور الـ16"),
    "quarter-finals": ("Quarter-Finals", "ربع النهائي"),
    "quarter-final": ("Quarter-Final", "ربع النهائي"),
    "semi-finals": ("Semi-Finals", "نصف النهائي"),
    "semi-final": ("Semi-Final", "نصف النهائي"),
    "final": ("Final", "النهائي"),
    "first round": ("First Round", "الدور الأول"),
    "second round": ("Second Round", "الدور الثاني"),
    "third round": ("Third Round", "الدور الثالث"),
    "fourth round": ("Fourth Round", "الدور الرابع"),
    "fifth round": ("Fifth Round", "الدور الخامس"),
    "sixth round": ("Sixth Round", "الدور السادس"),
    "preliminary round": ("Preliminary Round", "الدور التمهيدي"),
    "extra preliminary round": ("Extra Preliminary Round", "الدور التمهيدي المبكر"),
    "1/64": ("Round of 64", "دور الـ64"),
    "1/32": ("Round of 32", "دور الـ32"),
    "1/16": ("Round of 32", "دور الـ32"),
    "1/8": ("Round of 16", "دور الـ16"),
    "1/4": ("Quarter-Finals", "ربع النهائي"),
    "1/2": ("Semi-Finals", "نصف النهائي"),
}

AR_ORDINALS = {1: "الأول", 2: "الثاني", 3: "الثالث", 4: "الرابع",
               5: "الخامس", 6: "السادس", 7: "السابع", 8: "الثامن"}


def round_labels(round_str, round_name="", cup=False):
    """(en, ar) label for a round — handles league matchdays and cup rounds."""
    r = str(round_str or "").strip()
    rn = str(round_name or "").strip()
    key = (rn if rn and not rn.replace(".", "").isdigit() else r).lower()
    if key in ROUND_LABELS:
        return ROUND_LABELS[key]
    if r.isdigit():
        if cup:
            return (f"Round {r}", f"الدور {AR_ORDINALS.get(int(r), r)}")
        return (f"Matchday {r}", f"الجولة {r}")
    if r:
        return (rn or r, rn or r)
    return ("Fixtures", "مباريات")


def city_ar(city_en):
    if not city_en:
        return ""
    return CITIES.get(city_en.strip().lower(), "")


def country_ar(country_en):
    if not country_en:
        return ""
    return COUNTRIES.get(country_en.strip().lower(), "")


def alias_ar(fotmob_name):
    if not fotmob_name:
        return ""
    n = norm(fotmob_name)
    if n in ALIASES:
        return ALIASES[n]
    # try progressively shorter forms (e.g. "al hilal saudi fc" -> "al hilal saudi")
    toks = n.split()
    while len(toks) > 1:
        toks.pop()
        cand = " ".join(toks)
        if cand in ALIASES and ALIASES[cand]:
            return ALIASES[cand]
    return ""


# --------------------------------------------------------------------------
# Curated home-venue overrides for the rare fixtures where the source
# publishes no stadium (keeps calendar data 100% complete).
# key = fotmob team id
# --------------------------------------------------------------------------
VENUE_OVERRIDES = {
    "9754": {  # Hapoel Beer Sheva
        "name": "Turner Stadium", "city": "Be'er Sheva", "country": "Israel",
        "lat": 31.2453, "lng": 34.7914, "cap": 16126, "surface": "grass",
    },
}
