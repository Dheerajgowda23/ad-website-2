import { Route, Routes } from 'react-router-dom';
import { LoginPage } from './login.js';
import { ApplicationPage } from './application.js';
import { GuidelinesPage } from './Guidelines.js';
import { StatusCheckPage } from './StatusCheck.js';
import { VerifyCertificatePage } from './VerifyCertificate.js';
import { FaqPage } from './Faq.js';
import { DownloadsPage } from './Downloads.js';

/** Public route tree. Strictly public routes; no staff route appears here. */
export const App = () => (
  <Routes>
    <Route path="/" element={<GuidelinesPage />} />
    <Route path="/guidelines" element={<GuidelinesPage />} />
    <Route path="/status-check" element={<StatusCheckPage />} />
    <Route path="/verify" element={<VerifyCertificatePage />} />
    <Route path="/faq" element={<FaqPage />} />
    <Route path="/downloads" element={<DownloadsPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/application" element={<ApplicationPage />} />
    <Route path="*" element={<GuidelinesPage />} />
  </Routes>
);
