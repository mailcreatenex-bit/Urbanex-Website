import { Share2, Link2, MessageCircle, FileDown } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/context/I18nContext";
import { useViewer } from "@/context/ViewerContext";
import { shareUrl } from "@/lib/config";

// Shared links point at the API's /share page, which serves Open Graph tags for link previews
// and then redirects people to the real property page.
export default function ShareBar({ property }) {
  const { t } = useI18n();
  const { unlocked } = useViewer();
  const link = shareUrl("properties", property.slug || property.id);
  const text = `${property.title} — ${property.zone}, Burdwan`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast.success(t("share.copied")); }
    catch { toast.error(link); }
  };
  const native = async () => {
    if (navigator.share) { try { await navigator.share({ title: property.title, text, url: link }); } catch { /* dismissed */ } }
    else copy();
  };

  const btn = "inline-flex items-center gap-2 text-xs px-3 py-2 rounded-full border border-urbanex-navy/15 hover:border-urbanex-gold text-urbanex-navy/80";
  return (
    <div className="mt-6 pt-5 border-t border-urbanex-navy/10">
      <div className="text-xs tracking-[0.2em] uppercase text-urbanex-gold mb-3 flex items-center gap-2"><Share2 className="w-3.5 h-3.5"/> {t("share.title")}</div>
      <div className="flex flex-wrap gap-2">
        <a className={btn} target="_blank" rel="noreferrer" data-testid="share-whatsapp"
          href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${link}`)}`}><MessageCircle className="w-3.5 h-3.5"/> {t("share.whatsapp")}</a>
        <button type="button" className={btn} onClick={navigator.share ? native : copy} data-testid="share-copy"><Link2 className="w-3.5 h-3.5"/> {t("share.copy")}</button>
        <button type="button" className={btn} data-testid="share-brochure"
          onClick={async () => { const { downloadBrochure } = await import("@/lib/brochure"); const info = unlocked("property", property.id); downloadBrochure({ ...property, price_inr: info?.price_inr }, { showPrice: !!info?.price_inr, url: `${window.location.origin}/properties/${property.slug || property.id}` }); }}>
          <FileDown className="w-3.5 h-3.5"/> {t("share.brochure")}
        </button>
      </div>
    </div>
  );
}
