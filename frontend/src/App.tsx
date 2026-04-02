import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import type { RoleName, Session } from "./lib/models";
import { clearSession, readSession, writeSession } from "./lib/session";
import { logoutUser } from "./lib/api";
import LandingPage from "./pages/LandingPage";
import ExploreToursPage from "./pages/ExploreToursPage";
import TourDetailPage from "./pages/TourDetailPage";
import MyBookingsPage from "./pages/MyBookingsPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminBookingCenterPage from "./pages/AdminBookingCenterPage";

function isAdmin(session: Session | null) {
  return !!session?.roles?.some((r: RoleName) => r === "ADMIN" || r === "TRAVEL_MANAGER" || r === "STAFF");
}

function ProtectedRoute({ session, adminOnly, children }: { session: Session | null; adminOnly?: boolean; children: React.ReactElement }) {
  if (!session) return <Navigate to="/auth" replace />;
  if (adminOnly && !isAdmin(session)) return <Navigate to="/explore" replace />;
  if (!adminOnly && isAdmin(session) && false) return children; // customers allowed on all non-admin routes
  return children;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(() => readSession());

  const adminUser = useMemo(() => isAdmin(session), [session]);

  useEffect(() => {
    const onSessionUpdated = (event: Event) => {
      const custom = event as CustomEvent<Session>;
      if (!custom.detail) return;
      setSession(custom.detail);
    };
    window.addEventListener("tms:session-updated", onSessionUpdated);
    return () => window.removeEventListener("tms:session-updated", onSessionUpdated);
  }, []);

  const onLogin = (s: Session) => { writeSession(s); setSession(s); };

  const onLogout = async () => {
    try { await logoutUser(); } catch { /* continue */ }
    clearSession();
    setSession(null);
  };

  return (
    <Routes>
      <Route path="/" element={<Navigate to={session ? (adminUser ? "/admin" : "/explore") : "/auth"} replace />} />
      <Route path="/auth" element={<LandingPage session={session} onLogin={onLogin} />} />

      <Route path="/explore" element={
        <ProtectedRoute session={session}>
          <ExploreToursPage session={session!} onLogout={onLogout} />
        </ProtectedRoute>
      } />

      <Route path="/explore/tours/:id" element={
        <ProtectedRoute session={session}>
          <TourDetailPage session={session!} onLogout={onLogout} />
        </ProtectedRoute>
      } />

      <Route path="/my-bookings" element={
        <ProtectedRoute session={session}>
          <MyBookingsPage session={session!} onLogout={onLogout} />
        </ProtectedRoute>
      } />

      <Route path="/admin" element={
        <ProtectedRoute session={session} adminOnly>
          <AdminDashboardPage session={session!} onLogout={onLogout} />
        </ProtectedRoute>
      } />

      <Route path="/admin/bookings" element={
        <ProtectedRoute session={session} adminOnly>
          <AdminBookingCenterPage session={session!} onLogout={onLogout} />
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
