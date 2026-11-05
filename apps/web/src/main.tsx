import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { createApiClient } from './lib/api/client.ts';
import { createQueryClient } from './lib/api/query-client.ts';
import { createAuthClient, loadSupabaseClient } from './lib/auth/auth-client.ts';
import { config } from './lib/config.ts';
import { installErrorReporting } from './lib/error-reporting.ts';
import { createCachePersister, createImmediateFlushPersister } from './lib/offline/persist.ts';
import { registerQueueDefaults } from './lib/offline/chore-errand-writes.ts';
import { createRealtimePort } from './lib/realtime/supabase-realtime.ts';
import './index.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Missing #root element');
}

installErrorReporting();

// One origin serves the PWA, the API, and (through Kong) GoTrue, so supabase-js is pointed at
// this origin and Caddy routes `/auth/v1` onwards. The anon key is baked in at build time,
// where every other build-time setting is decided. The client itself arrives after this first
// render, which is why the session starts `loading`.
const supabase = loadSupabaseClient(window.location.origin, config.supabaseAnonKey);

const auth = createAuthClient(supabase);
const queryClient = createQueryClient();

// Registered before anything hydrates the persisted cache: TanStack merges a mutation's defaults
// when it builds the mutation, and a restored write is built during hydration. Registering after
// that would leave a queued write with no `mutationFn` to resume with.
registerQueueDefaults(queryClient, createApiClient(auth));

createRoot(root).render(
  <StrictMode>
    <App
      auth={auth}
      queryClient={queryClient}
      realtime={createRealtimePort(supabase)}
      persister={createCachePersister()}
      flushPersister={createImmediateFlushPersister()}
    />
  </StrictMode>,
);
