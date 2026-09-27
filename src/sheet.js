/* Spin / zoom / flip. Zoom changes layout size, never transform scale,
   so the text is re-rendered at every step instead of being stretched. */
(function(){
  const root  = document.documentElement;
  const stage = document.getElementById('stage');
  const sheet = document.getElementById('sheet');
  const shade = document.getElementById('shade');
  const hint  = document.getElementById('hint');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  function render(){
    const k = base * st.zoom, ry = st.ry + st.flip;
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
    sheet.querySelectorAll('.face').forEach(face => {
      const body = face.querySelector('.body');
      let size = 16;
      face.classList.add('measuring');
      face.style.setProperty('--fs', size + 'px');
      while (body.scrollHeight > body.clientHeight - 2 && size > 10.5) {
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
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(relayout, 120); });

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
    if (pts.size === 1) { st.drag = true; last = e; st.vx = st.vy = 0; stage.classList.add('dragging'); }
    if (pts.size === 2) { pinch0 = dist(); zoom0 = st.zoom; }
    touched = true; hint.classList.add('gone');
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
    hint.classList.add('gone');
  }, { passive:false });

  function flip(){
    const to = st.flip + 180, from = st.flip, t0 = performance.now();
    if (reduce) { st.flip = to; render(); return; }
    (function anim(now){
      const k = Math.min(1, (now - t0) / 620);
      st.flip = from + (to - from) * (1 - Math.pow(1 - k, 3)); render();
      if (k < 1) requestAnimationFrame(anim);
    })(t0);
  }

  /* lay flat = face on, zoomed back out to fit */
  function layFlat(){
    const f = { rx:st.rx, ry:st.ry, z:st.zoom, px:st.px, py:st.py }, t0 = performance.now();
    const targetRy = Math.round((st.ry + st.flip) / 180) * 180 - st.flip;
    if (reduce) { st.rx = 0; st.ry = targetRy; st.zoom = 1; st.px = st.py = 0; st.vx = st.vy = 0; render(); return; }
    st.vx = st.vy = 0;
    (function anim(now){
      const k = Math.min(1, (now - t0) / 480), e = 1 - Math.pow(1 - k, 3);
      st.rx = f.rx + (0 - f.rx) * e;
      st.ry = f.ry + (targetRy - f.ry) * e;
      st.zoom = f.z + (1 - f.z) * e;
      st.px = f.px * (1 - e);
      st.py = f.py * (1 - e);
      render();
      if (k < 1) requestAnimationFrame(anim);
    })(t0);
  }

  document.getElementById('flip').onclick = flip;
  document.getElementById('reset').onclick = layFlat;
  stage.addEventListener('dblclick', flip);

  /* a tooltip near the right edge of the window anchors from the right instead,
     so it can never be pushed off screen once the paper stops clipping it */
  const TIP_W = 300;
  stage.addEventListener('pointerover', e => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (!t) return;
    const r = t.getBoundingClientRect();
    t.classList.toggle('tip-flip', r.left + TIP_W > innerWidth - 12);
  });

  const coarse = matchMedia('(hover: none)').matches;
  stage.addEventListener('click', e => {
    if (moved > 5) { e.preventDefault(); return; }
    if (!coarse) return;
    const t = e.target.closest('[data-tip]');
    document.querySelectorAll('.tip-on').forEach(n => { if (n !== t) n.classList.remove('tip-on'); });
    if (t) {
      e.preventDefault();
      const r = t.getBoundingClientRect();
      t.classList.toggle('tip-flip', r.left + TIP_W > innerWidth - 12);
      t.classList.toggle('tip-on');
    }
  });

  addEventListener('keydown', e => {
    if (e.target.closest('a')) return;
    const k = e.key;
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
    if (k === 'Escape') document.querySelectorAll('.tip-on').forEach(n => n.classList.remove('tip-on'));
  });

  setTimeout(() => hint.classList.add('gone'), 7000);
})();