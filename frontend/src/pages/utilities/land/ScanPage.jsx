import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Camera, FileDown, ImagePlus, Trash2 } from "lucide-react";
import LandShell from "@/pages/utilities/LandShell";
import { useSeo } from "@/lib/seo";

// Shrink a photo (max 1600 px) and turn it into a data URL, optionally as a high-contrast black and white "scan".
async function prepare(file, scanLook) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext("2d");
  if (scanLook) ctx.filter = "grayscale(1) contrast(1.45) brightness(1.08)";
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}

export default function ScanPage() {
  useSeo({ title: "Document scanner for land papers", description: "Photograph deeds, khatian copies and receipts with your phone and save them as one PDF. Nothing leaves your phone." });
  const [pages, setPages] = useState([]);
  const [scanLook, setScanLook] = useState(true);
  const [busy, setBusy] = useState(false);
  const cam = useRef(null), gal = useRef(null);

  const add = async (files) => {
    setBusy(true);
    try {
      const out = [];
      for (const f of files) out.push(await prepare(f, scanLook));
      setPages(p => [...p, ...out]);
    } catch { toast.error("Could not read that photo"); } finally { setBusy(false); if (cam.current) cam.current.value = ""; if (gal.current) gal.current.value = ""; }
  };
  const move = (i, d) => setPages(p => { const n = [...p]; const j = i + d; if (j < 0 || j >= n.length) return p; [n[i], n[j]] = [n[j], n[i]]; return n; });

  // a clean print view, one photo per A4 page: choose "Save as PDF" in the print dialog
  const savePdf = () => {
    const w = window.open("", "_blank");
    if (!w) return toast.error("Allow pop-ups for this site to save the PDF");
    w.document.write(`<!doctype html><title>Documents</title><style>@page{size:A4;margin:8mm}body{margin:0}img{display:block;width:100%;max-height:277mm;object-fit:contain;page-break-after:always}</style>${pages.map(src => `<img src="${src}">`).join("")}`);
    w.document.close();
    w.onload = () => w.print();
    setTimeout(() => { try { w.print(); } catch { /* the window may already be printing */ } }, 800);
  };

  return (
    <LandShell title="Document scanner" intro="Photograph your deed, khatian copy or tax receipts, and save them together as one PDF to send or keep. Everything stays on your phone.">
      <div className="rounded-2xl bg-white border border-urbanex-navy/5 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => cam.current?.click()} disabled={busy} data-testid="scan-camera" className="inline-flex items-center gap-2 rounded-full bg-urbanex-navy text-urbanex-ivory px-6 py-3 text-sm disabled:opacity-50"><Camera className="w-4 h-4"/> Take a photo</button>
          <button type="button" onClick={() => gal.current?.click()} disabled={busy} className="inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm hover:border-urbanex-gold"><ImagePlus className="w-4 h-4"/> Choose from gallery</button>
          <label className="inline-flex items-center gap-2 text-sm text-urbanex-navy/70"><input type="checkbox" checked={scanLook} onChange={(e) => setScanLook(e.target.checked)} className="accent-[#C5A059]"/> Black and white “scan” look</label>
          <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => add([...e.target.files])}/>
          <input ref={gal} type="file" accept="image/*" multiple className="hidden" onChange={(e) => add([...e.target.files])} data-testid="scan-gallery"/>
        </div>
        {busy && <p className="mt-3 text-sm text-urbanex-navy/50">Preparing…</p>}
        {pages.length > 0 ? (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4" data-testid="scan-pages">
            {pages.map((src, i) => (
              <div key={i} className="rounded-xl border bg-urbanex-cream p-2">
                <img src={src} alt={`Page ${i + 1}`} className="w-full aspect-[3/4] object-contain rounded bg-white"/>
                <div className="mt-2 flex items-center justify-between text-xs"><span>Page {i + 1}</span>
                  <span className="flex gap-1"><button type="button" aria-label="Move up" onClick={() => move(i, -1)} className="p-1 hover:text-urbanex-gold"><ArrowUp className="w-4 h-4"/></button><button type="button" aria-label="Move down" onClick={() => move(i, 1)} className="p-1 hover:text-urbanex-gold"><ArrowDown className="w-4 h-4"/></button><button type="button" aria-label="Remove" onClick={() => setPages(pages.filter((_, j) => j !== i))} className="p-1 hover:text-red-600"><Trash2 className="w-4 h-4"/></button></span></div>
              </div>
            ))}
          </div>
        ) : <div className="mt-6 rounded-xl border-2 border-dashed p-12 text-center text-urbanex-navy/45 text-sm">No pages yet. Lay the paper flat in good light and take a photo.</div>}
        {pages.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={savePdf} data-testid="scan-pdf" className="inline-flex items-center gap-2 rounded-full bg-urbanex-gold text-urbanex-navy px-6 py-3 text-sm font-medium"><FileDown className="w-4 h-4"/> Save as PDF ({pages.length} page{pages.length > 1 ? "s" : ""})</button>
            <button type="button" onClick={() => setPages([])} className="text-sm text-urbanex-navy/50 px-3">Clear all</button>
          </div>
        )}
        <p className="mt-4 text-xs text-urbanex-navy/45">When the print window opens, choose “Save as PDF” as the printer. Photos are processed on your device and are never uploaded. They disappear when you close this page.</p>
      </div>
    </LandShell>
  );
}
