import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import FloatingWhatsApp from "@/components/common/FloatingWhatsApp";
import LoginModal from "@/components/common/LoginModal";
import AssistantWidget from "@/components/assistant/AssistantWidget";
import InterestModal from "@/components/common/InterestModal";

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-urbanex-ivory">
      <Navbar/>
      <main className="flex-1"><Outlet/></main>
      <Footer/>
      <FloatingWhatsApp/>
      <AssistantWidget/>
      <LoginModal/>
      <InterestModal/>
    </div>
  );
}
