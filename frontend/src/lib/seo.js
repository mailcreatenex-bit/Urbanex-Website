import { useEffect } from "react";

const SITE = "Urbanex Realty";

function setMeta(attr, key, content) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

// Per-page title/description/Open Graph/canonical + optional JSON-LD structured data.
// Googlebot renders JS so this is indexable; link-preview crawlers use the API's /share pages instead.
export function useSeo({ title, description, image, jsonLd } = {}) {
  const ld = jsonLd ? JSON.stringify(jsonLd) : null;
  useEffect(() => {
    const full = title ? `${title} | ${SITE}` : `${SITE} — Premium real estate in Burdwan`;
    document.title = full;
    setMeta("name", "description", description);
    setMeta("property", "og:title", full);
    setMeta("property", "og:description", description);
    setMeta("property", "og:image", image);
    setMeta("property", "og:url", window.location.href.split("#")[0]);
    let canon = document.head.querySelector('link[rel="canonical"]');
    if (!canon) {
      canon = document.createElement("link");
      canon.rel = "canonical";
      document.head.appendChild(canon);
    }
    canon.href = window.location.origin + window.location.pathname;
    let script = null;
    if (ld) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.text = ld;
      document.head.appendChild(script);
    }
    return () => { if (script) script.remove(); };
  }, [title, description, image, ld]);
}
