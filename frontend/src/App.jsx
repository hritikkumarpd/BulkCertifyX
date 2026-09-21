import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './store/AuthContext.jsx';
import { useOrg } from './store/OrgContext.jsx';
import { Loader2 } from 'lucide-react';

import LandingPage from './pages/LandingPage.jsx';
import PricingPage from './pages/PricingPage.jsx';
import VerifyPage from './pages/VerifyPage.jsx';
import LegalPage from './pages/LegalPage.jsx';

import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx';
import InvitePage from './pages/auth/InvitePage.jsx';
import OnboardingPage from './pages/OnboardingPage.jsx';

import DashboardLayout from './layouts/DashboardLayout.jsx';
import DashboardHome from './pages/dashboard/DashboardHome.jsx';
import CertificatesPage from './pages/dashboard/CertificatesPage.jsx';
import CertificateDetailPage from './pages/dashboard/CertificateDetailPage.jsx';
import BulkGeneratePage from './pages/dashboard/BulkGeneratePage.jsx';
import BulkJobPage from './pages/dashboard/BulkJobPage.jsx';
import TemplatesPage from './pages/dashboard/TemplatesPage.jsx';
import TemplateEditorPage from './pages/dashboard/TemplateEditorPage.jsx';
import EventsPage from './pages/dashboard/EventsPage.jsx';
import AnalyticsPage from './pages/dashboard/AnalyticsPage.jsx';
import TeamPage from './pages/dashboard/TeamPage.jsx';
import ApiPage from './pages/dashboard/ApiPage.jsx';
import DomainsPage from './pages/dashboard/DomainsPage.jsx';
import BillingPage from './pages/dashboard/BillingPage.jsx';
import SettingsPage from './pages/dashboard/SettingsPage.jsx';

function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
    </div>
  );
}

// Requires auth; if no org yet, routes to onboarding.
function Protected({ children }) {
  const { user, loading } = useAuth();
  const { current, loading: orgLoading } = useOrg();
  if (loading || orgLoading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!current) return <Navigate to="/onboarding" replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (user) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Public marketing + verification */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/verify/:code" element={<VerifyPage />} />
      <Route path="/verify" element={<VerifyPage />} />
      <Route path="/terms" element={<LegalPage kind="terms" />} />
      <Route path="/privacy" element={<LegalPage kind="privacy" />} />
      <Route path="/refund" element={<LegalPage kind="refund" />} />
      <Route path="/contact" element={<LegalPage kind="contact" />} />

      {/* Auth */}
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />

      {/* Dashboard (protected) */}
      <Route path="/app" element={<Protected><DashboardLayout /></Protected>}>
        <Route index element={<DashboardHome />} />
        <Route path="certificates" element={<CertificatesPage />} />
        <Route path="certificates/:id" element={<CertificateDetailPage />} />
        <Route path="bulk" element={<BulkGeneratePage />} />
        <Route path="bulk/:id" element={<BulkJobPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="templates/:id" element={<TemplateEditorPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="api" element={<ApiPage />} />
        <Route path="domains" element={<DomainsPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
