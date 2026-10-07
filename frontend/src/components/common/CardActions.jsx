import { MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/context/I18nContext";
import { shareUrl, waLink } from "@/lib/config";

// The two buttons on every property and video card. "WhatsApp" opens a chat with Ayan with the listing's link already typed in, so the
// message lands in his WhatsApp inbox ready to answer. "Share" hands the same link to the phone's share sheet, or copies it.
// `kind` is the share route: "properties" or "videos".
export default function CardActions({ kind, id, title, zone }) {
  const { t } = useI18n();
  const link = shareUrl(kind, id);
  const subject = `${title}${zone ? `, ${zone}` : ""}`;
  const chat = waLink(`Hi Ayan, I am interested in ${subject}.\n${link}`);
  const share = async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (navigator.share) { try { await navigator.share({ title, text: `${subject} (Urbanex Realty, Burdwan)`, url: link }); } catch { /* dismissed */ } return; }
    try { await navigator.clipboard.writeText(link); toast.success(t("share.copied")); } catch { toast.message(link); }
  };
  const base = "inline-flex items-center justify-center gap-1.5 rounded-full text-xs font-medium px-3.5 py-2 transition-colors";
  return (
    <div className="mt-4 flex gap-2" data-testid={`card-actions-${id}`}>
      <a href={chat} target="_blank" rel="noopener noreferrer" data-testid={`card-whatsapp-${id}`} aria-label={`WhatsApp Ayan about ${title}`}
        className={`${base} flex-1 bg-[#25D366] hover:bg-[#1fb857] text-white`}><MessageCircle className="w-4 h-4"/> {t("card.whatsapp")}</a>
      <button type="button" onClick={share} data-testid={`card-share-${id}`} aria-label={`Share ${title}`}
        className={`${base} border border-urbanex-navy/15 hover:border-urbanex-gold text-urbanex-navy/80`}><Share2 className="w-4 h-4"/> {t("card.share")}</button>
    </div>
  );
}
