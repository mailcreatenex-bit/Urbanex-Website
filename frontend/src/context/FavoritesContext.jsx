import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";

const Ctx = createContext(null);
const KEY = "urbanex_shortlist";
export const MAX_COMPARE = 3;

const read = () => {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
};

// The shortlist is stored in this browser. For signed-in users it is also synced to the account
// (the "watchlist"), which is what powers price-drop and sold alerts.
export function FavoritesProvider({ children }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [ids, setIds] = useState(read);
  const [compare, setCompare] = useState([]);
  const hinted = useRef(false);
  const uid = user?.user_id;
  const idsRef = useRef(ids);
  idsRef.current = ids;

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* storage blocked */ }
  }, [ids]);

  // On sign-in, merge what was saved before signing in with the account's watchlist.
  useEffect(() => {
    if (!uid) return;
    api.put("/me/watchlist", { ids: idsRef.current.slice(0, 100) })
      .then(r => setIds(cur => Array.from(new Set([...cur, ...(r.data.ids || [])]))))
      .catch(() => {});
  }, [uid]);

  const toggle = useCallback((id) => {
    const adding = !idsRef.current.includes(id);
    setIds(cur => (cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]));
    if (uid) {
      (adding ? api.post(`/me/watchlist/${id}`) : api.delete(`/me/watchlist/${id}`)).catch(() => {});
      if (adding) toast.success(t("watch.saved"));
    } else if (adding && !hinted.current) {
      hinted.current = true;
      toast.info(t("watch.signinHint"));
    }
  }, [uid, t]);

  const toggleCompare = useCallback((id) => setCompare(cur => {
    if (cur.includes(id)) return cur.filter(x => x !== id);
    return cur.length >= MAX_COMPARE ? cur : [...cur, id];
  }), []);

  return (
    <Ctx.Provider value={{ ids, has: (id) => ids.includes(id), toggle, compare, toggleCompare, clearCompare: () => setCompare([]) }}>
      {children}
    </Ctx.Provider>
  );
}
export const useFavorites = () => useContext(Ctx);
