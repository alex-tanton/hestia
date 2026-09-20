import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { createQueryClient } from './lib/api/query-client.ts';
import { createAuthClient, loadSupabaseClient } from './lib/auth/auth-client.ts';
import { installErrorReporting } from './lib/error-reporting.ts';
import './index.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Missing #root element');
}

installErrorReporting();

// One origin serves the PWA, the API, and (through Kong) GoTrue, so supabase-js is pointed at
// this origin and Caddy routes `/auth/v1` onwards. The anon key is baked in at build time,
// where every other build-time setting is decided (Technical Architecture, "Auth configuration").
// The client itself arrives after this first render, which is why the session starts `loading`.
const supabase = loadSupabaseClient(
  window.location.origin,
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
);

createRoot(root).render(
  <StrictMode>
    <App auth={createAuthClient(supabase)} queryClient={createQueryClient()} />
  </StrictMode>,
);
