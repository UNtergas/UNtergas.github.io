/* Spin / zoom / flip. Zoom changes layout size, never transform scale,
   so the text is re-rendered at every step instead of being stretched. */
(function(){
  const root  = document.documentElement;
  const stage = document.getElementById('stage');
  const sheet = document.getElementById('sheet');
  const shade = document.getElementById('shade');
  const hint  = document.getElementById('hint');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const st = { rx:-7, ry:-4, zoom:1, flip:0, vx:0, vy:0, drag:false };
  let base = 1, touched = false;
  const clamp = (v,a,b) => Math.min(b, Math.max(a, v));

  /* how big the sheet is when "laid flat": fills the stage, never the bar */
  function measure(){
    const w = stage.clientWidth, h = stage.clientHeight;
    base = Math.max(0.2, Math.min(w * 0.9 / 720, h * 0.94 / 1018));
  }

  function render(){
    const k = base * st.zoom, ry = st.ry + st.flip;
    root.style.setProperty('--k', k);
    sheet.style.transform = `rotateX(${st.rx}deg) rotateY(${ry}deg)`;
    const facing = Math.abs(Math.cos(ry * Math.PI / 180));
    shade.style.transform = `translateY(${300*k}px) scaleX(${(0.25+0.75*facing)*k}) scaleY(${k})`;
    shade.style.opacity = 0.22 + 0.33 * facing;
  }

  /* shrink the type until the page fits inside its margins */
  function fitText(){
    sheet.querySelectorAll('.face').forEach(face => {
      const body = face.querySelector('.body');
      let size = 16;
      face.style.setProperty('--fs', size + 'px');
      while (body.scrollHeight > body.clientHeight - 2 && size > 10.5) {
        size -= 0.25;
        face.style.setProperty('--fs', size + 'px');
      }
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
    if (pts.size === 2) { setZoom(zoom0 * dist() / pinch0); return; }
    if (!st.drag || !last) return;
    moved = Math.hypot(e.clientX - downX, e.clientY - downY);
    if (moved > 5 && !captured) { stage.setPointerCapture(e.pointerId); captured = true; }
    if (!captured) return;
    st.vx = (e.clientX - last.clientX) * 0.32;
    st.vy = (e.clientY - last.clientY) * 0.22;
    st.ry += st.vx; st.rx = clamp(st.rx - st.vy, -72, 72);
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

  /* zoom is a layout change, so coalesce it to one per frame */
  let pending = null;
  function setZoom(z){
    st.zoom = clamp(z, 1, 3.2);              /* 1 = fitted; never smaller */
    if (pending) return;
    pending = requestAnimationFrame(() => { pending = null; render(); });
  }
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    setZoom(st.zoom * (e.deltaY > 0 ? 0.9 : 1.11));
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
    const f = { rx:st.rx, ry:st.ry, z:st.zoom }, t0 = performance.now();
    const targetRy = Math.round((st.ry + st.flip) / 180) * 180 - st.flip;
    if (reduce) { st.rx = 0; st.ry = targetRy; st.zoom = 1; st.vx = st.vy = 0; render(); return; }
    st.vx = st.vy = 0;
    (function anim(now){
      const k = Math.min(1, (now - t0) / 480), e = 1 - Math.pow(1 - k, 3);
      st.rx = f.rx + (0 - f.rx) * e;
      st.ry = f.ry + (targetRy - f.ry) * e;
      st.zoom = f.z + (1 - f.z) * e;
      render();
      if (k < 1) requestAnimationFrame(anim);
    })(t0);
  }

  document.getElementById('flip').onclick = flip;
  document.getElementById('reset').onclick = layFlat;
  stage.addEventListener('dblclick', flip);

  const coarse = matchMedia('(hover: none)').matches;
  stage.addEventListener('click', e => {
    if (moved > 5) { e.preventDefault(); return; }
    if (!coarse) return;
    const t = e.target.closest('[data-tip]');
    document.querySelectorAll('.tip-on').forEach(n => { if (n !== t) n.classList.remove('tip-on'); });
    if (t) { e.preventDefault(); t.classList.toggle('tip-on'); }
  });

  addEventListener('keydown', e => {
    if (e.target.closest('a')) return;
    const k = e.key;
    if (k === 'ArrowLeft')  { st.ry -= 8; render(); }
    if (k === 'ArrowRight') { st.ry += 8; render(); }
    if (k === 'ArrowUp')    { st.rx = clamp(st.rx - 6, -72, 72); render(); }
    if (k === 'ArrowDown')  { st.rx = clamp(st.rx + 6, -72, 72); render(); }
    if (k === '+' || k === '=') setZoom(st.zoom * 1.15);
    if (k === '-') setZoom(st.zoom / 1.15);
    if (k === 'f' || k === 'F' || k === ' ') { e.preventDefault(); flip(); }
    if (k === '0') layFlat();
    if (k === 'Escape') document.querySelectorAll('.tip-on').forEach(n => n.classList.remove('tip-on'));
  });

  setTimeout(() => hint.classList.add('gone'), 7000);
})();
