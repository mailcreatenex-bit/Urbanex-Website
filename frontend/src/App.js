import "@/App.css";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { ViewerProvider } from "@/context/ViewerContext";
import { I18nProvider } from "@/context/I18nContext";
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
import ComparePage from "@/pages/ComparePage";
import ShortlistPage from "@/pages/ShortlistPage";
import BlogPage from "@/pages/BlogPage";
import BlogPostPage from "@/pages/BlogPostPage";
import ZoneQuizPage from "@/pages/ZoneQuizPage";
import NriPage from "@/pages/NriPage";
import VideosPage from "@/pages/VideosPage";
import VideoDetailPage from "@/pages/VideoDetailPage";

// The admin area is only needed by Ayan, so keep it out of the public bundle.
const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"));
const LeadsPage = lazy(() => import("@/pages/admin/LeadsPage"));
const ReportsPage = lazy(() => import("@/pages/admin/ReportsPage"));
const InvoicePage = lazy(() => import("@/pages/admin/InvoicePage"));
const PropertiesAdminPage = lazy(() => import("@/pages/admin/PropertiesAdminPage"));
const VisitsPage = lazy(() => import("@/pages/admin/VisitsPage"));
const ReviewsPage = lazy(() => import("@/pages/admin/ReviewsPage"));
const PostsAdminPage = lazy(() => import("@/pages/admin/PostsAdminPage"));
const DigestAdminPage = lazy(() => import("@/pages/admin/DigestAdminPage"));
const VideosAdminPage = lazy(() => import("@/pages/admin/VideosAdminPage"));
const InterestsAdminPage = lazy(() => import("@/pages/admin/InterestsAdminPage"));

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
        <Route path="/videos" element={<VideosPage/>}/>
        <Route path="/videos/:id" element={<VideoDetailPage/>}/>
        <Route path="/zone-quiz" element={<ZoneQuizPage/>}/>
        <Route path="/zone-quiz/r/:id" element={<ZoneQuizPage/>}/>
        <Route path="/nri" element={<NriPage/>}/>
        <Route path="/compare" element={<ComparePage/>}/>
        <Route path="/shortlist" element={<ShortlistPage/>}/>
        <Route path="/blog" element={<BlogPage/>}/>
        <Route path="/blog/:slug" element={<BlogPostPage/>}/>
        <Route path="/about" element={<AboutPage/>}/>
        <Route path="/contact" element={<ContactPage/>}/>
        <Route path="/construction" element={<ConstructionPage/>}/>
        <Route path="/terms" element={<TermsPage/>}/>
        <Route path="/privacy" element={<PrivacyPage/>}/>
      </Route>

      <Route path="/admin" element={<AdminLayout/>}>
        <Route index element={<LeadsPage/>}/>
        <Route path="leads" element={<LeadsPage/>}/>
        <Route path="visits" element={<VisitsPage/>}/>
        <Route path="properties" element={<PropertiesAdminPage/>}/>
        <Route path="reviews" element={<ReviewsPage/>}/>
        <Route path="posts" element={<PostsAdminPage/>}/>
        <Route path="digest" element={<DigestAdminPage/>}/>
        <Route path="videos" element={<VideosAdminPage/>}/>
        <Route path="interests" element={<InterestsAdminPage/>}/>
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
        <I18nProvider>
          <AuthProvider>
            <ViewerProvider>
            <FavoritesProvider>
              <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-urbanex-navy/50">Loading…</div>}>
                <AppRouter/>
              </Suspense>
              <Toaster position="top-right" richColors theme="light"/>
            </FavoritesProvider>
            </ViewerProvider>
          </AuthProvider>
        </I18nProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
