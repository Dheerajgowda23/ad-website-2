import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './login.js';
import { ApplicationPage } from './application.js';

/** Public route tree. No staff route name appears in this bundle. */
export const App = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/application" element={<ApplicationPage />} />
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>
);
