import { useEffect, useRef } from "react";

// A hairline gold bar showing how far down the page you are.
export default function ScrollProgress() {
  const bar = useRef(null);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = 0;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      bar.current.style.transform = `scaleX(${h > 0 ? Math.min(1, window.scrollY / h) : 0})`;
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(draw); };
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    draw();
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return <div ref={bar} aria-hidden="true" className="fixed top-0 left-0 right-0 h-[2px] z-[60] origin-left bg-gradient-to-r from-urbanex-gold via-urbanex-goldHover to-urbanex-gold" style={{ transform: "scaleX(0)" }}/>;
}
