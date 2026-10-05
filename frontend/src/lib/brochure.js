import jsPDF from "jspdf";
import { inrFull } from "@/lib/config";

const NAVY = [10, 18, 37];
const GOLD = [197, 160, 89];

// Text-only A4 brochure (photos are cross-origin, so they are intentionally left out).
// The price is only included for signed-in users, matching the on-site price gate.
export function downloadBrochure(p, { showPrice, url }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = 0;

  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 90, "F");
  doc.setTextColor(...GOLD); doc.setFont("times", "bold"); doc.setFontSize(26); doc.text("URBANEX REALTY", M, 56);
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.text("BURDWAN · WEST BENGAL", W - M, 56, { align: "right" });

  y = 140;
  doc.setTextColor(...NAVY); doc.setFont("times", "bold"); doc.setFontSize(24);
  doc.splitTextToSize(p.title, W - 2 * M).forEach(line => { doc.text(line, M, y); y += 30; });
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(90, 90, 90);
  doc.text(`${p.zone}, Burdwan`, M, y); y += 28;

  if (showPrice && p.price_inr != null) {
    doc.setTextColor(...GOLD); doc.setFont("times", "bold"); doc.setFontSize(22);
    doc.text(inrFull(p.price_inr), M, y); y += 30;
  }

  doc.setTextColor(...NAVY); doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  const facts = [
    ["Type", p.property_type], ["Area", `${p.area_sqft} sqft`],
    p.bedrooms != null && ["Bedrooms", p.bedrooms], p.bathrooms != null && ["Bathrooms", p.bathrooms],
    ["Status", p.status], p.possession && ["Possession", p.possession.replace(/_/g, " ")],
    p.furnishing && ["Furnishing", p.furnishing.replace(/_/g, " ")], p.rera_number && ["RERA No.", p.rera_number],
    p.verified && ["Verification", "Title & documents verified by Urbanex"],
  ].filter(Boolean);
  facts.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold"); doc.text(`${k}:`, M, y);
    doc.setFont("helvetica", "normal"); doc.text(String(v), M + 110, y); y += 18;
  });

  y += 14;
  doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60);
  doc.splitTextToSize(p.description || "", W - 2 * M).forEach(line => { doc.text(line, M, y); y += 15; });

  const list = (title, items) => {
    if (!items?.length) return;
    y += 16; doc.setTextColor(...NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(title, M, y); y += 18;
    doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(60, 60, 60);
    items.forEach(i => { if (y > H - 100) { doc.addPage(); y = 60; } doc.text(`•  ${i}`, M + 6, y); y += 15; });
  };
  list("Highlights", p.highlights);
  list("Amenities", p.amenities);
  list("Nearby (approx. straight-line)", (p.nearby || []).map(n => `${n.name} — ${n.distance_km} km`));

  doc.setFillColor(...GOLD); doc.rect(0, H - 70, W, 70, "F");
  doc.setTextColor(...NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("Book a visit or ask about this property", M, H - 42);
  doc.setFont("helvetica", "normal"); doc.text(url, M, H - 26);

  doc.save(`urbanex-${p.slug || p.id}.pdf`);
}
