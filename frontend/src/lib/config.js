// International format, digits only. Override with REACT_APP_WHATSAPP_NUMBER.
export const WHATSAPP_NUMBER = process.env.REACT_APP_WHATSAPP_NUMBER || "919933333333";
export const waLink = (text) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

const BACKEND = process.env.REACT_APP_BACKEND_URL || "";
// Uploaded images are stored by the API as "/api/uploads/<file>"; external URLs pass through.
// Pass a width to get a right-sized copy from the image hosts that support it (Pexels / Unsplash): the seeded
// photos are originals several thousand pixels wide, which would otherwise be downloaded in full.
export const assetUrl = (u, width) => {
  if (!u) return u;
  if (u.startsWith("/api/")) return `${BACKEND}${u}`;
  if (!width) return u;
  try {
    const url = new URL(u);
    if (url.hostname === "images.pexels.com") { url.search = `?auto=compress&cs=tinysrgb&w=${width}`; return url.toString(); }
    if (url.hostname === "images.unsplash.com") { url.searchParams.set("w", String(width)); url.searchParams.set("q", "70"); url.searchParams.set("auto", "format"); return url.toString(); }
  } catch { /* not a URL we can resize */ }
  return u;
};
// Shared links go through the API so WhatsApp/Facebook previews (which don't run JS) get Open Graph tags.
export const shareUrl = (kind, slug) => `${BACKEND}/api/share/${kind}/${encodeURIComponent(slug)}`;

export const inr = (n) =>
  n == null ? "₹00.00 L" : n >= 10000000 ? `₹${(n / 10000000).toFixed(2)} Cr` : `₹${(n / 100000).toFixed(2)} L`;
export const inrFull = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;
