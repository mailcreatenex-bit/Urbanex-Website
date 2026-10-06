import { NavLink } from "react-router-dom";
import { Calculator, Camera, Compass, Landmark, Ruler, Scale, Smartphone, Wallet } from "lucide-react";
import { useI18n } from "@/context/I18nContext";

export const UTILITIES = [
  { to: "/utilities/emi", key: "util.emi", icon: Calculator },
  { to: "/utilities/compass", key: "util.compass", icon: Compass },
  { to: "/utilities/gyroscope", key: "util.gyro", icon: Smartphone },
  { to: "/utilities/land-records", key: "util.records", icon: Landmark },
  { to: "/utilities/land-converter", key: "util.converter", icon: Scale },
  { to: "/utilities/plot-area", key: "util.area", icon: Ruler },
  { to: "/utilities/land-value", key: "util.value", icon: Wallet },
  { to: "/utilities/document-scanner", key: "util.scan", icon: Camera },
];

// Common frame: a title and a row of tabs to hop between the tools.
export default function UtilityShell({ title, intro, children }) {
  const { t } = useI18n();
  return (
    <div className="max-w-5xl mx-auto px-6 md:px-12 py-14 md:py-20">
      <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-3">{t("nav.utilities")}</div>
      <h1 className="font-display text-4xl md:text-5xl text-urbanex-navy tracking-tight text-balance">{title}</h1>
      {intro && <p className="mt-4 max-w-2xl text-urbanex-navy/70 leading-relaxed">{intro}</p>}
      <div className="mt-8 flex flex-wrap gap-2" role="tablist">
        {UTILITIES.map(u => (
          <NavLink key={u.to} to={u.to} className={({ isActive }) => `inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${isActive ? "bg-urbanex-navy text-urbanex-ivory border-urbanex-navy" : "bg-white hover:border-urbanex-gold"}`}>
            <u.icon className="w-4 h-4"/>{t(u.key)}
          </NavLink>
        ))}
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
