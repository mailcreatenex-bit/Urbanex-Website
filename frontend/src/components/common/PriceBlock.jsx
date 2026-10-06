import { HandHeart } from "lucide-react";
import { useViewer } from "@/context/ViewerContext";
import { useI18n } from "@/context/I18nContext";
import { inr } from "@/lib/config";

export function priceDropped(info) {
  return !!info?.price_drop_at && Date.now() - new Date(info.price_drop_at).getTime() < 14 * 86400000;
}

// Shows the unlocked price, or an "Interested" button that unlocks it. type: "property" | "video".
// item: the property ({id,title}) or video ({video_id,title}). size: "card" | "detail".
export default function PriceBlock({ type, item, size = "card", testId }) {
  const { unlocked, press, busyKey } = useViewer();
  const { t } = useI18n();
  const id = type === "video" ? item.video_id : item.id;
  const info = unlocked(type, id);
  const big = size === "detail" ? "text-4xl" : "text-3xl";

  if (info) {
    return (
      <div data-testid={testId || `price-${type}-${id}`}>
        <div className="text-[10px] tracking-[0.28em] uppercase text-urbanex-gold">{t("card.askPrice")}</div>
        {info.price_inr ? (
          <div className={`font-display ${big} text-urbanex-navy`}>{inr(info.price_inr)}{item?.listing_type === "rent" && <span className="text-sm font-sans text-urbanex-navy/60"> / month</span>}</div>
        ) : (
          <div className="text-sm text-urbanex-navy/70 max-w-[16rem]">{t("interest.onRequest")}</div>
        )}
        {priceDropped(info) && <div className="mt-1 inline-block text-[10px] tracking-[0.2em] uppercase bg-red-50 text-red-700 rounded-full px-2.5 py-0.5">{t("watch.priceDrop")}</div>}
      </div>
    );
  }
  return (
    <div>
      <div className="text-[10px] tracking-[0.28em] uppercase text-urbanex-gold">{t("card.askPrice")}</div>
      <button type="button" onClick={() => press(type, item)} disabled={busyKey === `${type}:${id}`} data-testid={testId || `interested-${type}-${id}`}
        className="mt-1.5 inline-flex items-center gap-2 bg-urbanex-gold hover:bg-urbanex-goldHover text-urbanex-navy rounded-full px-5 py-2 text-sm font-medium transition-colors disabled:opacity-60">
        <HandHeart className="w-4 h-4"/> {t("interest.btn")}
      </button>
      <div className="mt-1 text-[11px] text-urbanex-navy/45">{t("interest.hint")}</div>
    </div>
  );
}
