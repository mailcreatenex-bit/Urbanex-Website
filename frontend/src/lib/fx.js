// Tiny shared helpers for the motion effects. No dependencies; every effect checks these first so
// people who prefer reduced motion, have Data Saver on, or use a low-power device get a calm, fast page.
let _fx;
export function fxOK() {
  if (_fx !== undefined) return _fx;
  try {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const save = !!navigator.connection?.saveData;
    const weak = (navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2;
    _fx = !(reduce || save || weak);
  } catch { _fx = false; }
  return _fx;
}

// mouse/trackpad (hover) device, as opposed to a touch screen
export function finePointer() {
  try { return window.matchMedia("(hover: hover) and (pointer: fine)").matches; } catch { return false; }
}

// One rAF-throttled scroll listener shared by every parallax element, and it only touches elements that are on screen.
const items = new Set();
let ticking = false;
let io;

function update() {
  ticking = false;
  const vh = window.innerHeight;
  items.forEach((it) => {
    if (!it.visible) return;
    const r = it.el.getBoundingClientRect();
    const offset = (r.top + r.height / 2 - vh / 2) * it.speed;   // distance from screen centre, scaled
    it.el.style.transform = `translate3d(0, ${(-offset).toFixed(1)}px, 0)`;
  });
}
function onScroll() {
  if (!ticking) { ticking = true; requestAnimationFrame(update); }
}

export function registerParallax(el, speed) {
  if (!fxOK()) return () => {};
  if (!io) {
    io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { const it = [...items].find(i => i.el === e.target); if (it) it.visible = e.isIntersecting; });
      onScroll();
    }, { rootMargin: "100px" });
  }
  const it = { el, speed, visible: false };
  if (items.size === 0) window.addEventListener("scroll", onScroll, { passive: true });
  items.add(it);
  io.observe(el);
  return () => {
    io.unobserve(el);
    items.delete(it);
    if (items.size === 0) window.removeEventListener("scroll", onScroll);
    el.style.transform = "";
  };
}
