import { STAGES, inrShort } from "@/lib/crm";

const Card = ({ title, children }) => <div className="rounded-2xl border bg-white p-5"><div className="text-xs tracking-[0.2em] uppercase text-urbanex-gold mb-3">{title}</div>{children}</div>;

export default function Insights({ summary }) {
  if (!summary) return <div className="p-10 text-center text-gray-400">Loading…</div>;
  const max = Math.max(1, ...summary.stages.map(s => s.count));
  const dayMax = Math.max(1, ...summary.per_day.map(d => d.count));
  return (
    <div className="mt-4 grid lg:grid-cols-2 gap-4" data-testid="crm-insights">
      <Card title="Pipeline">
        <div className="space-y-2">
          {summary.stages.map(s => {
            const st = STAGES.find(x => x.v === s.stage);
            return (
              <div key={s.stage} className="flex items-center gap-3 text-sm">
                <div className="w-24 text-urbanex-navy/70">{st?.label}</div>
                <div className="flex-1 h-5 rounded bg-gray-100 overflow-hidden"><div className="h-full rounded" style={{ width: `${(s.count / max) * 100}%`, background: st?.color }}/></div>
                <div className="w-8 text-right font-mono text-xs">{s.count}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div><div className="font-display text-2xl">{inrShort(summary.pipeline_value)}</div><div className="text-[10px] uppercase tracking-widest text-gray-500">In play</div></div>
          <div><div className="font-display text-2xl">{inrShort(summary.weighted_forecast)}</div><div className="text-[10px] uppercase tracking-widest text-gray-500">Likely to close</div></div>
          <div><div className="font-display text-2xl">{inrShort(summary.closed_this_month)}</div><div className="text-[10px] uppercase tracking-widest text-gray-500">Won this month</div></div>
        </div>
      </Card>

      <Card title="New leads, last 14 days">
        <div className="flex items-end gap-1.5 h-36">
          {summary.per_day.map(d => (
            <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${d.date}: ${d.count}`}>
              <div className="text-[9px] text-gray-500">{d.count || ""}</div>
              <div className="w-full rounded-t bg-urbanex-gold/70" style={{ height: `${(d.count / dayMax) * 100}%`, minHeight: d.count ? 4 : 1 }}/>
              <div className="text-[9px] text-gray-400">{d.date.slice(8)}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="lg:col-span-2">
        <Card title="Which source brings real buyers?">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-500"><tr><th className="py-1">Source</th><th>Leads</th><th>Hot now</th><th>Won</th><th>Lost</th><th>Won of all</th><th>Win rate</th><th>Revenue (deal value)</th></tr></thead>
              <tbody>
                {summary.sources.map(s => (
                  <tr key={s.source} className="border-t">
                    <td className="py-2 font-medium">{s.source.replace("_", " ")}</td><td>{s.leads}</td><td>{s.hot}</td><td>{s.closed}</td><td>{s.lost}</td>
                    <td>{s.conversion}%</td><td>{s.win_rate == null ? "—" : `${s.win_rate}%`}</td><td>{s.value ? inrShort(s.value) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-gray-500">Average first reply: {summary.avg_first_response_minutes == null ? "not enough data yet" : summary.avg_first_response_minutes < 90 ? `${summary.avg_first_response_minutes} minutes` : `${(summary.avg_first_response_minutes / 60).toFixed(1)} hours`}. Leads answered within 5 minutes convert far better than the ones that wait.</p>
        </Card>
      </div>
    </div>
  );
}
