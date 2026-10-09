import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";

// mode "admin": CRM alerts (leads, visits, reviews). mode "user": saved-search matches.
// Polls every 60s; if the browser permits, new items also raise a desktop notification.
export default function NotificationBell({ mode = "user", dark = false }) {
  const base = mode === "admin" ? "/admin/notifications" : "/me/notifications";
  const [data, setData] = useState({ items: [], unread: 0 });
  const [open, setOpen] = useState(false);
  const seen = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get(base);
      if (seen.current !== null && d.unread > seen.current && typeof Notification !== "undefined" && Notification.permission === "granted") {
        const n = d.items.find(i => !i.read);
        if (n) new Notification(n.title, { body: n.body });
      }
      seen.current = d.unread;
      setData(d);
    } catch { /* offline or signed out */ }
  }, [base]);

  useEffect(() => {
    load();
    const h = setInterval(load, 60000);
    return () => clearInterval(h);
  }, [load]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && mode === "admin" && typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    if (next && data.unread) {
      await api.post(`${base}/read`, {}).catch(() => {});
      seen.current = 0;
      setTimeout(() => setData(d => ({ ...d, unread: 0 })), 1500);
    }
  };

  return (
    <div className="relative">
      <button type="button" onClick={toggle} aria-label="Notifications" data-testid="notif-bell"
        className={`relative p-2 rounded-full ${dark ? "hover:bg-white/10 text-urbanex-ivory" : "hover:bg-urbanex-navy/5 text-urbanex-navy"}`}>
        <Bell className="w-5 h-5"/>
        {data.unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center" data-testid="notif-count">{data.unread}</span>}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-[4.5rem] sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-80 max-h-96 overflow-y-auto bg-white text-urbanex-navy rounded-xl shadow-2xl border z-50">
          {data.items.length === 0 && <div className="p-6 text-sm text-gray-400 text-center">No notifications yet</div>}
          {data.items.map(n => (
            <Link key={n.id} to={n.link || "#"} onClick={() => setOpen(false)} className={`block px-4 py-3 border-b last:border-0 hover:bg-gray-50 ${n.read ? "" : "bg-urbanex-gold/10"}`}>
              <div className="text-sm font-medium">{n.title}</div>
              <div className="text-xs text-gray-500 line-clamp-2">{n.body}</div>
              <div className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString("en-IN")}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
