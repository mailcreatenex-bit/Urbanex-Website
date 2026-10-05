import { Link } from "react-router-dom";
import { ArrowRight, Compass, Globe2 } from "lucide-react";
import { useI18n } from "@/context/I18nContext";

export default function HomeCtas() {
  const { t } = useI18n();
  const cards = [
    { to: "/zone-quiz", icon: Compass, title: t("cta.quiz.title"), body: t("cta.quiz.body"), btn: t("cta.quiz.btn"), tid: "cta-quiz", dark: false },
    { to: "/nri", icon: Globe2, title: t("cta.nri.title"), body: t("cta.nri.body"), btn: t("cta.nri.btn"), tid: "cta-nri", dark: true },
  ];
  return (
    <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 grid md:grid-cols-2 gap-6">
      {cards.map(c => (
        <Link key={c.to} to={c.to} data-testid={c.tid}
          className={`group rounded-3xl p-8 md:p-10 flex flex-col justify-between min-h-[260px] transition-transform hover:-translate-y-1 ${c.dark ? "bg-urbanex-navy text-urbanex-ivory" : "bg-urbanex-cream text-urbanex-navy border border-urbanex-navy/5"}`}>
          <div>
            <c.icon className="w-8 h-8 text-urbanex-gold"/>
            <h3 className="mt-5 font-display text-3xl leading-tight text-balance">{c.title}</h3>
            <p className={`mt-3 text-sm leading-relaxed max-w-md ${c.dark ? "text-urbanex-ivory/70" : "text-urbanex-navy/70"}`}>{c.body}</p>
          </div>
          <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-urbanex-gold">{c.btn} <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1"/></div>
        </Link>
      ))}
    </section>
  );
}
