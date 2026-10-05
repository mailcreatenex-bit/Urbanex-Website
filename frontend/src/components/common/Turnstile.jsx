import { useEffect, useRef } from "react";

// Cloudflare Turnstile (free bot check). Set REACT_APP_TURNSTILE_SITE_KEY to switch it on, and
// TURNSTILE_SECRET_KEY on the backend. With no site key nothing is rendered and forms work as before.
export const TURNSTILE_SITE_KEY = process.env.REACT_APP_TURNSTILE_SITE_KEY || "";
export const TURNSTILE_ENABLED = !!TURNSTILE_SITE_KEY;

let scriptPromise = null;
function loadScript() {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.onload = resolve;
      s.onerror = () => { scriptPromise = null; reject(new Error("Turnstile failed to load")); };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

// value: the current token ("" when none). Parents set it back to "" after each submit so the widget re-arms.
export default function Turnstile({ value, onChange }) {
  const box = useRef(null);
  const widget = useRef(null);

  useEffect(() => {
    if (!TURNSTILE_ENABLED) return undefined;
    let dead = false;
    loadScript().then(() => {
      if (dead || !box.current || widget.current !== null) return;
      widget.current = window.turnstile.render(box.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (t) => onChange(t),
        "expired-callback": () => onChange(""),
        "error-callback": () => onChange(""),
      });
    }).catch(() => {});
    return () => {
      dead = true;
      if (widget.current !== null && window.turnstile) { try { window.turnstile.remove(widget.current); } catch { /* gone */ } }
      widget.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!value && widget.current !== null && window.turnstile) { try { window.turnstile.reset(widget.current); } catch { /* ignore */ } }
  }, [value]);

  if (!TURNSTILE_ENABLED) return null;
  return <div ref={box} className="my-1" data-testid="turnstile"/>;
}
