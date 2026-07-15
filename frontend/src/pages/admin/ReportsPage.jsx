import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ADMIN } from "@/constants/testIds";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, CartesianGrid } from "recharts";

const GOLD = "#C5A059";
const NAVY = "#0A1225";
const COLORS = ["#C5A059", "#0A1225", "#1A253F", "#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444"];

const Card = ({ title, children, className = "" }) => (
  <div className={`bg-white rounded-2xl p-6 border border-urbanex-navy/10 ${className}`}>
    <div className="text-xs tracking-[0.28em] uppercase text-urbanex-gold mb-4">{title}</div>
    {children}
  </div>
);

export default function ReportsPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/admin/reports/overview").then(r => setData(r.data)).catch(() => {});
  }, []);

  if (!data) return <div className="text-urbanex-navy/40">Loading reports…</div>;

  return (
    <div data-testid={ADMIN.reports}>
      <div className="text-xs tracking-[0.28em] uppercase text-urbanex-gold">CRM · Reports</div>
      <h1 className="font-display text-4xl text-urbanex-navy tracking-tight mt-1">The numbers that matter.</h1>

      {/* KPI */}
      <div className="mt-8 grid sm:grid-cols-4 gap-4">
        <Card title="Total leads"><div className="font-display text-5xl text-urbanex-navy">{data.total_leads}</div></Card>
        <Card title="Closed"><div className="font-display text-5xl text-urbanex-navy">{(data.by_status.find(s => s.name === "closed") || {}).value || 0}</div></Card>
        <Card title="In pipeline"><div className="font-display text-5xl text-urbanex-navy">{data.by_status.filter(s => !["closed","lost"].includes(s.name)).reduce((a,b) => a+b.value, 0)}</div></Card>
        <Card title="Sources"><div className="font-display text-5xl text-urbanex-navy">{data.by_source.length}</div></Card>
      </div>

      <div className="mt-8 grid md:grid-cols-2 gap-6">
        <Card title="Leads over time">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.by_day}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6e2d8"/>
              <XAxis dataKey="date" stroke="#0A1225" tick={{ fontSize: 11 }}/>
              <YAxis stroke="#0A1225" tick={{ fontSize: 11 }} allowDecimals={false}/>
              <Tooltip contentStyle={{ background: "#0A1225", color: "#FDFBF7", border: "none", borderRadius: 8 }}/>
              <Line type="monotone" dataKey="value" stroke={GOLD} strokeWidth={2.5} dot={{ fill: GOLD, r: 4 }}/>
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Status pipeline">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.by_status}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6e2d8"/>
              <XAxis dataKey="name" stroke="#0A1225" tick={{ fontSize: 11 }}/>
              <YAxis stroke="#0A1225" tick={{ fontSize: 11 }} allowDecimals={false}/>
              <Tooltip contentStyle={{ background: "#0A1225", color: "#FDFBF7", border: "none", borderRadius: 8 }}/>
              <Bar dataKey="value" fill={NAVY} radius={[8,8,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Source breakdown">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={data.by_source} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={3}>
                {data.by_source.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
              </Pie>
              <Tooltip contentStyle={{ background: "#0A1225", color: "#FDFBF7", border: "none", borderRadius: 8 }}/>
              <Legend/>
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Top interest zones">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart layout="vertical" data={data.zones_heat.filter(z => z.value > 0)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6e2d8"/>
              <XAxis type="number" stroke="#0A1225" tick={{ fontSize: 11 }} allowDecimals={false}/>
              <YAxis type="category" dataKey="zone" stroke="#0A1225" tick={{ fontSize: 11 }} width={110}/>
              <Tooltip contentStyle={{ background: "#0A1225", color: "#FDFBF7", border: "none", borderRadius: 8 }}/>
              <Bar dataKey="value" fill={GOLD} radius={[0,8,8,0]}/>
            </BarChart>
          </ResponsiveContainer>
          {!data.zones_heat.filter(z => z.value > 0).length && (
            <div className="py-6 text-center text-urbanex-navy/40 text-sm">No zone data yet — comes in as leads mention specific localities.</div>
          )}
        </Card>
      </div>
    </div>
  );
}
