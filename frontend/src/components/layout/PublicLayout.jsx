import { lazy, Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import FloatingWhatsApp from "@/components/common/FloatingWhatsApp";
import LoginModal from "@/components/common/LoginModal";
import InterestModal from "@/components/common/InterestModal";
import ScrollProgress from "@/components/fx/ScrollProgress";
import CursorGlow from "@/components/fx/CursorGlow";
import { InstallPill, InstallHelp } from "@/components/pwa/InstallUi";
import ExitOffer from "@/components/common/ExitOffer";

// The chat widget is not needed for first paint; it loads in the background.
const AssistantWidget = lazy(() => import("@/components/assistant/AssistantWidget"));

export default function PublicLayout() {
  const { pathname } = useLocation();
  const bleed = pathname === "/" || pathname.startsWith("/construction") || pathname.startsWith("/vastu") || pathname === "/map" || pathname === "/free-check";   // pages that start with their own full-width scene sit under the dock
  return (
    <div className="min-h-screen flex flex-col bg-urbanex-ivory film-grain">
      <ScrollProgress/>
      <CursorGlow/>
      <Navbar/>
      <main key={pathname} className={`flex-1 page-in ${bleed ? "" : "pt-24 md:pt-28"}`}><Suspense fallback={<div className="min-h-[70vh]"/>}><Outlet/></Suspense></main>
      <Footer/>
      <FloatingWhatsApp/>
      <Suspense fallback={null}><AssistantWidget/></Suspense>
      <LoginModal/>
      <InterestModal/>
      <ExitOffer/>
      <InstallPill/>
      <InstallHelp/>
    </div>
  );
}
