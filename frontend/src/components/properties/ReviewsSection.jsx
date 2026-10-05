import { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";

export const Stars = ({ n, size = "w-4 h-4" }) => (
  <span className="inline-flex" aria-label={`${n} out of 5`}>
    {[1, 2, 3, 4, 5].map(i => <Star key={i} className={`${size} ${i <= Math.round(n) ? "fill-urbanex-gold text-urbanex-gold" : "text-urbanex-navy/20"}`}/>)}
  </span>
);

// Reviews are moderated: a signed-in user submits, an admin approves before it shows.
export default function ReviewsSection({ propertyId }) {
  const { user, setLoginOpen } = useAuth();
  const { t } = useI18n();
  const [data, setData] = useState({ summary: { count: 0, average: null }, items: [] });
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get("/reviews", { params: propertyId ? { property_id: propertyId } : {} })
      .then(r => setData(r.data)).catch(() => {});
  }, [propertyId]);
  useEffect(load, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/reviews", { rating, text, property_id: propertyId || null });
      toast.success(t("reviews.pending"));
      setOpen(false); setText("");
    } catch (err) {
      const d = err?.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "Could not submit review");
    } finally { setBusy(false); }
  };

  return (
    <section className="mt-12" data-testid="reviews">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <h2 className="font-display text-3xl text-urbanex-navy">{t("reviews.title")}</h2>
        {data.summary.count > 0 && (
          <div className="flex items-center gap-2 text-sm text-urbanex-navy/70">
            <Stars n={data.summary.average}/> {data.summary.average} · {data.summary.count}
          </div>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {data.items.length === 0 && <div className="text-sm text-urbanex-navy/50">{t("reviews.none")}</div>}
        {data.items.map(r => (
          <div key={r.id} className="bg-white rounded-xl border border-urbanex-navy/10 p-5">
            <div className="flex items-center justify-between">
              <span className="font-medium text-urbanex-navy">{r.name}</span>
              <Stars n={r.rating}/>
            </div>
            <p className="mt-2 text-sm text-urbanex-navy/75 leading-relaxed whitespace-pre-line">{r.text}</p>
          </div>
        ))}
      </div>

      {!open ? (
        <button onClick={() => (user ? setOpen(true) : setLoginOpen(true))} data-testid="review-write"
          className="mt-5 text-sm text-urbanex-navy underline decoration-urbanex-gold underline-offset-4">
          {user ? t("reviews.write") : t("reviews.signin")}
        </button>
      ) : (
        <form onSubmit={submit} className="mt-5 bg-white rounded-xl border border-urbanex-navy/10 p-5 space-y-3">
          <div className="flex items-center gap-1" role="radiogroup" aria-label={t("reviews.rating")}>
            {[1, 2, 3, 4, 5].map(i => (
              <button type="button" key={i} role="radio" aria-checked={rating === i} onClick={() => setRating(i)}>
                <Star className={`w-6 h-6 ${i <= rating ? "fill-urbanex-gold text-urbanex-gold" : "text-urbanex-navy/20"}`}/>
              </button>
            ))}
          </div>
          <textarea required minLength={10} maxLength={1500} rows={4} value={text} onChange={(e) => setText(e.target.value)}
            placeholder={t("reviews.text")} className="w-full border border-urbanex-navy/15 rounded-lg px-3 py-2 text-sm"/>
          <div className="flex gap-2">
            <button disabled={busy} className="bg-urbanex-navy text-urbanex-ivory px-5 py-2 rounded-full text-sm disabled:opacity-50">{t("reviews.submit")}</button>
            <button type="button" onClick={() => setOpen(false)} className="text-sm text-urbanex-navy/60 px-3">{t("common.cancel")}</button>
          </div>
        </form>
      )}
    </section>
  );
}
