import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStore } from '@/store/useStore';
import Layout from '@/components/common/Layout';
import Dashboard from '@/pages/Dashboard';
import CustomerDashboard from '@/pages/CustomerDashboard';
import RentalApprovals from '@/pages/RentalApprovals';
import SiteOperations from '@/pages/SiteOperations';
import AuditLogs from '@/pages/AuditLogs';
import Equipment from '@/pages/Equipment';
import EquipmentDetail from '@/pages/EquipmentDetail';
import Rentals from '@/pages/Rentals';
import Usage from '@/pages/Usage';
import Alerts from '@/pages/Alerts';
import Forecast from '@/pages/Forecast';
import Anomalies from '@/pages/Anomalies';
import Recommendations from '@/pages/Recommendations';
import MapView from '@/pages/MapView';
import QRScanner from '@/pages/QRScanner';
import Copilot from '@/pages/Copilot';
import Login from '@/pages/Login';
import Settings from '@/pages/Settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
});

function SmartHome() {
  const user = useStore((state) => state.user);
  if (user?.role === 'CUSTOMER') {
    return <CustomerDashboard />;
  }
  if (user?.role === 'SITE_MANAGER') {
    return <SiteOperations />;
  }
  return <Dashboard />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route path="/" element={<SmartHome />} />
            <Route path="/customer-dashboard" element={<CustomerDashboard />} />
            <Route path="/my-requests" element={<CustomerDashboard />} />
            <Route path="/approvals" element={<RentalApprovals />} />
            <Route path="/site-operations" element={<SiteOperations />} />
            <Route path="/audit-logs" element={<AuditLogs />} />
            <Route path="/equipment" element={<Equipment />} />
            <Route path="/equipment/:id" element={<EquipmentDetail />} />
            <Route path="/rentals" element={<Rentals />} />
            <Route path="/usage" element={<Usage />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/forecast" element={<Forecast />} />
            <Route path="/anomalies" element={<Anomalies />} />
            <Route path="/recommendations" element={<Recommendations />} />
            <Route path="/map" element={<MapView />} />
            <Route path="/qr-scanner" element={<QRScanner />} />
            <Route path="/copilot" element={<Copilot />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
