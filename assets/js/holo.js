// holo.js — pointer-tilt foil for rare cards.
// Technique re-implemented from scratch (the approach popularized by
// simeydotme/pokemon-cards-css is GPL — no code copied). Paper-toned:
// soft-light blend, low alphas. Self-contained: injects its own CSS.
// Gates: reduced-motion → nothing; touch → static sheen only.

let injected = false;
function injectStyles() {
  if (injected) return; injected = true;
  const css = `
  .holo{ position:relative;
    transform: perspective(900px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));
    transition: transform .18s ease; will-change: transform; }
  .holo::after{ content:''; position:absolute; inset:0; pointer-events:none;
    border-radius:inherit; opacity:0; transition:opacity .35s ease;
    mix-blend-mode:soft-light;
    background:
      radial-gradient(circle at calc(var(--px,.5)*100%) calc(var(--py,.5)*100%),
        rgba(255,255,255,.65), transparent 42%),
      linear-gradient(115deg,
        transparent 18%,
        rgba(214,160,96,.38) 34%,
        rgba(122,51,64,.30) 44%,
        rgba(96,140,170,.32) 54%,
        rgba(214,160,96,.30) 64%,
        transparent 80%);
    background-size: 100% 100%, 220% 100%;
    background-position: 0 0, calc(var(--px,.5) * 100%) 0; }
  .holo.holo-on::after{ opacity:1; }
  .holo.holo-static::after{ opacity:.5;
    background-position: 0 0, 62% 0; }
  @media (prefers-reduced-motion: reduce){
    .holo{ transform:none !important; }
    .holo::after{ display:none !important; } }
  `;
  const s = document.createElement('style');
  s.setAttribute('data-holo', '');
  s.textContent = css;
  document.head.appendChild(s);
}

export function holo(el, opts = {}) {
  if (!el || el.classList.contains('holo')) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  injectStyles();
  el.classList.add('holo');

  const tiltX = opts.tiltX ?? 5;   // deg, max
  const tiltY = opts.tiltY ?? 7;

  if (!matchMedia('(any-hover: hover) and (pointer: fine)').matches) {
    el.classList.add('holo-static');   // touch: quiet fixed sheen, no tilt
    return;
  }

  let raf = null;
  el.addEventListener('pointermove', (e) => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      const r = el.getBoundingClientRect();
      const px = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
      const py = Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1);
      el.style.setProperty('--px', px.toFixed(3));
      el.style.setProperty('--py', py.toFixed(3));
      el.style.setProperty('--rx', ((py - .5) * -tiltX).toFixed(2) + 'deg');
      el.style.setProperty('--ry', ((px - .5) * tiltY).toFixed(2) + 'deg');
      el.classList.add('holo-on');
    });
  });
  el.addEventListener('pointerleave', () => {
    el.classList.remove('holo-on');
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  });
}

/* Freeze/unfreeze — used around PNG export so the tilt never skews the capture. */
export function holoFreeze(el) {
  if (!el) return () => {};
  const had = el.classList.contains('holo-on');
  el.classList.remove('holo-on');
  const prev = el.style.transform;
  el.style.transform = 'none';
  return () => { el.style.transform = prev; if (had) el.classList.add('holo-on'); };
}
