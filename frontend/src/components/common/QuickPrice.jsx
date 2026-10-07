import { useState } from "react";
import { MessageCircle } from "lucide-react";
import LeadMini from "@/components/common/LeadMini";
import { api } from "@/lib/api";

// "WhatsApp me the price": name and number only, no sign-in. `type` is "property" or "video"; `item` carries the id.
export default function QuickPrice({ type, item, className = "" }) {
  const [open, setOpen] = useState(false);
  const ref = type === "video" ? item.video_id : item.slug || item.id;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid="quick-price" className={`inline-flex items-center gap-1.5 text-sm text-[#128C7E] hover:underline underline-offset-4 ${className}`}>
        <MessageCircle className="w-4 h-4"/> Or WhatsApp me the price
      </button>
      <LeadMini open={open} onClose={() => setOpen(false)} testId="quick-price-dialog" title="We will WhatsApp you the price" intro={item.title}
        cta="Send me the price" doneTitle="On its way" doneText="Ayan will send the price and details on WhatsApp. You can also message him right now."
        onSubmit={async (p) => (await api.post("/enquiry/quick", { ...p, kind: type, ref_id: ref })).data}/>
    </>
  );
}
