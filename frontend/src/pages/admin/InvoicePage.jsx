import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ADMIN } from "@/constants/testIds";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { FileDown, FileText } from "lucide-react";

const inr = (n) => `₹ ${new Intl.NumberFormat("en-IN").format(n)}`;

function generatePdf(inv) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = 595, H = 842;

  // Navy header band
  doc.setFillColor(10, 18, 37);
  doc.rect(0, 0, W, 130, "F");
  // Gold accent line
  doc.setFillColor(197, 160, 89);
  doc.rect(0, 130, W, 3, "F");

  // Brand mark
  doc.setTextColor(197, 160, 89);
  doc.setFont("times", "italic");
  doc.setFontSize(30);
  doc.text("Urbanex", 40, 55);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(253, 251, 247);
  doc.text("REALTY · BURDWAN", 40, 74);

  doc.setFontSize(9);
  doc.setTextColor(220, 216, 200);
  doc.text("Ayan Dey · Founder", 40, 100);
  doc.text("hello@urbanex.in · +91 99333 33333", 40, 114);

  // Invoice title
  doc.setTextColor(197, 160, 89);
  doc.setFontSize(9);
  doc.text("INVOICE", W - 40, 55, { align: "right" });
  doc.setTextColor(253, 251, 247);
  doc.setFontSize(18);
  doc.setFont("times", "italic");
  doc.text(inv.invoice_number, W - 40, 76, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(new Date(inv.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }), W - 40, 92, { align: "right" });

  // Bill to
  let y = 180;
  doc.setTextColor(10, 18, 37);
  doc.setFontSize(9);
  doc.text("BILLED TO", 40, y);
  y += 18;
  doc.setFontSize(14);
  doc.setFont("times", "normal");
  doc.text(inv.client_name, 40, y);
  y += 16;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (inv.client_email) { doc.text(inv.client_email, 40, y); y += 14; }
  if (inv.client_phone) { doc.text(inv.client_phone, 40, y); y += 14; }

  // Property block
  y = 300;
  doc.setDrawColor(197, 160, 89);
  doc.setLineWidth(0.5);
  doc.line(40, y, W - 40, y);
  y += 24;
  doc.setFontSize(9);
  doc.setTextColor(197, 160, 89);
  doc.text("PROPERTY", 40, y);
  y += 16;
  doc.setTextColor(10, 18, 37);
  doc.setFontSize(13);
  doc.setFont("times", "normal");
  doc.text(inv.property_title, 40, y);
  y += 30;

  doc.setFontSize(9);
  doc.setTextColor(197, 160, 89);
  doc.setFont("helvetica", "normal");
  doc.text("PAYMENT SCHEDULE", 40, y);
  y += 16;
  doc.setTextColor(10, 18, 37);
  doc.setFontSize(11);
  const scheduleLines = doc.splitTextToSize(inv.payment_schedule, W - 80);
  doc.text(scheduleLines, 40, y);
  y += scheduleLines.length * 14 + 20;

  if (inv.notes) {
    doc.setFontSize(9);
    doc.setTextColor(197, 160, 89);
    doc.text("NOTES", 40, y); y += 14;
    doc.setTextColor(10, 18, 37);
    doc.setFontSize(10);
    const nl = doc.splitTextToSize(inv.notes, W - 80);
    doc.text(nl, 40, y);
    y += nl.length * 13 + 10;
  }

  // Amount block (navy)
  const boxY = H - 260;
  doc.setFillColor(10, 18, 37);
  doc.rect(40, boxY, W - 80, 110, "F");
  doc.setFillColor(197, 160, 89);
  doc.rect(40, boxY, 4, 110, "F");

  doc.setFontSize(9);
  doc.setTextColor(197, 160, 89);
  doc.text("TOTAL AMOUNT", 65, boxY + 30);
  doc.setFontSize(30);
  doc.setFont("times", "italic");
  doc.setTextColor(253, 251, 247);
  doc.text(inr(inv.amount_inr), 65, boxY + 75);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(220, 216, 200);
  doc.text("No GST applicable · Advisory service", 65, boxY + 95);

  // Signature block
  const sigY = H - 130;
  doc.setDrawColor(10, 18, 37);
  doc.setLineWidth(0.3);
  doc.line(40, sigY, 220, sigY);
  doc.line(W - 220, sigY, W - 40, sigY);
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text("Client signature", 40, sigY + 14);
  doc.text("Ayan Dey · Urbanex Realty", W - 40, sigY + 14, { align: "right" });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Urbanex Realty · Burdwan, West Bengal, India · hello@urbanex.in", W / 2, H - 30, { align: "center" });

  doc.save(`${inv.invoice_number}.pdf`);
}

export default function InvoicePage() {
  const [invoices, setInvoices] = useState([]);
  const [form, setForm] = useState({ client_name: "", client_email: "", client_phone: "", property_title: "", amount_inr: "", payment_schedule: "50% booking · 30% at agreement · 20% at registration", notes: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const load = () => api.get("/admin/invoices").then(r => setInvoices(r.data || []));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!form.client_name || !form.property_title || !form.amount_inr) {
      toast.error("Client, property and amount are required.");
      return;
    }
    setBusy(true);
    try {
      const payload = { ...form, amount_inr: Number(form.amount_inr) };
      const { data } = await api.post("/admin/invoices", payload);
      toast.success(`Invoice ${data.invoice_number} created`);
      generatePdf(data);
      setForm({ client_name: "", client_email: "", client_phone: "", property_title: "", amount_inr: "", payment_schedule: "50% booking · 30% at agreement · 20% at registration", notes: "" });
      load();
    } catch { toast.error("Create failed"); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div className="text-xs tracking-[0.28em] uppercase text-urbanex-gold">CRM · Invoices</div>
      <h1 className="font-display text-4xl text-urbanex-navy tracking-tight mt-1">Branded invoices, one click.</h1>

      <div className="mt-8 grid md:grid-cols-5 gap-6">
        <form onSubmit={create} className="md:col-span-2 bg-white rounded-2xl p-6 border border-urbanex-navy/10 space-y-3">
          <Input data-testid={ADMIN.invoiceClient} placeholder="Client name" value={form.client_name} onChange={set("client_name")} className="h-11 bg-urbanex-cream border-urbanex-navy/10 rounded-lg"/>
          <Input data-testid={ADMIN.invoiceEmail} placeholder="Client email" value={form.client_email} onChange={set("client_email")} className="h-11 bg-urbanex-cream border-urbanex-navy/10 rounded-lg"/>
          <Input placeholder="Client phone" value={form.client_phone} onChange={set("client_phone")} className="h-11 bg-urbanex-cream border-urbanex-navy/10 rounded-lg"/>
          <Input data-testid={ADMIN.invoiceProperty} placeholder="Property title" value={form.property_title} onChange={set("property_title")} className="h-11 bg-urbanex-cream border-urbanex-navy/10 rounded-lg"/>
          <Input data-testid={ADMIN.invoiceAmount} type="number" placeholder="Amount in ₹" value={form.amount_inr} onChange={set("amount_inr")} className="h-11 bg-urbanex-cream border-urbanex-navy/10 rounded-lg"/>
          <Textarea data-testid={ADMIN.invoiceSchedule} placeholder="Payment schedule" value={form.payment_schedule} onChange={set("payment_schedule")} className="bg-urbanex-cream border-urbanex-navy/10 rounded-lg" rows={3}/>
          <Textarea placeholder="Notes (optional)" value={form.notes} onChange={set("notes")} className="bg-urbanex-cream border-urbanex-navy/10 rounded-lg" rows={2}/>
          <Button data-testid={ADMIN.invoiceCreate} disabled={busy} type="submit" className="w-full bg-urbanex-navy text-urbanex-ivory rounded-full h-11">
            <FileText className="w-4 h-4 mr-1"/> Create & download PDF
          </Button>
        </form>

        <div className="md:col-span-3">
          <div className="text-xs tracking-[0.28em] uppercase text-urbanex-gold mb-3">Recent invoices</div>
          <div data-testid={ADMIN.invoiceList} className="space-y-3">
            {invoices.map(inv => (
              <div key={inv.id} className="bg-white rounded-xl p-5 border border-urbanex-navy/10 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs text-urbanex-gold">{inv.invoice_number}</div>
                  <div className="font-display text-lg text-urbanex-navy mt-0.5 truncate">{inv.client_name} · {inv.property_title}</div>
                  <div className="text-xs text-urbanex-navy/50 mt-0.5">{(inv.created_at || "").slice(0,10)} · {inr(inv.amount_inr)}</div>
                </div>
                <Button data-testid={ADMIN.invoiceGenerate(inv.id)} onClick={() => generatePdf(inv)} variant="outline" className="border-urbanex-gold text-urbanex-navy rounded-full">
                  <FileDown className="w-4 h-4 mr-1"/> PDF
                </Button>
              </div>
            ))}
            {!invoices.length && <div className="p-10 text-center text-urbanex-navy/40 bg-white rounded-xl border border-dashed border-urbanex-navy/15">No invoices yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
