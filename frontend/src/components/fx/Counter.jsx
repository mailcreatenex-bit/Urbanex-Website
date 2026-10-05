import { useEffect, useRef, useState } from "react";
import { fxOK } from "@/lib/fx";

// Counts up once when scrolled into view (or just shows the number when motion is reduced).
export default function Counter({ to, duration = 1400, className = "" }) {
  const el = useRef(null);
  const [n, setN] = useState(fxOK() ? 0 : to);

  useEffect(() => {
    if (!fxOK()) { setN(to); return undefined; }
    const node = el.current;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (t) => {
        const p = Math.min(1, (t - t0) / duration);
        setN(Math.round(to * (1 - Math.pow(1 - p, 3))));   // ease-out
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, { threshold: 0.4 });
    io.observe(node);
    return () => { io.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [to, duration]);

  return <span ref={el} className={className}>{n.toLocaleString("en-IN")}</span>;
}
