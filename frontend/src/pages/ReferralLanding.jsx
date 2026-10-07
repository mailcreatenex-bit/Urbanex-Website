import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";

// A past client's link: remember who sent this visitor (it travels with every enquiry they make), then go to the home page.
export default function ReferralLanding() {
  const { code } = useParams();
  const nav = useNavigate();
  useEffect(() => {
    api.get(`/r/${code}`).then(r => {
      try { localStorage.setItem("urbanex_ref", r.data.code); } catch { /* ignore */ }
      toast.success(`${r.data.name} sent you here. Welcome to Urbanex Realty.`);
    }).catch(() => {}).finally(() => nav("/", { replace: true }));
  }, [code, nav]);
  return <div className="min-h-[60vh]"/>;
}
