import { useState } from "react";
import { MessageCircle, Phone, Share2 } from "lucide-react";
import LeadMini from "@/components/common/LeadMini";
import { api } from "@/lib/api";
import { waLink } from "@/lib/config";

// Under a calculator: send the numbers to your own WhatsApp or a family member (the message carries a branded link back to the tool),
// ask Ayan about them, or leave a number and get a call. `lines` are plain sentences with the results.
export default function ShareResults({ title, lines }) {
  const [open, setOpen] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : "";
  const text = `${title}\n${lines.join("\n")}\n\nWorked out with Urbanex Realty, Burdwan: ${url}`;
  const summary = `${title}: ${lines.join("; ")}`.slice(0, 280);
  return (
    <div className="mt-6 rounded-2xl border border-urbanex-gold/40 bg-urbanex-gold/10 p-5" data-testid="share-results">
      <div className="font-display text-2xl text-urbanex-navy">Keep these numbers</div>
      <p className="text-sm text-urbanex-navy/65">Send them to your WhatsApp, or to family who will decide with you.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" data-testid="share-whatsapp" className="inline-flex items-center gap-2 rounded-full bg-[#25D366] text-white px-5 py-2.5 text-sm"><Share2 className="w-4 h-4"/> Send to my WhatsApp</a>
        <a href={waLink(`Hi Ayan, I worked this out on your website:\n${lines.join("\n")}\nCan you help me with it?`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-urbanex-navy/25 px-5 py-2.5 text-sm"><MessageCircle className="w-4 h-4"/> Ask Ayan about this</a>
        <button type="button" onClick={() => setOpen(true)} data-testid="share-call" className="inline-flex items-center gap-2 rounded-full border border-urbanex-navy/25 px-5 py-2.5 text-sm"><Phone className="w-4 h-4"/> Call me about this</button>
      </div>
      <LeadMini open={open} onClose={() => setOpen(false)} testId="share-call-dialog" title="Shall Ayan call you?" intro={summary} cta="Call me"
        doneTitle="Thank you" doneText="Ayan will call you about these numbers."
        onSubmit={async (p) => (await api.post("/enquiry/quick", { ...p, kind: "general", note: summary })).data}/>
    </div>
  );
}
