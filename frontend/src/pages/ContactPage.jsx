import PrivacyConsent from "@/components/common/PrivacyConsent";
import { useState } from "react";
import { api } from "@/lib/api";
import { waLink } from "@/lib/config";
import Turnstile, { TURNSTILE_ENABLED } from "@/components/common/Turnstile";
import { checkPhone, apiError } from "@/lib/phone";
import { toast } from "sonner";
import { Mail, Phone, MessageCircle, MapPin } from "lucide-react";
import { CONTACT } from "@/constants/testIds";
import { FOUNDER_IMAGES, FOUNDER_BIO } from "@/constants/seedData";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", phone: "", email: "", property_interest: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [ts, setTs] = useState("");

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || (!form.phone.trim() && !form.email.trim())) {
      toast.error("Please share your name and phone or email.");
      return;
    }
    let phoneValue = null;
    if (form.phone.trim()) {
      const ph = checkPhone(form.phone);
      if (!ph.ok) { toast.error(ph.error); return; }
      phoneValue = ph.value;
    }
    setBusy(true);
    try {
      await api.post("/leads", { ...form, phone: phoneValue, email: form.email.trim() || null, source_page: "contact", turnstile_token: ts || undefined });
      toast.success("Thanks — Ayan will reach out within 24 hours.");
      setForm({ name: "", phone: "", email: "", property_interest: "", message: "" });
    } catch (err) {
      toast.error(apiError(err, "Couldn't submit right now. Please WhatsApp Ayan directly."));
    } finally {
      setBusy(false);
      setTs("");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-4">Get in touch</div>
      <h1 className="font-display text-5xl md:text-6xl text-urbanex-navy leading-[1.02] tracking-tight max-w-3xl text-balance">
        The best conversations happen <em className="italic text-urbanex-gold">before</em> the paperwork.
      </h1>

      <div className="mt-14 grid md:grid-cols-12 gap-12">
        {/* Form */}
        <form data-testid={CONTACT.form} onSubmit={submit} className="md:col-span-7 bg-white rounded-3xl border border-urbanex-navy/10 p-8 md:p-10">
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="text-xs tracking-[0.24em] uppercase text-urbanex-navy/60">Your name</label>
              <Input data-testid={CONTACT.name} value={form.name} onChange={set("name")} placeholder="Full name" className="mt-2 bg-urbanex-cream border-urbanex-navy/10 h-12 rounded-lg"/>
            </div>
            <div>
              <label className="text-xs tracking-[0.24em] uppercase text-urbanex-navy/60">Phone (Whatsapp)</label>
              <Input data-testid={CONTACT.phone} value={form.phone} onChange={set("phone")} placeholder="+91" className="mt-2 bg-urbanex-cream border-urbanex-navy/10 h-12 rounded-lg"/>
            </div>
            <div>
              <label className="text-xs tracking-[0.24em] uppercase text-urbanex-navy/60">Email</label>
              <Input data-testid={CONTACT.email} type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" className="mt-2 bg-urbanex-cream border-urbanex-navy/10 h-12 rounded-lg"/>
            </div>
            <div>
              <label className="text-xs tracking-[0.24em] uppercase text-urbanex-navy/60">What you're looking for</label>
              <Input data-testid={CONTACT.interest} value={form.property_interest} onChange={set("property_interest")} placeholder="e.g. 3BHK in Nawabhat, plot in Borehat" className="mt-2 bg-urbanex-cream border-urbanex-navy/10 h-12 rounded-lg"/>
            </div>
          </div>
          <div className="mt-5">
            <label className="text-xs tracking-[0.24em] uppercase text-urbanex-navy/60">Message</label>
            <Textarea data-testid={CONTACT.message} value={form.message} onChange={set("message")} rows={5} placeholder="Tell us your budget, timeline and any specifics." className="mt-2 bg-urbanex-cream border-urbanex-navy/10 rounded-lg"/>
          </div>
          <div className="mt-6"><Turnstile value={ts} onChange={setTs}/></div>
          <PrivacyConsent tone="light"/>
      <Button data-testid={CONTACT.submit} disabled={busy || (TURNSTILE_ENABLED && !ts)} type="submit" className="mt-8 bg-urbanex-navy hover:bg-urbanex-navyLight text-urbanex-ivory rounded-full h-12 px-8">
            {busy ? "Sending…" : "Request a callback"}
          </Button>

          <div className="mt-8 pt-6 border-t border-urbanex-navy/10 flex flex-wrap gap-6 text-sm text-urbanex-navy/70">
            <span className="flex items-center gap-2"><Phone className="w-4 h-4 text-urbanex-gold"/> +91 99333 33333</span>
            <span className="flex items-center gap-2"><Mail className="w-4 h-4 text-urbanex-gold"/> hello@urbanex.in</span>
            <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-urbanex-gold"/> Burdwan, WB</span>
          </div>
        </form>

        {/* Founder side card */}
        <aside className="md:col-span-5">
          <div className="bg-urbanex-navy rounded-3xl overflow-hidden text-urbanex-ivory">
            <div className="aspect-[4/5] relative">
              <img src={FOUNDER_IMAGES.office} alt="Ayan Dey — Meet the founder" width="1100" height="1094" decoding="async" className="w-full h-full object-cover object-[50%_30%]"/>
              <div className="absolute inset-0 bg-gradient-to-t from-urbanex-navy via-urbanex-navy/40 to-transparent"/>
              <div className="absolute bottom-6 left-6 right-6">
                <div className="text-[10px] tracking-[0.28em] uppercase text-urbanex-gold mb-2">Meet the founder</div>
                <div className="font-display text-4xl leading-tight">Ayan Dey</div>
                <div className="text-sm text-urbanex-ivory/70 mt-1">Founder · Urbanex Realty</div>
              </div>
            </div>
            <div className="p-8">
              <p className="text-urbanex-ivory/80 leading-relaxed text-sm">{FOUNDER_BIO}</p>
              <a
                data-testid={CONTACT.whatsapp}
                href={waLink("Hi Ayan, I found Urbanex online and wanted to talk directly.")}
                target="_blank" rel="noreferrer"
                className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-urbanex-gold hover:bg-urbanex-goldHover text-urbanex-navy py-3 rounded-full text-sm font-medium transition-colors"
              >
                <MessageCircle className="w-4 h-4"/> WhatsApp Ayan directly
              </a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
