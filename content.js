// MedleaPlus — decoration + cursor-reactive console behaviour.
//
// styles.css does all static styling. This file does what CSS can't:
//   1. copy each event's original key colour into --key (probed from its colour
//      family class on a detached element, since the live header is blanked by CSS)
//   2. store each event's slot height in --h so :hover can expand clipped panes
//   3. lift z-index:-1 grid furniture above the console background
//   4. tag the anonymous toolbar div / date-nav / options link for styles.css
//   5. mount the ambient FX layers and drive the cursor interactions

(function () {
  'use strict';

  const keyCache = {};

  // 1Med home portal (www.1med…): a Bootstrap shell embedding cross-origin .widget
  // iframes. Flag <html> so styles.css can scope the shell skin (the dark navbar is the
  // shared .navbar.bg-uom treatment; the rest is the .mp-1med block in styles.css).
  if (location.hostname === 'www.1med.manchester.ac.uk') {
    document.documentElement.classList.add('mp-1med');
  }

  // Load the timetable's EXACT font on EVERY host — medlea pulls Open Sans from Google
  // Fonts, but 1med AND onemed ship their own "Open Sans" files with different metrics
  // (1med's rendered the header name ~6px narrower; onemed's rendered the clock digits
  // ~1px wider). Same-name-different-file drift broke pixel parity twice — so the same
  // Google file is loaded everywhere (no-op on medlea beyond a cached duplicate).
  if (!document.getElementById('mp-gfont')) {
    const gf = document.createElement('link');
    gf.id = 'mp-gfont'; gf.rel = 'stylesheet';
    gf.href = 'https://fonts.googleapis.com/css?family=Open+Sans:300,400,600';
    (document.head || document.documentElement).appendChild(gf);
  }

  // The 1Med home embeds its events + to-do as cross-origin iframes served from
  // medlea/onemed/home.aspx. The manifest injects us INTO those frames (all_frames), so
  // instead of a white card we restyle their content straight into the violet theme.
  // Flag the frame; styles.css's .mp-homewidget block does the rest. These frames have
  // no navbar/calendar/FX to build — skip the whole decorate() pass for them.
  const IS_HOME_WIDGET = /\/onemed\/home\.aspx/i.test(location.pathname);
  if (IS_HOME_WIDGET) document.documentElement.classList.add('mp-homewidget');

  // Task Inbox / "More Tasks" (medlea/tasks): standard medlea page reusing the Submissions
  // classes; flag it so styles.css can tidy its Todo sidebar layout specifically.
  if (/\/tasks\//i.test(location.pathname)) document.documentElement.classList.add('mp-tasks');

  // Logon gateway (medlea/auth/logon.aspx): the logged-out page — a classless 1998 table
  // (red "MedLea" bar + a groove fieldset with two login methods, the email form hidden
  // until "Enter Details"). No navbar/#content-body here, so it's all pure CSS: flag
  // <html>.mp-login and the LOGIN section of styles.css rebuilds it into the console
  // (dark aurora canvas + a centred glass auth card). ensureLayers() still mounts the FX.
  if (/\/auth\/logon\.aspx/i.test(location.pathname)) document.documentElement.classList.add('mp-login');

  // Shibboleth central sign-in (shib.manchester.ac.uk): the University's IdP login,
  // reached from the logon "Log In Here". A white responsive-framework page; flag
  // <html>.mp-shib and the SHIBBOLETH section of styles.css dark-themes it. Pure skin —
  // nothing here reads the credential fields; the shared decorateFooter() docks the
  // MEDLEA+ bar onto its footer.footerContainer for free.
  if (location.hostname === 'shib.manchester.ac.uk') document.documentElement.classList.add('mp-shib');

  // Add-personal-event page: single-month calendar nav + single-date select state.
  let aeVisIdx = 0, aeSelBound = false, aeSuppress = false;

  function familyColor(header) {
    const fam = [...header.classList].find(c => /^aj-event-header-/.test(c));
    if (!fam) return null;
    if (!(fam in keyCache)) {
      const probe = document.createElement('div');
      probe.className = fam;
      probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;';
      document.body.appendChild(probe);
      const c = getComputedStyle(probe).backgroundColor;
      probe.remove();
      keyCache[fam] = (c && c !== 'rgba(0, 0, 0, 0)') ? c : null;
    }
    return keyCache[fam];
  }

  function ensureLayers() {
    if (document.getElementById('mp-fx-root')) return;
    const root = document.createElement('div');
    root.id = 'mp-fx-root';
    root.innerHTML = '<div class="mp-fx mp-aurora"></div>' +
                     '<div class="mp-fx mp-grid"></div>' +
                     '<div class="mp-fx mp-spotlight"></div>';
    document.body.appendChild(root);
  }

  // 1Med home: the onemedbuzz widgets are removed (styles.css hides the iframes); also
  // collapse their now-empty Bootstrap column wrappers so no gap is left behind.
  function decorate1med() {
    if (!document.documentElement.classList.contains('mp-1med')) return;
    document.querySelectorAll('iframe[src*="onemedbuzz"]').forEach(f => {
      const wrap = f.closest('.col-12,.col-md-6,.col') || f.parentElement;
      if (wrap && wrap !== document.body && wrap.style.display !== 'none') wrap.style.display = 'none';
    });
    // The big "Hi <name> / Welcome…" hero is dropped (styles.css hides the greeting);
    // keep only the welcome note but relocate it to a modest spot just above the footer,
    // where styles.css renders it small and muted. Move once.
    const blurb = document.querySelector('.blurb');
    const footer = document.querySelector('footer');
    if (blurb && footer && footer.parentNode && !blurb.dataset.mpMoved) {
      blurb.dataset.mpMoved = '1';
      footer.parentNode.insertBefore(blurb, footer);
    }
    // The header search/magnifier is removed on every page (user request) — we no longer
    // inject one here; removeHeaderSearch() strips any stale/native one across all headers.
    //
    // NOTE: the medlea timetable prints the user's name WITH an honorific ("Mr/Ms/Dr …")
    // and the 1med bar prints it without, so the two right-hand clusters differ by that
    // one word. An earlier build closed the gap by prepending a hard-coded title — which
    // is only ever correct for one person. A viewer's title is not knowable from this
    // page (it lives on a different origin), and guessing it would put the wrong one in
    // front of somebody's name, so the name is now left exactly as 1med renders it.
  }

  // ── Tab favicon ─────────────────────────────────────────────────────────────
  // Every skinned host ships its own mark (medlea's purple "M", 1med's crest…),
  // so a window of 1Med tabs is a row of mismatched icons that no longer look like
  // the console they open into. Replace them with the MedleaPlus mark: the SAME
  // artwork as the extension icon (icons/mkicon.py), re-drawn as an SVG so it is a
  // few hundred bytes, needs no web_accessible_resources, and stays crisp at any
  // tab density.
  // It is a MONOGRAM — a big ice "M" with the brand's orchid "+", i.e. the footer
  // wordmark's own MEDLEA**+** lockup — NOT the extension icon's card artwork. A
  // favicon is drawn at 16–32px essentially always, and the card/spine/badge
  // composition turns to mush there (verified by rendering it at 16/20/32 in-page);
  // a two-glyph monogram survives. It also keeps continuity with medlea's own "M"
  // tab mark, which is what the tab used to show. The M is set in Times (user's
  // call) with a generic `serif` fallback, so it degrades to some serif M rather
  // than to nothing if the family is missing.
  const MP_FAVICON =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    '<defs><linearGradient id="p" x1="0" y1="0" x2="0.4" y2="1">' +
      '<stop offset="0" stop-color="#1C0F2E"/><stop offset="1" stop-color="#47156B"/>' +
    '</linearGradient></defs>' +
    '<rect width="64" height="64" rx="14.4" fill="url(#p)"/>' +
    '<text x="23.5" y="47" text-anchor="middle" fill="#ECE7FF"' +
      ' font-family="Times New Roman, Times, serif" font-weight="700" font-size="43">M</text>' +
    '<rect x="44" y="18.85" width="16" height="6.3" rx="2.1" fill="#C97DFF"/>' +
    '<rect x="48.85" y="14" width="6.3" height="16" rx="2.1" fill="#C97DFF"/>' +
    '</svg>';
  function setFavicon() {
    const head = document.head;
    if (!head) return;
    document.querySelectorAll('link[rel~="icon"], link[rel~="shortcut"], link[rel="mask-icon"]')
      .forEach(l => { if (l.id !== 'mp-favicon') l.remove(); });
    if (document.getElementById('mp-favicon')) return;
    const link = document.createElement('link');
    link.id = 'mp-favicon';
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href = 'data:image/svg+xml,' + encodeURIComponent(MP_FAVICON);
    head.appendChild(link);
  }

  function decorate() {
    if (IS_HOME_WIDGET) return;   // embedded widget: styling is pure-CSS (.mp-homewidget)
    setFavicon();
    ensureLayers();
    decorate1med();
    extendDayStart();
    document.querySelectorAll('.aj-week-event').forEach((ev, i) => {
      if (!ev.style.getPropertyValue('--key')) {
        const hd = ev.querySelector('.aj-week-event-header');
        const key = hd && familyColor(hd);
        if (key) ev.style.setProperty('--key', key);
      }
      if (!ev.style.getPropertyValue('--h') && ev.style.height) {
        ev.style.setProperty('--h', ev.style.height);
      }
      if (!ev.dataset.mpIn) {             // stagger the entrance once per pane
        ev.style.animationDelay = Math.min(i * 45, 700) + 'ms';
        ev.dataset.mpIn = '1';
      }
    });
    document.querySelectorAll('.aj-tt-grid *').forEach(el => {
      if (getComputedStyle(el).zIndex === '-1') el.style.zIndex = '0';
    });
    const tb = [...document.querySelectorAll('#optsform div, #content-body div')].find(d =>
      d.children.length && [...d.querySelectorAll(':scope > a')].some(a => a.textContent.includes('Find Sign-Ups')));
    if (tb) tb.classList.add('cl-toolbar');
    const fd = document.getElementById('from_date');
    if (fd) fd.parentElement.classList.add('cl-datenav');
    tagDayNumbers();
    tagInlineBg();
    litDarkText();
    litLightBoxes();
    decorateEvalGrids();
    decorateProgressTest();
    decorateCCA();
    decorateAttendance();
    decorateFormIcons();
    decorateFormList();
    decorateFormNotice();
    decorateGlyphs();
    decorateFormPages();   // after decorateGlyphs(): it relocates the swapped glyphs
    decorateGroups();
    decorateEventIcons();
    decorateAddEvent();
    decorateBinIcons();
    darkenEditorIframes();
    swapOptionsForToday();
    drawNowLine();
    buildProfileNavbar();
    removeHeaderSearch();
    buildClock();
    decorateCrumb();
    decorateLogin();
    decorateFooter();
  }

  // ── Logon gateway brand header (medlea/auth/logon.aspx) ─────────────────────
  // The site heads the page with a red "MedLea" bar — a classless td.layout-sitename
  // carrying an inline height:20px that clips its content box. Rebuild it as the
  // MEDLEA+ console wordmark (mark / MEDLEA+ / mono subtitle) so the LOGIN css can
  // stack the two lines and pin the flowing accent line safely BELOW them. Runs once
  // (dataset guard); the MutationObserver re-fire is a no-op after the first pass.
  function decorateLogin() {
    if (!document.documentElement.classList.contains('mp-login')) return;
    const bar = document.querySelector('.layout-sitename');
    if (!bar || bar.dataset.mpBrand) return;
    bar.dataset.mpBrand = '1';
    bar.innerHTML = '<span class="mp-login-mark" aria-hidden="true">◆</span>' +
                    '<span class="mp-login-word">MEDLEA<b>+</b></span>' +
                    '<span class="mp-login-sub">1MED · TIMETABLE CONSOLE</span>';
  }

  // ── Header console clock: a live UK-time (Europe/London, BST-aware) digital clock
  // centred in the navbar. Cyan --pulse (reserved for time/live signals) with a soft
  // glow, a muted mono date line above, and a gently pulsing live dot. SF Mono so the
  // ticking seconds never shift layout. Built once per page (guarded on #mp-clock); the
  // self-correcting timeout re-aligns to each second boundary and stops if the navbar is
  // ever replaced. Appears on any page carrying the shared .navbar.bg-uom header.
  function buildClock() {
    const nav = document.querySelector('.navbar.bg-uom');
    if (!nav || document.getElementById('mp-clock')) return;
    const clock = document.createElement('div');
    clock.id = 'mp-clock';
    clock.className = 'mp-clock';
    clock.setAttribute('aria-hidden', 'true');
    clock.innerHTML = '<div class="mp-clock-date"></div>' +
      '<div class="mp-clock-time"><span class="mp-clock-dot"></span><span class="mp-clock-hms"></span></div>';
    nav.appendChild(clock);
    const dateEl = clock.querySelector('.mp-clock-date');
    const hmsEl = clock.querySelector('.mp-clock-hms');
    // Intl with timeZone:'Europe/London' shows UK time and flips GMT↔BST on its own;
    // hourCycle h23 avoids the "24:00" midnight quirk of hour12:false.
    const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    const dateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    const part = (fmt, d) => fmt.formatToParts(d).reduce((o, p) => (o[p.type] = p.value, o), {});
    function update() {
      const d = new Date();
      const t = part(timeFmt, d);
      hmsEl.innerHTML = t.hour + ':' + t.minute + ':<span class="mp-clock-sec">' + t.second + '</span>';
      const dt = part(dateFmt, d);
      dateEl.textContent = (dt.weekday + ' ' + dt.day + ' ' + dt.month + ' ' + dt.year).toUpperCase();
    }
    (function tick() {
      if (!clock.isConnected) return;                 // navbar replaced → stop this loop
      update();
      setTimeout(tick, 1000 - (Date.now() % 1000));   // re-align to the next second
    })();
  }

  // ── Live "now" line: a cyan current-time thread + dot in today's column, on the
  // week/day time grid. Positioned from the .aj-week-time labels' RENDERED screen
  // positions (their offsetTop is on a differently-scaled gutter, so screen rects
  // are the only reliable ground truth), so it stays accurate at any scroll. Only
  // drawn when today is one of the visible day columns and the time is on-grid.
  // Hidden labels (other views' panes) are told apart by ZERO-SIZE rects, never by
  // y>0: labels scrolled above the viewport have negative y but full height, and a
  // y>0 filter made every redraw-while-scrolled drop them → nowY fell outside the
  // surviving labels' range → early return AFTER the old line was removed, so the
  // line vanished on scroll. All rects are same-frame, so negative y is harmless.
  // ── Day start: begin the grid at 6am ───────────────────────────────────────
  // The site draws the day from 08:00 (l2.js: `var first_hour = 8; var last_hour = 23`)
  // — but it ALSO widens those bounds to fit the week's events (`if (e.eventStart
  // .getHours() < first_hour) first_hour = e.eventStart.getHours()`), so a 03:00 event
  // is never silently hidden. THAT PROPERTY IS LOAD-BEARING AND MUST SURVIVE: the grid
  // is only ever extended, never trimmed. We lower the start to 6am when the site began
  // later than that, and do nothing at all when the site already begins earlier.
  //
  // The geometry, all measured off the live grid: the canvas is `.aj-tt-grid`
  // (position:relative, height auto) inside the sized `#cal_holder`; 60px per hour;
  // canvas y=0 represents `first_hour` AFTER l2.js's `first_hour -= .5`, so the default
  // origin is 07:30. Each hour ships TWO `.aj-week-time` divs — the right-aligned text at
  // `top-10` and a 1px full-width rule at `top` — where `top = (hour - origin) * 60`.
  const MP_DAY_START = 6;    // the clock hour the grid should start at
  const MP_HOUR_PX   = 60;   // l2.js: `var hourHeight = 60`

  function mpHourOf(t){
    t = String(t).trim().toLowerCase();
    if (t === 'midnight') return 24;
    if (t === 'midday' || t === 'noon') return 12;
    const m = /^(\d{1,2})(am|pm)$/.exec(t);
    if (!m) return null;
    const h = +m[1] % 12;
    return m[2] === 'pm' ? h + 12 : h;
  }
  // Match the site's own wording, so nowLineParse() reads our labels like any other.
  function mpHourLabel(h){
    h = ((h % 24) + 24) % 24;
    return h === 0 ? 'midnight' : h === 12 ? 'midday' : h < 12 ? h + 'am' : (h - 12) + 'pm';
  }

  function extendDayStart(){
    const labels = [...document.querySelectorAll('.aj-week-time')];
    if (!labels.length) return;                       // month view / no hour grid
    const grid = labels[0].parentElement;
    if (!grid || grid.querySelector('.mp-hour-ext')) return;   // already extended this render
    const texts = labels.filter(l => l.textContent.trim());
    const lines = labels.filter(l => !l.textContent.trim());
    if (!texts.length || !lines.length) return;

    const firstHour = mpHourOf(texts[0].textContent);
    if (firstHour == null) return;
    // y=0 of the canvas: the text sits 10px above its rule, and the rule is on the hour.
    const origin = firstHour - (parseFloat(texts[0].style.top) + 10) / MP_HOUR_PX;
    const target = Math.min(origin, MP_DAY_START - 0.5);
    const shift  = (origin - target) * MP_HOUR_PX;
    if (!(shift > 0)) return;                         // site already starts at/earlier than 6am

    // Elements anchored to a clock time move down; elements that span the whole day
    // (the vertical day dividers, top:0 height:<day>) stay put and grow instead —
    // shifting those left the new early band with no dividers at all.
    [...grid.children].forEach(el => {
      if (el.classList.contains('mp-nowline')) return;          // redrawn from scratch below
      if (el.classList.contains('aj-week-day-divider')) {
        const h = parseFloat(el.style.height);
        if (!isNaN(h)) el.style.height = (h + shift) + 'px';
        return;
      }
      const t = parseFloat(el.style.top);
      if (!isNaN(t)) el.style.top = (t + shift) + 'px';
    });

    const holder = grid.closest('#cal_holder') || grid.parentElement;
    const hh = holder && parseFloat(holder.style.height);
    if (holder && !isNaN(hh)) holder.style.height = (hh + shift) + 'px';

    // Draw the newly exposed hours by cloning the site's own two divs, so they inherit
    // every rule (ours and the site's) that already targets .aj-week-time.
    const protoText = texts[0], protoLine = lines[0];
    for (let h = Math.ceil(target); h < Math.ceil(origin); h++) {
      const top = (h - target) * MP_HOUR_PX;
      const tx = protoText.cloneNode(false);
      tx.className = 'aj-week-time mp-hour-ext';
      tx.style.top = (top - 10) + 'px';
      tx.textContent = mpHourLabel(h);
      const ln = protoLine.cloneNode(false);
      ln.className = 'aj-week-time mp-hour-ext';
      ln.style.top = top + 'px';
      ln.textContent = '';
      grid.appendChild(tx);
      grid.appendChild(ln);
    }
  }

  function nowLineParse(t){t=t.trim().toLowerCase();if(t==='midday'||t==='noon')return 720;if(t==='midnight')return 1440;
    var m=t.match(/^(\d{1,2})(:(\d\d))?\s*(am|pm)$/);if(!m)return null;var h=+m[1]%12;if(m[4]==='pm')h+=12;return h*60+(m[3]?+m[3]:0);}
  function drawNowLine(){
    document.querySelectorAll('.mp-nowline').forEach(function(e){e.remove();});
    var grid=document.querySelector('.aj-tt-grid'); if(!grid) return;
    var pts=[].map.call(document.querySelectorAll('.aj-week-time'),function(l){
      var r=l.getBoundingClientRect(); return {m:nowLineParse(l.textContent),y:r.top+r.height/2,h:r.height};
    }).filter(function(p){return p.m!=null&&p.h>0;}).sort(function(a,b){return a.y-b.y;});
    if(pts.length<2) return;
    var A=pts[0],B=pts[1],ppm=(B.y-A.y)/(B.m-A.m);
    if(!isFinite(ppm)||ppm<=0) return;
    var now=new Date(), nm=now.getHours()*60+now.getMinutes();
    var nowY=A.y+(nm-A.m)*ppm, yMin=pts[0].y-8, yMax=pts[pts.length-1].y+ppm*60;
    if(nowY<yMin||nowY>yMax) return;
    var mon=now.toLocaleString('en-GB',{month:'short'});
    var re=new RegExp('\\b'+now.getDate()+'\\s+'+mon+'\\b','i');
    var col=[].slice.call(document.querySelectorAll('.aj-tt-dayHeader')).find(function(h){return re.test(h.textContent);});
    if(!col) return;
    var gr=grid.getBoundingClientRect(), cr=col.getBoundingClientRect();
    var line=document.createElement('div'); line.className='mp-nowline';
    line.style.top=(nowY-gr.top)+'px'; line.style.left=(cr.left-gr.left)+'px'; line.style.width=cr.width+'px';
    var hh=now.getHours()%12||12, lab=hh+':'+(now.getMinutes()<10?'0':'')+now.getMinutes()+(now.getHours()<12?'am':'pm');
    line.innerHTML='<span class="mp-nowlabel">'+lab+'</span>';
    grid.appendChild(line);
  }

  // ── Replace the "OPTIONS" link (show_all_options) with a "TODAY" button that
  // jumps to the period containing today. from/to/view live in the URL fragment
  // and the page reads them on load, so we rewrite the fragment + reload.
  var MP_DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var MP_MONS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function mpFmtDate(d){return MP_DAYS[d.getDay()]+' '+d.getDate()+' '+MP_MONS[d.getMonth()]+' '+d.getFullYear();}
  function mpGoToday(e){
    if(e){e.preventDefault();}
    var now=new Date(), h=location.hash;
    var uid=(h.match(/userIds=([^&]+)/)||[])[1]||'';
    var view=(h.match(/view=([^&]+)/)||[])[1]||'view_week';
    var sun=new Date(now); sun.setDate(now.getDate()-now.getDay());
    var from, to;
    if(view==='view_day'){from=new Date(now);to=new Date(now);}
    else if(view==='view_month'){from=new Date(now.getFullYear(),now.getMonth(),1);to=new Date(now.getFullYear(),now.getMonth()+1,0);}
    else if(view==='view_fortnight'){from=sun;to=new Date(sun);to.setDate(sun.getDate()+13);}
    else {from=sun;to=new Date(sun);to.setDate(sun.getDate()+6);}   // week / custom → week
    location.hash='at=0'+(uid?'&userIds='+uid:'')+'&from='+encodeURIComponent(mpFmtDate(from))+
                  '&to='+encodeURIComponent(mpFmtDate(to))+'&view='+view;
    location.reload();
  }
  function swapOptionsForToday(){
    var opt=[].slice.call(document.querySelectorAll('a')).find(function(a){return a.textContent.trim().toLowerCase()==='options';});
    if(!opt || opt.dataset.mpToday) return;
    opt.dataset.mpToday='1';
    opt.style.display='none';
    var btn=document.createElement('a');
    btn.href='#'; btn.className='cl-today'; btn.setAttribute('role','button');
    btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9h17M8 3v3M16 3v3"/><circle cx="12" cy="14.5" r="2.2" fill="currentColor" stroke="none"/></svg>Today';
    btn.addEventListener('click',mpGoToday);
    opt.parentNode.insertBefore(btn,opt);
  }

  // ── onemed Profiles page only: the native .main-header is a structurally different
  // Bootstrap template whose expanded side-menu can never match the timetable's
  // global-menu dropdown. So (styles.css hides .main-header and) we inject a REAL
  // replica of the timetable's nav.navbar.bg-uom: brand + burger → the global menu
  // (every 1Med section), plus the user dropdown on the right (the header search/magnifier
  // is removed on every page per user request — see removeHeaderSearch()). Because it uses
  // the same .navbar/.navbar-brand/.dropdown-menu classes, the shared timetable CSS
  // styles it for free — a perfect match in the collapsed AND expanded states.
  // ── Who is logged in, and where is *their* profile? ────────────────────────
  // The replica navbar must show the VIEWER's own name and link to the VIEWER's own
  // profile, so neither may be hard-coded: both are read off the live page, with a
  // neutral fallback when the page does not say. (onemed's profile URLs carry an
  // opaque per-account id, which is exactly why it is never written down here.)
  const MP_ONEMED = 'https://www.onemed.manchester.ac.uk';
  const MP_PROFILE_PATH = '/Profiles/StudentAdmin/Details/';

  // Any link on the page that points at a onemed profile is, on a logged-in page, the
  // viewer's own. Ignore our own injected navbar so we never read a value back from it.
  // Always reduced to origin+path: several of the profile links a page carries point at
  // a particular TAB of the record (…?tabSelected=N). Keeping the query made "My Profile"
  // open the notifications tab, and made mpNotifyHref() append a second query onto one
  // that already had it. The record URL is the answer here; tabs are added by the caller.
  function mpProfileRecord(url){
    try { const u = new URL(url, location.href); return u.origin + u.pathname; }
    catch (e) { return String(url).split('?')[0].split('#')[0]; }
  }
  function mpProfileHref(){
    const own = document.getElementById('mp-navbar');
    const link = [...document.querySelectorAll('a[href*="' + MP_PROFILE_PATH + '"]')]
      .find(a => !own || !own.contains(a));
    if (link) return mpProfileRecord(link.href);
    // On the profile page itself the URL *is* the answer.
    if (location.pathname.indexOf(MP_PROFILE_PATH) === 0) return location.origin + location.pathname;
    return MP_ONEMED + '/';                       // site root routes each account to its own
  }

  // Notifications live on a TAB of the viewer's own profile record, not on a route of
  // their own. Verified against a live student session: /Notifications/NotificationAdmin
  // is a staff area and bounces a student to /Account/UnauthorizedRoleAreaFailure, and
  // the only /Notifications/… links a student sees are individual messages — so neither
  // may be used here. Prefer the site's own menu entry, else rebuild it from the profile
  // href, which is itself resolved per-viewer.
  const MP_NOTIFY_TAB = '?tabSelected=907';
  function mpNotifyHref(){
    const own = document.getElementById('mp-navbar');
    const site = [...document.querySelectorAll('a[href*="' + MP_PROFILE_PATH + '"]')]
      .find(a => (!own || !own.contains(a)) && /^\s*notifications\s*$/i.test(a.textContent));
    return site ? site.href : mpProfileHref() + MP_NOTIFY_TAB;
  }

  // onemed writes the name surname-first ("Surname, Forename") while the timetable writes
  // it "Title Forename Surname". Flip a single leading comma so the replica navbar reads
  // the same way round as the bar it is replicating. Nothing here assumes a title, a
  // gender or a name shape: no comma, no change.
  function mpNameOrder(t){
    const m = /^([^,]+),\s*(.+)$/.exec(t);
    return m ? (m[2].trim() + ' ' + m[1].trim()) : t;
  }

  // Names go into innerHTML, so escape them.
  function mpEsc(t){ return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // Text that is plainly not a person's name — the logged-out/native header wording.
  const MP_NOT_A_NAME = /^\s*(log\s*in|login|sign\s*in|sign\s*out|log\s*out|logout|menu|home|help|search|notifications?|account|profile|my\s+account)\s*$/i;

  // A run of text is usable as a name only if it is short, has letters, and is not one
  // of the header's own control words.
  function mpNameish(raw){
    const t = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
    if (!t || t.length > 60 || !/[A-Za-z]/.test(t)) return '';
    return MP_NOT_A_NAME.test(t) ? '' : t;
  }

  // The viewer's display name, in preference order:
  //   1. the shared UoM navbar's user dropdown (medlea / 1med) — carries the title too
  //   2. onemed's Student Profile overview heading — a real name, no title
  //   3. onemed's own header account cluster (ul.main-header__user) — the login id
  //   4. nothing usable → a neutral label, never an invented name
  // Within (2), LEAF elements are tried before their containers: logged out the cluster
  // reads "Log In", and a logged-in one may hold a sign-out control beside the name — a
  // container's textContent would glue the two together, a leaf's does not.
  function mpUserName(){
    // NOT `.navbar.bg-uom` bare: our own replica bar (#mp-navbar) carries those very
    // classes, so the bare selector reads the name back out of what we just built.
    const bar = document.querySelector('.navbar.bg-uom:not(#mp-navbar)');
    if (bar) {
      const a = bar.querySelector('.navbar-nav.ml-auto .nav-link.dropdown-toggle');
      const t = mpNameish(a && a.textContent);
      if (t) return t;
    }
    // onemed's Student Profile states the viewer's name in its overview heading — the
    // only place on that template that holds a NAME. (.main-header__user, below, holds
    // the university login id, e.g. "t01234ab": accurate, and better than nothing, but
    // it is a fallback rather than a display name.)
    const overview = document.querySelector('.student-overview-data h3, .student-overview h3');
    const ot = mpNameish(overview && overview.textContent);
    if (ot) return mpNameOrder(ot);
    const box = document.querySelector('.main-header__user');
    if (box) {
      const all = [...box.querySelectorAll('*')];
      for (const el of all.filter(e => !e.children.length).concat(all)) {
        const t = mpNameish(el.textContent);
        if (t) return t;
      }
    }
    return 'My Account';
  }

  // The global menu mirrors the timetable's own, i.e. the 1Med sections every student
  // has. Keep this list to SITE-WIDE urls: an entry that would differ per account gets
  // a resolver function instead (see mpNavLinks / mpProfileHref), never a literal id.
  var MP_GLOBAL=[
    ['Blackboard','https://online.manchester.ac.uk'],
    ['Buzz','https://www.onemedbuzz.manchester.ac.uk'],
    ['Curriculum Map','https://cmt.mhs.man.ac.uk'],
    ['Educational Alert','https://www.medlea.manchester.ac.uk/ReportIssue.aspx'],
    ['Help','https://www.onemed.manchester.ac.uk/Help/HelpPage'],
    ['Info','https://www.onemedinfo.manchester.ac.uk'],
    ['Learn','https://www.onemedlearn.manchester.ac.uk'],
    ['MBChB Programme Handbook','https://www.mbchbhandbook.manchester.ac.uk'],
    ['My Attendance','https://www.medlea.manchester.ac.uk/TimeTable/Viewer/AttendanceViewer.aspx'],
    ['My Forms','https://www.onemedforms.manchester.ac.uk'],
    ['My Manchester','https://my.manchester.ac.uk'],
    ['My Profile', mpProfileHref],
    ['My Submissions','https://www.medlea.manchester.ac.uk/forms/list.aspx'],
    ['Notifications', mpNotifyHref],
    // The site's own menu links a handbook path pinned to one academic year
    // (…/2025-26/…), which silently rots every August. Point at the year-less index
    // instead and let the reader pick the current year — never template the year in,
    // the rollover date and path scheme are not ours to guess.
    ['Programme Handbooks','https://handbooks.bmh.manchester.ac.uk/'],
    ['PPD portfolio','https://www.onemed.manchester.ac.uk/EPPDPortfolio/Portfolio'],
    ['Timetable','https://www.medlea.manchester.ac.uk/TimeTable/l2.aspx']
  ];
  var MP_USERMENU=[
    ['My Timetable Profile','https://www.medlea.manchester.ac.uk/people/Me/default.aspx'],
    ['Timetable Groups','https://www.medlea.manchester.ac.uk/Groups/showGroups.aspx'],
    ['Sign out','https://www.medlea.manchester.ac.uk/auth/logon.aspx?logout=true']
  ];
  var MP_NAVICO={
    // 18×13 (not 12): the timetable's .burger div renders 18×13 at y22.5 (centre 29 —
    // 2px ABOVE bar-centre); styles.css offsets the flex-centred svg with margin-top:-4.
    burger:'<svg class="mp-ico mp-burger" width="18" height="13" viewBox="0 0 18 13" fill="#fff"><rect y="0" width="18" height="2"/><rect y="5.5" width="18" height="2"/><rect y="11" width="18" height="2"/></svg>',
    x:'<svg class="mp-ico mp-x" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };
  // An entry's href may be a FUNCTION, resolved when the menu is rendered — that is
  // how the per-account links (My Profile) stay the *viewer's* own rather than a
  // hard-coded id. Everything else is a plain site-wide URL.
  function mpNavLinks(rows){ return rows.map(function(x){
    var href = (typeof x[1] === 'function') ? x[1]() : x[1];
    return '<a class="dropdown-item" href="'+mpEsc(href)+'">'+x[0]+'</a>'; }).join(''); }
  // ── Remove the header search (magnifier) control on EVERY skinned page (user request).
  // The medlea navbar (timetable + forms/people/groups/tasks/attendance) ships a NATIVE
  // search dropdown — an <li.nav-item.dropdown> whose <a.nav-link> carries the 20×20
  // search-white.png raster; strip that whole <li>. Also clears any stale injected control
  // (the old onemed #mp-navbar search li / 1med .mp-1med-search) so no magnifier survives
  // on any header. Idempotent: once the <li> is gone the selector matches nothing.
  function removeHeaderSearch(){
    document.querySelectorAll(
      '.navbar img[src*="search-white"], #mp-navbar img[src*="search-white"], .mp-1med-search'
    ).forEach(function(el){
      var li = el.closest('li, .nav-item') || el;
      li.remove();
    });
  }

  function buildProfileNavbar(){
    if(!document.querySelector('.main-header')) return;   // onemed Profiles only
    if(document.getElementById('mp-navbar')) return;      // build once
    var html='<div class="container">'
      +'<div class="global-menu dropdown mp-dd">'
      +'<a class="navbar-brand" href="#" data-mp-toggle role="button">'+MP_NAVICO.burger+MP_NAVICO.x+'<span class="mp-brandtext">1Med Timetable</span></a>'
      +'<div class="dropdown-menu">'+mpNavLinks(MP_GLOBAL)+'</div></div>'
      +'<ul class="navbar-nav ml-auto">'
      // The header search/magnifier is removed on every page (user request), so the right
      // cluster is the user menu only. name anchor anatomy = the timetable's, measured live
      // (do NOT re-flex; see styles.css): [.mp-lead with margin-right:9.1px][RAW text][caret]
      // — 9.1 is the timetable's measured lead (4px dead-<i> margin + 5.1px rendered space)
      // baked as a margin, because whitespace-stripping before the text proved PAGE-DEPENDENT
      // (a literal space renders on medlea/1med but is stripped on this template) — the margin
      // is deterministic. Result: the name cluster's coordinates equal the timetable's.
      // The NAME is the viewer's own, read off the live page by mpUserName() (falling back
      // to a neutral 'My Account'), and escaped because it lands in innerHTML.
      +'<li class="nav-item dropdown mp-dd"><a class="nav-link dropdown-toggle" href="#" data-mp-toggle role="button"><i class="mp-lead"></i>'+mpEsc(mpUserName())+'</a>'
      +'<div class="dropdown-menu dropdown-menu-right">'+mpNavLinks(MP_USERMENU)+'</div></li></ul></div>';
    var nav=document.createElement('nav');
    nav.id='mp-navbar'; nav.className='navbar navbar-expand-sm navbar-dark bg-uom fixed-top mp-navbar';
    nav.innerHTML=html;
    document.body.insertBefore(nav, document.body.firstChild);
    nav.addEventListener('click',function(e){
      var t=e.target.closest('[data-mp-toggle]'); if(!t) return;
      e.preventDefault(); e.stopPropagation();
      var dd=t.closest('.mp-dd'), was=dd.classList.contains('mp-open');
      nav.querySelectorAll('.mp-dd.mp-open').forEach(function(x){x.classList.remove('mp-open');});
      if(!was){ dd.classList.add('mp-open'); }
    });
    document.addEventListener('click',function(){
      nav.querySelectorAll('.mp-dd.mp-open').forEach(function(x){x.classList.remove('mp-open');}); });
  }

  // ── Replace the submissions page's dated GNOME/Tango raster icons (emblem-shared,
  // printer, list-add, stock_zoom on the action links; emblem-important, folder,
  // user-trash-full on the View-Forms tabs) with hand-drawn line-SVG glyphs that
  // take their colour from CSS (currentColor). Same swap pattern as the footer
  // socials: keep the anchor/tab, hide the raster, inject an inline SVG. Idempotent.
  const MP_FORM_SVG = {
    'emblem-shared.png': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="17.5" cy="5.5" r="2.4"/><circle cx="6" cy="12" r="2.4"/><circle cx="17.5" cy="18.5" r="2.4"/><path d="M8.2 10.9l7-4M8.2 13.1l7 4"/></svg>',
    'printer.png':       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 8.5V3.5h11v5"/><rect x="3.5" y="8.5" width="17" height="8" rx="2"/><rect x="6.5" y="14" width="11" height="6.5" rx="1"/><circle cx="16.8" cy="11.4" r=".85" fill="currentColor" stroke="none"/></svg>',
    'list-add.png':      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z"/><path d="M13.5 3.5V9H19"/><path d="M12 12.3v5M9.5 14.8h5"/></svg>',
    'stock_zoom.png':    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.2"/><path d="M15.2 15.2L20 20"/><circle cx="10.5" cy="8.7" r="1.7"/><path d="M7.4 13.4a3.3 3.3 0 0 1 6.2 0"/></svg>'
  };
  // ── "View Forms" rail tabs. NEVER key these off the label text: the site adds a
  // fresh academic-year folder every August ("2026/2027", "2027/2028", …) and a
  // text-keyed lookup silently misses it — the tab then keeps the raw folder.png
  // bitmap sitting under its own label (exactly what happened to 2026/2027 while
  // 2025/2026 rendered correctly). The site's own machine-readable keys are the
  // INLINE background raster and the href's cmd, so resolve on those:
  //   emblems/emblem-important.png · cmd=showToDo    → Outstanding
  //   places/folder.png            · cmd=userForms   → an academic-year folder
  //   status/user-trash-full.png   · cmd=showDeleted → Deleted
  //   (no raster at all)           · cmd=showAC      → Academic Summary
  // Academic Summary ships no icon at all — it gets one here for the first time.
  const MP_TAB_SVG = {
    alert:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.6l8.4 14.8H3.6z"/><path d="M12 9.5v4"/><circle cx="12" cy="16.2" r=".5" fill="currentColor"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 6.5a2 2 0 0 1 2-2h3.3a2 2 0 0 1 1.5.7l1 1.3H18a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2z"/></svg>',
    trash:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 6.5h15M9 6.5V5A1.5 1.5 0 0 1 10.5 3.5h3A1.5 1.5 0 0 1 15 5v1.5M6.7 6.5l.8 12a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l.8-12M10 10v6M14 10v6"/></svg>',
    chart:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 20v-5.5M12.7 20V8.5M17.4 20v-8"/></svg>'
  };
  function mpTabKind(tab) {
    const bg = tab.getAttribute('style') || '';
    const href = tab.getAttribute('href') || '';
    if (/emblem-important/.test(bg) || /cmd=showToDo/i.test(href))    return 'alert';
    if (/user-trash/.test(bg)       || /cmd=showDeleted/i.test(href)) return 'trash';
    if (/cmd=showAC/i.test(href))                                     return 'chart';
    if (/places\/folder/.test(bg)   || /cmd=userForms/i.test(href) ||
        /^\d{4}\s*\/\s*\d{2,4}$/.test(tab.textContent.trim()))        return 'folder';
    return null;
  }
  // the "Deleted" rail glyph, reused as the per-row deleted marker in decorateFormList()
  const MP_FD_TRASH = MP_TAB_SVG.trash;
  // row-level status glyphs on the submissions LIST: the "locked/read-only" emblem
  // (GNOME emblem-readonly.png padlock) beside a locked form, and the file-type
  // mimetype rasters (docx/pdf/xlsx.png) beside an attached report. Same swap as the
  // nav icons: hide the raster, drop in a currentColor line-SVG (CSS colours them —
  // lock = calm haze, file = orchid to pair with the download link).
  const MP_LOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4.6" y="10.4" width="14.8" height="9.8" rx="2.3"/><path d="M7.8 10.4V7.6a4.2 4.2 0 0 1 8.4 0v2.8"/><circle cx="12" cy="14.7" r="1.35" fill="currentColor" stroke="none"/><path d="M12 15.8v2.1"/></svg>';
  const MP_FILE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6.6 3.4h6.6l4.2 4.2v11.4a1.6 1.6 0 0 1-1.6 1.6H6.6A1.6 1.6 0 0 1 5 19V5a1.6 1.6 0 0 1 1.6-1.6z"/><path d="M12.8 3.4v4.6h4.6"/><path d="M8.6 13h6.8M8.6 16h6.8M8.6 19h4.2"/></svg>';
  function decorateFormIcons() {
    document.querySelectorAll('.formListNavCol p img').forEach(img => {
      if (img.dataset.mpFormIcon) return;
      const svg = MP_FORM_SVG[(img.getAttribute('src') || '').split('/').pop()];
      if (!svg) return;
      img.dataset.mpFormIcon = '1';
      img.insertAdjacentHTML('afterend', '<span class="mp-form-icon">' + svg + '</span>');
      img.style.display = 'none';
    });
    // /forms/ only: the Task Inbox reuses .formLinkTab with its own <img> rasters,
    // already swapped by decorateGlyphs() as .mp-task-icon.
    if (/\/forms\//i.test(location.pathname)) {
      document.querySelectorAll('.formLinkTab').forEach(tab => {
        if (tab.dataset.mpTabIcon) return;
        const kind = mpTabKind(tab);          // by raster + href cmd, never by label
        if (!kind) return;
        tab.dataset.mpTabIcon = kind;
        tab.style.backgroundImage = 'none';
        tab.insertAdjacentHTML('afterbegin',
          '<span class="mp-tab-icon mp-tab-' + kind + '">' + MP_TAB_SVG[kind] + '</span>');
        // same anatomy as the action tiles below them (icon chip · label · chevron)
        if (!tab.classList.contains('formLinkTabSelected')) {
          tab.insertAdjacentHTML('beforeend', '<span class="mp-act-go" aria-hidden="true"></span>');
        }
      });
    }
    decorateFormRail();
    // NB: match the file-attachment folder /icons/mimetypes/ specifically — NOT a
    // bare "/mimetypes/", which also catches GNOME category icons like
    // gnome/22x22/mimetypes/x-office-calendar.png (a calendar, handled by decorateGlyphs).
    document.querySelectorAll('#content-body img[src*="emblem-readonly"], ' +
                             '#content-body img[src*="/icons/mimetypes/"]').forEach(img => {
      if (img.dataset.mpRowIcon) return;
      img.dataset.mpRowIcon = '1';
      const lock = /emblem-readonly/.test(img.getAttribute('src') || '');
      img.style.display = 'none';
      img.insertAdjacentHTML('afterend',
        '<span class="' + (lock ? 'mp-lock-icon' : 'mp-file-icon') + '" aria-hidden="true">' +
        (lock ? MP_LOCK_SVG : MP_FILE_SVG) + '</span>');
    });
  }

  // ── "View Forms" rail: the four action links → action tiles ─────────────────
  // The site ships them as four bare <p><img><a>text</a></p> rows — an underlined
  // link with a 24px GNOME raster floating beside it, nothing tying the two into
  // one control. decorateFormIcons() has already swapped the raster for a
  // currentColor line-SVG; fold that glyph INSIDE the anchor so the whole tile is
  // a single hit target (and a single hover surface), then let styles.css draw it
  // as a card. Also gives the rail its two section labels: "View Forms:" is a raw
  // text node inside the <nobr>, so it has to be wrapped before CSS can reach it.
  // Idempotent (dataset guards); nothing here moves on hover.
  function mpCmd(search) {
    const m = /[?&]cmd=([^&]*)/i.exec(search || '');
    return m ? m[1].toLowerCase() : '';
  }
  function decorateFormRail() {
    const nav = document.querySelector('.formListNavCol');
    if (!nav) return;
    // NB: descendant, not ':scope > p' — the site never closes the rail's <nobr>,
    // so the four action <p>s parse as children of THAT, not of .formListNavCol.
    nav.querySelectorAll('p').forEach(p => {
      if (p.dataset.mpAct) return;
      const ico = p.querySelector(':scope > .mp-form-icon');
      if (!ico) return;
      // on an action's OWN page the site drops the link and emits a bare <b>
      // instead — style that one as the current tile rather than skipping it
      // (which left "Print blank forms" as loose text beside a stray glyph).
      const host = p.querySelector(':scope > a') || p.querySelector(':scope > b');
      if (!host) return;
      // "current" = the action you are already looking at. Three signals, because
      // the site is inconsistent about which it uses:
      //   · <b> instead of <a>          — Print blank forms, Find forms by user
      //   · same cmd in the query        — Share your forms (still a live link)
      //   · same path (OFF list.aspx)    — Enter a new form (addSubmissionMenu)
      // The path test must skip list.aspx: three of the four actions POINT at
      // list.aspx, so it would light all of them at once there.
      const cmd = mpCmd(location.search);
      const current = host.tagName === 'B' ||
        (cmd && host.search && mpCmd(host.search) === cmd) ||
        (!/list\.aspx$/i.test(location.pathname) && host.pathname &&
         host.pathname.toLowerCase() === location.pathname.toLowerCase());
      p.dataset.mpAct = '1';
      p.classList.add('mp-act-row');
      host.classList.add('mp-act');
      if (current) host.classList.add('mp-act-current');
      host.insertBefore(ico, host.firstChild);
      if (!current) host.insertAdjacentHTML('beforeend', '<span class="mp-act-go" aria-hidden="true"></span>');
    });
    if (nav.dataset.mpRail) return;
    nav.dataset.mpRail = '1';
    const nb = nav.querySelector(':scope > nobr');
    if (nb) [...nb.childNodes].forEach(n => {
      if (n.nodeType !== 3 || !n.textContent.trim()) return;
      const s = document.createElement('span');
      s.className = 'mp-rail-label';
      s.textContent = n.textContent.trim().replace(/:$/, '');
      n.replaceWith(s);
    });
    const first = nav.querySelector('p.mp-act-row');
    if (first) first.insertAdjacentHTML('beforebegin',
      '<div class="mp-rail-label mp-rail-label2">Actions</div>');
  }

  // ── Submissions list rows (/forms/list.aspx — every view, incl. Deleted) ─────
  // The list is a classless 3-column table: an always-empty spacer <td>, a 100px
  // right-aligned status/date cell, and the title cell ("<a>title</a> <br>deleted:
  // - <span class=designer-link>"). Deleted forms come as tr.fdRow.deleted, which
  // the site paints #eee with a blanket `text-decoration: line-through` on the ROW
  // — so every word in the row, meta text included, is struck through, and the
  // "not submitted" marker is a red 16px emblem-important.png bitmap.
  // This tags the parts CSS cannot reach:
  //   · .mp-fd-title / .mp-fd-group on the two colspan header rows, so the zebra
  //     and hover rules can EXCLUDE them by :not() — a tr:nth-child(even) zebra is
  //     (0,2,2) and silently outranks a later band rule, so make the sets disjoint
  //     rather than trying to out-specify it (same trap as the marksheet grids).
  //   · .mp-fd-chip on the status <nobr> so "not submitted" reads as a chip.
  //   · .mp-fd-meta around everything after the <br>, with the site's "deleted: -"
  //     wording rebuilt as a trash glyph + "Deleted" (+ any date, + the deleting
  //     user's link, which the site keeps in the .designer-link span and which must
  //     survive as a link — it does not on every sitting, hence the guards).
  // Idempotent via per-row dataset guards.
  function decorateFormList() {
    if (!/\/forms\/list\.aspx/i.test(location.pathname)) return;
    const inner = document.querySelector('.formListDisplayInner');
    if (!inner) return;
    if (/cmd=showDeleted/i.test(location.search)) {
      document.documentElement.classList.add('mp-fdel');
    }
    inner.querySelectorAll('tr').forEach(tr => {
      if (tr.children.length !== 1) return;
      const td = tr.children[0];
      if (td.querySelector(':scope > h3'))     tr.classList.add('mp-fd-title');
      else if (td.querySelector(':scope > b')) tr.classList.add('mp-fd-group');
    });
    inner.querySelectorAll('tr.fdRow').forEach(tr => {
      if (tr.dataset.mpFdRow) return;
      tr.dataset.mpFdRow = '1';
      const when = tr.children[tr.children.length - 2];
      const body = tr.children[tr.children.length - 1];
      if (when) {
        when.classList.add('mp-fd-when');
        const nb = when.querySelector('nobr');
        if (nb) nb.classList.add('mp-fd-chip',
          /not submitted/i.test(nb.textContent) ? 'mp-fd-chip-warn' : 'mp-fd-chip-ok');
      }
      if (!body || !tr.classList.contains('deleted')) return;
      const a = body.querySelector(':scope > a');
      if (a) a.classList.add('mp-fd-gone');
      const br = body.querySelector(':scope > br');
      if (!br) return;
      const meta = document.createElement('span');
      meta.className = 'mp-fd-meta';
      const rest = [];
      for (let n = br.nextSibling; n; n = n.nextSibling) rest.push(n);
      br.after(meta);
      rest.forEach(n => meta.appendChild(n));
      // strip the site's "deleted: -" wording from the loose text nodes but KEEP any
      // date it carries ("deleted: 12 Mar 26 - " on some sittings) and keep the
      // .designer-link element (the deleting user's link) untouched.
      const texts = [...meta.childNodes].filter(n => n.nodeType === 3);
      const lead = texts.map(n => n.textContent).join(' ').replace(/\s+/g, ' ')
        .replace(/^\s*deleted\s*:?\s*/i, '').replace(/^[-–—]\s*/, '')
        .replace(/\s*[-–—]\s*$/, '').trim();
      texts.forEach((n, i) => { n.textContent = i === 0 && lead ? ' · ' + lead : ''; });
      const who = meta.querySelector('.designer-link');
      if (who && who.textContent.trim()) {
        who.insertAdjacentHTML('beforebegin', '<span class="mp-fd-sep"> · </span>');
      }
      meta.insertAdjacentHTML('afterbegin',
        '<span class="mp-glyph mp-fd-meta-ico" aria-hidden="true">' + MP_FD_TRASH + '</span>' +
        '<span class="mp-fd-meta-lbl">Deleted</span>');
    });
  }

  // ── "New exam feedback" notice (/forms/list.aspx, every view) ───────────────
  // When a result is published the site prints one bare line at the top of the
  // display column:
  //   <img …/emblems/emblem-mail.png title="results!"><a href=ViewForm…>Month Year
  //   / CCA Feedback / Year N</a> - New exam feedback<br>
  // — a 24px glossy WHITE envelope raster (a light bitmap on the near-black
  // canvas) plus two runs of loose text, with the only actionable thing on the
  // page marked by nothing at all. Rebuilt as a notice card: the whole row
  // becomes ONE anchor (same href, so the hit target is the card rather than a
  // ~200px run of text) carrying an envelope glyph, the site's own wording as a
  // kicker, the form title, and a "View feedback" cue. Hover is glow-only.
  // Two things this must respect:
  //   · everything on this page lives inside the site's UNCLOSED <nobr>, so the
  //     notice's siblings are the REST OF THE PAGE (the OkMsg, the list table…).
  //     Only the img, its <a>, the text run between them and the closing <br>
  //     may be consumed — never "everything up to the next element".
  //   · that same <nobr> means white-space: nowrap inherits into the card, so
  //     styles.css restores it (the title is a long "…/…/…" string).
  // Idempotent: the raster is REPLACED by the card, so a re-run matches nothing.
  const MP_FD_MAIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.9" y="5.1" width="18.2" height="13.8" rx="2.4"/><path d="M3.6 6.6 12 12.9l8.4-6.3"/></svg>';
  const MP_FD_CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 5.5 16 12l-6.5 6.5"/></svg>';
  function decorateFormNotice() {
    if (!/\/forms\/list\.aspx/i.test(location.pathname)) return;
    const host = document.querySelector('.formListDisplayInner') ||
                 document.getElementById('content-body');
    if (!host) return;
    host.querySelectorAll('img[src*="emblems/emblem-mail"]').forEach(img => {
      const a = img.nextElementSibling;
      if (!a || a.tagName !== 'A' || !a.getAttribute('href')) return;
      // the site's own wording between the link and the line break ("- New exam
      // feedback"); the img's title ("results!") is the fallback.
      const spent = [];
      let kicker = '';
      for (let n = a.nextSibling; n; n = n.nextSibling) {
        if (n.nodeType === 3) { kicker += n.textContent; spent.push(n); continue; }
        if (n.nodeType === 1 && n.tagName === 'BR') { spent.push(n); }
        break;
      }
      kicker = kicker.replace(/\s+/g, ' ').replace(/^[\s–—:-]+/, '').trim() ||
               (img.getAttribute('title') || '').replace(/[!\s]+$/, '') || 'New result';
      const card = document.createElement('a');
      card.className = 'mp-fd-notice';
      card.setAttribute('href', a.getAttribute('href'));
      card.innerHTML =
        '<span class="mp-glyph mp-fd-notice-ico" aria-hidden="true">' + MP_FD_MAIL + '</span>' +
        '<span class="mp-fd-notice-body">' +
          '<span class="mp-fd-notice-kicker"></span>' +
          '<span class="mp-fd-notice-title"></span>' +
        '</span>' +
        '<span class="mp-fd-notice-cta">View feedback' +
          '<span class="mp-glyph mp-fd-notice-chev" aria-hidden="true">' + MP_FD_CHEV + '</span>' +
        '</span>';
      card.querySelector('.mp-fd-notice-kicker').textContent = kicker;
      card.querySelector('.mp-fd-notice-title').textContent =
        a.textContent.replace(/\s+/g, ' ').trim();
      img.replaceWith(card);
      spent.forEach(n => n.remove());
      a.remove();
    });
  }

  // ── The rail's four destinations (all under /forms/) ────────────────────────
  // Runs AFTER decorateGlyphs() so every raster has already become a currentColor
  // <span class="mp-glyph …"> that can be moved around wholesale.
  //   · Print blank forms  (list.aspx cmd=printForms) — sections of
  //     "<a><img printer></a> <a>title</a><br>" pairs inside a <p class=indent>.
  //     BOTH anchors carry the SAME href, so fold the glyph into the label anchor
  //     and drop the icon anchor: one anchor per row = one hit target, one hover
  //     surface, and a <br>-free flow CSS can lay out as a tile list.
  //   · Enter a new form   (addSubmissionMenu.aspx) — a classless table whose group
  //     headings are <tr><td colspan=2><h3>. Tagged so CSS can band the headings and
  //     turn "enter form" / "view printable version" into pill buttons. The site also
  //     emits a THIRD, empty <a href=''> between them (a dead placeholder that still
  //     renders as a gap) — removed here.
  // Idempotent (dataset guards). Nothing added here moves on hover.
  // NB: spelled out rather than built from MP_GS — that const is declared further
  // down the file, so referencing it here hits its temporal dead zone and throws
  // on every page (`Cannot access 'MP_GS' before initialization`), which kills the
  // whole decorate() pass, not just this page.
  const MP_AF_STROKE = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
  const MP_AF_ADD = '<svg viewBox="0 0 24 24" ' + MP_AF_STROKE + '><path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z"/><path d="M13.5 3.5V9H19"/><path d="M12 12.3v5M9.5 14.8h5"/></svg>';
  const MP_AF_PRINT = '<svg viewBox="0 0 24 24" ' + MP_AF_STROKE + '><path d="M6.5 8.5V3.5h11v5"/><rect x="3.5" y="8.5" width="17" height="8" rx="2"/><rect x="6.5" y="14" width="11" height="6.5" rx="1"/></svg>';
  // addSubmissionMenu.aspx is the one rail destination that is NOT a list.aspx
  // view, so the site drops the whole "View Forms / Actions" sidebar there and you
  // land on a page with no way back into the section. Fetch the rail from the
  // submissions list once and mount a copy — it is the same markup, so
  // decorateFormIcons()/decorateFormRail() pick it up on the next observer pass.
  // Its hrefs are bare query strings ("?userId=…&cmd=showToDo") which would
  // resolve against THIS path, so they are rewritten to /forms/list.aspx first.
  function mountFormRail() {
    if (document.querySelector('.formListNavCol')) return;
    const body = document.getElementById('content-body');
    if (!body || body.dataset.mpRailMount) return;
    body.dataset.mpRailMount = '1';
    fetch('/forms/list.aspx', { credentials: 'same-origin' })
      .then(r => r.ok ? r.text() : Promise.reject(r.status))
      .then(html => {
        const rail = new DOMParser().parseFromString(html, 'text/html')
          .querySelector('.formListNavCol');
        if (!rail) return;
        rail.querySelectorAll('a[href]').forEach(a => {
          const h = a.getAttribute('href');
          if (h && h.charAt(0) === '?') a.setAttribute('href', '/forms/list.aspx' + h);
        });
        // /forms/list.aspx with no query defaults to the Outstanding view, so the
        // fetched copy arrives with that tab flagged selected — no View-Forms view
        // is actually open on this page, so drop it.
        rail.querySelectorAll('.formLinkTabSelected')
            .forEach(t => t.classList.remove('formLinkTabSelected'));
        const col = document.createElement('div');
        col.className = 'formListDisplay';
        while (body.firstChild) col.appendChild(body.firstChild);
        body.appendChild(document.importNode(rail, true));
        body.appendChild(col);
      })
      .catch(() => { body.dataset.mpRailMount = ''; });
  }

  function decorateFormPages() {
    if (!/\/forms\//i.test(location.pathname)) return;
    const root = document.documentElement;
    // Signature fields are a SERVER-rendered raster (showformimg.aspx), not markup,
    // so no CSS can reach inside them. Two cases:
    //   · a blank print view has no submission behind it (submissionid=-1) and the
    //     server answers with a 200×25 WHITE bitmap reading "Form not specified" —
    //     a light slab with dark text, and meaningless on a sheet meant to be
    //     signed by hand. Replaced with a ruled signing slot.
    //   · a real signature is dark ink on white, which cannot be recoloured — that
    //     one is kept and framed as paper rather than left as a bare white strip.
    document.querySelectorAll('img[src*="showformimg.aspx"]').forEach(img => {
      if (img.dataset.mpSig) return;
      img.dataset.mpSig = '1';
      if (/submissionid=-1/i.test(img.getAttribute('src') || '')) {
        img.style.display = 'none';
        img.insertAdjacentHTML('afterend', '<span class="mp-sig-slot" aria-hidden="true"></span>');
      } else {
        img.classList.add('mp-sig-ink');
      }
    });
    if (/cmd=printForms/i.test(location.search)) {
      root.classList.add('mp-printforms');
      document.querySelectorAll('.formListDisplay p.indent').forEach(p => {
        if (p.dataset.mpPf) return;
        p.dataset.mpPf = '1';
        p.classList.add('mp-pf-list');
        [...p.querySelectorAll(':scope > a')].forEach(a => {
          if (!a.querySelector('img')) return;
          const label = a.nextElementSibling;
          if (!label || label.tagName !== 'A' ||
              label.getAttribute('href') !== a.getAttribute('href')) return;
          [...a.childNodes].reverse().forEach(k => label.insertBefore(k, label.firstChild));
          a.remove();
          label.classList.add('mp-pf');
        });
        p.querySelectorAll(':scope > br').forEach(br => br.remove());
      });
    }
    // printview.aspx — the blank printable form behind every "view printable
    // version" / Print-blank-forms tile. An Angular field renderer: ul.fields > li,
    // each a floated .left title + .right control, with radio groups as
    // table.grid-table. Pure CSS from here (html.mp-printview).
    if (/printview\.aspx/i.test(location.pathname)) root.classList.add('mp-printview');
    if (/addsubmissionmenu/i.test(location.pathname)) {
      root.classList.add('mp-addform');
      mountFormRail();
      document.querySelectorAll('#content-body table').forEach(t => {
        if (t.dataset.mpAf) return;
        t.dataset.mpAf = '1';
        t.classList.add('mp-af');
        t.querySelectorAll('tr').forEach(tr => {
          if (tr.children.length === 1) {
            if (tr.children[0].querySelector('h3')) tr.classList.add('mp-af-group');
            return;
          }
          if (tr.children.length < 2) return;
          tr.classList.add('mp-af-row');
          tr.children[0].classList.add('mp-af-name');
          const acts = tr.children[tr.children.length - 1];
          acts.classList.add('mp-af-acts');
          acts.querySelectorAll('a').forEach(a => {
            const href = a.getAttribute('href') || '';
            if (!href || !a.textContent.trim()) { a.remove(); return; }
            const print = /printview\.aspx/i.test(href);
            a.classList.add('mp-af-btn', print ? 'mp-af-print' : 'mp-af-enter');
            a.insertAdjacentHTML('afterbegin', '<span class="mp-glyph mp-af-ico"' +
              ' aria-hidden="true">' + (print ? MP_AF_PRINT : MP_AF_ADD) + '</span>');
          });
        });
      });
    }
  }

  // ── Groups "showMembers" (+ shared): swap the dated GNOME toolbar/role rasters —
  // period-nav arrows, current-period play marker, group people, calendar, and the
  // tiny per-member role icon — for crisp currentColor line-SVGs. Same hide+insert
  // pattern; CSS colours them (nav controls = orchid affordance, role = calm haze).
  // Keyed by exact src fragment so it only touches these known icons on any page.
  const MP_GS = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
  const MP_GLYPHS = [
    ['users/Student.png',           'mp-role-icon', '<svg viewBox="0 0 24 24" ' + MP_GS + '><circle cx="12" cy="8" r="3.6"/><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0"/></svg>'],
    // "not submitted" / attention markers in a form-list row: a red 16px glossy
    // emblem-important.png circle — the cheapest bitmap left on the submissions
    // pages. (The identical raster on the "Outstanding" rail TAB is a CSS
    // background, not an <img>, so it is handled by mpTabKind() instead.)
    ['emblems/emblem-important',    'mp-alert-icon','<svg viewBox="0 0 24 24" ' + MP_GS + '><path d="M12 3.9 20.6 19H3.4z"/><path d="M12 9.8v4.1"/><circle cx="12" cy="16.6" r=".55" fill="currentColor"/></svg>'],
    // "Print blank forms" (list.aspx cmd=printForms) repeats a 24px glossy printer
    // bitmap on every row; decorateFormPages() folds the swapped glyph into the
    // row's label anchor. (The rail's own printer img is .mp-form-icon — see the
    // mpFormIcon guard in decorateGlyphs().)
    ['devices/printer.png',         'mp-print-icon','<svg viewBox="0 0 24 24" ' + MP_GS + '><path d="M6.5 8.5V3.5h11v5"/><rect x="3.5" y="8.5" width="17" height="8" rx="2"/><rect x="6.5" y="14" width="11" height="6.5" rx="1"/><circle cx="16.8" cy="11.4" r=".85" fill="currentColor" stroke="none"/></svg>'],
    ['actions/go-previous',         'mp-nav-icon',  '<svg viewBox="0 0 24 24" ' + MP_GS + '><path d="M19 12H5.5"/><path d="M11.5 5.5 5 12l6.5 6.5"/></svg>'],
    ['actions/go-next',             'mp-nav-icon',  '<svg viewBox="0 0 24 24" ' + MP_GS + '><path d="M5 12h13.5"/><path d="M12.5 5.5 19 12l-6.5 6.5"/></svg>'],
    ['actions/go-up',               'mp-nav-icon',  '<svg viewBox="0 0 24 24" ' + MP_GS + '><path d="M12 19V5.5"/><path d="M5.5 12 12 5.5 18.5 12"/></svg>'],
    ['actions/go-down',             'mp-nav-icon',  '<svg viewBox="0 0 24 24" ' + MP_GS + '><path d="M12 5v13.5"/><path d="M5.5 12 12 18.5 18.5 12"/></svg>'],
    ['media-playback-start',        'mp-nav-icon',  '<svg viewBox="0 0 24 24" fill="none"><path d="M8.5 5.6v12.8L18.4 12z" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>'],
    ['apps/system-users',           'mp-nav-icon',  '<svg viewBox="0 0 24 24" ' + MP_GS + '><circle cx="9" cy="8" r="3.1"/><path d="M3.6 19a5.4 5.4 0 0 1 10.8 0"/><path d="M16 5.3a3 3 0 0 1 0 5.4"/><path d="M17.6 13.2A5.4 5.4 0 0 1 20.4 18"/></svg>'],
    ['mimetypes/x-office-calendar', 'mp-nav-icon',  '<svg viewBox="0 0 24 24" ' + MP_GS + '><rect x="3.5" y="4.5" width="17" height="16" rx="2.3"/><path d="M3.5 9h17M8 3v3.4M16 3v3.4"/></svg>'],
    // Task Inbox sidebar (medlea/tasks): replace the dated GNOME mail/folder/bin rasters
    ['stock_mail-receive',          'mp-task-icon', '<svg viewBox="0 0 24 24" ' + MP_GS + '><path d="M21 12h-5l-1.5 2.5h-5L8 12H3"/><path d="M6.2 5.4 3 12v5.5A1.5 1.5 0 0 0 4.5 19h15a1.5 1.5 0 0 0 1.5-1.5V12l-3.2-6.6A1.5 1.5 0 0 0 16.5 4.5h-9A1.5 1.5 0 0 0 6.2 5.4z"/></svg>'],
    ['stock_mail-send',             'mp-task-icon', '<svg viewBox="0 0 24 24" ' + MP_GS + '><path d="M21 3 10.5 13.5"/><path d="M21 3 14.5 21l-4-8-8-4L21 3z"/></svg>'],
    ['system-file-manager',         'mp-task-icon', '<svg viewBox="0 0 24 24" ' + MP_GS + '><rect x="3.5" y="4.5" width="17" height="4" rx="1.2"/><path d="M5.5 8.5V18a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5"/><path d="M10 12h4"/></svg>'],
    ['places/user-trash',           'mp-task-icon', '<svg viewBox="0 0 24 24" ' + MP_GS + '><path d="M4.5 7h15"/><path d="M9 7V4.8A1.3 1.3 0 0 1 10.3 3.5h3.4A1.3 1.3 0 0 1 15 4.8V7"/><path d="M6.5 7l.8 12a1.6 1.6 0 0 0 1.6 1.5h6.2a1.6 1.6 0 0 0 1.6-1.5l.8-12"/><path d="M10 11v6M14 11v6"/></svg>'],
    // AttendanceViewer date-range bar: the grey datePick arrow rasters beside Previous/Next
    ['datePickArrowLeftGrey',       'mp-att-arrow', '<svg viewBox="0 0 24 24" ' + MP_GS + '><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>'],
    ['datePickArrowRightGrey',      'mp-att-arrow', '<svg viewBox="0 0 24 24" ' + MP_GS + '><path d="M9.5 5.5 16 12l-6.5 6.5"/></svg>'],
    // Groups list (showGroups.aspx) floating date-range picker (.mp-litebox toolbar):
    // ‹ shift earlier · + widen range (pickBigger) · − narrow range (pickSmaller) · › shift
    // later. Match the arrows WITH ".png" so they can't also catch the AttendanceViewer's
    // datePickArrowLeftGrey.png / …RightGrey.png above (which keep their mp-att-arrow style).
    // Circle +/− echo the original circular buttons as crisp line-art; styles.css colours them.
    ['datePickArrowLeft.png',       'mp-pick-icon', '<svg viewBox="0 0 24 24" ' + MP_GS + '><path d="M19 12H5.5"/><path d="M11.5 5.5 5 12l6.5 6.5"/></svg>'],
    ['pickBigger.png',              'mp-pick-icon', '<svg viewBox="0 0 24 24" ' + MP_GS + '><circle cx="12" cy="12" r="8.3"/><path d="M12 8.3v7.4M8.3 12h7.4"/></svg>'],
    ['pickSmaller.png',             'mp-pick-icon', '<svg viewBox="0 0 24 24" ' + MP_GS + '><circle cx="12" cy="12" r="8.3"/><path d="M8.3 12h7.4"/></svg>'],
    ['datePickArrowRight.png',      'mp-pick-icon', '<svg viewBox="0 0 24 24" ' + MP_GS + '><path d="M5 12h13.5"/><path d="M12.5 5.5 19 12l-6.5 6.5"/></svg>'],
    // Submissions marksheets (ViewForm.aspx table.eval): the read-only radio/checkbox
    // state ships as LIGHT rasters — white circles that read as bright dots on the
    // near-black canvas, and a cream "checked" dot that is the ONLY marker of the
    // grade awarded. Line-SVGs instead: muted --faint when unset, orchid + halo when
    // set. The "-empty"/"-checkbox" fragments can't cross-match each other (neither
    // filename contains the other's fragment), so order here is irrelevant.
    ['form-radio-empty.png',        'mp-rb-off',    '<svg viewBox="0 0 24 24" ' + MP_GS + '><circle cx="12" cy="12" r="7.6"/></svg>'],
    ['form-radio.png',              'mp-rb-on',     '<svg viewBox="0 0 24 24" ' + MP_GS + '><circle cx="12" cy="12" r="7.6"/><circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none"/></svg>'],
    ['form-checkbox-empty.png',     'mp-cb-off',    '<svg viewBox="0 0 24 24" ' + MP_GS + '><rect x="4.2" y="4.2" width="15.6" height="15.6" rx="3.4"/></svg>'],
    ['form-checkbox.png',           'mp-cb-on',     '<svg viewBox="0 0 24 24" ' + MP_GS + '><rect x="4.2" y="4.2" width="15.6" height="15.6" rx="3.4"/><path d="M8 12.3l2.8 2.9L16.4 9"/></svg>']
  ];
  function decorateGlyphs() {
    for (let i = 0; i < MP_GLYPHS.length; i++) {
      const g = MP_GLYPHS[i];
      document.querySelectorAll('img[src*="' + g[0] + '"]').forEach(img => {
        // mpFormIcon: the rail's own printer/share/add/zoom rasters are swapped by
        // decorateFormIcons() (as .mp-form-icon) — don't insert a second glyph.
        if (img.dataset.mpGlyph || img.dataset.mpFormIcon) return;
        img.dataset.mpGlyph = '1';
        img.style.display = 'none';
        img.insertAdjacentHTML('afterend',
          '<span class="mp-glyph ' + g[1] + '" aria-hidden="true">' + g[2] + '</span>');
      });
    }
  }

  // ── Timetable Groups (medlea /Groups/showGroups.aspx) ───────────────────────
  // The page is a bare Gantt of the student's group memberships: each .show-groups-block
  // is an <a> the site positions by DATE (inline left%/width%/top-em) but renders as a
  // clipped "name <br> period" that truncates mid-word on narrow bars — with NO title,
  // axis label, or explanation of what the chart even is. This adds the missing context
  // WITHOUT touching the date-driven positioning (that geometry IS the data):
  //   1. a header card (title + plain-language description) inserted ABOVE #content-body
  //      (in <main>, so the absolute chart inside #content-body is untouched — it just
  //      flows down with its offset parent);
  //   2. each bar rebuilt as a clean name-over-period label (CSS clips with an ellipsis),
  //      and the SITE's own hover tooltip (a classless .mp-litebox div) reformatted into a
  //      proper card — so even a clipped narrow bar reads in full on hover, with no 2nd box;
  //   3. the floating date-range picker (the .mp-litebox whose GNOME arrows/± were swapped
  //      by decorateGlyphs) captioned "Date range" so it reads as the time-window control.
  // Idempotent (dataset/id guards); styles.css .mp-groups block does the looks.
  function decorateGroups() {
    if (!/\/groups\/showgroups/i.test(location.pathname)) return;
    document.documentElement.classList.add('mp-groups');
    const cb = document.getElementById('content-body');
    if (!cb) return;
    // 1+2. rebuild each membership bar as a clean name-over-period label. The site's own
    // groupname/periodname/startdate/enddate/studentcount attributes stay on the element and
    // feed the custom hover tooltip below (the raw native title is dropped — it looked cheap).
    cb.querySelectorAll('.show-groups-block').forEach(a => {
      if (a.dataset.mpGrp) return;
      a.dataset.mpGrp = '1';
      const name = (a.getAttribute('groupname') || a.textContent || '').trim();
      const period = (a.getAttribute('periodname') || '').trim();
      a.classList.add('mp-grp-bar');
      a.removeAttribute('title');
      a.textContent = '';
      const ns = document.createElement('span'); ns.className = 'mp-grp-name'; ns.textContent = name;
      a.appendChild(ns);
      if (period) { const ps = document.createElement('span'); ps.className = 'mp-grp-period'; ps.textContent = period; a.appendChild(ps); }
    });
    // The site ships its OWN hover tooltip: a classless absolute <div> it repositions per
    // bar and fills with "name<br>period<br>dates<br>count students" (that is what the bar's
    // data-attributes are FOR). litLightBoxes() already darkened it to a plain .mp-litebox.
    // So we add NO tooltip of our own (a second card was what made "several things" appear) —
    // we reformat the site's single card into a proper one. Tag it + observe it so each
    // hover's fresh content is reformatted; the reformat's own mutation is skipped (guard on
    // our .mp-ht-name). The date-range picker is a .mp-litebox too — exclude it.
    const fmtTip = box => {
      if (box.querySelector('.mp-ht-name')) return;        // already reformatted by us
      const raw = box.innerHTML;
      if (!/<br/i.test(raw)) return;                       // not the site's raw multi-line fill
      const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const parts = raw.split(/<br\s*\/?>/i).map(s => s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()).filter(Boolean);
      if (parts.length < 2) return;
      const [name, period, dates, count] = parts;
      let html = '<span class="mp-ht-name">' + esc(name) + '</span>';
      if (period) html += '<span class="mp-ht-period">' + esc(period) + '</span>';
      let rows = '';
      if (dates) rows += '<span class="mp-ht-row"><span class="k">Active</span><span class="v">' + esc(dates.replace(/\s*[-–]\s*/, ' → ')) + '</span></span>';
      if (count) rows += '<span class="mp-ht-row"><span class="k">Members</span><span class="v">' + esc(count) + '</span></span>';
      if (rows) html += '<span class="mp-ht-rows">' + rows + '</span>';
      box.innerHTML = html;
    };
    cb.querySelectorAll('.mp-litebox').forEach(box => {
      if (box.classList.contains('mp-pickbox') ||
          box.querySelector('.mp-pick-icon, img[src*="datePickArrow"]')) return;   // that's the picker
      if (!box.dataset.mpHovertip) {
        box.dataset.mpHovertip = '1';
        box.classList.add('mp-grp-hovertip');
        new MutationObserver(() => fmtTip(box)).observe(box, { childList: true, characterData: true, subtree: true });
      }
      fmtTip(box);
    });
    // 3. header card, inserted once ABOVE the chart (before #content-body in <main>)
    if (!document.getElementById('mp-grp-head') && cb.parentNode) {
      const head = document.createElement('div');
      // + the site's own .container class so the card is inset/centred to the SAME
      // responsive max-width as the breadcrumb + chart (main is full-width with no padding,
      // so without this the card ran edge-to-edge against the viewport).
      head.id = 'mp-grp-head'; head.className = 'mp-grp-head container';
      const text = document.createElement('div'); text.className = 'mp-grp-headtext';
      text.innerHTML =
        '<div class="mp-grp-eyebrow">TIMETABLE · GROUP MEMBERSHIPS</div>' +
        '<h1 class="mp-grp-title">Your Timetable Groups</h1>' +
        '<p class="mp-grp-desc">The teaching groups you belong to, laid out across time. ' +
        'Each bar is one group — its position and length show <b>when</b> you’re in it ' +
        'and for how long. Select a bar to see that group’s members.</p>';
      head.appendChild(text);
      cb.parentNode.insertBefore(head, cb);
    }
    // relocate the floating date-range picker INTO the header, right side. It leaves
    // #content-body, so .mp-pickbox carries its own glass/colours (see styles.css). Strip
    // the site's absolute inline positioning; caption it "Date range". Moved once.
    const head = document.getElementById('mp-grp-head');
    const picker = [...document.querySelectorAll('.mp-litebox')]
      .find(b => b.querySelector('img[src*="datePickArrowLeft"], .mp-pick-icon'));
    if (head && picker && !picker.dataset.mpPickMoved) {
      picker.dataset.mpPickMoved = '1';
      picker.classList.add('mp-pickbox');
      ['position', 'right', 'top', 'left', 'z-index', 'background-color'].forEach(p => picker.style.removeProperty(p));
      const lbl = document.createElement('span');
      lbl.className = 'mp-pick-label'; lbl.textContent = 'Date range';
      picker.insertBefore(lbl, picker.firstChild);
      head.appendChild(picker);
    }
  }

  // ── Event detail toolbar (medlea /TimeTable/EditSingleEvent.aspx) ────────────
  // The single-event view heads its action row with dated GNOME rasters (stock_edit,
  // edit-delete, stock_folder-copy, stock_zoom, list-add, stock_mark, mail) — the
  // "cheap emoji" look. Swap each for a currentColor line-SVG in the SAME hide+insert
  // idiom, but insert the glyph INSIDE its labelled <a> (the raster is a sibling BEFORE
  // the link, so nesting gives one unified hover/click target). styles.css colours them
  // orchid → ice on link-hover (static, no motion). Keyed by exact filename; guarded to
  // the event page so the shared filenames (list-add/stock_zoom also live on Submissions)
  // are never touched off this toolbar.
  const MP_EVT_SVG = {
    'stock_edit.png':        '<svg viewBox="0 0 24 24" ' + MP_GS + '><path d="M21.2 6.4 17.6 2.8a1.9 1.9 0 0 0-2.7 0L4 13.7 3 21l7.3-1 10.9-10.9a1.9 1.9 0 0 0 0-2.7Z"/><path d="M14.6 5.4l4 4"/></svg>',
    'edit-delete.png':       '<svg viewBox="0 0 24 24" ' + MP_GS + '><path d="M4.5 6.5h15"/><path d="M9 6.5V5A1.5 1.5 0 0 1 10.5 3.5h3A1.5 1.5 0 0 1 15 5v1.5"/><path d="M6.8 6.5l.8 12.2a1.6 1.6 0 0 0 1.6 1.5h5.6a1.6 1.6 0 0 0 1.6-1.5l.8-12.2"/><path d="M10 10.2v6.4M14 10.2v6.4"/></svg>',
    'stock_folder-copy.png': '<svg viewBox="0 0 24 24" ' + MP_GS + '><rect x="8.5" y="8.5" width="11" height="11.5" rx="2"/><path d="M15.5 8.5V6.3a2 2 0 0 0-2-2H6.4a2 2 0 0 0-2 2v7.1a2 2 0 0 0 2 2h2.1"/></svg>',
    'stock_zoom.png':        '<svg viewBox="0 0 24 24" ' + MP_GS + '><circle cx="10.7" cy="10.7" r="6.3"/><path d="M15.4 15.4 20 20"/></svg>',
    'list-add.png':          '<svg viewBox="0 0 24 24" ' + MP_GS + '><rect x="3.5" y="5" width="17" height="15.5" rx="2.3"/><path d="M3.5 9.5h17"/><path d="M8 3v3.6M16 3v3.6"/><path d="M12 12.6v5M9.5 15.1h5"/></svg>',
    'stock_mark.png':        '<svg viewBox="0 0 24 24" ' + MP_GS + '><rect x="3.8" y="3.8" width="16.4" height="16.4" rx="3.4"/><path d="M8 12.2l2.8 2.8 5.4-6"/></svg>',
    'mail.png':              '<svg viewBox="0 0 24 24" ' + MP_GS + '><rect x="3.3" y="5.4" width="17.4" height="13.2" rx="2.3"/><path d="M4.2 7l7.8 6.1L19.8 7"/></svg>'
  };
  function decorateEventIcons() {
    if (!/\/editsingleevent/i.test(location.pathname)) return;
    const cb = document.getElementById('content-body');
    if (!cb) return;
    cb.querySelectorAll('img[src*="/icons/"]').forEach(img => {
      if (img.dataset.mpEvtIcon) return;
      const svg = MP_EVT_SVG[(img.getAttribute('src') || '').split('/').pop().split('?')[0]];
      if (!svg) return;
      img.dataset.mpEvtIcon = '1';
      img.style.display = 'none';
      const span = '<span class="mp-glyph mp-evt-icon" aria-hidden="true">' + svg + '</span>';
      const a = img.nextElementSibling;
      if (a && a.tagName === 'A') a.insertAdjacentHTML('afterbegin', span);
      else img.insertAdjacentHTML('afterend', span);
    });
  }

  // ── Add personal event (medlea /TimeTable/Add/personal.aspx) ────────────────
  // The ASP.NET form ships a cramped 3-month "aw-month" (AjaxWidgets) calendar with
  // raster page-arrows, a save button stranded OUTSIDE the form (in main.home), and
  // hidden multi-date/recurring machinery. Rebuild it as a clean single-month picker
  // (styles.css does the looks): show ONE month; page it with an injected ‹ title ›
  // header. The widget's own arrows shift its 3-month window by 3, so we treat those
  // three months as a BUFFER — step within them, only firing the widget's jump when
  // stepping off either end. Enforce single-date select by toggling any extra
  // selection back off THROUGH the widget (a real cell .click()), so its serialized
  // #starts/#ends stay in sync. Relocate the save into the form footer — verified it
  // then posts as ONE clean native submit (plain POST form; no viewstate/postback,
  // no form.submit()/AJAX handler → no double-submit). Guarded to this page and made
  // idempotent (guards on every branch) so the MutationObserver can't loop.
  // a "Start"/"End" hour:minute dropdown group wired to write "HH:MM" into `inp`.
  function aeTimeGroup(label, inp) {
    const g = document.createElement('div'); g.className = 'mp-time-group';
    const lb = document.createElement('span'); lb.className = 'mp-time-label'; lb.textContent = label;
    const cur = (inp.value || '').match(/^(\d{1,2}):(\d{2})$/);
    const h = document.createElement('select'); h.className = 'mp-time-h';
    const m = document.createElement('select'); m.className = 'mp-time-m';
    // Hours 08–23 only: a 1Med session never starts before 8am, so 00–07 are noise.
    let ho = '<option value="">--</option>';
    for (let i = 8; i < 24; i++) { const v = ('0' + i).slice(-2); ho += '<option value="' + v + '">' + v + '</option>'; }
    let mo = '<option value="">--</option>';
    for (let j = 0; j < 12; j++) { const mv = ('0' + (j * 5)).slice(-2); mo += '<option value="' + mv + '">' + mv + '</option>'; }
    h.innerHTML = ho; m.innerHTML = mo;
    if (cur) { h.value = ('0' + cur[1]).slice(-2); m.value = cur[2]; }
    const sep = document.createElement('span'); sep.className = 'mp-time-sep'; sep.textContent = ':';
    g.append(lb, h, sep, m);
    // Write "HH:MM" into the site's start/end text box, then FIRE the change event
    // the site's TimePicker.js observes on those inputs (Event.observe(ip,"change",…)).
    // Without this dispatch the raw .value set is invisible to the site, so its
    // getTimesForSubmission() never re-serializes and the hidden #starts/#ends fields
    // that actually POST keep their stale (date-only → midnight) value — which is why
    // events saved as 00:00–00:00. Setting .value alone never fires change; we must.
    const sync = () => {
      inp.value = (h.value && m.value) ? (h.value + ':' + m.value) : '';
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    };
    h.addEventListener('change', sync); m.addEventListener('change', sync);
    return g;
  }
  // Re-flow the site's Monday-first aw-month grid to Sunday-first, to match the
  // timetable (which starts weeks on Sunday). A naive column rotation scrambles the
  // dates — Sunday moves from week-END to week-START, so the whole grid re-flows — so
  // we REBUILD it: every date cell carries aw-dow-<N> (N = getDay, Sun=0), so place each
  // at column N and break to a new row on every Sunday. Existing cell elements are moved
  // (not recreated), preserving the widget's delegated click handlers; padding is fresh
  // blank cells. Idempotent per table (the widget makes a NEW table on each re-render,
  // so the flag never blocks a genuine re-flow). CSS on table.aw-month is column-agnostic.
  function aeSundayFirst(tbl) {
    if (!tbl || tbl.dataset.mpSun) return;
    tbl.dataset.mpSun = '1';
    let monthRow = null, nameRow = null;
    const dateCells = [];
    [...tbl.rows].forEach(tr => {
      const cs = [...tr.cells];
      if (cs.some(c => c.classList.contains('aw-month-name'))) { monthRow = tr; return; }
      if (cs.some(c => c.classList.contains('aw-dow-name'))) { nameRow = tr; return; }
      cs.forEach(td => {
        if (td.classList.contains('aw-dow') && !td.classList.contains('aw-dow-pad')) {
          let wd = null;
          td.classList.forEach(c => { const m = c.match(/^aw-dow-(\d)$/); if (m) wd = +m[1]; });
          if (wd !== null) dateCells.push({ el: td, wd });
        }
      });
    });
    if (!dateCells.length) return;
    // header: move Sunday name cell to the front (Su Mo Tu We Th Fr Sa)
    if (nameRow) {
      const su = [...nameRow.cells].find(c => c.classList.contains('aw-dow-Su'));
      if (su) nameRow.insertBefore(su, nameRow.firstChild);
    }
    // drop the old (Monday-first) week rows; keep month + name rows
    [...tbl.rows].forEach(tr => { if (tr !== monthRow && tr !== nameRow) tr.remove(); });
    const tb = (nameRow && nameRow.parentNode) || tbl.tBodies[0] || tbl;
    const blank = () => { const td = document.createElement('td'); td.className = 'aw-dow-pad'; td.innerHTML = '&nbsp;'; return td; };
    let row = null, col = 0;
    const newRow = () => { row = document.createElement('tr'); tb.appendChild(row); col = 0; };
    dateCells.forEach((dc, i) => {
      if (i === 0) { newRow(); for (let p = 0; p < dc.wd; p++) { row.appendChild(blank()); col++; } }
      else if (dc.wd === 0) newRow();          // Sunday opens a new week
      row.appendChild(dc.el); col++;
    });
    while (col > 0 && col < 7) { row.appendChild(blank()); col++; }
  }
  function aeMonths() { return [...document.querySelectorAll('.mp-addevent table.aw-month')]; }
  function aeShowMonth() {
    const ms = aeMonths(); if (!ms.length) return;
    aeVisIdx = Math.max(0, Math.min(ms.length - 1, aeVisIdx));
    ms.forEach((m, i) => { const t = (i === aeVisIdx) ? '' : 'none'; if (m.style.display !== t) m.style.display = t; });
    const hdr = document.getElementById('mp-cal-title');
    if (hdr) {
      const mn = ms[aeVisIdx].querySelector('.aw-month-name');
      const t = mn ? mn.textContent.trim() : '';
      if (hdr.textContent !== t) hdr.textContent = t;
    }
  }
  function aeNav(dir) {
    const ms = aeMonths(); const nx = aeVisIdx + dir;
    if (nx > ms.length - 1) { const d = document.querySelector('#moveDatesDown input'); if (d) d.click(); aeVisIdx = 0; }
    else if (nx < 0) { const u = document.querySelector('#moveDatesUp input'); if (u) u.click(); aeVisIdx = ms.length - 1; }
    else aeVisIdx = nx;
    setTimeout(aeShowMonth, 0);   // after the widget re-renders its 3-month window
  }
  function decorateAddEvent() {
    if (!/\/add\/personal/i.test(location.pathname)) return;
    const cb = document.getElementById('content-body');
    if (!cb || !document.getElementById('datepicker')) return;
    cb.classList.add('mp-addevent');
    // relocate the stranded save button into the form footer (node move keeps its
    // handler; verified this yields exactly one clean native submit — see note above)
    const form = cb.querySelector('form');
    const save = [...document.querySelectorAll('input[type="submit"],input[type="button"]')]
      .find(b => /save/i.test(b.value || ''));
    if (save && form && !form.contains(save)) {
      const f = document.createElement('div'); f.className = 'mp-ae-footer';
      f.appendChild(save); form.appendChild(f);
    }
    // equal, clearly-visible rims on Title + Notes. The shared #content-body
    // input:not(...) form-control rule has 3-ID specificity a class selector can't
    // beat, so set the rim inline !important; also kills the textarea's leftover
    // #eee inset shadow that made Notes read brighter than Title. Once per field.
    [form.querySelector('input[name="title"]'), form.querySelector('textarea[name="desc"]')].forEach(el => {
      if (el && !el.dataset.mpRim) {
        el.dataset.mpRim = '1';
        el.style.setProperty('border-color', 'rgba(160,130,255,0.42)', 'important');
        el.style.setProperty('box-shadow', 'none', 'important');
      }
    });
    // replace the cramped hh:mm text boxes with a clear Start/End hour:minute
    // dropdown row (minutes in 5s, matching the timetable grid) written back into
    // the hidden start/end fields the plain POST form submits. The original time
    // table (day-specific recurring slots + labels + hints) is hidden wholesale via
    // .mp-time-hidden; its start/end inputs stay in the form to carry the value.
    // Built once (guarded on .mp-time-row).
    if (!form.querySelector('.mp-time-row')) {
      const sInp = [...document.querySelectorAll('input[name="start"]')].find(i => i.getBoundingClientRect().width > 0);
      const eInp = [...document.querySelectorAll('input[name="end"]')].find(i => i.getBoundingClientRect().width > 0);
      const timeDiv = document.querySelector('#datepicker > div:last-child');
      if (sInp && eInp && timeDiv) {
        const row = document.createElement('div'); row.className = 'mp-time-row';
        row.appendChild(aeTimeGroup('Start', sInp));
        row.appendChild(aeTimeGroup('End', eInp));
        timeDiv.parentNode.insertBefore(row, timeDiv.nextSibling);
        timeDiv.classList.add('mp-time-hidden');
      }
    }
    // drop the stray thin vertical divider(s) — a leaf div with a left border that
    // ships as a DIRECT child of the form (not under #datepicker). Checked once per
    // leaf div; the strict thin+tall+bordered filter won't touch real content.
    cb.querySelectorAll('form div').forEach(d => {
      if (d.dataset.mpAeChk || d.children.length) return;
      d.dataset.mpAeChk = '1';
      const r = d.getBoundingClientRect();
      if (r.width < 6 && r.height > 50 && getComputedStyle(d).borderLeftWidth !== '0px') d.style.display = 'none';
    });
    // inject the single-month ‹ title › nav (once)
    if (!document.getElementById('mp-cal-nav')) {
      const dp = document.getElementById('datepicker');
      const chev = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + p + '"/></svg>';
      const nav = document.createElement('div'); nav.id = 'mp-cal-nav'; nav.className = 'mp-cal-nav';
      nav.innerHTML = '<button type="button" id="mp-prev" class="mp-cal-arrow" aria-label="Previous month">' + chev('M15 5l-7 7 7 7') + '</button>' +
        '<span id="mp-cal-title" class="mp-cal-title"></span>' +
        '<button type="button" id="mp-next" class="mp-cal-arrow" aria-label="Next month">' + chev('M9 5l7 7-7 7') + '</button>';
      dp.insertBefore(nav, dp.firstChild);
      nav.querySelector('#mp-prev').addEventListener('click', () => aeNav(-1));
      nav.querySelector('#mp-next').addEventListener('click', () => aeNav(1));
    }
    // enforce single-date selection through the widget (bind once)
    if (!aeSelBound) {
      aeSelBound = true;
      document.addEventListener('click', e => {
        if (aeSuppress) return;
        const td = e.target.closest && e.target.closest('.mp-addevent td.aw-dow');
        if (!td || td.classList.contains('aw-dow-name') || !td.textContent.trim()) return;
        setTimeout(() => {
          const sel = [...document.querySelectorAll('.mp-addevent table.aw-month td.aw-dow-selected')];
          if (sel.length <= 1) return;
          aeSuppress = true;
          sel.forEach(c => { if (c !== td && c.classList.contains('aw-dow-selected')) c.click(); });
          aeSuppress = false;
        }, 0);
      }, true);
    }
    aeMonths().forEach(aeSundayFirst);   // flip each month grid to Sunday-first
    aeShowMonth();
  }

  // ── onemed only: the PPD pages/modals ship a dated raster bin (trash-icon.png)
  // for every delete control (delete tag, delete item/evidence). Swap it for a
  // refined line-SVG bin (styles.css colours it faint → soft-red on hover). The
  // raster is hidden, not removed, so the surrounding delete <a>/handler is intact.
  var MP_BIN_SVG = '<svg class="mp-bin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V5.4A1.4 1.4 0 0 1 10.4 4h3.2A1.4 1.4 0 0 1 15 5.4V7"/><path d="M6.3 7l.85 12.3A2 2 0 0 0 9.15 21.2h5.7a2 2 0 0 0 2-1.9L17.7 7"/><path d="M10 10.6v6.4M14 10.6v6.4"/></svg>';
  function decorateBinIcons() {
    if (!document.querySelector('#main-wrapper')) return;   // onemed pages only
    document.querySelectorAll('img[src*="trash"]').forEach(img => {
      if (img.dataset.mpBin) return;
      img.dataset.mpBin = '1';
      img.style.display = 'none';
      img.insertAdjacentHTML('afterend', '<span class="mp-bin-wrap">' + MP_BIN_SVG + '</span>');
    });
  }

  // ── onemed only: the Add-item wizard embeds a TinyMCE editor whose writing area
  // is a same-origin iframe with a white body + black text. CSS can't cross into the
  // iframe, so inject a dark style into its document (styles.css handles the editor
  // chrome). Re-applied per iframe; guarded so it runs once per editor document.
  function darkenEditorIframes() {
    if (!document.querySelector('#main-wrapper')) return;
    document.querySelectorAll('.mce-edit-area iframe, iframe.mce-content-body, iframe[id*="mce"]').forEach(f => {
      let doc;
      try { doc = f.contentDocument; } catch (e) { return; }   // cross-origin — skip
      if (!doc || !doc.head || doc.getElementById('mp-iframe-dark')) return;
      const st = doc.createElement('style');
      st.id = 'mp-iframe-dark';
      st.textContent = 'html,body{background:#08060F !important;color:#ECE7FF !important;}' +
                       'a{color:#C97DFF !important;} p,li,span,td,div{color:#ECE7FF !important;}';
      doc.head.appendChild(st);
    });
  }

  // ── Safety net: the medlea forms/detail pages colour assorted elements (li, span,
  // font, td, h…) with the site's dark ink (rgb(52,53,54), #444, #333…) which is
  // invisible on the dark canvas. Rather than chase each element type in CSS, tag
  // any #content-body text node whose *computed* colour is dark-on-dark and let CSS
  // lift it to --haze. Skips the timetable grid, toolbar, footer and links (they
  // have their own colours). Idempotent via dataset flag; incremental on re-run.
  function litDarkText() {
    const cb = document.getElementById('content-body');
    if (!cb) return;
    cb.querySelectorAll('td,th,li,span,p,div,font,dd,dt,b,i,label,nobr,em,strong')
      .forEach(el => {
        if (el.dataset.mpLit) return;
        el.dataset.mpLit = '1';
        if (el.closest('.aj-week-event,.aj-tt-dayHeader,.aj-week-time,.aj-tt-grid,' +
                        '#view_selectors,.cl-toolbar,a,.mp-footer,.OkMsg,.ErrMsg,.WarnMsg')) return;
        if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
        const m = getComputedStyle(el).color.match(/[\d.]+/g);
        if (!m || (m.length >= 4 && +m[3] === 0)) return;
        const lum = (0.2126 * +m[0] + 0.7152 * +m[1] + 0.0722 * +m[2]) / 255;
        if (lum < 0.4) el.classList.add('mp-lit');
      });
  }

  // ── Forms detail / exam-feedback pages (medlea /forms/ViewForm.aspx): the CCA/
  // OSCE + progress-test feedback boxes ship as inline-styled LIGHT panels — cream
  // (#ffffee) <fieldset> value chips (styles.css dark-themes those directly) and
  // classless grey (#F1F1F1) note / "show details" <div>s (incl. ones hidden at
  // width:0 until expanded). This is the background twin of litDarkText(): tag any
  // #content-body element whose *computed* background is a light fill as .mp-litebox
  // so styles.css can dark-glass it — no fragile per-hex CSS. Skips <fieldset> (own
  // rule) and the chart/image pixels (canvas/img/svg, which carry a transparent bg,
  // never a light one, so they can't be tagged anyway). Idempotent; incremental.
  function litLightBoxes() {
    const cb = document.getElementById('content-body');
    if (!cb) return;
    cb.querySelectorAll('div,td,th,section,article,aside,p,dl').forEach(el => {
      if (el.dataset.mpBox) return;
      el.dataset.mpBox = '1';
      if (el.closest('fieldset,.aj-week-event,.aj-tt-grid,.mp-footer,' +
                     '.OkMsg,.ErrMsg,.WarnMsg,#view_list')) return;
      const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
      if (!m || (m.length >= 4 && +m[3] < 0.5)) return;
      const lum = (0.2126 * +m[0] + 0.7152 * +m[1] + 0.0722 * +m[2]) / 255;
      if (lum > 0.6) el.classList.add('mp-litebox');
    });
  }

  // ── Submissions marksheets (medlea /forms/ViewForm.aspx, the table.eval family:
  // APEP / supervisor assessments). The grade awarded is encoded ONLY in one 24px
  // form-radio.png raster sitting among ~72 identical empty ones — on a 15,000px
  // page of six-band rubrics that is effectively unreadable. CSS can highlight the
  // winning CELL on its own (td:has(img…)), but not the rest of its COLUMN, so tag
  // that here: .mp-eval-won on the band's header cell + every other cell in the same
  // column, .mp-rb-sel on the chosen radio's holder. Keyed off the raster's src
  // (NOT the .mp-rb-on glyph decorateGlyphs() inserts) so call order can't matter.
  // Idempotent via a dataset flag; safe to re-run from the MutationObserver.
  function decorateEvalGrids() {
    document.querySelectorAll('#content-body table.eval').forEach(t => {
      if (t.dataset.mpEval) return;
      t.dataset.mpEval = '1';
      t.querySelectorAll('td:has(img[src$="form-radio.png"])').forEach(td => {
        const holder = td.querySelector('div.rbholder:has(img[src$="form-radio.png"])');
        if (holder) holder.classList.add('mp-rb-sel');
        const i = td.cellIndex, body = td.closest('tbody') || t;
        body.querySelectorAll('tr.domain, tr.headerrow, tr.qrow').forEach(r => {
          const c = r.cells[i];
          if (c && c !== td) c.classList.add('mp-eval-won');
        });
      });
    });
  }

  // ── Progress-test feedback (medlea /forms/ViewForm.aspx) ────────────────────
  // These pages state every number as a bare <fieldset> holding THREE things: a
  // `float:right;height:1em;width:1px` spacer, the value's text node, and a
  // `clear:both` div. The spacer reserves a line the value then sits beside and the
  // clear div is forced past it, so a one-line chip renders ~44px tall with the
  // digit stranded low; and because a fieldset's UA `min-inline-size` is
  // `min-content`, every box also shrink-wraps its own digits — "100" comes out
  // wider than "57". The cohort mean is worse still: it is a loose text node
  // "(70)" sitting OUTSIDE the chip entirely. Net effect is a grid of
  // different-sized boxes with the numbers off-centre.
  //
  // So: rebuild each chip's contents (which drops both shims), pull the cohort
  // mean inside it, and tag it with a tone class for how the score compares to
  // that mean — CSS can neither count nor compare, which is the whole reason this
  // lives in JS. styles.css owns every pixel of the result.
  //
  // Also: a progress test is sat as TWO papers on separate days — questions 1–125
  // are day 1, anything beyond is day 2 — but the page reports one combined mark,
  // so how each day went is invisible. Tally them and inject a summary panel plus
  // a divider row at the boundary.
  //
  // Every step is guarded by its own dataset flag, so the MutationObserver can
  // re-run decorate() freely. The observer watches childList only (no attributes),
  // so the injections cost exactly one debounced re-run, which the guards no-op.
  // Day-1 length of the MBChB progress test. This is a property of the EXAM FORMAT,
  // not of any one sitting: a paper of 125 or fewer questions is day 1 on its own and
  // the panel falls back to a single 'Question tally' card. The cards always print the
  // question range they are claiming (Q1–Q125 / Q126–Qn), so a sitting that splits
  // somewhere else is visible as wrong rather than silently mis-stated.
  const MP_PT_DAY1 = 125;

  function mpPtClean(el) {
    return (el ? el.textContent : '').replace(/\s+/g, ' ').trim();
  }
  function mpPtNum(value) {
    if (value == null) return null;
    const s = String(value).trim();
    if (!s || /^n\/?a$/i.test(s)) return null;
    const m = s.match(/-?\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }
  // One shared scale so a cell that reads green in the results grid means the same
  // thing as a green headline. N/A stays neutral — "not assessed" is not a result.
  function mpPtTone(score, mean) {
    if (score == null) return 'na';
    if (mean == null) return 'flat';
    const d = score - mean;
    if (d >= 10) return 'up';
    if (d > 0) return 'slight-up';
    if (d === 0) return 'flat';
    if (d > -10) return 'slight-down';
    return 'down';
  }
  function mpPtSigned(n) { return (n > 0 ? '+' : '') + n; }

  function decorateProgressTest() {
    const grids = [...document.querySelectorAll('#content-body table.grid-table')];
    const examTable = grids.find(t =>
      t.rows[0] && /^Examination$/i.test(mpPtClean(t.rows[0].cells[0])));
    const questionTable = grids.find(t =>
      t.rows[0] && t.rows[0].cells.length >= 3 &&
      /^Question$/i.test(mpPtClean(t.rows[0].cells[0])) &&
      /Responses/i.test(mpPtClean(t.rows[0].cells[2])));
    const resultsGrid = document.querySelector('#content-body table.grid-table.centredtable');
    if (!examTable && !questionTable) return;      // not a progress-test page

    // Gate for every rule in the PROGRESS TEST block of styles.css — the CCA/OSCE
    // feedback pages share the fieldset markup and must stay untouched.
    document.documentElement.classList.add('mp-pt');

    mpPtExam(examTable);
    mpPtResults(resultsGrid);
    mpPtQuestions(questionTable);
  }

  // Rebuild a value chip as [score][mean] and tone it. Returns the fieldset.
  // Chrome lays a <fieldset>'s children out in an ANONYMOUS content box, so flex
  // alignment set on the fieldset never reaches them — `align-items:center`
  // computes correctly and the content still sits flush to the top. Every chip
  // therefore carries an inner .mp-pt-inner span that is the real flex container;
  // the fieldset just wraps it for the border/background.
  function mpPtInner(fieldset) {
    fieldset.textContent = '';                     // drops the float/clear shims
    const inner = document.createElement('span');
    inner.className = 'mp-pt-inner';
    fieldset.appendChild(inner);
    return inner;
  }

  function mpPtChip(fieldset, score, mean, scoreText) {
    const tone = mpPtTone(score, mean);
    const inner = mpPtInner(fieldset);
    const value = document.createElement('span');
    value.className = 'mp-pt-score';
    value.textContent = scoreText;
    inner.appendChild(value);
    if (mean != null || score == null) {
      const meanEl = document.createElement('span');
      meanEl.className = 'mp-pt-mean';
      meanEl.textContent = mean == null ? '(N/A)' : '(' + mean + ')';
      inner.appendChild(meanEl);
    }
    fieldset.classList.add('mp-pt-chip', 'mp-pt-' + tone);
    fieldset.title = (score != null && mean != null)
      ? 'You ' + score + '% · cohort ' + mean + '% · ' + mpPtSigned(score - mean) + ' vs cohort'
      : 'Not assessed in this sitting';
    return fieldset;
  }

  // ── headline mark + grade ───────────────────────────────────────────────────
  function mpPtExam(table) {
    if (!table || table.dataset.mpPtExam) return;
    table.dataset.mpPtExam = '1';

    const markRow  = [...table.rows].find(r => /overall mark/i.test(mpPtClean(r.cells[0])));
    const gradeRow = [...table.rows].find(r => /^Grade$/i.test(mpPtClean(r.cells[0])));

    if (markRow && markRow.cells[1]) {
      const fieldset = markRow.cells[1].querySelector('fieldset');
      const mark   = fieldset ? mpPtNum(mpPtClean(fieldset)) : null;
      const cohort = markRow.cells[2] ? mpPtNum(mpPtClean(markRow.cells[2])) : null;

      if (fieldset) {
        // The "%" lives in a sibling cell of a nested layout table; fold it into
        // the chip so the headline reads as one figure instead of two fragments.
        const layoutTable = fieldset.closest('table');
        if (layoutTable && layoutTable !== table) {
          [...layoutTable.querySelectorAll('td')].forEach(td => {
            if (!td.contains(fieldset) && /^%$/.test(mpPtClean(td))) td.remove();
          });
        }
        // Built directly rather than via mpPtChip: the headline carries a
        // "+2 vs cohort" line where a grid cell carries the bracketed mean.
        const inner = mpPtInner(fieldset);
        const value = document.createElement('span');
        value.className = 'mp-pt-score';
        value.textContent = mark == null ? 'N/A' : mark + '%';
        const sub = document.createElement('span');
        sub.className = 'mp-pt-hero-sub';
        sub.textContent = (mark != null && cohort != null)
          ? mpPtSigned(mark - cohort) + ' vs cohort' : 'Your mark';
        inner.append(value, sub);
        fieldset.classList.add('mp-pt-chip', 'mp-pt-hero', 'mp-pt-' + mpPtTone(mark, cohort));
        if (mark != null && cohort != null) {
          fieldset.title = 'You ' + mark + '% · cohort ' + cohort + '%';
        }
      }

      // Mirror the cohort figure so the two columns read as a matched pair.
      if (markRow.cells[2] && !markRow.cells[2].querySelector('.mp-pt-hero')) {
        const text = mpPtClean(markRow.cells[2]);
        markRow.cells[2].textContent = '';
        const twin = document.createElement('div');
        twin.className = 'mp-pt-chip mp-pt-hero mp-pt-muted';
        const inner = mpPtInner(twin);
        const value = document.createElement('span');
        value.className = 'mp-pt-score';
        value.textContent = text || (cohort == null ? 'N/A' : cohort + '%');
        const sub = document.createElement('span');
        sub.className = 'mp-pt-hero-sub';
        sub.textContent = 'Cohort mean';
        inner.append(value, sub);
        markRow.cells[2].appendChild(twin);
      }
    }

    if (gradeRow && gradeRow.cells[1]) {
      // The grade cell is colspan=2, so it straddles the PT and Cohort mean
      // columns and its badge lands between them rather than under "PT". Drop it
      // to one column and pad the row out to full width.
      const spanOf = row => [...row.cells].reduce((n, c) => n + (c.colSpan || 1), 0);
      const columns = table.rows[0] ? spanOf(table.rows[0]) : 0;
      const cell = gradeRow.cells[1];
      if (columns && cell.colSpan > 1) {
        cell.colSpan = 1;
        while (spanOf(gradeRow) < columns) {
          const filler = document.createElement('td');
          filler.className = 'mp-pt-filler';
          gradeRow.appendChild(filler);
        }
      }
      const fieldset = cell.querySelector('fieldset');
      if (fieldset) {
        // Rank against the page's own boundary ladder rather than hard-coding
        // outcome names — the thresholds differ per sitting (Winter ≥62 for a
        // Distinction, Summer ≥70), and a renamed outcome still tones sensibly.
        const grade = mpPtClean(fieldset);
        const ladder = [...document.querySelectorAll('#content-body table.grid-table')]
          .filter(t => t.rows[0] && /Grade Outcome/i.test(mpPtClean(t.rows[0].cells[0])))
          .flatMap(t => [...t.rows].slice(1).map(r => mpPtClean(r.cells[0])));
        const tone = ['up', 'slight-up', 'flat', 'slight-down', 'down'][ladder.indexOf(grade)] || 'flat';
        const value = document.createElement('span');
        value.className = 'mp-pt-score';
        value.textContent = grade;
        mpPtInner(fieldset).appendChild(value);
        fieldset.classList.add('mp-pt-chip', 'mp-pt-grade', 'mp-pt-' + tone);
      }
    }
  }

  // ── clinical-area × domain grid ─────────────────────────────────────────────
  function mpPtResults(grid) {
    if (!grid || grid.dataset.mpPtGrid) return;
    grid.dataset.mpPtGrid = '1';

    const rows = [...grid.rows];
    const header = rows.find(r => r.cells.length > 2 && /clinical area/i.test(mpPtClean(r.cells[0])));
    const start = header ? rows.indexOf(header) + 1 : 0;

    rows.slice(start).filter(r => r.cells.length > 2).forEach(row => {
      [...row.cells].slice(1).forEach(td => {
        const fieldset = td.querySelector('fieldset');
        if (!fieldset) return;
        const scoreText = mpPtClean(fieldset);
        const score = mpPtNum(scoreText);
        // the cohort mean is a loose "(70)" text node sitting outside the chip
        const loose = [...td.childNodes]
          .filter(n => n.nodeType === 3)
          .map(n => { const t = n.textContent; n.remove(); return t; })
          .join(' ');
        const bracketed = loose.match(/\(([^)]*)\)/);
        const mean = mpPtNum(bracketed ? bracketed[1] : null);
        mpPtChip(fieldset, score, mean, score == null ? 'N/A' : String(score));
      });
    });

    // The tones carry real information, so they need a key.
    if (!document.querySelector('.mp-pt-legend')) {
      const legend = document.createElement('div');
      legend.className = 'mp-pt-legend';
      [['up', '10+ above cohort'], ['slight-up', 'Above cohort'],
       ['slight-down', 'Below cohort'], ['down', '10+ below cohort'],
       ['na', 'Not assessed']].forEach(([tone, label]) => {
        const key = document.createElement('span');
        key.className = 'mp-pt-key';
        const swatch = document.createElement('i');
        swatch.className = 'mp-pt-swatch mp-pt-' + tone;
        key.append(swatch, document.createTextNode(label));
        legend.appendChild(key);
      });
      const note = document.createElement('span');
      note.className = 'mp-pt-key mp-pt-key-note';
      note.textContent = 'Cohort mean in brackets';
      legend.appendChild(note);
      grid.parentNode.insertBefore(legend, grid);
    }
  }

  // ── per-question responses + the day 1 / day 2 split ────────────────────────
  function mpPtQuestions(table) {
    if (!table || table.dataset.mpPtQ) return;
    table.dataset.mpPtQ = '1';

    const rows = [...table.rows].slice(1).filter(r => r.cells.length >= 3);
    if (!rows.length) return;

    const marks = rows.map(row => {
      const td = row.cells[2];
      const fieldset = td.querySelector('fieldset');
      const correct = mpPtClean(fieldset || td) === '1';
      if (fieldset) {
        const glyph = document.createElement('span');
        glyph.className = 'mp-pt-score';
        glyph.textContent = correct ? '✓' : '✗';
        mpPtInner(fieldset).appendChild(glyph);
        fieldset.classList.add('mp-pt-chip', 'mp-pt-mark',
          correct ? 'mp-pt-correct' : 'mp-pt-incorrect');
        fieldset.title = correct ? 'Correct (1)' : 'Incorrect (0)';
      }
      return correct ? 1 : 0;
    });

    const tally = (from, to) => {
      let correct = 0;
      for (let i = from; i < to; i++) correct += marks[i];
      const total = to - from;
      return { correct, total, pct: total ? Math.round((correct / total) * 100) : 0 };
    };

    const hasDayTwo = rows.length > MP_PT_DAY1;
    const day1 = tally(0, hasDayTwo ? MP_PT_DAY1 : rows.length);
    const day2 = hasDayTwo ? tally(MP_PT_DAY1, rows.length) : null;
    const all  = tally(0, rows.length);

    // MedLea never prints the raw tally, only the rounded percentage.
    const panel = document.createElement('section');
    panel.className = 'mp-pt-days';
    const title = document.createElement('h3');
    title.className = 'mp-pt-days-title';
    title.textContent = hasDayTwo ? 'Day split' : 'Question tally';
    panel.appendChild(title);

    const strip = document.createElement('div');
    strip.className = 'mp-pt-days-strip';
    const cards = hasDayTwo
      ? [{ label: 'Day 1', data: day1, span: 'Q1–Q' + MP_PT_DAY1 },
         { label: 'Day 2', data: day2, span: 'Q' + (MP_PT_DAY1 + 1) + '–Q' + rows.length },
         { label: 'Overall', data: all, span: 'Both papers', muted: true }]
      : [{ label: 'Overall', data: all, span: 'Q1–Q' + rows.length }];

    cards.forEach(entry => {
      const card = document.createElement('div');
      card.className = 'mp-pt-day' + (entry.muted ? ' mp-pt-day-all' : '');
      const label = document.createElement('span');
      label.className = 'mp-pt-day-label';
      label.textContent = entry.label;
      const pct = document.createElement('span');
      pct.className = 'mp-pt-day-pct';
      pct.textContent = entry.data.pct + '%';
      const count = document.createElement('span');
      count.className = 'mp-pt-day-count';
      count.textContent = entry.data.correct + ' / ' + entry.data.total + ' correct';
      const range = document.createElement('span');
      range.className = 'mp-pt-day-range';
      range.textContent = entry.span;
      // Width travels as a custom property (same idiom as the timetable's
      // --key/--h) so styles.css keeps ownership of the geometry.
      const bar = document.createElement('span');
      bar.className = 'mp-pt-day-bar';
      const fill = document.createElement('i');
      fill.style.setProperty('--pct', entry.data.pct + '%');
      bar.appendChild(fill);
      card.append(label, pct, count, range, bar);
      strip.appendChild(card);
    });
    panel.appendChild(strip);

    if (hasDayTwo) {
      const gap = day2.pct - day1.pct;
      const note = document.createElement('p');
      note.className = 'mp-pt-days-note';
      note.textContent = gap === 0
        ? 'Both days scored the same.'
        : 'Day ' + (gap > 0 ? '2' : '1') + ' was ' + Math.abs(gap) +
          ' point' + (Math.abs(gap) === 1 ? '' : 's') + ' stronger.';
      panel.appendChild(note);
    }
    table.parentNode.insertBefore(panel, table);

    // Divider row so the boundary is findable while scrolling 175 rows.
    if (hasDayTwo) {
      const boundary = rows[MP_PT_DAY1];
      const divider = table.insertRow(boundary.rowIndex);
      divider.className = 'mp-pt-day2-row';
      const cell = divider.insertCell();
      cell.colSpan = boundary.cells.length;
      cell.textContent = 'Day 2 · ' + day2.correct + ' / ' + day2.total +
                         ' correct (' + day2.pct + '%)';
    }
  }

  // ── CCA / OSCE station feedback (medlea /forms/ViewForm.aspx) ───────────────
  // The THIRD ViewForm layout, after the table.eval marksheets and the progress
  // test. A CCA page is a `table.examfeedback` of station rows, each followed by a
  // `div#detailsdivN` the site toggles with Prototype's $(…).toggle().
  //
  // What the page ships and why it needs rebuilding:
  //   • Every judgement — the station's global band and each skill component — is a
  //     <fieldset> carrying the SAME `float:right;height:1em;width:1px` + `clear:both`
  //     shims as the progress test, so the value sits low in a ~44px box, and an
  //     inline `width:15em` that squeezes 800-character examiner comments into a
  //     narrow ribbon.
  //   • Beside each judgement the site prints a Chart.js bar chart of the cohort's
  //     band distribution. The ONE bar tinted rgba(0,176,80) is the student's own
  //     band — that green index is the only machine-readable record of where they
  //     landed, so read it rather than pattern-matching the prose (the prose is the
  //     fallback). Those charts are 250px tall, one per component, and the ones
  //     inside a collapsed details panel are created at 0×0 because their container
  //     is display:none when Chart.js measures it.
  //   • Nothing anywhere states how the student sits against the cohort, though the
  //     chart data says it exactly: the percentages BELOW the green bar are the
  //     share of the year that scored in a lower band.
  //
  // So: rebuild each station row as a card (number, title, toned band badge, a
  // compact CSS distribution strip with the cohort standing spelled out), rebuild
  // the component rows the same way, and lead the page with an overview panel that
  // aggregates the spread and names the strongest / weakest stations. The site's
  // canvases are hidden, never removed. Every step is dataset/expando-guarded so
  // the MutationObserver can re-run decorate() freely.
  //
  // Tones are the progress test's scale (rose → amber → ice → pale green → emerald)
  // mapped onto the band's index, so a green chip means the same thing on both page
  // types. Cyan --pulse stays reserved for time/live. Nothing moves on hover.
  const MP_CCA_TONES = ['down', 'slight-down', 'flat', 'slight-up', 'up'];

  function mpCcaClean(el) { return (el ? el.textContent : '').replace(/\s+/g, ' ').trim(); }

  // The component scales (None → All) are an even ladder, so tone follows position.
  // The GLOBAL judgement scale is not: its bands are MF, F, S, G, E, and MF and F
  // are both failures to demonstrate competency — a positional ladder paints the
  // second-lowest band amber, which under-signals a station the student failed.
  // So when the label set is the global one, map by band rather than by position.
  const MP_CCA_BAND_TONE = { MF: 'down', F: 'down', S: 'flat', G: 'slight-up', E: 'up' };

  function mpCcaTone(idx, n, labels) {
    if (idx == null || idx < 0 || !n || n < 2) return 'na';
    if (labels && labels.join(',') === 'MF,F,S,G,E') return MP_CCA_BAND_TONE[labels[idx]];
    return MP_CCA_TONES[Math.round((idx / (n - 1)) * 4)];
  }

  // Fallback band index when a chart is missing. "marginal" is tested before "fail"
  // because the marginal band's wording contains both; the component wordings
  // ("Uses most elements") share the same 0–4 ladder.
  function mpCcaBandIdx(text) {
    const t = (text || '').toLowerCase();
    if (/excellent/.test(t)) return 4;
    if (/\bgood\b/.test(t)) return 3;
    if (/satisfactory/.test(t)) return 2;
    if (/marginal/.test(t)) return 0;
    if (/fail/.test(t)) return 1;
    if (/\ball\b/.test(t)) return 4;
    if (/\bmost\b/.test(t)) return 3;
    if (/\bhalf\b/.test(t)) return 2;
    if (/\bfew\b/.test(t)) return 1;
    if (/\bno\b|\bnone\b/.test(t)) return 0;
    return -1;
  }

  // Read the cohort chart out of the inline Chart.js block in a cell.
  function mpCcaChart(cell) {
    const sc = cell && cell.querySelector('script');
    if (!sc) return null;
    const src = sc.textContent;
    const lm = src.match(/labels:\s*\[([^\]]*)\]/);
    const dm = src.match(/data:\s*\[([^\]]*)\]/);
    const bm = src.match(/backgroundColor:\s*\[([^\]]*)\]/);
    if (!lm || !dm) return null;
    const labels = lm[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    const data = dm[1].split(',').map(s => parseFloat(s) || 0);
    if (!labels.length || labels.length !== data.length) return null;
    let you = -1;
    ((bm && bm[1].match(/rgba\([^)]*\)/g)) || []).forEach((c, i) => {
      if (/\(\s*0\s*,\s*176\s*,\s*80/.test(c)) you = i;
    });
    return { labels, data, you };
  }

  // Share of the cohort in a strictly lower band than `idx`.
  function mpCcaBelow(chart, idx) {
    if (!chart || idx == null || idx < 0) return null;
    return chart.data.slice(0, idx).reduce((a, b) => a + b, 0);
  }

  // The distribution strip: one column per band, bar height relative to the tallest
  // bar (not to 100) so a 2% band is still visible, the student's own column toned.
  // Heights travel as a --pct custom property, same idiom as the timetable's --h.
  function mpCcaDist(chart, idx, small) {
    const max = Math.max.apply(null, chart.data.concat([1]));
    const wrap = document.createElement('div');
    wrap.className = 'mp-cca-dist' + (small ? ' mp-cca-dist-sm' : '');
    chart.labels.forEach((lab, i) => {
      const col = document.createElement('div');
      col.className = 'mp-cca-col' +
        (i === idx ? ' mp-cca-you mp-cca-' + mpCcaTone(i, chart.labels.length, chart.labels) : '');
      const track = document.createElement('span');
      track.className = 'mp-cca-track';
      const fill = document.createElement('i');
      fill.style.setProperty('--pct', (chart.data[i] / max * 100).toFixed(1) + '%');
      track.appendChild(fill);
      const cap = document.createElement('span');
      cap.className = 'mp-cca-cap';
      cap.textContent = lab;
      const val = document.createElement('span');
      val.className = 'mp-cca-val';
      val.textContent = Math.round(chart.data[i]) + '%';
      col.append(track, cap, val);
      wrap.appendChild(col);
    });
    return wrap;
  }

  // Re-line a judgement <fieldset> as a chip: dropping its children drops the two
  // layout shims, and the inner span is the real flex box (Chrome lays a fieldset's
  // children out in an anonymous box, so flex set on the fieldset never reaches
  // them — the same trap the progress-test chips hit).
  function mpCcaChip(fs, extra, text, tone, full) {
    fs.classList.add('mp-cca-chip', extra, 'mp-cca-' + tone);
    if (full && full !== text) fs.title = full;
    fs.textContent = '';
    const inner = document.createElement('span');
    inner.className = 'mp-cca-chip-inner';
    inner.textContent = text;
    fs.appendChild(inner);
    return fs;
  }

  // "Excellent demonstration of competency" → "Excellent"; the full wording is kept
  // as the chip's title. The band letter from the chart carries the rest.
  function mpCcaShortBand(text) {
    return (text || '').replace(/\s*(demonstration of|to demonstrate)\s+competency\s*$/i, '').trim() || text;
  }

  function decorateCCA() {
    const table = [...document.querySelectorAll('#content-body table.examfeedback')]
      .find(t => t.rows[0] && /global\s+judge?ment/i.test(t.rows[0].textContent));
    if (!table) return;
    document.documentElement.classList.add('mp-cca');
    table.classList.add('mp-cca-stations');

    const stations = [];
    [...table.rows].forEach(row => {
      if (row.cells.length === 3 && /^\d+$/.test(mpCcaClean(row.cells[0])) &&
          row.cells[1].querySelector('fieldset')) {
        stations.push(mpCcaStation(row));
      } else if (row.querySelector('[id^="detailsdiv"]')) {
        mpCcaDetail(row);
      } else if (row.cells.length === 3 && row.cells[0].tagName === 'TH') {
        row.classList.add('mp-cca-hide');           // the card is self-describing
      }
    });
    mpCcaNotes();
    mpCcaOverview(table, stations);
  }

  // One station row → one card. Parsed once and cached on the row (the rebuild
  // removes the markup the parse reads, so a re-run must not re-parse).
  function mpCcaStation(row) {
    if (row._mpCca) return row._mpCca;
    const main  = row.cells[1];
    const sub   = main.querySelector('table.subtable');
    const fs    = main.querySelector('fieldset');
    const link  = main.querySelector('a');
    const chart = mpCcaChart(row.cells[2]);
    const band  = mpCcaClean(fs);
    const idx   = chart && chart.you >= 0 ? chart.you : mpCcaBandIdx(band);
    const n     = chart ? chart.labels.length : 5;
    // with no chart to read the band set off, the prose still names a failure
    const tone  = chart ? mpCcaTone(idx, n, chart.labels)
                        : /fail/i.test(band) ? 'down' : mpCcaTone(idx, n);
    const rec = {
      num: mpCcaClean(row.cells[0]),
      title: sub && sub.rows[0] ? mpCcaClean(sub.rows[0].cells[0]) : '',
      band, idx, tone,
      letter: chart && idx >= 0 ? chart.labels[idx] : '',
      below: mpCcaBelow(chart, idx)
    };
    row._mpCca = rec;

    row.classList.add('mp-cca-station');
    row.cells[0].classList.add('mp-cca-hide');
    row.cells[2].classList.add('mp-cca-hide');
    main.classList.add('mp-cca-slot');

    const card = document.createElement('div');
    card.className = 'mp-cca-card mp-cca-' + rec.tone;

    const head = document.createElement('div');
    head.className = 'mp-cca-head';
    const num = document.createElement('span');
    num.className = 'mp-cca-num';
    num.textContent = rec.num;
    const title = document.createElement('h4');
    title.className = 'mp-cca-title';
    title.textContent = rec.title;
    head.append(num, title);
    if (fs) head.appendChild(mpCcaChip(fs, 'mp-cca-badge', mpCcaShortBand(band), rec.tone, band));
    card.appendChild(head);

    if (chart) {
      const strip = document.createElement('div');
      strip.className = 'mp-cca-strip';
      strip.appendChild(mpCcaDist(chart, idx, false));
      strip.appendChild(mpCcaRead(chart, idx));
      card.appendChild(strip);
    }
    if (link) {
      // The site's onclick rewrites this anchor's innerHTML on every toggle, so the
      // button look has to be pure CSS — anything appended here would be wiped.
      link.classList.add('mp-cca-toggle');
      const foot = document.createElement('div');
      foot.className = 'mp-cca-foot';
      foot.appendChild(link);
      card.appendChild(foot);
    }
    main.appendChild(card);
    if (sub) sub.remove();
    return rec;
  }

  // The cohort standing, spelled out. This is the one figure the page never states
  // even though its own chart data gives it exactly.
  function mpCcaRead(chart, idx) {
    const read = document.createElement('div');
    read.className = 'mp-cca-read';
    const below = mpCcaBelow(chart, idx);
    if (below == null) {
      read.classList.add('mp-cca-read-na');
      read.textContent = 'Band not recorded';
      return read;
    }
    const same  = chart.data[idx] || 0;
    const above = chart.data.slice(idx + 1).reduce((a, b) => a + b, 0);
    const val = document.createElement('span');
    val.className = 'mp-cca-read-val';
    val.textContent = Math.round(below) + '%';
    const lab = document.createElement('span');
    lab.className = 'mp-cca-read-lab';
    lab.textContent = 'of the year placed lower';
    const sub = document.createElement('span');
    sub.className = 'mp-cca-read-sub';
    sub.textContent = Math.round(same) + '% level with you · ' + Math.round(above) + '% higher';
    read.append(val, lab, sub);
    return read;
  }

  // The expandable panel: component table → row cards with the same chips and
  // strips, examiner comment → a readable quote block instead of a 15em ribbon.
  function mpCcaDetail(row) {
    if (row.dataset.mpCcaDet) return;
    row.dataset.mpCcaDet = '1';
    row.classList.add('mp-cca-detailrow');
    const box = row.querySelector('[id^="detailsdiv"]');
    [...row.cells].forEach(c => { if (!c.contains(box)) c.classList.add('mp-cca-hide'); });
    if (!box) return;
    box.classList.add('mp-cca-detail');

    const ct = box.querySelector('table.examfeedback');
    if (ct) {
      ct.classList.add('mp-cca-comps');
      [...ct.rows].forEach((r, i) => {
        if (r.cells[0] && r.cells[0].tagName === 'TH') { r.classList.add('mp-cca-comps-head'); return; }
        if (r.cells.length < 3) return;
        r.classList.add('mp-cca-comp');
        const fs = r.cells[1].querySelector('fieldset');
        const ch = mpCcaChart(r.cells[2]);
        const idx = ch && ch.you >= 0 ? ch.you : mpCcaBandIdx(mpCcaClean(fs));
        const n = ch ? ch.labels.length : 5;
        const tone = mpCcaTone(idx, n, ch && ch.labels);
        r.cells[0].classList.add('mp-cca-comp-name');
        r.cells[1].classList.add('mp-cca-comp-val');
        r.cells[2].classList.add('mp-cca-comp-dist');
        if (fs) mpCcaChip(fs, 'mp-cca-comp-chip', mpCcaClean(fs), tone);
        if (ch) {
          // capture the site's canvas holder BEFORE appending ours, or the
          // :scope > div query would match the replacement
          const canvasBox = r.cells[2].querySelector(':scope > div');
          const holder = document.createElement('div');
          holder.className = 'mp-cca-comp-strip';
          holder.appendChild(mpCcaDist(ch, idx, true));
          const below = mpCcaBelow(ch, idx);
          if (below != null) {
            const ahead = document.createElement('span');
            ahead.className = 'mp-cca-comp-ahead';
            ahead.textContent = Math.round(below) + '% of the year below';
            holder.appendChild(ahead);
          }
          r.cells[2].appendChild(holder);
          if (canvasBox) canvasBox.classList.add('mp-cca-hide');
        }
      });
    }

    const fb = [...box.children].find(c => c.tagName === 'FIELDSET');
    if (fb) {
      const text = mpCcaClean(fb);
      mpCcaChip(fb, 'mp-cca-quote', text || 'No written feedback for this station.', 'na');
      if (!text) fb.classList.add('mp-cca-quote-empty');
      // The site labels this box with a bare TEXT NODE ("Examiner Feedback
      // Comments:") on some sittings and with nothing at all on others. Adopt its
      // own wording where there is one — injecting a second heading beside it
      // would read as a duplicate — and remove the loose node either way.
      let own = '';
      [...box.childNodes].forEach(n => {
        if (n.nodeType !== 3 || !n.nodeValue.trim()) return;
        own = n.nodeValue.replace(/\s+/g, ' ').trim().replace(/:\s*$/, '');
        n.remove();
      });
      const lab = document.createElement('p');
      lab.className = 'mp-cca-quote-label';
      lab.textContent = own || 'Examiner feedback';
      box.insertBefore(lab, fb);
      // the site pads the gap with bare <br>s; the quote block owns its spacing now
      [...box.children].forEach(c => { if (c.tagName === 'BR') c.classList.add('mp-cca-hide'); });
    }
  }

  // "Assessment Office Notes:" is a bare text node followed by <br> and the box —
  // no element to hang a rule on. Wrap the three into one section.
  function mpCcaNotes() {
    const fs = document.querySelector('#content-body fieldset[name="assessment_notes"]');
    if (!fs || fs.dataset.mpCcaNotes) return;
    fs.dataset.mpCcaNotes = '1';
    const sec = document.createElement('section');
    sec.className = 'mp-cca-notes';
    fs.parentNode.insertBefore(sec, fs);
    for (let n = sec.previousSibling, hops = 0; n && hops < 5; hops++) {
      const prev = n.previousSibling;
      if (n.nodeType === 3 && /Assessment Office Notes/i.test(n.nodeValue)) { n.remove(); break; }
      if (n.nodeType === 1 && n.tagName === 'BR') n.remove();
      else if (n.nodeType === 3 && !n.nodeValue.trim()) n.remove();
      else break;
      n = prev;
    }
    const lab = document.createElement('h3');
    lab.className = 'mp-cca-notes-label';
    lab.textContent = 'Assessment office notes';
    const text = mpCcaClean(fs);
    sec.append(lab, mpCcaChip(fs, 'mp-cca-notes-box', text || 'None recorded.', 'na'));
    if (!text) fs.classList.add('mp-cca-quote-empty');
  }

  // ── Overview panel ──────────────────────────────────────────────────────────
  // The site's summary is a two-cell table ("Number of stations passed: | 7"). Lead
  // with a proper panel instead: the tallies as stat tiles, the spread of global
  // judgements as one stacked bar, the cohort standing averaged, and the strongest
  // / weakest stations named. The original table is hidden, never removed.
  function mpCcaOverview(table, stations) {
    const cb = document.getElementById('content-body');
    if (!cb || cb.querySelector('.mp-cca-overview')) return;
    const sum = [...cb.querySelectorAll(':scope > table')].find(t =>
      /number of stations passed/i.test(t.textContent));
    if (!sum || !stations.length) return;
    sum.classList.add('mp-cca-hide');

    const stat = name => {
      const fs = sum.querySelector('fieldset[name="' + name + '"]');
      return fs ? mpCcaClean(fs) : null;
    };
    const total     = stations.length;
    const passed    = stat('stationspassed');
    const excellent = stat('stationsexcellent');
    const outcome   = stat('overalloutcome');

    const panel = document.createElement('section');
    panel.className = 'mp-cca-overview';
    const title = document.createElement('h3');
    title.className = 'mp-cca-ov-title';
    title.textContent = 'Station overview';
    panel.appendChild(title);

    const tiles = document.createElement('div');
    tiles.className = 'mp-cca-tiles';
    const addTile = (value, label, sub, pct, tone) => {
      if (value == null) return;
      const tile = document.createElement('div');
      tile.className = 'mp-cca-tile' + (tone ? ' mp-cca-' + tone : '');
      const v = document.createElement('span');
      v.className = 'mp-cca-tile-val';
      v.textContent = value;
      const l = document.createElement('span');
      l.className = 'mp-cca-tile-label';
      l.textContent = label;
      tile.append(v, l);
      if (sub) {
        const s = document.createElement('span');
        s.className = 'mp-cca-tile-sub';
        s.textContent = sub;
        tile.appendChild(s);
      }
      if (pct != null) {
        const bar = document.createElement('span');
        bar.className = 'mp-cca-tile-bar';
        const fill = document.createElement('i');
        fill.style.setProperty('--pct', pct + '%');
        bar.appendChild(fill);
        tile.appendChild(bar);
      }
      tiles.appendChild(tile);
    };
    const passedN = parseFloat(passed);
    addTile(passed, 'stations passed', 'of ' + total,
            isFinite(passedN) ? Math.round(passedN / total * 100) : null,
            isFinite(passedN) ? mpCcaTone(passedN === total ? 4 : passedN >= total - 1 ? 3 : 2, 5) : null);
    addTile(excellent, 'at "Excellent"', 'of ' + total,
            isFinite(parseFloat(excellent)) ? Math.round(parseFloat(excellent) / total * 100) : null);
    if (outcome) {
      // the field holds a bare letter on most sittings ("S") — name it, and read
      // the TONE off the named form: /^un/ never matched a lone "U", so a failed
      // CCA was toned as a pass.
      // Tone the tile only when the outcome is one we actually recognise. A sitting
      // that names its outcomes differently used to fall through to the positive
      // branch — i.e. an unknown result was painted as a pass. Unknown is now flat.
      const word = mpCcaOutcomeName(outcome);
      const known = /^[USHD]$/i.test(String(outcome).trim());
      const tile = document.createElement('div');
      tile.className = 'mp-cca-tile mp-cca-tile-outcome mp-cca-' +
        (/^un|fail/i.test(word) ? 'down' : known ? 'slight-up' : 'flat');
      const v = document.createElement('span');
      v.className = 'mp-cca-tile-val mp-cca-tile-word';
      v.textContent = word;
      const l = document.createElement('span');
      l.className = 'mp-cca-tile-label';
      l.textContent = 'overall CCA outcome';
      tile.append(v, l);
      tiles.appendChild(tile);
    }
    panel.appendChild(tiles);

    // spread of global judgements, in the cohort chart's own band order
    const bands = [];
    stations.forEach(s => {
      const key = s.letter || String(s.idx);
      let b = bands.find(x => x.key === key);
      if (!b) {
        // Name the band from the row's own PROSE ("Satisfactory demonstration of
        // competency" → "Satisfactory"); the chart's letter (S / G / MF …) is the
        // site's abbreviation and reads as nothing on its own. The letter stays
        // the grouping KEY — only the label changes.
        b = { key, idx: s.idx, tone: s.tone, label: mpCcaShortBand(s.band) || s.letter, n: 0 };
        bands.push(b);
      }
      b.n++;
    });
    bands.sort((a, b) => b.idx - a.idx);
    if (bands.length) {
      const spread = document.createElement('div');
      spread.className = 'mp-cca-spread';
      const lab = document.createElement('span');
      lab.className = 'mp-cca-spread-label';
      lab.textContent = 'Global judgements';
      const bar = document.createElement('div');
      bar.className = 'mp-cca-spread-bar';
      const key = document.createElement('div');
      key.className = 'mp-cca-spread-key';
      bands.forEach(b => {
        const seg = document.createElement('span');
        seg.className = 'mp-cca-seg mp-cca-' + b.tone;
        seg.style.setProperty('--pct', (b.n / stations.length * 100).toFixed(2) + '%');
        seg.title = b.label + ' × ' + b.n;
        bar.appendChild(seg);
        const k = document.createElement('span');
        k.className = 'mp-cca-spread-item';
        const sw = document.createElement('i');
        sw.className = 'mp-cca-swatch mp-cca-' + b.tone;
        const t = document.createElement('span');
        t.textContent = b.label + ' × ' + b.n;
        k.append(sw, t);
        key.appendChild(k);
      });
      spread.append(lab, bar, key);
      panel.appendChild(spread);
    }

    // cohort standing: average percentile plus the two stations at the extremes
    const ranked = stations.filter(s => s.below != null).sort((a, b) => b.below - a.below);
    if (ranked.length) {
      const avg = ranked.reduce((a, s) => a + s.below, 0) / ranked.length;
      const best = ranked[0], worst = ranked[ranked.length - 1];
      const note = document.createElement('p');
      note.className = 'mp-cca-ov-note';
      const strong = document.createElement('span');
      strong.className = 'mp-cca-ov-figure';
      strong.textContent = Math.round(avg) + '%';
      note.appendChild(strong);
      note.appendChild(document.createTextNode(
        ' of the year placed in a lower band than you on an average station.' +
        (ranked.length > 1
          ? ' Strongest station: ' + best.num + ' ' + best.title + ' (' +
            Math.round(best.below) + '% of the year below). Weakest: ' + worst.num + ' ' +
            worst.title + ' (' + Math.round(worst.below) + '%).'
          : '')));
      panel.appendChild(note);
    }

    const matrix = mpCcaMatrix(cb, passedN, parseFloat(excellent), outcome, total);
    if (matrix) panel.appendChild(matrix);

    sum.parentNode.insertBefore(panel, sum);
  }

  // ── Outcome matrix ──────────────────────────────────────────────────────────
  // Summative pages ship the grade key as a raster JPG (a white 17×17 grid of
  // U/S/H/D letters) that states the outcome for every (stations passed, stations
  // at Excellent) pair — including how far the next band is, which nothing on the
  // page says in words. Redraw it as a dark grid with the student's cell marked.
  //
  // The ladder below is transcribed from that key, so it is only used when the page
  // is the one it belongs to AND it reproduces the outcome the page itself printed
  // — a self-check in the spirit of the progress test's day tally. Any mismatch
  // (different key image, different station count, reworded outcome) falls through
  // and the page keeps the site's own image.
  const MP_CCA_KEY = 'stationgradekey2';
  const MP_CCA_RANK = { U: 0, S: 1, H: 2, D: 3 };
  // The key — and the page's own "overall CCA outcome" field — states the result
  // as a BARE LETTER, and nothing on the page ever expands it: a tile reading "S"
  // tells the student nothing. Spell it out everywhere the letter is surfaced
  // (the overview tile, the grid legend, every cell's tooltip, the note).
  // The grid CELLS stay letters — at 17×17 there is no room for words, which is
  // what the legend under it is for.
  const MP_CCA_OUTCOME = { U: 'Unsatisfactory', S: 'Satisfactory', H: 'Honours', D: 'Distinction' };
  function mpCcaOutcomeName(v) {
    const t = String(v == null ? '' : v).trim();
    return /^[USHD]$/i.test(t) ? MP_CCA_OUTCOME[t.toUpperCase()] : t;
  }

  function mpCcaOutcomeLetter(passed, excellent) {
    if (passed <= 11) return 'U';
    if (passed <= 13) return 'S';
    if (passed === 14) return excellent >= 10 ? 'H' : 'S';
    if (passed === 15) return excellent >= 8 ? 'H' : 'S';
    return excellent >= 8 ? 'D' : excellent >= 6 ? 'H' : 'S';
  }

  function mpCcaMatrix(cb, passed, excellent, outcome, total) {
    const img = cb.querySelector('img[src*="' + MP_CCA_KEY + '"]');
    if (!img || total !== 16 || !outcome ||
        !isFinite(passed) || !isFinite(excellent)) return null;
    const letter = mpCcaOutcomeLetter(passed, excellent);
    if (letter !== outcome.trim().charAt(0).toUpperCase()) return null;   // self-check
    img.classList.add('mp-cca-hide');

    const wrap = document.createElement('div');
    wrap.className = 'mp-cca-matrix';
    const head = document.createElement('span');
    head.className = 'mp-cca-matrix-title';
    head.textContent = 'Outcome grid — stations passed × stations at "Excellent"';
    wrap.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'mp-cca-grid';
    grid.style.setProperty('--cols', total + 1);
    for (let p = total; p >= 0; p--) {
      const rowLab = document.createElement('span');
      rowLab.className = 'mp-cca-grid-rowlab';
      rowLab.textContent = p;
      grid.appendChild(rowLab);
      for (let e = 0; e <= total; e++) {
        const cell = document.createElement('span');
        if (e > p) { cell.className = 'mp-cca-grid-void'; grid.appendChild(cell); continue; }
        const l = mpCcaOutcomeLetter(p, e);
        cell.className = 'mp-cca-grid-cell mp-cca-band-' + l.toLowerCase();
        cell.textContent = l;
        cell.title = p + ' passed, ' + e + ' at "Excellent" → ' + mpCcaOutcomeName(l);
        if (p === passed && e === excellent) {
          cell.classList.add('mp-cca-grid-you');
          cell.title = 'You: ' + passed + ' passed, ' + excellent + ' at "Excellent" → ' +
            mpCcaOutcomeName(outcome);
        }
        grid.appendChild(cell);
      }
    }
    const corner = document.createElement('span');
    corner.className = 'mp-cca-grid-rowlab mp-cca-grid-corner';
    grid.appendChild(corner);
    for (let e = 0; e <= total; e++) {
      const colLab = document.createElement('span');
      colLab.className = 'mp-cca-grid-collab';
      colLab.textContent = e;
      grid.appendChild(colLab);
    }
    wrap.appendChild(grid);

    // legend — the grid is 17×17, so the cells can only carry letters; this is
    // where they are named. Highest band first so it reads as a ladder, with the
    // student's own band ringed to match its cell.
    const legend = document.createElement('div');
    legend.className = 'mp-cca-grid-key';
    ['D', 'H', 'S', 'U'].forEach(l => {
      const item = document.createElement('span');
      item.className = 'mp-cca-grid-key-item' +
        (l === letter ? ' mp-cca-grid-key-you' : '');
      const sw = document.createElement('i');
      sw.className = 'mp-cca-grid-swatch mp-cca-band-' + l.toLowerCase();
      sw.textContent = l;
      const name = document.createElement('span');
      name.textContent = MP_CCA_OUTCOME[l];
      item.append(sw, name);
      legend.appendChild(item);
    });
    wrap.appendChild(legend);

    const axes = document.createElement('span');
    axes.className = 'mp-cca-matrix-axes';
    axes.textContent = 'rows: stations passed   ·   columns: stations at "Excellent"';
    wrap.appendChild(axes);

    const note = document.createElement('p');
    note.className = 'mp-cca-matrix-note';
    let next = null;
    for (let p = passed + 1; p <= total; p++) {
      const l = mpCcaOutcomeLetter(p, excellent);
      if (MP_CCA_RANK[l] > MP_CCA_RANK[letter]) { next = { p, l }; break; }
    }
    // the self-check above guarantees `letter` IS the outcome the page printed, so
    // name it once rather than printing the letter and the raw field ("S (S)").
    note.textContent = 'You sat at ' + passed + ' passed / ' + excellent +
      ' at "Excellent" → ' + mpCcaOutcomeName(letter) + '.' +
      (next
        ? ' With ' + excellent + ' at "Excellent", ' + mpCcaOutcomeName(next.l) +
          ' starts at ' + next.p + ' passed — ' + (next.p - passed) +
          ' more station' + (next.p - passed === 1 ? '' : 's') + '.'
        : ' This is the top band on the key.');
    wrap.appendChild(note);
    return wrap;
  }

  // ── AttendanceViewer / absence pages: the tab bar + date-filter bar carry inline
  // light backgrounds and have no class/id to target. Tag them so styles.css can
  // dark-theme them. Gated on .mitDetail OR the AttendanceViewer path (the history
  // tab has no .mitDetail, which once left its red tab td untagged) so the calendar
  // grid's own inline-styled cells are never affected. Idempotent, safe to re-run.
  const MP_ATTEND = /\/TimeTable\/Viewer\/AttendanceViewer/i.test(location.pathname);
  function tagInlineBg() {
    if (!document.querySelector('.mitDetail') && !MP_ATTEND) return;
    document.querySelectorAll('#content-body td[style*="background"]').forEach(td => {
      td.classList.add('mp-inlinebg');
    });
  }

  // ── AttendanceViewer redesign hooks: the page's header furniture is classless
  // (unclassed tables, inline red/pink tab tds whose <a>s carry inline black),
  // so tag everything the ATTENDANCE VIEWER css section rebuilds: <html>.mp-attend,
  // the head table (.mp-att-head), the two tab links (.mp-att-tab, active carries
  // .mp-att-on — recognised by its td's inline #aa0000), the date-filter table
  // (.mp-att-filter) and the "[ View: … ]" switch td (.mp-att-views). Also joins
  // each <br>-stacked venue address into one wrappable line — CSS can only hide
  // <br>s, which would glue "…Building,Salford" together without the space — so
  // the row cards stay shallow and never overflow sideways. Idempotent.
  function decorateAttendance() {
    if (!MP_ATTEND) return;
    document.documentElement.classList.add('mp-attend');
    const cb = document.getElementById('content-body');
    if (!cb) return;
    const head = cb.querySelector(':scope > table:not(#EventResults)');
    if (head) {
      head.classList.add('mp-att-head');
      head.querySelectorAll('a').forEach(a => {
        const t = a.textContent.trim();
        if (t !== 'Absence Forms' && t !== 'Attendance History') return;
        a.classList.add('mp-att-tab');
        const td = a.closest('td');
        a.classList.toggle('mp-att-on', !!td && /aa0000/i.test(td.getAttribute('style') || ''));
      });
      const filt = [...head.querySelectorAll('table')].find(t =>
        t.querySelector('img[src*="datePickArrow"]'));
      if (filt) filt.classList.add('mp-att-filter');
      head.querySelectorAll('td').forEach(td => {
        if (!td.querySelector('td') && /^\[\s*View:/.test(td.textContent.trim())) {
          td.classList.add('mp-att-views');
        }
      });
    }
    cb.querySelectorAll('#EventResults td, .eventsDetail table td').forEach(td => {
      if (td.dataset.mpJoin) return;
      const brs = td.querySelectorAll('br');
      if (brs.length < 2) return;       // only the address stacks — leave lone <br>s alone
      td.dataset.mpJoin = '1';
      brs.forEach(br => br.replaceWith(' '));
    });
  }

  // ── D2: tag month day-of-month numerals (classless black <div>) ─────────────
  // The site renders each day number as a CLASSLESS leaf <div> ("Mar 1st","2",…)
  // under the calendar holder. Event roots carry classes and chip text lives in
  // <a>/<nobr>/<b>, so a classless-leaf + day-number filter isolates the numerals.
  // Idempotent (dataset flag), guarded, safe to re-run every decorate().
  function tagDayNumbers() {
    const holder = document.getElementById('cal_holder') ||
                   document.getElementById('calholder');
    if (!holder) return;
    // "2", "22", "1st", "Mar 1st", "Sept. 3rd" — optional month word, then a day.
    const dayRe = /^(?:[A-Z][a-z]{2,}\.?\s+)?\d{1,2}(?:st|nd|rd|th)?$/;
    holder.querySelectorAll('div').forEach(d => {
      if (d.dataset.mpDaynum) return;           // idempotent
      if (d.classList.length) return;           // classless only → skips chips/headers/banner
      if (d.children.length) return;            // leaf text node only → skips containers
      if (d.closest('.aj-week-event')) return;  // never a chip descendant
      if (d.closest('.aj-tt-dayHeader')) return;// never the weekday/date header
      const t = d.textContent.trim();
      if (!t || !dayRe.test(t)) return;
      d.dataset.mpDaynum = '1';
      d.classList.add('mp-daynum');
    });
  }

  // ── D5: tag the breadcrumb <ul> so CSS can recolour "Home" without hitting
  // event, nav, or footer links. Idempotent (early-return once tagged) + guarded.
  function decorateCrumb() {
    if (document.querySelector('ul.mp-crumb')) return;   // already tagged — idempotent
    const home = [...document.querySelectorAll('ul a')].find(a =>
      a.textContent.trim() === 'Home' &&
      !a.closest('.navbar') && !a.closest('#calholder') && !a.closest('.aj-week-event') &&
      !a.closest('footer') && !a.closest('.mp-footer'));
    const ul = home && home.closest('ul');
    if (ul) ul.classList.add('mp-crumb');
  }

  // ── Footer console dock ─────────────────────────────────────────────────
  // hand-drawn inline-SVG brand glyphs (fill/stroke = currentColor → chip drives colour)
  const MP_FOOT_SVG = {
    facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5h1.65V3.6c-.8-.1-1.6-.15-2.4-.15-2.4 0-4.05 1.47-4.05 4.16v2.29H7.5V13h2.75v8h3.25z"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.2 3h2.9l-6.34 7.25L21.5 21h-5.9l-4.6-6.02L5.72 21H2.8l6.78-7.75L2.5 3h6.05l4.16 5.5L17.2 3zm-1.02 16.24h1.6L8.9 4.68H7.18l9 14.56z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M22.5 8.4a3 3 0 0 0-2.1-2.12C18.6 5.8 12 5.8 12 5.8s-6.6 0-8.4.48A3 3 0 0 0 1.5 8.4 31 31 0 0 0 1.02 12a31 31 0 0 0 .48 3.6 3 3 0 0 0 2.1 2.12C5.4 18.2 12 18.2 12 18.2s6.6 0 8.4-.48a3 3 0 0 0 2.1-2.12A31 31 0 0 0 22.98 12a31 31 0 0 0-.48-3.6zM9.8 15.3V8.7l5.7 3.3-5.7 3.3z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><rect x="3.3" y="3.3" width="17.4" height="17.4" rx="5" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3.9" stroke="currentColor" stroke-width="1.8"/><circle cx="17.2" cy="6.8" r="1.15" fill="currentColor"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.5 3c.32 2.1 1.5 3.55 3.5 3.86v2.9c-1.3.1-2.48-.28-3.5-.98v6.06c0 3.42-2.6 5.66-5.6 5.66A5.18 5.18 0 0 1 5.7 15.3c0-3.02 2.63-5.4 5.9-4.86v3.02c-.42-.16-.9-.2-1.36-.1-1.08.22-1.86 1.12-1.82 2.26a2.08 2.08 0 0 0 2.14 2.02c1.2 0 2.16-.94 2.16-2.2V3h3.08z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.1 8.6H3V21h3.1zM4.55 3.5A1.8 1.8 0 1 0 4.53 7.1 1.8 1.8 0 0 0 4.55 3.5zM21 21v-6.8c0-3.4-1.82-4.98-4.24-4.98-1.95 0-2.82 1.07-3.3 1.83V8.6H10.4V21h3.06v-6.5c0-.34.02-.68.12-.92.28-.68.9-1.38 1.95-1.38 1.37 0 1.92 1.04 1.92 2.58V21z"/></svg>'
  };
  const MP_FOOT_MATCH = [
    { re: /facebook\.com/i,            key: 'facebook'  },
    { re: /(twitter\.com|x\.com)/i,    key: 'x'         },
    { re: /(youtube\.com|youtu\.be)/i, key: 'youtube'   },
    { re: /instagram\.com/i,           key: 'instagram' },
    { re: /tiktok\.com/i,              key: 'tiktok'    },
    { re: /linkedin\.com/i,            key: 'linkedin'  }
  ];

  // Minimal, uniform footer everywhere (user: keep it simple + consistent across
  // pages). A refined brand lockup on the left, a mono copyright on the right.
  const MP_FOOT_INNER =
    '<div class="mp-foot-seam"></div>' +
    '<div class="mp-foot-brand">' +
      '<span class="mp-foot-mark">&#9670;</span>' +
      '<span class="mp-foot-word">MEDLEA<b>+</b></span>' +
      '<span class="mp-foot-sub">1Med &middot; Timetable Console</span>' +
    '</div>' +
    '<div class="mp-foot-mini">&copy; The University of Manchester &middot; 1Med</div>';

  function decorateFooter() {
    // medlea pages ship a real footer.footerContainer (with Contacts/Find-us/Connect
    // columns + legal) → collapse it to the minimal bar; CSS hides the site content.
    const footer = document.querySelector('footer.footerContainer');
    if (footer) {
      if (footer.dataset.mpFooter) return;
      footer.dataset.mpFooter = '1';
      footer.classList.add('mp-footer', 'mp-footer-min');
      footer.insertAdjacentHTML('afterbegin', MP_FOOT_INNER);
      return;
    }
    // 1Med home ships a plain <footer> (just a "Contact us…" link, not a .footerContainer)
    // → dock it the same way so the footer matches the timetable; the mp-footer-min
    // `:not(.mp-foot-*)` rule hides the original link, leaving only the MEDLEA+ dock.
    if (document.documentElement.classList.contains('mp-1med')) {
      const f1 = document.querySelector('footer');
      if (f1 && !f1.dataset.mpFooter) {
        f1.dataset.mpFooter = '1';
        f1.classList.add('mp-footer', 'mp-footer-min');
        f1.insertAdjacentHTML('afterbegin', MP_FOOT_INNER);
      }
      return;
    }
    // the onemed profile has NO page footer → build the same minimal one so every
    // reachable page ends consistently (matches the timetable).
    if (document.getElementById('main-wrapper') && !document.getElementById('mp-built-footer')) {
      const f = document.createElement('footer');
      f.id = 'mp-built-footer';
      f.className = 'mp-footer mp-footer-min';
      f.innerHTML = MP_FOOT_INNER;
      document.body.appendChild(f);
    }
  }

  // ── Cursor interaction ─────────────────────────────────────────────────────
  const root = document.documentElement;
  let hotCard = null, pending = null, raf = 0;

  // The SITE has its own hover-expand on clipped panes: on mouseover it rewrites the pane's
  // INLINE style (height → fit-content, z-index → 5) and never puts it back, so a card the
  // cursor merely passed over stayed enlarged over the following hour for the rest of the
  // render. (While the groups-tooltip rule keyed on that inline `z-index: 5;`, it also went
  // invisible — the flicker.) Restore the slot geometry we captured in --h when a pane goes
  // cold; the skin's own expand is the CSS :hover rule, which needs no inline height.
  function cool(el) {
    el.classList.remove('mp-hot');
    const h = el.style.getPropertyValue('--h');
    if (h && el.style.height !== h) el.style.height = h;
    if (el.style.zIndex) el.style.zIndex = '';
  }

  function apply() {
    raf = 0;
    const e = pending; if (!e) return;

    // console spotlight follows the pointer
    root.style.setProperty('--mx', e.clientX + 'px');
    root.style.setProperty('--my', e.clientY + 'px');

    // event pane: holographic sheen tracks the cursor. NO tilt and NO magnetic
    // pill movement — the elements never physically move (motion-sickness fix);
    // hover feedback is glow + border + expand only.
    const card = e.target.closest ? e.target.closest('.aj-week-event') : null;
    if (hotCard && hotCard !== card) { cool(hotCard); hotCard = null; }
    if (card) {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--lx', (((e.clientX - r.left) / r.width) * 100).toFixed(1) + '%');
      card.style.setProperty('--ly', (((e.clientY - r.top) / r.height) * 100).toFixed(1) + '%');
      card.classList.add('mp-hot');
      hotCard = card;
    }
  }

  document.addEventListener('mousemove', e => {
    pending = e;
    if (!raf) raf = requestAnimationFrame(apply);
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    if (hotCard) { cool(hotCard); hotCard = null; }
  });

  // Whole event card clickable. The site only hyperlinks the title text (~66×15) that
  // sits in a much taller card (.openEvent, e.g. a 3-hour slot ~177px), so clicks on the
  // empty lower area did nothing. Delegate once: a click inside an .openEvent card that
  // didn't land on a real control fires the card's own title link — inheriting its href
  // and any site handler. Bound at document level so it survives the calendar's in-place
  // re-renders (no per-card rebind needed). The guard skips genuine controls so nested
  // links/buttons still work; re-entrancy is safe (the synthesized click's target is the
  // <a>, which the guard then ignores).
  document.addEventListener('click', e => {
    if (!e.target.closest || e.target.closest('a,button,input,select,textarea,label')) return;
    const card = e.target.closest('.openEvent');
    if (!card) return;
    const a = card.querySelector('a[href]');
    if (a) a.click();
  });

  decorate();

  // The calendar re-renders in place on week/view changes. Observe #content-body
  // (which CONTAINS the grid #cal_holder); #calholder is a thin SIBLING of the grid,
  // so watching it never fired → decorate() never re-ran on in-page view switches.
  let t;
  new MutationObserver(() => {
    // extendDayStart() runs SYNCHRONOUSLY here rather than on the 150ms debounce.
    // The calendar delivers the entire grid — hour labels, day dividers and every
    // event — in ONE mutation batch (measured), and this callback is a microtask that
    // runs BEFORE the browser paints it. Left to decorate(), the 8am-origin grid was
    // painted first and every card visibly dropped 120px about a second later: motion,
    // which this skin must never produce. Measured grid→shift latency 1163ms → 0.6ms.
    // It is guarded and idempotent, so the extra calls cost nothing; try/catch because
    // an exception here would kill the observer and with it every later re-decoration.
    try { extendDayStart(); } catch (e) {}
    clearTimeout(t); t = setTimeout(decorate, 150);
  }).observe(document.getElementById('content-body') || document.body, { childList: true, subtree: true });

  // keep the "now" line current — redraw every minute + on window resize
  setInterval(drawNowLine, 60000);
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(drawNowLine, 120); });
})();
