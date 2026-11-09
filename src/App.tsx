import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { lazy, Suspense } from "react";

import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";

const Clients = lazy(() => import("./pages/Clients"));
const ClientDetail = lazy(() => import("./pages/ClientDetail"));
const Audits = lazy(() => import("./pages/Audits"));
const AuditDetail = lazy(() => import("./pages/AuditDetail"));
const Tasks = lazy(() => import("./pages/Tasks"));
const CertificationBodies = lazy(() => import("./pages/CertificationBodies"));
const Auditors = lazy(() => import("./pages/Auditors"));
const Consultants = lazy(() => import("./pages/Consultants"));
const Calendar = lazy(() => import("./pages/Calendar"));
const ActivityLog = lazy(() => import("./pages/ActivityLog"));
const CertificationsManagement = lazy(() => import("./pages/CertificationsManagement"));
const AuditTemplates = lazy(() => import("./pages/AuditTemplates"));
const CertificationDetail = lazy(() => import("./pages/CertificationDetail"));
const Agents = lazy(() => import("./pages/Agents"));
const About = lazy(() => import("./pages/About"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />

            {/* Protected Routes with Persistent Layout */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/clients" element={<Suspense fallback={null}><Clients /></Suspense>} />
              <Route path="/clients/:id" element={<Suspense fallback={null}><ClientDetail /></Suspense>} />
              <Route path="/audits" element={<Suspense fallback={null}><Audits /></Suspense>} />
              <Route path="/audits/:id" element={<Suspense fallback={null}><AuditDetail /></Suspense>} />
              <Route path="/tasks" element={<Suspense fallback={null}><Tasks /></Suspense>} />
              <Route path="/certification-bodies" element={<Suspense fallback={null}><CertificationBodies /></Suspense>} />
              <Route path="/auditors" element={<Suspense fallback={null}><Auditors /></Suspense>} />
              <Route path="/consultants" element={<Suspense fallback={null}><Consultants /></Suspense>} />
              <Route path="/calendar" element={<Suspense fallback={null}><Calendar /></Suspense>} />
              <Route path="/activity-log" element={<Suspense fallback={null}><ActivityLog /></Suspense>} />
              <Route path="/agents" element={<Suspense fallback={null}><Agents /></Suspense>} />
              <Route path="/about" element={<Suspense fallback={null}><About /></Suspense>} />
              <Route path="/certifications/:id" element={<Suspense fallback={null}><CertificationDetail /></Suspense>} />

              {/* Settings Routes */}
              <Route path="/settings/certifications" element={<Suspense fallback={null}><CertificationsManagement /></Suspense>} />
              <Route path="/settings/audit-templates" element={<Suspense fallback={null}><AuditTemplates /></Suspense>} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
