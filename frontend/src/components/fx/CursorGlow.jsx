import { useEffect, useRef } from "react";
import { fxOK, finePointer } from "@/lib/fx";

// A soft gold light that trails the mouse. One fixed div, moved with transform; skipped on touch screens.
export default function CursorGlow() {
  const el = useRef(null);
  useEffect(() => {
    const node = el.current;
    if (!node || !fxOK() || !finePointer()) return undefined;
    let x = -400, y = -400, tx = x, ty = y, raf = 0, shown = false;
    const tick = () => {
      x += (tx - x) * 0.14; y += (ty - y) * 0.14;
      node.style.transform = `translate3d(${x - 200}px, ${y - 200}px, 0)`;
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(tick) : 0;   // stops when it catches up
    };
    const move = (e) => {
      tx = e.clientX; ty = e.clientY;
      if (!shown) { shown = true; node.style.opacity = "1"; x = tx; y = ty; }
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const out = () => { shown = false; node.style.opacity = "0"; };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", out);
    return () => { window.removeEventListener("pointermove", move); document.documentElement.removeEventListener("pointerleave", out); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return <div ref={el} aria-hidden="true" className="cursor-glow" style={{ opacity: 0 }}/>;
}
