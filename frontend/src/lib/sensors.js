import { useCallback, useEffect, useRef, useState } from "react";

export const CARDINALS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export const CARDINAL_NAMES = { N: "North", NE: "North-East", E: "East", SE: "South-East", S: "South", SW: "South-West", W: "West", NW: "North-West" };
export const cardinal = (deg) => CARDINALS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

const rad = Math.PI / 180;

// Compass heading from the three orientation angles. Lying flat, the way the TOP edge points is the heading; held upright
// like a camera, it is the way the BACK points (W3C formula). Whichever of the two is more horizontal is used.
export function headingFrom(alpha, beta, gamma) {
  const cA = Math.cos(alpha * rad), sA = Math.sin(alpha * rad);
  const cB = Math.cos(beta * rad), sB = Math.sin(beta * rad);
  const cG = Math.cos(gamma * rad), sG = Math.sin(gamma * rad);
  const topX = -sA * cB, topY = cA * cB;                       // east, north parts of the device's top edge
  const backX = -cA * sG - sA * sB * cG, backY = -sA * sG + cA * sB * cG;   // the direction the back of the phone points
  const [x, y] = Math.hypot(topX, topY) >= Math.hypot(backX, backY) ? [topX, topY] : [backX, backY];
  let h = Math.atan2(x, y) / rad;
  if (h < 0) h += 360;
  return h;
}

// move `from` towards `to` along the shortest way round the circle
export function smoothAngle(from, to, k = 0.25) {
  if (from == null) return to;
  let d = ((to - from + 540) % 360) - 180;
  return (from + d * k + 360) % 360;
}

/**
 * Phone orientation. status: idle | waiting | live | denied | unsupported | nodata.
 * start() must be called from a tap (iOS asks permission only then).
 */
export function useOrientation() {
  const [status, setStatus] = useState("idle");
  const [o, setO] = useState({ alpha: null, beta: null, gamma: null, heading: null, absolute: false, rate: null });
  const last = useRef({ heading: null });
  const got = useRef(false);

  const start = useCallback(async () => {
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) { setStatus("unsupported"); return; }
    try {
      for (const Ev of [window.DeviceOrientationEvent, window.DeviceMotionEvent]) {
        if (Ev && typeof Ev.requestPermission === "function") {
          const r = await Ev.requestPermission();
          if (r !== "granted") { setStatus("denied"); return; }
        }
      }
    } catch { setStatus("denied"); return; }
    got.current = false;
    setStatus("waiting");
  }, []);

  useEffect(() => {
    if (status !== "waiting" && status !== "live") return undefined;
    const onOri = (e) => {
      if (e.alpha == null && e.webkitCompassHeading == null) return;
      got.current = true;
      let heading = null, absolute = !!e.absolute;
      if (typeof e.webkitCompassHeading === "number") { heading = e.webkitCompassHeading; absolute = true; }
      else if (e.absolute && e.alpha != null) heading = headingFrom(e.alpha, e.beta || 0, e.gamma || 0);
      if (heading != null) { heading = smoothAngle(last.current.heading, heading); last.current.heading = heading; }
      setO(prev => ({ ...prev, alpha: e.alpha, beta: e.beta, gamma: e.gamma, heading: heading ?? prev.heading, absolute }));
      setStatus("live");
    };
    const onMotion = (e) => { const r = e.rotationRate; if (r) setO(prev => ({ ...prev, rate: { alpha: r.alpha || 0, beta: r.beta || 0, gamma: r.gamma || 0 } })); };
    window.addEventListener("deviceorientationabsolute", onOri, true);
    window.addEventListener("deviceorientation", onOri, true);
    window.addEventListener("devicemotion", onMotion, true);
    const t = setTimeout(() => { if (!got.current) setStatus("nodata"); }, 3000);   // desktops fire nothing
    return () => {
      clearTimeout(t);
      window.removeEventListener("deviceorientationabsolute", onOri, true);
      window.removeEventListener("deviceorientation", onOri, true);
      window.removeEventListener("devicemotion", onMotion, true);
    };
  }, [status === "idle" || status === "denied" || status === "unsupported" || status === "nodata"]); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = useCallback(() => { last.current.heading = null; setStatus("idle"); }, []);
  return { status, o, start, stop };
}
