import "@/App.css";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { ViewerProvider } from "@/context/ViewerContext";
import { PwaProvider } from "@/context/PwaContext";
import { I18nProvider } from "@/context/I18nContext";
import { Toaster } from "sonner";

import PublicLayout from "@/components/layout/PublicLayout";
import HomePage from "@/pages/HomePage";
import AuthCallback from "@/pages/AuthCallback";

// Public pages other than the home page load on demand, so first paint ships as little code as possible.
const PropertiesPage = lazy(() => import("@/pages/PropertiesPage"));
const PropertyDetailPage = lazy(() => import("@/pages/PropertyDetailPage"));
const AboutPage = lazy(() => import("@/pages/AboutPage"));
const ContactPage = lazy(() => import("@/pages/ContactPage"));
const ConstructionPage = lazy(() => import("@/pages/ConstructionPage"));
const TermsPage = lazy(() => import("@/pages/TermsPage"));
const PrivacyPage = lazy(() => import("@/pages/PrivacyPage"));
const ComparePage = lazy(() => import("@/pages/ComparePage"));
const ShortlistPage = lazy(() => import("@/pages/ShortlistPage"));
const BlogPage = lazy(() => import("@/pages/BlogPage"));
const BlogPostPage = lazy(() => import("@/pages/BlogPostPage"));
const ZoneQuizPage = lazy(() => import("@/pages/ZoneQuizPage"));
const NriPage = lazy(() => import("@/pages/NriPage"));
const VideosPage = lazy(() => import("@/pages/VideosPage"));
const VideoDetailPage = lazy(() => import("@/pages/VideoDetailPage"));

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
const PushAdminPage = lazy(() => import("@/pages/admin/PushAdminPage"));

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
        <Route path="push" element={<PushAdminPage/>}/>
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
          <PwaProvider>
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
          </PwaProvider>
        </I18nProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
