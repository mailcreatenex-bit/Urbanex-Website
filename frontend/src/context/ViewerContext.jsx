import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

// Prices are never part of public API data. A visitor unlocks the price of ONE listing by pressing
// "Interested": the first time with a name + phone form, afterwards (same browser, or a Google account
// the browser was linked to) with a single click. `prices` holds only what this visitor has unlocked.
const Ctx = createContext(null);

export function ViewerProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState({ known: false, name: null, linked: false, prices: {}, ready: false });
  const [modal, setModal] = useState(null);       // {type, id, title} while the form is open
  const [busyKey, setBusyKey] = useState(null);
  const uid = user?.user_id;

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/viewer");
      setState({ ...data, ready: true });
    } catch {
      setState(s => ({ ...s, ready: true }));
    }
  }, []);
  useEffect(() => { refresh(); }, [refresh, uid]);

  const apply = useCallback((data) => {
    setState(s => ({ ...s, known: true, prices: { ...s.prices, [data.key]: data.price || { price_inr: null } } }));
  }, []);

  const unlocked = useCallback((type, id) => state.prices[`${type}:${id}`], [state.prices]);

  // item: a property ({id,title}) or a video ({video_id,title})
  const press = useCallback(async (type, item) => {
    const id = type === "video" ? item.video_id : item.id;
    if (!state.known) { setModal({ type, id, title: item.title }); return null; }
    setBusyKey(`${type}:${id}`);
    try {
      const { data } = await api.post("/interest", { item_type: type, item_id: id });
      apply(data);
      return data;
    } catch (e) {
      if (e?.response?.status === 422) setModal({ type, id, title: item.title });   // cookie expired: ask again
      else toast.error(e?.response?.status === 429 ? "Too many requests, please wait a minute." : "Could not unlock the price. Please try again.");
      return null;
    } finally { setBusyKey(null); }
  }, [state.known, apply]);

  const submitForm = useCallback(async ({ name, phone, turnstile_token }) => {
    const { data } = await api.post("/interest", { item_type: modal.type, item_id: modal.id, name, phone, turnstile_token });
    apply(data);
    setState(s => ({ ...s, name }));
    return data;
  }, [modal, apply]);

  const value = useMemo(() => ({
    ...state, unlocked, press, busyKey, modal, closeModal: () => setModal(null), submitForm, refresh,
  }), [state, unlocked, press, busyKey, modal, submitForm, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useViewer = () => useContext(Ctx);
