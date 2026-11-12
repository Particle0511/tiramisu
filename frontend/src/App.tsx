
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./lib/auth";
import Shell from "./components/Shell";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Overview from "./pages/Overview";
import Disputes from "./pages/Disputes";
import DisputeDetail from "./pages/DisputeDetail";
import Prevention from "./pages/Prevention";
import Evidence from "./pages/Evidence";
import Approvals from "./pages/Approvals";
import Activity from "./pages/Activity";
import Settings from "./pages/Settings";
import { Terms, Privacy } from "./pages/Legal";
import Landing from "./pages/Landing";

function Protected() {
  const { session, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <p style={{ padding: 40 }} role="status">Loading</p>;
  if (!session) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <Shell />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route element={<Protected />}>
        <Route path="/overview" element={<Overview />} />
        <Route path="/disputes" element={<Disputes />} />
        <Route path="/disputes/:id" element={<DisputeDetail />} />
        <Route path="/prevention" element={<Prevention />} />
        <Route path="/evidence" element={<Evidence />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="/" element={<Landing />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
