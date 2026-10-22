/* Spin / zoom / flip. Zoom changes layout size, never transform scale,
   so the text is re-rendered at every step instead of being stretched. */
(function(){
  const root  = document.documentElement;
  const stage = document.getElementById('stage');
  const sheet = document.getElementById('sheet');
  const shade = document.getElementById('shade');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* one sheet per language in the DOM; only the current one is shown and measured.
     ?lang=fr in the URL wins over the last choice. */
  const LANGS = (root.dataset.langs || 'en').split(' ');
  const saved = (() => { try { return localStorage.getItem('cv.lang'); } catch { return null; } })();
  const asked = new URLSearchParams(location.search).get('lang');
  let lang = [asked, saved].find(l => LANGS.includes(l)) || LANGS[0];
  function showLang(l){
    lang = root.dataset.lang = root.lang = l;
    sheet.querySelectorAll('.face').forEach(f => { f.hidden = f.dataset.lang !== l; });
  }
  showLang(lang);

  const st = { rx:-7, ry:-4, zoom:1, flip:0, vx:0, vy:0, px:0, py:0, drag:false };
  let base = 1, touched = false;
  const clamp = (v,a,b) => Math.min(b, Math.max(a, v));

  /* how big the sheet is when "laid flat": fills the stage, never the bar */
  /* sheet size at k = 1 comes from CSS (--sw, --sh): A4 on desktop, long and narrow on phones */
  let SW = 720, SH = 1018;
  function measure(){
    const cs = getComputedStyle(root);
    SW = parseFloat(cs.getPropertyValue('--sw')) || 720;
    SH = parseFloat(cs.getPropertyValue('--sh')) || 1018;
    const w = stage.clientWidth, h = stage.clientHeight;
    const fill = parseFloat(cs.getPropertyValue('--fill')) || 0.9;   /* share of the width the sheet may take */
    const fitW = cs.getPropertyValue('--fitw').trim() === '1';       /* phones: fit the width, scroll the length */
    base = Math.max(0.2, fitW ? w * fill / SW : Math.min(w * fill / SW, h * 0.94 / SH));
  }

  /* Pan bounds are measured, not predicted: the sheet is tilted inside a
     perspective, so its projected box is not SW x SH * k. Measure where it
     actually landed, then pull it back only if an edge came off the stage. */
  const EDGE = 40;                       /* paper may pass the stage edge by this much */

  function applyTransform(){
    const ry = st.ry + st.flip;
    sheet.style.transform =
      `translate3d(${st.px}px, ${st.py}px, 0) rotateX(${st.rx}deg) rotateY(${ry}deg)`;
  }

  function correctPan(){
    const s = stage.getBoundingClientRect(), r = sheet.getBoundingClientRect();
    /* centre from the measured box, extent from layout size: rotation moves the
       projection but never the centre, so this stays stable mid-flip */
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hw = sheet.offsetWidth / 2, hh = sheet.offsetHeight / 2;
    let dx = 0, dy = 0;

    if (hw * 2 <= s.width)        dx = (s.left + s.width / 2) - cx;          /* fits: centre it */
    else if (cx - hw > s.left + EDGE)   dx = s.left + EDGE - (cx - hw);      /* gap on the left */
    else if (cx + hw < s.right - EDGE)  dx = s.right - EDGE - (cx + hw);     /* gap on the right */

    if (hh * 2 <= s.height)       dy = (s.top + s.height / 2) - cy;
    else if (cy - hh > s.top + EDGE)    dy = s.top + EDGE - (cy - hh);
    else if (cy + hh < s.bottom - EDGE) dy = s.bottom - EDGE - (cy + hh);

    if (dx || dy) { st.px += dx; st.py += dy; applyTransform(); }
  }

  let watchTurn = null;                  /* set by the counters below */
  function render(){
    const k = base * st.zoom, ry = st.ry + st.flip;
    if (watchTurn) watchTurn(ry);
    root.style.setProperty('--k', k);
    stage.classList.toggle('panning', st.zoom > 1.02);
    applyTransform();
    correctPan();
    const facing = Math.abs(Math.cos(ry * Math.PI / 180));
    shade.style.transform =
      `translate(${st.px}px, ${st.py + SH * 0.295 * k}px) scaleX(${(0.25+0.75*facing)*k*SW/720}) scaleY(${k})`;
    shade.style.opacity = 0.22 + 0.33 * facing;
  }

  /* shrink the type until the page fits inside its margins.
     .measuring turns on overflow:hidden just for the measurement — the rest of
     the time the box must stay unclipped or it cuts the tooltips off. */
  function fitText(){
    sheet.querySelectorAll('.face:not([hidden])').forEach(face => {
      const body = face.querySelector('.body');
      let size = 16;
      face.classList.add('measuring');
      face.style.setProperty('--fs', size + 'px');
      while (body.scrollHeight > body.clientHeight && size > 8.5) {
        size -= 0.25;
        face.style.setProperty('--fs', size + 'px');
      }
      face.classList.remove('measuring');
    });
  }

  function relayout(){ measure(); render(); fitText(); }
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(relayout);
  relayout();

  let rt;
  const requeue = () => { clearTimeout(rt); rt = setTimeout(relayout, 120); };
  addEventListener('resize', requeue);
  addEventListener('orientationchange', () => setTimeout(relayout, 250));
  /* iOS fires this, not resize, when the browser toolbar collapses or expands */
  const vv = window.visualViewport;
  if (vv) vv.addEventListener('resize', requeue);
  /* iOS doesn't shrink the page for the on-screen keyboard, it slides it up under it.
     The body is fixed (CSS) and sized to the visible part instead, so the bar sits on
     the keyboard and the stage is only what you can see. */
  if (vv) {
    const pin = () => {
      if (vv.scale > 1.01) return;                   /* page pinch-zoomed: leave it */
      document.body.style.height = vv.height + 'px';
      document.body.style.top = vv.offsetTop + 'px';
    };
    vv.addEventListener('resize', pin); vv.addEventListener('scroll', pin); pin();
  }

  if (!reduce) {
    /* a long sheet (phones) never tips forward: tilted, its top would leave the screen */
    const tall = sheet.offsetHeight > stage.clientHeight;
    const from = { rx:tall ? 0 : 16, ry:-42 }, t0 = performance.now(), rx1 = tall ? 0 : -7;
    (function intro(now){
      if (touched) return;
      const e = 1 - Math.pow(1 - Math.min(1,(now-t0)/900), 3);
      st.rx = from.rx + (rx1-from.rx)*e;
      st.ry = from.ry + (-4-from.ry)*e;
      render();
      if (e < 1) requestAnimationFrame(intro);
    })(t0);
  }

  /* ---- drag, pinch ---- */
  const pts = new Map();
  let last = null, pinch0 = 0, zoom0 = 1, downX = 0, downY = 0, moved = 0, captured = false, lock = 'x';
  const dist = () => { const [a,b] = [...pts.values()];
    return Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY) || 1; };

  stage.addEventListener('pointerdown', e => {
    downX = e.clientX; downY = e.clientY; moved = 0;
    pts.set(e.pointerId, e);
    faceAnim = null;                                 /* grabbing the sheet stops a camera move */
    if (pts.size === 1) { st.drag = true; last = e; st.vx = st.vy = 0; stage.classList.add('dragging'); }
    if (pts.size === 2) { pinch0 = dist(); zoom0 = st.zoom; }
    touched = true;
  });

  stage.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, e);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      setZoom(zoom0 * dist() / pinch0, (a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
      return;
    }
    if (!st.drag || !last) return;
    moved = Math.hypot(e.clientX - downX, e.clientY - downY);
    if (moved > 5 && !captured) {
      stage.setPointerCapture(e.pointerId); captured = true;
      lock = Math.abs(e.clientY - downY) > Math.abs(e.clientX - downX) ? 'y' : 'x';   /* one axis per gesture */
    }
    if (!captured) return;
    const dx = e.clientX - last.clientX, dy = e.clientY - last.clientY;
    const tall = sheet.offsetHeight > stage.clientHeight + 1;   /* phones: the sheet is longer than the screen */
    if ((st.zoom > 1.02 || (tall && lock === 'y')) && !e.shiftKey) {   // reading: pan (up/down scrolls a long sheet)
      st.px += dx; st.py += dy;
      st.vx = st.vy = 0;
    } else {                                     // fitted, or Shift held: turn the page
      st.vx = dx * 0.32; st.vy = tall ? 0 : dy * 0.22;   /* long sheet: sideways only turns it, never tips it */
      st.ry += st.vx; st.rx = clamp(st.rx - st.vy, -72, 72);
    }
    last = e; render();
  });

  function up(e){
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch0 = 0;
    if (pts.size === 0) { st.drag = false; last = null; captured = false; stage.classList.remove('dragging'); glide(); }
  }
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);

  let gliding = false;
  function glide(){
    if (gliding) return; gliding = true;
    (function step(){
      if (st.drag) { gliding = false; return; }
      st.vx *= 0.94; st.vy *= 0.94;
      st.ry += st.vx; st.rx = clamp(st.rx - st.vy, -72, 72); render();
      if (Math.abs(st.vx) > 0.02 || Math.abs(st.vy) > 0.02) requestAnimationFrame(step);
      else gliding = false;
    })();
  }

  /* zoom is a layout change, so coalesce it to one per frame.
     anchor: keep whatever is under (cx, cy) roughly under it after the zoom */
  let pending = null;
  function setZoom(z, cx, cy){
    const prev = st.zoom;
    st.zoom = clamp(z, 1, 3.2);                /* 1 = fitted; never smaller */
    const f = st.zoom / prev;
    if (cx !== undefined && f !== 1) {
      const r = stage.getBoundingClientRect();
      const ox = cx - (r.left + r.width / 2);
      const oy = cy - (r.top + r.height / 2);
      st.px = ox - (ox - st.px) * f;
      st.py = oy - (oy - st.py) * f;
    }
    if (st.zoom === 1) { st.px = st.py = 0; }  /* back to fit: recentre */
    if (pending) return;
    pending = requestAnimationFrame(() => { pending = null; render(); });
  }
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    setZoom(st.zoom * (e.deltaY > 0 ? 0.9 : 1.11), e.clientX, e.clientY);
  }, { passive:false });

  /* ---- status line: tooltips, counters, uptime ---- */
  const msg = document.getElementById('msg'), stats = document.getElementById('stats');
  /* idle hints rotate in the status line (they used to float over the paper) */
  /* the default line says it's a command line; every other tick shows another tip.
     [f][f] (dyno) is deliberately not advertised: it's an easter egg. */
  const CMD_HINT = {
    en: 'this is a command line · press : then type help, ls, cd skills, grep…',
    fr: 'ceci est une ligne de commande · appuyez sur : puis tapez help, ls, cd skills, grep…',
  };
  const IDLES = {
    en: [
      'drag to turn · scroll or pinch to zoom · [f] flip',
      'hover a dotted word or a number for details',
      '[/] searches the sheet, like in man',
      '[c] to write to me · ↓ to download the CV',
    ],
    fr: [
      'glisser pour tourner · molette ou pincer pour zoomer · [f] retourner',
      'survolez un mot pointillé ou un chiffre pour le détail',
      '[/] cherche dans la feuille, comme dans man',
      "[c] pour m'écrire · ↓ pour télécharger le CV",
    ],
  };
  let idleAt = 0, idling = true;
  const idle = () => {
    const l = IDLES[lang] || IDLES.en;
    say(idleAt % 2 ? l[(idleAt >> 1) % l.length] : CMD_HINT[lang] || CMD_HINT.en);
    idling = true;
  };
  const store = {
    get(k){ try { return +localStorage.getItem(k) || 0; } catch { return 0; } },
    bump(k){ const v = this.get(k) + 1; try { localStorage.setItem(k, v); } catch {} return v; },
  };
  let flips = store.get('cv.flips'), dynos = store.get('cv.dynos');

  /* Counted from the sheet itself, however it turned (key, drag, search, cat…):
     every time the other face comes round is a flip. A dyno is two flips inside
     0.7 s ([f][f], or the flip button twice), or a hard fling by hand: 600° inside
     one second, which an ordinary drag never reaches. */
  const DYNO_SPIN = 600;
  let shown = null, spins = [], dynoing = false, lastDyno = 0;
  function countDyno(){
    lastDyno = performance.now(); spins = [];
    dynos = store.bump('cv.dynos'); showStats();
    climb();
  }
  watchTurn = T => {
    const now = performance.now(), c = Math.cos(T * Math.PI / 180);
    if (shown === null) shown = c >= 0;
    else if (Math.abs(c) > 0.2 && (c > 0) !== shown) {      /* 0.2: no double count at the edge */
      shown = c > 0;
      flips = store.bump('cv.flips'); showStats();
    }
    spins.push([now, T]);
    while (now - spins[0][0] > 1000) spins.shift();
    if (!dynoing && now - lastDyno > 1500 && Math.abs(T - spins[0][1]) >= DYNO_SPIN) countDyno();
  };

  /* uptime from data-since="YYYY-MM" (and data-until, once the job ends) */
  function uptime(){
    const since = stats.dataset.since;
    if (!since) return '';
    const [y0, m0] = since.split('-').map(Number);
    const end = stats.dataset.until ? stats.dataset.until.split('-').map(Number) : null;
    const now = new Date(), y1 = end ? end[0] : now.getFullYear(), m1 = end ? end[1] : now.getMonth() + 1;
    const months = Math.max(0, (y1 - y0) * 12 + (m1 - m0));
    const t = (months >= 12 ? Math.floor(months / 12) + 'y ' : '') + (months % 12) + 'm';
    return ` · up <b>${t}</b>${stats.dataset.label ? ' @ ' + stats.dataset.label : ''}`;
  }
  function showStats(){
    stats.innerHTML = `flips <b>${flips}</b>` + (dynos ? ` · dynos <b>${dynos}</b>` : '') + uptime();
  }
  /* a tip that holds an ASCII chart is typed out, so the bars grow */
  const BARS = /[█▁▂▃▄▅▆▇]/;
  let sayId = 0, said = null;
  function say(text, cls){
    idling = false;
    msg.className = cls || '';
    if (text === said) return;                       /* same tip re-hovered: don't restart */
    said = text;
    const id = ++sayId;
    if (reduce || !BARS.test(text)) { msg.textContent = text; return; }
    let n = 0;
    (function type(){
      if (id !== sayId) return;                      /* something newer took the line */
      msg.textContent = text.slice(0, ++n);
      if (n < text.length) setTimeout(type, BARS.test(text[n - 1]) ? 40 : 10);
    })();
  }

  idle(); showStats();
  setInterval(() => { if (idling) { idleAt++; idle(); } }, 4500);
  setInterval(showStats, 60000);

  const tipOf = t => t && t.closest && t.closest('[data-tip]');
  const tipText = t => (lang === 'fr' && t.dataset.tipFr) || t.dataset.tip;
  document.addEventListener('pointerover', e => { const t = tipOf(e.target); if (t) say(tipText(t)); });
  document.addEventListener('pointerout',  e => { const t = tipOf(e.target); if (t && !t.classList.contains('tip-on')) idle(); });
  document.addEventListener('focusin',     e => { const t = tipOf(e.target); if (t) say(tipText(t)); });

  /* ---- flip, and the dyno: a second flip within 700 ms becomes one 720° spin ---- */
  let anim = null, lastFlip = 0;
  function animateTo(to, dur){
    const from = st.flip, t0 = performance.now(), id = {};
    anim = id; faceAnim = null;                      /* a flip overrides a camera move */
    if (reduce) { st.flip = to; render(); return; }
    (function step(now){
      if (anim !== id) return;                       /* a newer flip took over */
      const k = Math.min(1, (now - t0) / dur);
      st.flip = from + (to - from) * (1 - Math.pow(1 - k, 3)); render();
      if (k < 1) requestAnimationFrame(step); else anim = null;
    })(t0);
  }
  /* Easter egg: the dyno. An ASCII climber goes up a wall as tall as the stage,
     jumping hold to hold, zig-zag, and tops out. Drawn in #climber, an overlay,
     so the layout never moves. */
  const climber = document.getElementById('climber');
  /* Poses, by the side of the hold the hand is on (or reaching for): L = screen left.
     One arm only goes to the hold; the leg on the other side kicks out to balance. */
  const FIG = {
    hangL:   ['\\o ', ' |\\', '/ \\'],     /* hand on a left hold, other arm hangs */
    hangR:   [' o/', '/| ', '/ \\'],
    crouchL: ['\\o ', ' |\\', '/ >'],      /* jumping right: left leg straight, right leg bent */
    crouchR: [' o/', '/| ', '< \\'],       /* jumping left: right leg straight, left leg bent */
    flyL:    ['\\o ', ' | ', ' |\\'],      /* reaching left, right leg kicked out */
    flyR:    [' o/', ' | ', '/| '],
    cheerL:  ['\\o/', ' | ', '/ \\'],      /* top hold on the left, right arm waves… */
    cheerL2: ['\\o_', ' | ', '/ \\'],
    cheerR:  ['\\o/', ' | ', '/ \\'],      /* …or on the right, left arm waves */
    cheerR2: ['_o/', ' | ', '/ \\'],
  };
  const WALL = 17;                                       /* wall width in characters */
  function wallFrame(rows, holds, fig, r, c, flag){
    const g = Array.from({ length: rows }, () => Array(WALL).fill(' '));
    for (const [hr, hc] of holds) if (hr >= 0 && hr < rows) g[hr][hc] = '●';
    FIG[fig].forEach((line, i) => [...line].forEach((ch, j) => {
      const y = r + i, x = c + j;
      if (ch !== ' ' && y >= 0 && y < rows && x >= 0 && x < WALL) g[y][x] = ch;
    }));
    if (flag) [...'TOP!'].forEach((ch, j) => { g[0][flag + j] = ch; });
    return g.map(l => '│' + l.join('') + '│').join('\n');
  }
  let climbId = 0;
  function climb(){
    const id = ++climbId;
    const lh = parseFloat(getComputedStyle(climber).fontSize) * 1.15;
    const rows = Math.max(12, Math.floor((stage.clientHeight - 40) / lh));
    const holds = [];
    const HOLDS = 8, gap = (rows - 6) / (HOLDS - 1);   /* always 8 holds, spread over the full height */
    for (let i = 0; i < HOLDS; i++) holds.push([Math.round(rows - 4 - i * gap), i % 2 ? WALL - 3 : 2]);
    /* where the figure sits so its hand is right under hold i */
    const side = ([, c]) => (c < WALL / 2 ? 'L' : 'R');
    const at = h => [h[0] + 1, side(h) === 'L' ? h[1] : h[1] - 2];
    const frames = [];                                    /* [fig, row, col, ms] */
    holds.forEach((h, i) => {
      const [r, c] = at(h), s = side(h), next = holds[i + 1];
      frames.push(['hang' + s, r, c, 110]);
      if (!next) return;
      frames.push(['crouch' + s, r, c, 60]);
      const [r2, c2] = at(next);
      for (let k = 1; k <= 3; k++)
        frames.push(['fly' + side(next), Math.round(r + (r2 - r) * k / 4), Math.round(c + (c2 - c) * k / 4), 40]);
    });
    /* top: one hand on the last hold, the other waves */
    const last = holds[holds.length - 1], [lr, lc] = at(last), ls = side(last);
    const flagAt = ls === 'L' ? WALL - 5 : 1;            /* TOP! on the other side of the wall */
    for (let k = 0; k < 6; k++) frames.push([k % 2 ? 'cheer' + ls + '2' : 'cheer' + ls, lr, lc, 170, flagAt]);
    climber.classList.add('on');
    let i = 0, hold = 0;
    (function next(){
      if (id !== climbId) return;
      if (i < frames.length) {
        const [fig, r, c, ms, flag] = frames[i++];
        if (fig.startsWith('hang')) say(`dyno… hold ${++hold}/${holds.length}`, 'dyno');
        if (fig.startsWith('cheer') && !said.startsWith('dyno!')) say('dyno! topped out.', 'dyno');
        climber.textContent = wallFrame(rows, holds, fig, r, c, flag);
        setTimeout(next, ms);
      } else {
        setTimeout(() => { if (id === climbId) { climber.classList.remove('on'); idle(); } }, 900);
      }
    })();
  }
  let base0 = 0;                                     /* where the current flip started */
  function flip(){
    const now = performance.now();
    if (now - lastFlip < 700 && anim) {              /* dyno! counted here, not by the spin watcher */
      lastFlip = 0;
      dynoing = true;
      setTimeout(() => { dynoing = false; spins = []; }, 1250);
      animateTo(base0 + 720, 1150);
      countDyno();
    } else {
      lastFlip = now;
      base0 = Math.round(st.flip / 180) * 180;
      animateTo(base0 + 180, 620);
    }
  }

  /* face on: square to the viewer, on a given face (or the nearest one) and zoom.
     lay flat = face on, zoomed back out to fit. */
  let faceAnim = null;
  function faceOn({ back, zoom = 1, pan = { px:0, py:0 }, done } = {}){
    anim = null;                                     /* stop a flip in progress */
    const T = st.ry + st.flip, off = back ? 180 : 0;
    const target = back === undefined ? Math.round(T / 180) * 180 : off + Math.round((T - off) / 360) * 360;
    const f = { rx:st.rx, ry:st.ry, z:st.zoom, px:st.px, py:st.py }, ry1 = target - st.flip;
    st.vx = st.vy = 0;
    if (reduce) { st.rx = 0; st.ry = ry1; st.zoom = zoom; st.px = pan.px; st.py = pan.py; render(); if (done) done(); return; }
    const id = faceAnim = {}, t0 = performance.now();
    (function step(now){
      if (faceAnim !== id) return;
      const k = Math.min(1, (now - t0) / 480), e = 1 - Math.pow(1 - k, 3);
      st.rx = f.rx * (1 - e);
      st.ry = f.ry + (ry1 - f.ry) * e;
      st.zoom = f.z + (zoom - f.z) * e;
      st.px = f.px + (pan.px - f.px) * e;
      st.py = f.py + (pan.py - f.py) * e;
      render();
      if (k < 1) requestAnimationFrame(step); else if (done) done();
    })(t0);
  }
  const layFlat = () => { goHome(); faceOn(); };   /* goHome: further down, with the prompt */

  const TOP = 16;                                     /* a tall block's top lands this far under the stage top */
  /* slide the sheet so el sits in the middle of the stage (correctPan keeps it in bounds) */
  function centreOn(el){
    const s = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
    const dx = s.left + s.width / 2 - (r.left + r.width / 2);
    const dy = r.height > s.height * 0.9 ? s.top + TOP - r.top : s.top + s.height / 2 - (r.top + r.height / 2);
    const p0 = { x:st.px, y:st.py }, t0 = performance.now(), id = faceAnim = {};
    if (reduce) { st.px += dx; st.py += dy; render(); return; }
    (function step(now){
      if (faceAnim !== id) return;
      const k = Math.min(1, (now - t0) / 320), e = 1 - Math.pow(1 - k, 3);
      st.px = p0.x + dx * e; st.py = p0.y + dy * e; render();
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  /* where the sheet must be panned for el to sit mid-stage once it is face on at
     `zoom`: from layout offsets, which scale linearly with zoom and ignore rotation.
     With no pan, a sheet smaller than the stage sits centred; a bigger one starts
     at the stage's top / left edge (the grid track grows to fit it). */
  function panFor(el, zoom){
    const face = el.closest('.face');
    let x = el.offsetWidth / 2, y = el.offsetHeight / 2, n = el;
    while (n && n !== face) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    const f = zoom / st.zoom, W = stage.clientWidth, H = stage.clientHeight;
    const w = SW * base * zoom, h = SH * base * zoom;
    const left0 = Math.max(0, (W - w) / 2), top0 = Math.max(0, (H - h) / 2);
    const tall = el.offsetHeight * f > H * 0.9;      /* taller than the stage: show its top, not its middle */
    return { px: W / 2 - left0 - x * f, py: tall ? TOP - top0 - (y - el.offsetHeight / 2) * f : H / 2 - top0 - y * f };
  }
  function focusEl(el, zoom){
    requestAnimationFrame(() => focusNow(el, zoom));   /* after the command's output has resized the status line */
  }
  function focusNow(el, zoom){
    const back = !!el.closest('.back');
    /* already square on that face at that zoom (n / N between matches): just slide
       there. Going through faceOn would pan back to the middle first. */
    const off = ((st.ry + st.flip - (back ? 180 : 0)) % 360 + 540) % 360 - 180;
    if (Math.abs(off) < 0.5 && Math.abs(st.rx) < 0.5 && Math.abs(st.zoom - zoom) < 0.05 * zoom) { centreOn(el); return; }
    /* turning: pan toward the target during the turn, then a final small correction */
    faceOn({ back, zoom, pan: panFor(el, zoom), done: () => centreOn(el) });
  }

  /* zoom until a whole section fills the stage, then flash its box */
  function showSection(sec){                         /* any block: section, entry, grid row */
    const h1 = sec.offsetHeight / st.zoom, w1 = sec.offsetWidth / st.zoom;
    focusEl(sec, clamp(Math.min(0.9 * stage.clientHeight / h1, 0.95 * stage.clientWidth / w1), 1, 2.4));
    sheet.querySelectorAll('.flash').forEach(n => n.classList.remove('flash')); void sec.offsetWidth; sec.classList.add('flash');
  }

  /* ---- language ---- */
  const langBtn = document.getElementById('lang');
  const otherLang = () => LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length];
  function setLang(l){
    if (!LANGS.includes(l)) return false;
    clearHits();
    showLang(l);
    try { localStorage.setItem('cv.lang', l); } catch {}
    if (langBtn) langBtn.querySelector('span').textContent = otherLang().toUpperCase();
    fitText(); render();
    idleAt = 0; idle();
    return true;
  }
  if (langBtn) { langBtn.querySelector('span').textContent = otherLang().toUpperCase(); langBtn.onclick = () => setLang(otherLang()); }

  /* ---- search: / like in man and less; n and N step through the matches ---- */
  let hits = [], hitAt = -1;
  const bar = document.getElementById('bar');
  function clearHits(){
    bar.classList.remove('searching');
    for (const m of sheet.querySelectorAll('mark.hit')) {
      const parent = m.parentNode;
      parent.replaceChild(document.createTextNode(m.textContent), m);
      parent.normalize();
    }
    hits = []; hitAt = -1;
  }
  function find(q){
    clearHits();
    q = q.trim();
    if (q.length < 2) return 0;
    const ql = q.toLowerCase();
    for (const face of sheet.querySelectorAll('.face:not([hidden]) .body')) {
      const walk = document.createTreeWalker(face, NodeFilter.SHOW_TEXT), nodes = [];
      while (walk.nextNode()) nodes.push(walk.currentNode);
      for (let node of nodes) {
        let i;
        while ((i = node.data.toLowerCase().indexOf(ql)) !== -1) {
          const hit = node.splitText(i);
          node = hit.splitText(q.length);
          const m = document.createElement('mark');
          m.className = 'hit';
          hit.parentNode.replaceChild(m, hit);
          m.appendChild(hit);
          hits.push(m);
        }
      }
    }
    return hits.length;
  }
  function jump(step){
    if (!hits.length) return;
    hitAt = (hitAt + step + hits.length) % hits.length;
    bar.classList.add('searching');
    hits.forEach((h, i) => h.classList.toggle('on', i === hitAt));
    focusEl(hits[hitAt], 1.9);
    say(`match ${hitAt + 1} of ${hits.length}` + (matchMedia('(hover: none)').matches ? '' : ' · [n] next · [N] previous · [esc] clear'));
  }

  /* ---- contact, window boxes ---- */
  const contact = document.getElementById('contact');
  contact.addEventListener('click', () => say('opening your mail app…'));
  stage.addEventListener('click', e => {
    if (moved > 5) return;
    if (e.target.closest('.box.close')) say("a CV can't be closed. try [c] to write to me");
    if (e.target.closest('.box.zoom')) layFlat();
  });

  document.getElementById('flip').onclick = flip;
  document.getElementById('reset').onclick = layFlat;
  stage.addEventListener('dblclick', flip);

  const coarse = matchMedia('(hover: none)').matches;
  stage.addEventListener('click', e => {
    if (moved > 5) { e.preventDefault(); return; }
    if (!coarse) return;
    const t = e.target.closest('[data-tip]');
    document.querySelectorAll('.tip-on').forEach(n => { if (n !== t) n.classList.remove('tip-on'); });
    if (t) {
      e.preventDefault();
      t.classList.toggle('tip-on');
      if (t.classList.contains('tip-on')) say(t.dataset.tip); else idle();
    }
  });

  /* ---- the status line is a shell ---- */
  const cmd = document.getElementById('cmd'), status = document.getElementById('status');
  /* the section you cd'd into shows in the prompt and in pwd; lay flat leaves it */
  const promptEl = document.getElementById('prompt');
  let here = '';
  const ps1 = () => `tuan@cv:~${here ? '/' + here : ''}$`;
  function goHome(){ here = ''; if (mode !== 'search') promptEl.textContent = ps1(); }
  let mode = null;                                   /* null | 'shell' | 'search' */
  const hist = []; let histAt = 0;

  function openLine(m){
    mode = m;
    status.classList.add('typing');
    promptEl.textContent = m === 'search' ? '/' : ps1();
    cmd.value = '';
    cmd.focus();
    say(m === 'search' ? 'type to highlight · enter to jump · esc to cancel'
                       : 'type help · tab completes · ↑ history · esc leaves');
  }
  function closeLine(){
    if (!mode) return;
    mode = null;
    status.classList.remove('typing');
    promptEl.textContent = ps1();
    if (document.activeElement === cmd) cmd.blur();
  }
  cmd.addEventListener('blur', closeLine);
  status.addEventListener('click', e => { if (!mode && !e.target.closest('a,button')) openLine('shell'); });
  document.getElementById('search').onclick = () => openLine('search');
  document.getElementById('next').onclick = () => jump(1);
  document.getElementById('prev').onclick = () => jump(-1);
  document.getElementById('clear').onclick = () => { clearHits(); idle(); };
  document.getElementById('shell').onclick = () => openLine('shell');

  const faceTitle = () => sheet.querySelector('.face.front:not([hidden])');
  const sectionsNow = () => [...sheet.querySelectorAll('.face:not([hidden]) section')];
  const filesNow = () => [...document.querySelectorAll('#keys a.download')]
    .map(a => ({ name: a.getAttribute('href').split('?')[0], a }));
  const later = (ms, fn) => setTimeout(fn, ms);
  /* a path as typed -> '' (home: ~, .., /home/tuan/cv) or a name (section key or file).
     Accepts experience, experience/, ./x, ../x, ../../x, ~/x, /home/tuan/cv/x. '.' is here. */
  function resolve(raw){
    let p = raw.toLowerCase().replace(/^\/home\/tuan\/cv(\/|$)/, '~/').replace(/\/+$/, '');
    if (p === '.' ) return here;
    p = p.replace(/^(~\/?|\/|(\.\.?\/)+)/, '');
    return /^(~|\.\.|\.)?$/.test(p) ? '' : p;
  }
  /* what a section holds: entries with their dates, grid labels, or the opening sentence */
  /* The sheet as a filesystem: sections are directories, and their items are files.
     entries -> named after the role / project (text before the first comma)
     grid rows -> named after the label;  a text section -> profile.txt */
  const slug = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  function itemsOf(sec){
    const items = [], seen = {};
    const add = (base, it) => { let n = base || 'item'; if (seen[n]) n += '-' + (++seen[n]); else seen[n] = 1; items.push({ ...it, name: n }); };
    for (const e of sec.querySelectorAll('.entry')) {
      const role = e.querySelector('.entry-head strong').textContent.trim();
      const where = (e.querySelector('.where') || {}).textContent || '';
      const heads = [...e.querySelectorAll('li')].map(li => {
        const b = li.querySelector('strong');
        const t = (b ? b.textContent : li.textContent).trim().replace(/\.$/, '');
        return '* ' + (t.length > 70 ? t.slice(0, 68) + '…' : t);
      });
      add(slug(role.split(',')[0]), { el: e, when: ((e.querySelector('.when') || {}).textContent || '').trim(),
        text: [role, where.trim()].filter(Boolean).join(' · ') + (heads.length ? '\n' + heads.join('\n') : '') });
    }
    for (const b of sec.querySelectorAll('.grid > b'))
      add(slug(b.textContent), { el: b, text: b.nextElementSibling.textContent.trim() });
    if (!items.length) {
      const p = sec.querySelector('p');
      if (p) items.push({ name: 'profile.txt', el: p, text: p.textContent.trim() });
    }
    return items;
  }
  function listSection(sec){
    const items = itemsOf(sec);
    const w = Math.max(...items.map(i => (i.when || '').length)) + 2;   /* date column fits the longest date */
    return items.some(i => i.when)
      ? items.map(i => i.when.padEnd(w) + i.name).join('\n')
      : items.map(i => i.name).join('  ');
  }
  /* a resolved path ('skills', 'skills/backend', 'backend' inside skills, 'cv-en.pdf') */
  function lookup(path){
    const secs = sectionsNow(), [a, b] = path.split('/');
    const secOf = k => secs.find(s => s.dataset.key === k);
    if (b !== undefined) {
      const sec = secOf(a);
      if (!sec) return null;
      const item = itemsOf(sec).find(i => i.name === b);
      return item ? { sec, item } : null;
    }
    if (here) { const item = itemsOf(secOf(here)).find(i => i.name === a); if (item) return { sec: secOf(here), item }; }
    if (secOf(a)) return { sec: secOf(a) };
    const pdf = filesNow().find(f => f.name.toLowerCase() === a);
    return pdf ? { pdf } : null;
  }

  /* help for people who have never used a shell: a one-line summary per command for
     `help`, and usage with examples for `<command> --help`, `help <command>`, `man <command>`.
     Only listed commands appear; the jokes and the dyno stay hidden. */
  const HELP = {
    ls:      ['ls [section]',  "list what's here",
              'ls              the parts of the CV (and the PDFs)\nls experience   what is inside a part: its files\nInside a part (after cd), plain ls lists it.'],
    cd:      ['cd <section>',  'go into a part of the CV',
              'cd experience   the sheet turns and zooms there\ncd ../skills    move to another part\ncd ..           back to the whole page (so does the 0 key)'],
    cat:     ['cat <file>',    'read one item',
              'cat full-stack-engineer   (inside experience) one job, its highlights\ncat skills/backend        one row of skills\ncat about/profile.txt     the profile paragraph\nUse ls to see the file names. Tab completes them.'],
    grep:    ['grep <word>',   'find a word on the CV',
              'grep node       highlights every match and jumps to the first\nThen n / N (or the next / prev buttons) step through them; esc clears.\nSame as pressing /.'],
    open:    ['open <pdf>',    'download the CV as a PDF',
              'open cv-en.pdf  English\nopen cv-fr.pdf  French'],
    man:     ['man tuan',      'back to the first page', 'man tuan        the front page, laid flat'],
    lang:    ['lang en|fr',    'switch language', 'lang fr         the CV in French (the l key does it too)\nlang en         back to English'],
    contact: ['contact',       'write me an email', 'contact         opens your mail app (the c key does it too)'],
    flip:    ['flip',          'turn the sheet over', 'flip            same as the f key or a double-click on the sheet'],
    print:   ['print',         'print the CV', 'print           prints the current language (the p key does it too)'],
    whoami:  ['whoami',        'who this is', 'whoami          name and role'],
    pwd:     ['pwd',           'where you are', 'pwd             the part of the CV you are in (see cd)'],
    clear:   ['clear',         'clear this line', 'clear           empties the status line'],
    help:    ['help [command]','this list', 'help            every command\nhelp cd         one command in detail (same as cd --help)'],
  };
  const helpFor = name => {
    const h = HELP[name];
    return h ? `${h[0]}  ·  ${h[1]}\n\n${h[2]}` : `${name}: no help for that. try help`;
  };
  function helpList(){
    const rows = Object.values(HELP).map(([u, d]) => u.padEnd(16) + d);
    const narrow = matchMedia('(max-width: 820px)').matches;
    const tip = 'type <command> --help for details, e.g. cd --help';
    /* phones: the main eight in full, the rest on one line, so the bar stays short */
    if (narrow) return rows.slice(0, 8).join('\n') + '\nalso: ' + Object.keys(HELP).slice(8).join(' · ') + '\n' + tip;
    const half = Math.ceil(rows.length / 2), w = Math.max(...rows.map(r => r.length)) + 4;
    return rows.slice(0, half).map((r, i) => r.padEnd(w) + (rows[half + i] || '')).join('\n') + '\n' + tip;
  }

  const COMMANDS = {
    help: a => a[0] ? helpFor(a[0].toLowerCase()) : helpList(),
    whoami: () => {
      const f = faceTitle();
      return `${f.querySelector('h1').textContent} · ${f.querySelector('.role').textContent}`;
    },
    ls: a => {
      /* ls: where you are (cd), or a named section; ~ / .. list the top level.
         The view follows what is listed; where you are (the prompt) does not change. */
      const raw = (a.find(x => !x.startsWith('-')) || '').toLowerCase();
      const target = !raw || /^\.\/?$/.test(raw) ? here : resolve(raw);
      if (!target) { if (raw) faceOn(); return sectionsNow().map(s => s.dataset.key + '/').concat(filesNow().map(f => f.name)).join('  '); }
      const hit = lookup(target);
      if (!hit) return `ls: cannot access '${raw}': No such file or directory`;
      if (hit.item) { showSection(hit.item.el); return hit.item.name; }
      if (hit.pdf) return hit.pdf.name;
      showSection(hit.sec); return listSection(hit.sec);
    },
    cd: a => {
      /* accepts experience, experience/, ./experience, ~/experience, ../experience */
      const raw = (a[0] || '').toLowerCase();
      if (/^\.\/?$/.test(raw)) return '';                   /* cd . : stay where you are */
      const name = resolve(raw);
      if (!name) { layFlat(); return ''; }
      const hit = lookup(name);
      const sec = hit ? (!hit.item && hit.sec)
        : !name.includes('/') && sectionsNow().find(s => s.dataset.key.startsWith(name));
      if (sec) {
        showSection(sec);
        here = sec.dataset.key;
        promptEl.textContent = ps1();
        return `${here}/ · on the sheet ↑ · ls to see inside · cd .. to go back`;
      }
      if (hit) return `cd: not a directory: ${raw}`;
      return `cd: no such file or directory: ${raw}`;
    },
    cat: a => {
      /* reads one item: zooms onto it on the sheet and prints it */
      const raw = (a[0] || '').toLowerCase();
      if (!raw) return 'usage: cat <file> · try ls, then cat one of its files';
      const hit = lookup(resolve(raw));
      if (!hit) return `cat: ${raw}: No such file or directory`;
      if (hit.pdf) return `cat: ${hit.pdf.name}: binary file, try open ${hit.pdf.name}`;
      if (!hit.item) return `cat: ${hit.sec.dataset.key}/: Is a directory · try ls ${hit.sec.dataset.key}`;
      showSection(hit.item.el);
      return hit.item.text;
    },
    grep: a => {
      const q = a.filter(x => !x.startsWith('-')).join(' ');
      if (!q) return 'usage: grep <word>';
      if (!find(q)) return `grep: no match for "${q}"`;
      closeLine();                                   /* hand the keys back, so n / N / esc work */
      jump(1);
    },
    open: a => {
      const raw = (a[0] || '').toLowerCase();
      if (!raw) return 'usage: open <file.pdf> · try ls';
      const hit = lookup(resolve(raw));
      if (hit && hit.pdf) { hit.pdf.a.click(); return `opening ${hit.pdf.name}…`; }
      if (hit && hit.item) return `open: ${hit.item.name}: not a PDF · try cat ${raw}`;
      if (hit) return `open: ${hit.sec.dataset.key}/: Is a directory · try cd ${hit.sec.dataset.key}`;
      return `open: ${raw}: no such file. try ls`;
    },
    man: a => {
      if (!a.length) return 'What manual page do you want?\nFor example, try "man tuan".';
      if (/^tuan$/i.test(a[a.length - 1])) { goHome(); faceOn({ back: false }); return 'TUAN(1): you are reading it.'; }
      if (HELP[a[0].toLowerCase()]) return helpFor(a[0].toLowerCase());
      return `No manual entry for ${a.join(' ')}`;
    },
    flip: () => { flip(); },
    dyno: () => { flip(); later(120, flip); },
    lang: a => a[0] ? (setLang(a[0].toLowerCase()) ? undefined : `lang: ${a[0]}: not here. try ${LANGS.join(' or ')}`)
                    : `${lang} (${LANGS.join(', ')} available)`,
    contact: () => { contact.click(); },
    print: () => { later(50, () => window.print()); return 'printing…'; },
    uptime: () => stats.textContent,
    clear: () => '',
    echo: a => a.join(' '),
    pwd: () => '/home/tuan/cv' + (here ? '/' + here : ''),
    date: () => new Date().toString(),
    uname: () => 'TuanOS 1.0 (1-bit, mono) GNU/CV',
    exit: () => 'there is no exit from a CV. try [c] to write to me',
    hire: () => 'hire: permission denied. try: sudo hire tuan',
    sudo: a => {
      if (a[0] !== 'hire') return `recruiter is not in the sudoers file. This incident will be reported.`;
      say('[sudo] password for recruiter: ');
      later(500, () => say('[sudo] password for recruiter: ********'));
      later(1100, () => say('✓ permission granted. opening your mail app…', 'dyno'));
      later(1800, () => { window.location.href = contact.href; });
    },
    rm: () => 'rm: cannot remove: read-only CV',
    vim: () => 'no editor here, the CV is final. (and you would never get out)',
  };
  Object.assign(COMMANDS, { less: COMMANDS.cat, more: COMMANDS.cat, mail: COMMANDS.contact,
    logout: COMMANDS.exit, vi: COMMANDS.vim, nano: COMMANDS.vim, emacs: COMMANDS.vim, ':q': COMMANDS.exit,
    find: COMMANDS.grep });

  /* phones: Enter puts the keyboard away, and the command runs once the page has its
     full height back, so cd / ls / cat aim at the real stage, not the strip above the keys */
  function afterKeyboard(fn){
    if (!vv) return fn();
    let t;
    const go = ms => { clearTimeout(t); t = setTimeout(() => { vv.removeEventListener('resize', settle); fn(); }, ms); };
    const settle = () => go(150);
    vv.addEventListener('resize', settle); go(400);
  }
  function run(line){
    const [name, ...args] = line.trim().replace(/^:(?!q$)/, '').split(/\s+/);   /* ":help" works too; :q stays a joke */
    if (!name) return;
    const fn = COMMANDS[name] || COMMANDS[name.toLowerCase()];
    const asksHelp = args.some(x => x === '--help' || x === '-h');
    const out = !fn ? `${name}: command not found. try help`
      : asksHelp ? helpFor(name.toLowerCase())
      : fn(args);
    if (out !== undefined) { said = null; say(out); }
  }

  function complete(){
    const parts = cmd.value.split(/\s+/);
    /* keep a path prefix (../, ~/, ./, /home/tuan/cv/) and complete the name after it;
       inside a directory part (skills/ba…) complete that directory's files */
    const lastRaw = parts[parts.length - 1];
    const prefix = parts.length > 1 ? (lastRaw.match(/^(~\/|\/home\/tuan\/cv\/|(\.\.?\/)+)/) || [''])[0] : '';
    const last = lastRaw.slice(prefix.length).toLowerCase();
    const dirs = sectionsNow().map(s => s.dataset.key + '/');
    const filesIn = k => { const sec = sectionsNow().find(s => s.dataset.key === k); return sec ? itemsOf(sec).map(i => i.name) : []; };
    const slash = last.indexOf('/');
    const paths = slash >= 0 ? filesIn(last.slice(0, slash)).map(n => last.slice(0, slash) + '/' + n)
      : dirs.concat(here && !prefix ? filesIn(here) : []);
    const pool = parts.length === 1 ? Object.keys(COMMANDS)
      : parts[0] === 'cd' ? (slash >= 0 ? [] : dirs.concat(here ? ['..'] : []))
      : /^(ls|cat|less|more)$/.test(parts[0]) ? paths
      : parts[0] === 'open' ? filesNow().map(f => f.name)
      : parts[0] === 'lang' ? LANGS
      : parts[0] === 'man'  ? ['tuan'] : [];
    const found = pool.filter(w => w.toLowerCase().startsWith(last));
    if (found.length === 1) {
      parts[parts.length - 1] = prefix + found[0];
      cmd.value = parts.join(' ') + (found[0].endsWith('/') ? '' : ' ');   /* a directory: keep typing into it */
    }
    else if (found.length) { said = null; say(found.join('  ')); }
  }

  cmd.addEventListener('input', () => {
    if (mode !== 'search') return;
    const n = find(cmd.value);
    said = null;
    say(cmd.value.trim().length < 2 ? 'type to highlight · enter to jump · esc to cancel'
        : n ? `${n} match${n > 1 ? 'es' : ''} · enter to jump` : 'no match');
  });
  cmd.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') { if (mode === 'search') clearHits(); closeLine(); idle(); return; }
    if (e.key === 'Enter') {
      if (mode === 'search') {
        closeLine();
        const go = () => { if (hits.length) { hitAt = -1; jump(1); } else { said = null; say('no match'); } };
        if (coarse) afterKeyboard(go); else go();
        return;
      }
      const line = cmd.value;
      if (line.trim()) { hist.push(line); histAt = hist.length; }
      cmd.value = '';
      if (coarse) { closeLine(); afterKeyboard(() => run(line)); } else run(line);
      return;
    }
    if (mode !== 'shell') return;
    if (e.key === 'Tab') { e.preventDefault(); complete(); }
    if (e.key === 'ArrowUp' && hist.length)   { e.preventDefault(); histAt = Math.max(0, histAt - 1); cmd.value = hist[histAt]; }
    if (e.key === 'ArrowDown' && hist.length) { e.preventDefault(); histAt = Math.min(hist.length, histAt + 1); cmd.value = hist[histAt] || ''; }
  });

  addEventListener('keydown', e => {
    if (e.target === cmd) return;
    if (e.target.closest && e.target.closest('a')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;      /* Ctrl+F, Ctrl+P… stay the browser's */
    const k = e.key;
    if ((k === ' ' || k === 'Enter') && e.target.closest && e.target.closest('button')) return;  /* the button clicks itself */
    const panning = st.zoom > 1.02 && !e.shiftKey;   /* Shift forces rotation */
    const STEP = 60;
    if (k === 'ArrowLeft')  { if (panning) st.px += STEP; else st.ry -= 8; render(); }
    if (k === 'ArrowRight') { if (panning) st.px -= STEP; else st.ry += 8; render(); }
    if (k === 'ArrowUp')    { if (panning) st.py += STEP; else st.rx = clamp(st.rx - 6, -72, 72); render(); }
    if (k === 'ArrowDown')  { if (panning) st.py -= STEP; else st.rx = clamp(st.rx + 6, -72, 72); render(); }
    if (k === '+' || k === '=') setZoom(st.zoom * 1.15);
    if (k === '-') setZoom(st.zoom / 1.15);
    if (k === 'f' || k === 'F' || k === ' ') { e.preventDefault(); flip(); }
    if (k === '0') layFlat();
    if (k === 'c' || k === 'C') contact.click();
    if (k === 'p' || k === 'P') window.print();
    if ((k === 'l' || k === 'L') && LANGS.length > 1) setLang(otherLang());
    if (k === '/') { e.preventDefault(); openLine('search'); }
    if (k === ':' || k === 'Enter') { e.preventDefault(); openLine('shell'); }
    if (k === 'n') jump(1);
    if (k === 'N') jump(-1);
    if (k === 'Escape') { document.querySelectorAll('.tip-on').forEach(n => n.classList.remove('tip-on')); clearHits(); idle(); }
    /* someone starts typing a command without ':' first: tell them how */
    else if (/^[a-z]$/i.test(k) && !'fFcCpPlLnN'.includes(k)) { said = null; say(lang === 'fr'
      ? 'pour taper une commande, appuyez d’abord sur :  · essayez :help'
      : 'to type a command, press : first · try :help'); }
  });

})();
