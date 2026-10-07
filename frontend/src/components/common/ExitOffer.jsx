import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import LeadMini from "@/components/common/LeadMini";
import { api } from "@/lib/api";

const SEEN = "urbanex_exit_offer";
const PAGE = /^\/properties\/(video\/)?([^/]+)$/;

// On a property or video page: when the visitor moves to leave (cursor leaves through the top of the window), or on a phone after a while
// and a good scroll, offer to message them similar homes. At most once per visit, and never after they have already left their details.
export default function ExitOffer() {
  const { pathname } = useLocation();
  const m = pathname.match(PAGE);
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState({});
  const armed = useRef(false);

  useEffect(() => {
    if (!m) return undefined;
    const used = () => { try { return sessionStorage.getItem(SEEN) === "1" || sessionStorage.getItem("urbanex_lead_given") === "1"; } catch { return false; } };
    if (used()) return undefined;
    armed.current = false;
    let cancelled = false;
    const isVideo = !!m[1], id = m[2];
    const show = () => {
      if (cancelled || used() || !armed.current) return;
      try { sessionStorage.setItem(SEEN, "1"); } catch { /* ignore */ }
      (isVideo ? api.get(`/video-listings/${id}`) : api.get(`/properties/${id}`)).then(r => {
        const d = r.data;
        setFilters({ zone: d.zone || undefined, property_type: d.property_type || undefined, bedrooms: d.bedrooms ?? undefined, listing_type: d.listing_type === "rent" ? "rent" : undefined });
      }).catch(() => {}).finally(() => setOpen(true));
    };
    const arm = setTimeout(() => { armed.current = true; }, 15000);          // not in the first moments
    const leave = (e) => { if (e.clientY <= 0 && !e.relatedTarget) show(); };
    document.addEventListener("mouseout", leave);
    const touch = window.matchMedia("(hover: none)").matches;
    let late;
    if (touch) late = setTimeout(() => { if (window.scrollY > document.documentElement.scrollHeight * 0.4) show(); }, 45000);
    return () => { cancelled = true; clearTimeout(arm); clearTimeout(late); document.removeEventListener("mouseout", leave); };
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <LeadMini open={open} onClose={() => setOpen(false)} testId="exit-offer" title="Before you go: save this" intro="Leave your number and we will WhatsApp you similar homes, and the moment a new one comes up."
      cta="Send me similar homes" doneTitle="Saved" doneText="Ayan will message you similar homes on WhatsApp."
      onSubmit={async (p) => (await api.post("/enquiry/alert", { ...p, source: "exit_offer", ...filters })).data}/>
  );
}
