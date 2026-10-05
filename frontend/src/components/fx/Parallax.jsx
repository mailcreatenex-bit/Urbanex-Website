import { useEffect, useRef } from "react";
import { registerParallax } from "@/lib/fx";

// Slides its content against the scroll direction. speed ~0.05 (subtle) to 0.3 (strong). Decorative only.
export default function Parallax({ children, speed = 0.12, className = "", ...rest }) {
  const el = useRef(null);
  useEffect(() => registerParallax(el.current, speed), [speed]);
  return <div ref={el} className={`will-change-transform ${className}`} {...rest}>{children}</div>;
}
