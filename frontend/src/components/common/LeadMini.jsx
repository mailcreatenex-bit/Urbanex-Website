import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Turnstile, { TURNSTILE_ENABLED } from "@/components/common/Turnstile";
import { checkPhone, apiError } from "@/lib/phone";
import { useAuth } from "@/context/AuthContext";

const inp = "w-full h-12 rounded-xl border border-urbanex-navy/15 bg-white px-4 text-sm placeholder:text-urbanex-navy/40";

// A small "your name and number" pop-up used by the quick enquiry buttons. `onSubmit({ name, phone, turnstile_token })` talks to the server and may
// return { whatsapp } to offer a one-tap WhatsApp chat afterwards. Once a visitor has left details anywhere, other offers stay quiet for the visit.
export default function LeadMini({ open, onClose, title, intro, cta = "Send", onSubmit, doneTitle = "Thank you", doneText, testId = "lead-mini" }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [ts, setTs] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => { if (open) { setDone(null); setName((n) => n || user?.name || ""); } }, [open, user]);

  const submit = async (e) => {
    e.preventDefault();
    const ph = checkPhone(phone);
    if (name.trim().length < 2) { toast.error("Please tell us your name"); return; }
    if (!ph.ok) { toast.error(ph.error); return; }
    setBusy(true);
    try {
      const data = await onSubmit({ name: name.trim(), phone: ph.value, turnstile_token: ts || undefined });
      try { sessionStorage.setItem("urbanex_lead_given", "1"); } catch { /* ignore */ }
      setDone(data || {});
    } catch (er) { toast.error(apiError(er, "Could not send. Please try again, or WhatsApp Ayan.")); }
    finally { setBusy(false); setTs(""); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md bg-urbanex-ivory" data-testid={testId}>
        {done ? (
          <div className="text-center py-4" data-testid={`${testId}-done`}>
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto"/>
            <h3 className="mt-3 font-display text-3xl text-urbanex-navy">{doneTitle}</h3>
            <p className="mt-2 text-sm text-urbanex-navy/70">{doneText}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {done.whatsapp && <a href={done.whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[#25D366] text-white px-5 py-2.5 text-sm"><MessageCircle className="w-4 h-4"/> Chat with Ayan now</a>}
              <button type="button" onClick={onClose} className="rounded-full border border-urbanex-navy/20 px-5 py-2.5 text-sm">Close</button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-3xl text-urbanex-navy">{title}</DialogTitle>
              {intro && <DialogDescription className="text-urbanex-navy/65">{intro}</DialogDescription>}
            </DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" className={inp} data-testid={`${testId}-name`}/>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone / WhatsApp number" inputMode="tel" autoComplete="tel" className={inp} data-testid={`${testId}-phone`}/>
              <Turnstile value={ts} onChange={setTs}/>
              <button disabled={busy || (TURNSTILE_ENABLED && !ts)} data-testid={`${testId}-send`} className="w-full h-12 rounded-full bg-urbanex-gold hover:bg-urbanex-goldHover text-urbanex-navy font-medium disabled:opacity-60">{busy ? "Sending…" : cta}</button>
              <p className="text-[11px] text-urbanex-navy/45 text-center">Only Ayan sees your number. No spam, and you can say stop at any time.</p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
