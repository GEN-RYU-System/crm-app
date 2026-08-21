import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/app.css';

// Dev-only preview mode: install GAS mock so the app runs without real GAS auth.
// Activated only when running `npm run dev` with `?preview` in the URL.
// Vite eliminates this block in production builds (import.meta.env.DEV → false).
if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('preview')) {
  const { installGASMock } = await import('./preview/gasRunnerMock');
  installGASMock();
}

const root = document.getElementById('root');
if (!root) throw new Error('React root が見つかりません。');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
