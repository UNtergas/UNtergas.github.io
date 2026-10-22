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
  function measure(){
    const w = stage.clientWidth, h = stage.clientHeight;
    base = Math.max(0.2, Math.min(w * 0.9 / 720, h * 0.94 / 1018));
  }

  /* Pan bounds are measured, not predicted: the sheet is tilted inside a
     perspective, so its projected box is not 720x1018 * k. Measure where it
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
      `translate(${st.px}px, ${st.py + 300*k}px) scaleX(${(0.25+0.75*facing)*k}) scaleY(${k})`;
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
  if (window.visualViewport) visualViewport.addEventListener('resize', requeue);

  if (!reduce) {
    const from = { rx:16, ry:-42 }, t0 = performance.now();
    (function intro(now){
      if (touched) return;
      const e = 1 - Math.pow(1 - Math.min(1,(now-t0)/900), 3);
      st.rx = from.rx + (-7-from.rx)*e;
      st.ry = from.ry + (-4-from.ry)*e;
      render();
      if (e < 1) requestAnimationFrame(intro);
    })(t0);
  }

  /* ---- drag, pinch ---- */
  const pts = new Map();
  let last = null, pinch0 = 0, zoom0 = 1, downX = 0, downY = 0, moved = 0, captured = false;
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
    if (moved > 5 && !captured) { stage.setPointerCapture(e.pointerId); captured = true; }
    if (!captured) return;
    const dx = e.clientX - last.clientX, dy = e.clientY - last.clientY;
    if (st.zoom > 1.02 && !e.shiftKey) {        // zoomed in: you are reading, so pan
      st.px += dx; st.py += dy;
      st.vx = st.vy = 0;
    } else {                                     // fitted, or Shift held: turn the page
      st.vx = dx * 0.32; st.vy = dy * 0.22;
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
    en: 'this is a command line · press : then type help, ls, cat skills, top…',
    fr: 'ceci est une ligne de commande · appuyez sur : puis tapez help, ls, cat skills, top…',
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
     every time the other face comes round is a flip; a full turn inside one
     second is a dyno, flung by hand included. */
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
    if (!dynoing && now - lastDyno > 1500 && Math.abs(T - spins[0][1]) >= 360) countDyno();
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
  /* `top`: the console's CPU before and after the incident fix, live */
  function top(){
    const id = ++sayId, spark = '▁▂▃▄▅▆▇█', series = [];
    idling = false; said = null; msg.className = '';
    let t = 0;
    (function tick(){
      if (id !== sayId) return;
      const before = t < 60;
      const v = before && t % 10 === 0 ? 0.99 : 0.1 + Math.random() * (before ? 0.08 : 0.1);
      series.push(v); if (series.length > 30) series.shift();
      msg.textContent = `top - cpu ${series.map(x => spark[Math.min(7, Math.floor(x * 8))]).join('')} ${String(Math.round(v * 100)).padStart(3)}%  `
        + (before ? 'before the fix: a spike every 10 min' : 'after the fix: 10-20% max');
      if (++t < 130) setTimeout(tick, 80);
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
  const FIG = {
    hang:   ['\\o/', ' | ', '/ \\'],
    crouch: [' o ', '/|\\', '< >'],
    fly:    ['\\o/', ' | ', '/ \\'],
    top:    [' o  ', '/|\\ ', '/ \\ '],
  };
  const WALL = 17;                                       /* wall width in characters */
  function wallFrame(rows, holds, fig, r, c, flag){
    const g = Array.from({ length: rows }, () => Array(WALL).fill(' '));
    for (const [hr, hc] of holds) if (hr >= 0 && hr < rows) g[hr][hc] = '●';
    FIG[fig].forEach((line, i) => [...line].forEach((ch, j) => {
      const y = r + i, x = c + j;
      if (ch !== ' ' && y >= 0 && y < rows && x >= 0 && x < WALL) g[y][x] = ch;
    }));
    if (flag) ['TOP!', '|'].forEach((t, i) => [...t].forEach((ch, j) => { g[i][WALL - 5 + j] = ch; }));
    return g.map(l => '│' + l.join('') + '│').join('\n');
  }
  let climbId = 0;
  function climb(){
    const id = ++climbId;
    const lh = parseFloat(getComputedStyle(climber).fontSize) * 1.15;
    const rows = Math.max(12, Math.floor((stage.clientHeight - 40) / lh));
    const holds = [];
    const HOLDS = 8, gap = (rows - 5) / (HOLDS - 1);   /* always 8 holds, spread over the full height */
    for (let i = 0; i < HOLDS; i++) holds.push([Math.round(rows - 4 - i * gap), i % 2 ? WALL - 3 : 2]);
    const frames = [];                                    /* [fig, row, col, ms] */
    holds.forEach(([r, c], i) => {
      frames.push(['hang', r + 1, c - 1, 110]);
      const next = holds[i + 1];
      if (!next) return;
      frames.push(['crouch', r + 1, c - 1, 60]);
      for (let k = 1; k <= 3; k++)
        frames.push(['fly', Math.round(r + 1 + (next[0] - r) * k / 4), Math.round(c - 1 + (next[1] - c) * k / 4), 40]);
    });
    climber.classList.add('on');
    let i = 0, hold = 0;
    (function next(){
      if (id !== climbId) return;
      if (i < frames.length) {
        const [fig, r, c, ms] = frames[i++];
        if (fig === 'hang') say(`dyno… hold ${++hold}/${holds.length}`, 'dyno');
        climber.textContent = wallFrame(rows, holds, fig, r, c);
        setTimeout(next, ms);
      } else {
        climber.textContent = wallFrame(rows, holds, 'top', 0, 1, true);
        say('dyno! topped out.', 'dyno');
        setTimeout(() => { if (id === climbId) { climber.classList.remove('on'); idle(); } }, 1800);
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
  function faceOn({ back, zoom = 1, done } = {}){
    anim = null;                                     /* stop a flip in progress */
    const T = st.ry + st.flip, off = back ? 180 : 0;
    const target = back === undefined ? Math.round(T / 180) * 180 : off + Math.round((T - off) / 360) * 360;
    const f = { rx:st.rx, ry:st.ry, z:st.zoom, px:st.px, py:st.py }, ry1 = target - st.flip;
    st.vx = st.vy = 0;
    if (reduce) { st.rx = 0; st.ry = ry1; st.zoom = zoom; st.px = st.py = 0; render(); if (done) done(); return; }
    const id = faceAnim = {}, t0 = performance.now();
    (function step(now){
      if (faceAnim !== id) return;
      const k = Math.min(1, (now - t0) / 480), e = 1 - Math.pow(1 - k, 3);
      st.rx = f.rx * (1 - e);
      st.ry = f.ry + (ry1 - f.ry) * e;
      st.zoom = f.z + (zoom - f.z) * e;
      st.px = f.px * (1 - e);
      st.py = f.py * (1 - e);
      render();
      if (k < 1) requestAnimationFrame(step); else if (done) done();
    })(t0);
  }
  const layFlat = () => faceOn();

  /* slide the sheet so el sits in the middle of the stage (correctPan keeps it in bounds) */
  function centreOn(el){
    const s = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
    const dx = s.left + s.width / 2 - (r.left + r.width / 2), dy = s.top + s.height / 2 - (r.top + r.height / 2);
    const p0 = { x:st.px, y:st.py }, t0 = performance.now(), id = faceAnim = {};
    if (reduce) { st.px += dx; st.py += dy; render(); return; }
    (function step(now){
      if (faceAnim !== id) return;
      const k = Math.min(1, (now - t0) / 320), e = 1 - Math.pow(1 - k, 3);
      st.px = p0.x + dx * e; st.py = p0.y + dy * e; render();
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  const focusEl = (el, zoom) => faceOn({ back: !!el.closest('.back'), zoom, done: () => centreOn(el) });

  /* zoom until a whole section fills the stage, then flash its box */
  function showSection(sec){
    const h1 = sec.offsetHeight / st.zoom, w1 = sec.offsetWidth / st.zoom;
    focusEl(sec, clamp(Math.min(0.9 * stage.clientHeight / h1, 0.95 * stage.clientWidth / w1), 1, 2.4));
    sec.classList.remove('flash'); void sec.offsetWidth; sec.classList.add('flash');
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
  function clearHits(){
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
    hits.forEach((h, i) => h.classList.toggle('on', i === hitAt));
    focusEl(hits[hitAt], 1.9);
    say(`match ${hitAt + 1} of ${hits.length} · [n] next · [N] previous · [esc] clear`);
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
  const promptEl = document.getElementById('prompt'), PS1 = promptEl.textContent;
  let mode = null;                                   /* null | 'shell' | 'search' */
  const hist = []; let histAt = 0;

  function openLine(m){
    mode = m;
    status.classList.add('typing');
    promptEl.textContent = m === 'search' ? '/' : PS1;
    cmd.value = '';
    cmd.focus();
    say(m === 'search' ? 'type to highlight · enter to jump · esc to cancel'
                       : 'type help · tab completes · ↑ history · esc leaves');
  }
  function closeLine(){
    if (!mode) return;
    mode = null;
    status.classList.remove('typing');
    promptEl.textContent = PS1;
    if (document.activeElement === cmd) cmd.blur();
  }
  cmd.addEventListener('blur', closeLine);
  status.addEventListener('click', e => { if (!mode && !e.target.closest('a,button')) openLine('shell'); });
  document.getElementById('search').onclick = () => openLine('search');
  document.getElementById('shell').onclick = () => openLine('shell');

  const faceTitle = () => sheet.querySelector('.face.front:not([hidden])');
  const sectionsNow = () => [...sheet.querySelectorAll('.face:not([hidden]) section')];
  const filesNow = () => [...document.querySelectorAll('#keys a.download')]
    .map(a => ({ name: a.getAttribute('href').split('?')[0], a }));
  const later = (ms, fn) => setTimeout(fn, ms);

  const COMMANDS = {
    help: () =>
      'whoami · ls · cat <section> · grep <word> · open <file> · man tuan · top\n' +
      'flip · lang <' + LANGS.join('|') + '> · contact · print · uptime · clear · exit',
    whoami: () => {
      const f = faceTitle();
      return `${f.querySelector('h1').textContent} · ${f.querySelector('.role').textContent}`;
    },
    ls: () => sectionsNow().map(s => s.dataset.key + '/').concat(filesNow().map(f => f.name)).join('  '),
    cat: a => {
      const name = (a[0] || '').replace(/\/$/, '').toLowerCase();
      if (!name) return 'cat: which one? try ls';
      const sec = sectionsNow().find(s => s.dataset.key === name)
               || sectionsNow().find(s => s.dataset.key.startsWith(name));
      if (sec) { showSection(sec); return `${sec.dataset.key}: on the sheet ↑ · [0] to lay it flat again`; }
      const file = filesNow().find(f => f.name === name);
      if (file) return `cat: ${name}: binary file, try open ${name}`;
      return `cat: ${name}: no such section. try ls`;
    },
    grep: a => {
      const q = a.filter(x => !x.startsWith('-')).join(' ');
      if (!q) return 'usage: grep <word>';
      if (!find(q)) return `grep: no match for "${q}"`;
      jump(1);
    },
    open: a => {
      const name = (a[0] || '').toLowerCase().replace(/\/$/, '');
      if (!name) return 'usage: open <file.pdf> · try ls';
      const file = filesNow().find(f => f.name.toLowerCase() === name);
      if (file) { file.a.click(); return `opening ${file.name}…`; }
      if (sectionsNow().some(s => s.dataset.key === name))
        return `open: ${name}: not a file, it's a section. use cat ${name}`;
      return `open: ${name}: no such file. try ls`;
    },
    man: a => {
      if (!a.length) return 'What manual page do you want?\nFor example, try "man tuan".';
      if (/^tuan$/i.test(a[a.length - 1])) { faceOn({ back: false }); return 'TUAN(1): you are reading it.'; }
      return `No manual entry for ${a.join(' ')}`;
    },
    top: () => { top(); },
    flip: () => { flip(); },
    dyno: () => { flip(); later(120, flip); },
    lang: a => a[0] ? (setLang(a[0].toLowerCase()) ? undefined : `lang: ${a[0]}: not here. try ${LANGS.join(' or ')}`)
                    : `${lang} (${LANGS.join(', ')} available)`,
    contact: () => { contact.click(); },
    print: () => { later(50, () => window.print()); return 'printing…'; },
    uptime: () => stats.textContent,
    clear: () => '',
    echo: a => a.join(' '),
    pwd: () => '/home/tuan/cv',
    cd: () => 'cd: this is the only directory worth visiting',
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
    find: COMMANDS.grep, xdg_open: COMMANDS.open });

  function run(line){
    const [name, ...args] = line.trim().split(/\s+/);
    if (!name) return;
    const fn = COMMANDS[name] || COMMANDS[name.toLowerCase()];
    const out = fn ? fn(args) : `${name}: command not found. try help`;
    if (out !== undefined) { said = null; say(out); }
  }

  function complete(){
    const parts = cmd.value.split(/\s+/), last = parts[parts.length - 1].toLowerCase();
    const pool = parts.length === 1 ? Object.keys(COMMANDS)
      : /^(cat|less|more)$/.test(parts[0]) ? sectionsNow().map(s => s.dataset.key)
      : parts[0] === 'open' ? filesNow().map(f => f.name)
      : parts[0] === 'lang' ? LANGS
      : parts[0] === 'man'  ? ['tuan'] : [];
    const found = pool.filter(w => w.toLowerCase().startsWith(last));
    if (found.length === 1) { parts[parts.length - 1] = found[0]; cmd.value = parts.join(' ') + ' '; }
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
      if (mode === 'search') { closeLine(); if (hits.length) { hitAt = -1; jump(1); } else { said = null; say('no match'); } return; }
      const line = cmd.value;
      if (line.trim()) { hist.push(line); histAt = hist.length; }
      cmd.value = '';
      run(line);
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
