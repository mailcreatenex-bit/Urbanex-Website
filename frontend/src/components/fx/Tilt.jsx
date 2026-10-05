import { useEffect, useRef } from "react";
import { fxOK } from "@/lib/fx";

// 3D tilt + moving glare that follows the cursor (mouse) or finger (touch drag).
// Pure CSS transforms driven by two CSS variables; one rAF per frame; nothing runs when idle.
// Children can read --mx/--my (-1..1) for their own depth effect (see .tilt-depth in index.css).
export default function Tilt({ children, max = 7, className = "", glare = true, ...rest }) {
  const el = useRef(null);

  useEffect(() => {
    const node = el.current;
    if (!node || !fxOK()) return undefined;
    let raf = 0;
    let next = null;

    const apply = () => {
      raf = 0;
      if (!next) return;
      node.style.setProperty("--mx", next.x.toFixed(3));
      node.style.setProperty("--my", next.y.toFixed(3));
      node.style.setProperty("--gx", `${((next.x + 1) * 50).toFixed(1)}%`);
      node.style.setProperty("--gy", `${((next.y + 1) * 50).toFixed(1)}%`);
    };
    const move = (e) => {
      const r = node.getBoundingClientRect();
      next = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 };
      node.dataset.active = "1";
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const leave = () => {
      next = { x: 0, y: 0 };
      delete node.dataset.active;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    node.addEventListener("pointermove", move, { passive: true });
    node.addEventListener("pointerleave", leave);
    node.addEventListener("pointercancel", leave);
    node.addEventListener("pointerup", leave);
    return () => {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerleave", leave);
      node.removeEventListener("pointercancel", leave);
      node.removeEventListener("pointerup", leave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={el} className={`tilt ${glare ? "tilt-glare" : ""} ${className}`} style={{ "--tilt": `${max}deg` }} {...rest}>
      {children}
    </div>
  );
}
