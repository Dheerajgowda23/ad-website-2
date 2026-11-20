import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './login.js';
import { DashboardPage } from './dashboard.js';

/**
 * Intranet route tree. It contains no student route: the public application
 * form does not exist in this bundle at all (§3).
 */
export const App = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/dashboard" element={<DashboardPage />} />
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>
);
