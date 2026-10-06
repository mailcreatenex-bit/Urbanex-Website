import { NavLink } from "react-router-dom";
import { Camera, Landmark, Ruler, Scale, Wallet } from "lucide-react";
import UtilityShell from "@/pages/utilities/UtilityShell";

const TOOLS = [
  { to: "/utilities/banglar-bhumi", label: "Record search", icon: Landmark, end: true },
  { to: "/utilities/banglar-bhumi/converter", label: "Land unit converter", icon: Scale },
  { to: "/utilities/banglar-bhumi/area", label: "Plot area calculator", icon: Ruler },
  { to: "/utilities/banglar-bhumi/value", label: "Value estimator", icon: Wallet },
  { to: "/utilities/banglar-bhumi/scan", label: "Document scanner", icon: Camera },
];

export default function LandShell({ title, intro, children }) {
  return (
    <UtilityShell title={title} intro={intro}>
      <div className="-mt-2 mb-8 flex gap-2 overflow-x-auto pb-1" data-testid="land-tabs">
        {TOOLS.map(t => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `shrink-0 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm border transition-colors ${isActive ? "bg-urbanex-gold/20 border-urbanex-gold text-urbanex-navy" : "bg-white border-urbanex-navy/10 text-urbanex-navy/70 hover:border-urbanex-gold"}`}>
            <t.icon className="w-4 h-4 text-urbanex-gold"/>{t.label}
          </NavLink>
        ))}
      </div>
      {children}
    </UtilityShell>
  );
}
