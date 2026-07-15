import { useEffect, useMemo, useState } from "react";
import PropertyCard from "@/components/properties/PropertyCard";
import { api } from "@/lib/api";
import { PROP } from "@/constants/testIds";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export default function PropertiesPage() {
  const [items, setItems] = useState([]);
  const [zone, setZone] = useState("all");
  const [type, setType] = useState("all");

  useEffect(() => {
    api.get("/properties").then(r => setItems(r.data || [])).catch(() => {});
  }, []);

  const zones = useMemo(() => Array.from(new Set(items.map(i => i.zone))).sort(), [items]);
  const types = useMemo(() => Array.from(new Set(items.map(i => i.property_type))).sort(), [items]);

  const filtered = items.filter(i =>
    (zone === "all" || i.zone === zone) &&
    (type === "all" || i.property_type === type)
  );

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-4">Live inventory</div>
      <h1 className="font-display text-5xl md:text-6xl text-urbanex-navy leading-[1.05] tracking-tight max-w-3xl text-balance">
        Twelve homes. Every one, personally walked by Ayan.
      </h1>
      <p className="mt-6 text-urbanex-navy/70 max-w-xl leading-relaxed">
        Prices are held for verified buyers only. Sign in with Google to unlock — takes 5 seconds, no forms.
      </p>

      <div className="mt-10 flex flex-wrap items-center gap-3 pb-4 border-b border-urbanex-navy/10">
        <Select value={zone} onValueChange={setZone}>
          <SelectTrigger data-testid={PROP.filterZone} className="w-52 bg-white border-urbanex-navy/20 rounded-full">
            <SelectValue placeholder="All zones"/>
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">All zones</SelectItem>
            {zones.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger data-testid={PROP.filterType} className="w-52 bg-white border-urbanex-navy/20 rounded-full">
            <SelectValue placeholder="All types"/>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {types.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="ghost" data-testid={PROP.clearFilters} onClick={() => { setZone("all"); setType("all"); }} className="text-urbanex-navy/60 hover:text-urbanex-navy">Clear</Button>
        <span className="ml-auto text-xs text-urbanex-navy/50 font-mono">{filtered.length} results</span>
      </div>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" data-testid={PROP.grid}>
        {filtered.map((p, i) => <PropertyCard key={p.id} property={p} idx={i}/>)}
      </div>

      {!filtered.length && (
        <div className="py-24 text-center text-urbanex-navy/50">No properties match your filters yet.</div>
      )}
    </div>
  );
}
