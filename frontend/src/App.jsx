import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { startMawFeed } from './store/mawFeedStore';
import DeviceAlerts from './components/watch/DeviceAlerts';
import ConfigWarning from './components/ui/ConfigWarning';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { useAuthStore } from './store/authStore';
import Dashboard from './routes/Dashboard';
import LiveMap from './routes/LiveMap';
import Crossings from './routes/Crossings';
import Alerts from './routes/Alerts';
import EventHistory from './routes/EventHistory';
import Network from './routes/Network';
import DeviceHealth from './routes/DeviceHealth';
import Settings from './routes/Settings';
import CrossingMonitoring from './routes/CrossingMonitoring';
import SimulationCenter from './routes/SimulationCenter';
import Login from './routes/Login';

function DashboardLayout({ children }) {
  // Live MAW feed for every authenticated page.
  useEffect(() => startMawFeed(), []);

  return (
    <div className="app-shell flex h-screen bg-maw-bg">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <TopBar title="Smart Rail Guard" />
        <DeviceAlerts />
        <div className="flex-1 overflow-y-auto pb-16 lg:pb-0">{children}</div>
      </main>
    </div>
  );
}

// Wraps a page in the authenticated shell + route guard.
function Protected({ children }) {
  return (
    <ProtectedRoute>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}

// `/` is the entry point: login when unauthenticated, dashboard when signed in.
function Landing() {
  const authenticated = useAuthStore((s) => s.authenticated);
  return authenticated ? <Navigate to="/dashboard" replace /> : <Login />;
}

function App() {
  return (
    <BrowserRouter>
      <ConfigWarning />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/map" element={<Protected><LiveMap /></Protected>} />
        <Route path="/crossings" element={<Protected><Crossings /></Protected>} />
        <Route path="/crossing/:id" element={<Protected><CrossingMonitoring /></Protected>} />
        <Route path="/alerts" element={<Protected><Alerts /></Protected>} />
        <Route path="/events" element={<Protected><EventHistory /></Protected>} />
        <Route path="/network" element={<Protected><Network /></Protected>} />
        <Route path="/health" element={<Protected><DeviceHealth /></Protected>} />
        <Route path="/simulation" element={<Protected><SimulationCenter /></Protected>} />
        <Route path="/settings" element={<Protected><Settings /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
