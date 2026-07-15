import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';

const Overview = lazy(() => import('./pages/Overview').then((m) => ({ default: m.Overview })));
const LuogoPage = lazy(() => import('./pages/LuogoPage').then((m) => ({ default: m.LuogoPage })));
const DeviceDetailPage = lazy(() =>
  import('./pages/DeviceDetailPage').then((m) => ({ default: m.DeviceDetailPage })),
);
const AlertsPage = lazy(() => import('./pages/AlertsPage').then((m) => ({ default: m.AlertsPage })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));

function AuthenticatedApp() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Layout>
        <Suspense fallback={<p className="text-sm text-gray-500">Caricamento…</p>}>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/luoghi/:luogoId" element={<LuogoPage />} />
            <Route path="/devices/:deviceId" element={<DeviceDetailPage />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}

function Gate() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <AuthenticatedApp /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
