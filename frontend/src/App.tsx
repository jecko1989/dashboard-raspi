import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Overview } from './pages/Overview';
import { ApartmentPage } from './pages/ApartmentPage';
import { DeviceDetailPage } from './pages/DeviceDetailPage';
import { DeviceCreatePage } from './pages/DeviceCreatePage';
import { AlertsPage } from './pages/AlertsPage';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';

function AuthenticatedApp() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/apartments/:apartmentId" element={<ApartmentPage />} />
          <Route path="/devices/new" element={<DeviceCreatePage />} />
          <Route path="/devices/:deviceId" element={<DeviceDetailPage />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
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
