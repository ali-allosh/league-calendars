/* ==========================================================================
   i18n — Arabic (default) + English
   ========================================================================== */
(function (global) {
  "use strict";

  var STR = {
    /* ---- global ---- */
    brand:            { ar: "تقاويم الدوريات", en: "League Calendars" },
    tagline:          { ar: "جداول مباريات دورياتك المفضلة — في تقويمك",
                        en: "Your favourite leagues' fixtures — right in your calendar" },
    langToggle:       { ar: "English", en: "العربية" },
    themeDark:        { ar: "الوضع الليلي", en: "Dark mode" },
    themeLight:       { ar: "الوضع النهاري", en: "Light mode" },
    skipToContent:    { ar: "تخطَّ إلى المحتوى", en: "Skip to content" },

    /* ---- home ---- */
    heroKicker:       { ar: "تحديث تلقائي يومياً • بيانات FotMob", en: "Auto-updated daily • FotMob data" },
    heroTitle:        { ar: "كل مباريات فريقك، في تقويم واحد", en: "Every match of your team, in one calendar" },
    heroSub:          { ar: "حمّل جدول الدوري كاملاً أو جدول فريقك فقط — بتوقيت دقيق، وتفاصيل الملعب، وتذكير قبل المباراة. يعمل مع تقويم آبل، أوت لوك، جوجل، وكل تطبيقات ICS.",
                        en: "Download the full league table or just your team's fixtures — exact times, stadium details and match reminders. Works with Apple Calendar, Outlook, Google and any ICS app." },
    statLeagues:      { ar: "بطولة", en: "Competitions" },
    statTeams:        { ar: "فريقاً", en: "Teams" },
    statMatches:      { ar: "مباراة", en: "Matches" },
    statStadiums:     { ar: "ملعباً", en: "Stadiums" },
    searchPlaceholder:{ ar: "ابحث عن دوري أو فريق…", en: "Search a league or team…" },
    searchNoResults:  { ar: "لا توجد نتائج مطابقة", en: "No matching results" },
    searchLeagues:    { ar: "الدوريات", en: "Leagues" },
    searchTeams:      { ar: "الفرق", en: "Teams" },

    /* ---- reminders ---- */
    remindersTitle:   { ar: "تنبيهات المباريات القادمة", en: "Upcoming match reminders" },
    remindersSub:     { ar: "أقرب المباريات في جميع الدوريات — بوقتك المحلي", en: "The nearest kick-offs across all leagues — in your local time" },
    nextMatch:        { ar: "المباراة القادمة", en: "Next match" },
    nextMatchOf:      { ar: "المباراة القادمة لفريقك", en: "Your team's next match" },
    kickoff:          { ar: "انطلاق المباراة", en: "Kick-off" },
    remindMe:         { ar: "تذكير بالمباراة", en: "Remind me" },
    addToGoogle:      { ar: "إضافة إلى Google", en: "Add to Google" },
    reminderDone:     { ar: "تم تنزيل التذكير — افتح الملف ليُضاف إلى تقويمك (تنبيه قبل ٣٠ دقيقة ويوم كامل)",
                        en: "Reminder downloaded — open it to add to your calendar (alerts 30 min & 24 h before)" },
    upcoming:         { ar: "مباريات قادمة", en: "Upcoming" },
    d:                { ar: "يوم", en: "d" },
    h:                { ar: "س", en: "h" },
    m:                { ar: "د", en: "m" },
    s:                { ar: "ث", en: "s" },
    startsIn:         { ar: "تبدأ بعد", en: "Starts in" },
    liveNow:          { ar: "مباشر الآن", en: "LIVE" },
    noUpcoming:       { ar: "لا مباريات قادمة مجدولة حالياً", en: "No upcoming matches scheduled" },

    /* ---- leagues ---- */
    chooseLeague:     { ar: "اختر بطولة", en: "Choose a competition" },
    chooseLeagueSub:  { ar: "الدوريات الكبرى والكؤوس المحلية — اضغط على أي بطولة للبدء", en: "Big leagues & cup competitions — tap any of them to begin" },
    matchesCount:     { ar: "مباراة", en: "matches" },
    teamsCount:       { ar: "فريقاً", en: "teams" },
    seasonLabel:      { ar: "الموسم", en: "Season" },

    /* ---- league options sheet ---- */
    whatToDownload:   { ar: "ماذا تريد أن تحمّل؟", en: "What would you like to download?" },
    optFullTitle:     { ar: "جدول مباريات الدوري كاملاً", en: "Full league fixtures" },
    optFullDesc:      { ar: "كل مباريات الموسم بجميع الجولات — مع التوقيت الدقيق وتفاصيل الملعب لكل مباراة",
                        en: "Every match of the season, all rounds — with exact times & stadium details for each" },
    optTeamTitle:     { ar: "جدول مباريات فريقي", en: "My team's fixtures" },
    optTeamDesc:      { ar: "اختر فريقك من قائمة الفرق لتتابع مبارياته فقط في الديار والخارج",
                        en: "Pick your club from the list to follow its home & away matches only" },
    close:            { ar: "إغلاق", en: "Close" },

    /* ---- league calendar view ---- */
    fullFixturesOf:   { ar: "جدول", en: "Fixtures" },
    leagueFixturesH:  { ar: "مباريات الدوري كاملة", en: "Full league fixtures" },
    downloadCalendar: { ar: "حمّل التقويم", en: "Download the calendar" },
    downloadCalendarSub:{ ar: "اختر صيغتك المفضلة — كل الصيغ تحوي التفاصيل كاملة والمصدر",
                        en: "Pick your format — every format carries the full details & source" },

    copyLink:         { ar: "نسخ الرابط", en: "Copy link" },
    copied:           { ar: "تم نسخ رابط الاشتراك ✓", en: "Subscription link copied ✓" },

    /* ---- teams ---- */
    chooseTeam:       { ar: "اختر فريقك", en: "Pick your team" },
    chooseTeamSub:    { ar: "اضغط على الشعار لعرض جدول مباريات الفريق وصيغ التحميل", en: "Tap a crest to see the club's fixtures & download formats" },
    searchTeam:       { ar: "ابحث عن فريق…", en: "Search a team…" },
    next:             { ar: "التالية", en: "Next" },
    vs:               { ar: "ضد", en: "vs" },

    /* ---- team view ---- */
    teamFixtures:     { ar: "مباريات الفريق", en: "Team fixtures" },
    allMatches:       { ar: "المباريات", en: "Matches" },
    homeMatch:        { ar: "ديار", en: "Home" },
    awayMatch:        { ar: "خارج", en: "Away" },

    /* ---- fixtures list ---- */
    fixtures:         { ar: "المباريات", en: "Fixtures" },
    filterAll:        { ar: "الكل", en: "All" },
    filterUpcoming:   { ar: "القادمة", en: "Upcoming" },
    filterFinished:   { ar: "انتهت", en: "Finished" },
    matchday:         { ar: "الجولة", en: "Matchday" },
    matchdayShort:    { ar: "ج", en: "MD" },
    today:            { ar: "اليوم", en: "Today" },
    tomorrow:         { ar: "غداً", en: "Tomorrow" },
    yesterday:        { ar: "أمس", en: "Yesterday" },
    finishedLabel:    { ar: "انتهت", en: "FT" },
    postponed:        { ar: "مؤجلة", en: "Postponed" },
    tbd:              { ar: "يُعلن لاحقاً", en: "TBD" },
    showAllRounds:    { ar: "كل الجولات", en: "All rounds" },
    showMore:         { ar: "عرض المزيد", en: "Show more" },
    showLess:         { ar: "عرض أقل", en: "Show less" },
    noMatchesFilter:  { ar: "لا مباريات مطابقة للفلتر", en: "No matches for this filter" },
    venueLabel:       { ar: "الملعب", en: "Venue" },
    capacityLabel:    { ar: "السعة", en: "Capacity" },
    refereeLabel:     { ar: "الحكم", en: "Referee" },
    attendanceLabel:  { ar: "الحضور", en: "Attendance" },
    viewOnFotmob:     { ar: "التفاصيل على FotMob", en: "Details on FotMob" },

    /* ---- expandable match row ---- */
    expandHint:       { ar: "اضغط على أي مباراة لعرض التفاصيل الكاملة والقنوات الناقلة",
                        en: "Tap any match for full details & TV channels" },
    matchDetails:     { ar: "تفاصيل المباراة", en: "Match details" },
    kickoffLocal:     { ar: "وقت الانطلاق", en: "Kickoff" },
    leagueLabel:      { ar: "البطولة", en: "Competition" },
    roundLabel:       { ar: "الجولة", en: "Round" },
    surfaceLabel:     { ar: "الأرضية", en: "Surface" },
    resultLabel:      { ar: "النتيجة", en: "Result" },
    statusLabel:      { ar: "الحالة", en: "Status" },
    tvChannels:       { ar: "القنوات الناقلة", en: "TV channels" },
    tvNone:           { ar: "لم تُعلن القنوات الناقلة بعد — تُنشر عادة قبل المباراة بأيام قليلة",
                        en: "Broadcasters not announced yet — usually listed a few days before kick-off" },
    tvSourceNote:     { ar: "القنوات الناقلة من 365scores (عرض المنطقة العربية) وFotMob",
                        en: "Broadcasters via 365scores (MENA view) & FotMob" },
    openInMaps:       { ar: "افتح في الخرائط", en: "Open in Maps" },
    sourcesLabel:     { ar: "المصادر والمزيد", en: "Sources & more" },
    viewOn365:        { ar: "البطولة على 365scores", en: "Competition on 365scores" },
    moreOnFotmob:     { ar: "صفحة المباراة على FotMob", en: "Match page on FotMob" },

    /* ---- formats ---- */
    fmtApple:         { ar: "تقويم Apple", en: "Apple Calendar" },
    fmtAppleD:        { ar: "اشتراك مباشر في تطبيق التقويم", en: "Subscribe directly in the Calendar app" },
    fmtOutlook:       { ar: "Outlook", en: "Outlook" },
    fmtOutlookD:      { ar: "ملف ICS يستورد في أوت لوك", en: "ICS file that imports into Outlook" },
    fmtICS:           { ar: "ملف ICS", en: "ICS file" },
    fmtICSD:          { ar: "الصيغة القياسية لكل التطبيقات", en: "The standard format for every app" },
    fmtGoogle:        { ar: "Google Calendar", en: "Google Calendar" },
    fmtGoogleD:       { ar: "إضافة سريعة إلى حساب Google", en: "Quick-add to your Google account" },
    downloaded:       { ar: "تم تنزيل التقويم ✓", en: "Calendar downloaded ✓" },
    downloadedOf:     { ar: "تم تنزيل تقويم {x} — افتح الملف ليُضاف إلى تطبيق التقويم. المصدر داخل الملف: FotMob.",
                        en: "Downloaded the {x} calendar — open the file to add it to your calendar app. Source inside the file: FotMob." },
    downloadedOfOutlook: { ar: "تم تنزيل تقويم {x} — في Outlook: ملف ← فتح ← استيراد (أو اسحب الملف إلى نافذة Outlook). المصدر داخل الملف: FotMob.",
                        en: "Downloaded the {x} calendar — in Outlook: File → Open & Import (or drag the file onto Outlook). Source inside the file: FotMob." },
    googleHint:       { ar: "استورد الملف من calendar.google.com ← الإعدادات ← استيراد وتصدير",
                        en: "Import the file at calendar.google.com → Settings → Import & export" },
    openedWebcal:     { ar: "يجري فتح تطبيق التقويم…", en: "Opening your calendar app…" },
    googleOpened:     { ar: "تم فتح Google Calendar — أكد إضافة التقويم هناك ✓",
                        en: "Google Calendar opened — confirm the subscription there ✓" },
    directDl:         { ar: "تحميل مباشر للملف", en: "Direct file download" },
    dlFallbackHint:   { ar: "لم يبدأ التحميل؟ انقر بالزر الأيمن على «التحميل المباشر» واختر «حفظ الرابط باسم…»",
                        en: "Download didn't start? Right-click “Direct file download” and choose “Save link as…”" },

    /* ---- format sheet (per-app add flows) ---- */
    fmtSheetHow:      { ar: "كيف تضيف التقويم؟", en: "How would you like to add it?" },
    autoUpdatesNote:  { ar: "اشتراك يتحدّث تلقائياً — ٤ مرات يومياً مع كل تغيير في المواعيد",
                        en: "A subscription that auto-refreshes 4× daily as fixtures change" },
    subSectionT:      { ar: "اشتراك تلقائي (موصى به)", en: "Live subscription (recommended)" },
    fileSectionT:     { ar: "ملف ICS — استيراد يدوي", en: "ICS file — manual import" },
    subNowApple:      { ar: "اشترك الآن — يفتح تطبيق التقويم", en: "Subscribe now — opens Calendar" },
    appleOtherNote:   { ar: "لم يفتح التطبيق؟ في تطبيق التقويم: ملف ← اشتراك تقويم جديد ← الصق الرابط أعلاه.",
                        en: "Didn't open? In Calendar: File → New Calendar Subscription → paste the link above." },
    openGoogleNow:    { ar: "افتح Google Calendar الآن", en: "Open Google Calendar now" },
    googleManualNote: { ar: "أو يدوياً: calendar.google.com ← الإعدادات ← إضافة تقويم ← من الرابط ← الصق الرابط أعلاه.",
                        en: "Or manually: calendar.google.com → Settings → Add calendar → From URL → paste the link above." },
    outlookWebNote:   { ar: "Outlook على الويب: التقويم ← «إضافة تقويم» ← «الاشتراك من الويب» ← الصق الرابط أعلاه.",
                        en: "Outlook on the web: Calendar → Add calendar → Subscribe from the web → paste the link above." },
    outlookPcNote:    { ar: "Outlook للكمبيوتر/الجوال: حمّل الملف بالأسفل ثم: ملف ← فتح ← استيراد.",
                        en: "Outlook desktop/mobile: download the file below, then File → Open & Import." },
    icsAnyAppNote:    { ar: "الصيغة القياسية — تعمل مع Apple وOutlook وGoogle وكل تطبيقات التقويم.",
                        en: "The standard format — works with Apple, Outlook, Google and every calendar app." },
    dlFileNow:        { ar: "تحميل ملف ICS الآن", en: "Download the ICS file now" },
    embeddedNote:     { ar: "أنت تعرض التطبيق داخل إطار معاينة مقيّد — إن لم يعمل زر التحميل استخدم «التحميل المباشر» بالزر الأيمن للفأرة.",
                        en: "You're viewing the app inside a restricted preview frame — if the button doesn't work, use “Direct file download” with a right-click." },
    hostedNote:       { ar: "روابط الاشتراك تعمل بعد رفع الموقع على الإنترنت (GitHub Pages) — تحميل ملف ICS يعمل الآن.",
                        en: "Subscription links activate once the site is online (GitHub Pages) — the ICS file download works right now." },

    /* ---- favorites ---- */
    favAdd:           { ar: "أضف إلى فريقي", en: "Add to my teams" },
    favRemove:        { ar: "إزالة من فريقي", en: "Remove from my teams" },
    myTeams:          { ar: "فريقي", en: "My teams" },
    myTeamsSub:       { ar: "فرقك المفضلة — مبارياتها القادمة أول ما تظهر", en: "Your favourites — their next matches come first" },

    /* ---- back / nav ---- */
    back:             { ar: "رجوع", en: "Back" },
    home:             { ar: "الرئيسية", en: "Home" },

    /* ---- footer ---- */
    footerAbout:      { ar: "تطبيق مفتوح يحمّل جداول مباريات الدوريات الكبرى إلى تقويمك — بأوقات دقيقة، وتفاصيل ملاعب، وتذكيرات قبل المباريات. البيانات تُحدَّث تلقائياً عدة مرات يومياً.",
                        en: "An open app that puts the big leagues' fixtures into your calendar — exact times, stadium details and pre-match reminders. Data refreshes automatically several times a day." },
    dataSources:      { ar: "مصادر البيانات", en: "Data sources" },
    sourcePrimary:    { ar: "المصدر الأساسي: FotMob — المباريات والأوقات والملاعب", en: "Primary source: FotMob — matches, times & stadiums" },
    sourceSecondary:  { ar: "المصدر الثانوي: 365scores — الأسماء العربية والتحقق", en: "Secondary source: 365scores — Arabic names & verification" },
    lastUpdate:       { ar: "آخر تحديث للبيانات", en: "Last data update" },
    autoUpdateNote:   { ar: "المواعيد والنتائج تتحدّث تلقائياً ٤ مرات يومياً", en: "Fixtures & results auto-update 4× daily" },
    localTimeNote:    { ar: "كل الأوقات تُعرض بتوقيتك المحلي",
                        en: "All times are shown in your local timezone" },
    /* ---- settings modal ---- */
    settingsTitle:    { ar: "الإعدادات", en: "Settings" },
    setLanguage:      { ar: "اللغة", en: "Language" },
    setTheme:         { ar: "المظهر", en: "Appearance" },
    setTimeFmt:       { ar: "تنسيق الوقت", en: "Time format" },
    setTz:            { ar: "المنطقة الزمنية", en: "Timezone" },
    tzDevice:         { ar: "توقيت جهازك", en: "Device timezone" },
    setNotify:        { ar: "إشعارات المباريات", en: "Match notifications" },
    setNotifySub:     { ar: "تنبيه عند كل هدف وبدء المباريات المباشرة — أثناء فتح التطبيق فقط",
                        en: "Alert on goals and live kickoffs — only while the app is open" },
    setNotifyOn:      { ar: "مفعّلة", en: "On" },
    setNotifyOff:     { ar: "معطّلة", en: "Off" },
    setFavs:          { ar: "المفضلة", en: "Favorites" },
    setFavsSub:       { ar: "الأندية والبطولات المتابعة — تظهر أولاً في الصفحة الرئيسية",
                        en: "Followed clubs & competitions — shown first on the home page" },
    noFavs:           { ar: "لا توجد مفضلات بعد — اضغط النجمة على أي فريق أو بطولة", en: "No favorites yet — tap the star on any team or competition" },
    themeDark:        { ar: "ليلي", en: "Dark" },
    themeLight:       { ar: "نهاري", en: "Light" },
    hour12:           { ar: "12 ساعة", en: "12-hour" },
    hour24:           { ar: "24 ساعة", en: "24-hour" },

    /* ---- live ---- */
    liveSectionT:     { ar: "المباريات المباشرة الآن", en: "Live matches now" },
    liveSwitch:       { ar: "مباشر", en: "Live" },
    liveMin:          { ar: "د", en: "'" },
    liveNoMatches:    { ar: "لا توجد مباريات مباشرة حالياً", en: "No live matches right now" },
    liveGoal:         { ar: "هدف!", en: "GOAL!" },
    liveKickoff:      { ar: "انطلقت المباراة", en: "Kick-off" },
    liveEnded:        { ar: "انتهت المباراة", en: "Full time" },
    notifyAsk:        { ar: "لتفعيل الإشعارات اسمح بالإشعارات من المتصفح", en: "Allow notifications in your browser to enable alerts" },
    notifyInApp:      { ar: "التنبيهات داخل التطبيق مفعّلة ✅", en: "In-app alerts are on ✅" },

    /* ---- live events timeline ---- */
    liveEventsT:      { ar: "أحداث المباراة", en: "Match events" },
    evGoal:           { ar: "هدف", en: "Goal" },
    evOwnGoal:        { ar: "هدف ذاتي", en: "Own goal" },
    evPenalty:        { ar: "ركلة جزاء", en: "Penalty" },
    evPenShootout:    { ar: "ركلة ترجيح", en: "Shootout penalty" },
    evYellow:         { ar: "بطاقة صفراء", en: "Yellow card" },
    evRed:            { ar: "بطاقة حمراء", en: "Red card" },
    evSub:            { ar: "تبديل", en: "Substitution" },
    evMissedPen:      { ar: "ركلة جزاء ضائعة", en: "Missed penalty" },
    evVar:            { ar: "حكم الفيديو", en: "VAR" },

    /* ---- kickoff soon ---- */
    kickoffSoon:      { ar: "اقتراب انطلاق المباراة", en: "Kick-off soon" },
    kickoffSoonBody:  { ar: "بعد {m} دقيقة: {x}", en: "In {m} min: {x}" },

    disclaimer:       { ar: "المواعيد قابلة للتغيير — يحدّثها التطبيق تلقائياً بعد نشرها لدى المصدر.",
                        en: "Kick-off times can change — the app refreshes them automatically once the source publishes updates." },
    madeWith:         { ar: "صُنع بشغف كرة القدم ⚽", en: "Made with football love ⚽" },

    /* ---- misc ---- */
    loading:          { ar: "جاري التحميل…", en: "Loading…" },
    errorNoData:      { ar: "تعذر تحميل بيانات المباريات. حدّث الصفحة وحاول مجدداً.", en: "Could not load match data. Refresh and try again." },
    pageLeagueTitle:  { ar: "تقاويم الدوريات", en: "League Calendars" },
  };

  function t(key, lang) {
    var e = STR[key];
    if (!e) return key;
    return e[lang || global.A7LANG] || e.ar;
  }

  global.A7I18N = { STR: STR, t: t };
})(window);
