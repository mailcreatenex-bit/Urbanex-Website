// International format, digits only. Override with REACT_APP_WHATSAPP_NUMBER.
export const WHATSAPP_NUMBER = process.env.REACT_APP_WHATSAPP_NUMBER || "919933333333";
export const waLink = (text) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

const BACKEND = process.env.REACT_APP_BACKEND_URL || "";
// Uploaded images are stored by the API as "/api/uploads/<file>"; external URLs pass through.
export const assetUrl = (u) => (u && u.startsWith("/api/") ? `${BACKEND}${u}` : u);
// Shared links go through the API so WhatsApp/Facebook previews (which don't run JS) get Open Graph tags.
export const shareUrl = (kind, slug) => `${BACKEND}/api/share/${kind}/${encodeURIComponent(slug)}`;

export const inr = (n) =>
  n == null ? "₹00.00 L" : n >= 10000000 ? `₹${(n / 10000000).toFixed(2)} Cr` : `₹${(n / 100000).toFixed(2)} L`;
export const inrFull = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;
