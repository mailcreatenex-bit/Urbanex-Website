// Small helpers shared by the CRM screens.
export const STAGES = [
  { v: "new", label: "New", color: "#3B82F6" },
  { v: "contacted", label: "Contacted", color: "#8B5CF6" },
  { v: "site_visit", label: "Site visit", color: "#F59E0B" },
  { v: "negotiation", label: "Negotiation", color: "#C5A059" },
  { v: "closed", label: "Closed", color: "#10B981" },
  { v: "lost", label: "Lost", color: "#EF4444" },
];

export const SOURCES = ["manual", "walk_in", "phone_call", "referral", "99acres", "magicbricks", "housing", "nobroker", "facebook", "instagram", "youtube", "whatsapp", "website"];

export const TEMP = {
  hot: { label: "Hot", cls: "bg-red-100 text-red-700" },
  warm: { label: "Warm", cls: "bg-amber-100 text-amber-700" },
  cold: { label: "Cold", cls: "bg-sky-100 text-sky-700" },
  closed: { label: "Won", cls: "bg-emerald-100 text-emerald-700" },
  lost: { label: "Lost", cls: "bg-gray-200 text-gray-600" },
};

export const stageOf = (v) => STAGES.find(s => s.v === v) || STAGES[0];

// "+919830012345" -> "919830012345" (what wa.me wants)
export const waNumber = (phone) => String(phone || "").replace(/\D/g, "");
export const telLink = (phone) => `tel:${String(phone || "").replace(/[^\d+]/g, "")}`;
export const waLink = (phone, text) => `https://wa.me/${waNumber(phone)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

export function fillTemplate(text, lead, me = "Ayan") {
  return String(text || "")
    .replaceAll("{name}", (lead.name || "").split(" ")[0] || "there")
    .replaceAll("{property}", lead.property_interest || "the property")
    .replaceAll("{me}", me);
}

export const inrShort = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2).replace(/\.?0+$/, "")} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1).replace(/\.0$/, "")} L`;
  return v ? `₹${v.toLocaleString("en-IN")}` : "₹0";
};

export const when = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "");

export function ago(iso) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

// when a follow-up is due, in words
export function dueLabel(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const diff = d.getTime() - Date.now();
  const sameDay = d.toDateString() === new Date().toDateString();
  if (diff < 0) return { text: `Overdue · ${ago(iso)}`, tone: "bad" };
  if (sameDay) return { text: `Today ${d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`, tone: "warn" };
  return { text: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), tone: "ok" };
}

// value for <input type="datetime-local"> from an ISO string, and back
export const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

// presets for the follow-up buttons: 9 AM that many days ahead
export function followUpIn(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}
