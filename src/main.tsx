import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ReportForm from './components/ReportForm';
import './index.css';

// Two routes, no router dependency. Neither view ever links to the other:
// the laptop holds "/", a phone holds "/report" via a QR code.
const isReport = window.location.pathname.startsWith('/report');

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isReport ? <ReportForm /> : <App />}</StrictMode>,
);
