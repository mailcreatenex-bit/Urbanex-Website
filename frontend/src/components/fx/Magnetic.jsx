import { useEffect, useRef } from "react";
import { fxOK, finePointer } from "@/lib/fx";

// Buttons that lean toward the cursor when it gets close. Mouse devices only.
export default function Magnetic({ children, strength = 0.28, className = "" }) {
  const el = useRef(null);
  useEffect(() => {
    const node = el.current;
    if (!node || !fxOK() || !finePointer()) return undefined;
    let raf = 0;
    const set = (x, y) => { raf = 0; node.style.transform = `translate3d(${x}px, ${y}px, 0)`; };
    const move = (e) => {
      const r = node.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      if (!raf) raf = requestAnimationFrame(() => set(dx * strength, dy * strength));
    };
    const leave = () => { if (raf) cancelAnimationFrame(raf); raf = 0; node.style.transform = ""; };
    node.addEventListener("pointermove", move, { passive: true });
    node.addEventListener("pointerleave", leave);
    return () => { node.removeEventListener("pointermove", move); node.removeEventListener("pointerleave", leave); if (raf) cancelAnimationFrame(raf); };
  }, [strength]);
  return <span ref={el} className={`inline-block transition-transform duration-200 ease-out ${className}`}>{children}</span>;
}
