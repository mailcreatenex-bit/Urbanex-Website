import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "sonner";

import PublicLayout from "@/components/layout/PublicLayout";
import HomePage from "@/pages/HomePage";
import PropertiesPage from "@/pages/PropertiesPage";
import PropertyDetailPage from "@/pages/PropertyDetailPage";
import AboutPage from "@/pages/AboutPage";
import ContactPage from "@/pages/ContactPage";
import ConstructionPage from "@/pages/ConstructionPage";
import TermsPage from "@/pages/TermsPage";
import PrivacyPage from "@/pages/PrivacyPage";
import AuthCallback from "@/pages/AuthCallback";

import AdminLayout from "@/pages/admin/AdminLayout";
import LeadsPage from "@/pages/admin/LeadsPage";
import ReportsPage from "@/pages/admin/ReportsPage";
import InvoicePage from "@/pages/admin/InvoicePage";

function AppRouter() {
  const location = useLocation();
  // Handle OAuth callback BEFORE any other routing
  if (location.hash?.includes("session_id=")) return <AuthCallback/>;

  return (
    <Routes>
      <Route element={<PublicLayout/>}>
        <Route path="/" element={<HomePage/>}/>
        <Route path="/properties" element={<PropertiesPage/>}/>
        <Route path="/properties/:id" element={<PropertyDetailPage/>}/>
        <Route path="/about" element={<AboutPage/>}/>
        <Route path="/contact" element={<ContactPage/>}/>
        <Route path="/construction" element={<ConstructionPage/>}/>
        <Route path="/terms" element={<TermsPage/>}/>
        <Route path="/privacy" element={<PrivacyPage/>}/>
      </Route>

      <Route path="/admin" element={<AdminLayout/>}>
        <Route index element={<LeadsPage/>}/>
        <Route path="leads" element={<LeadsPage/>}/>
        <Route path="reports" element={<ReportsPage/>}/>
        <Route path="invoices" element={<InvoicePage/>}/>
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter/>
          <Toaster position="top-right" richColors theme="light"/>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
