/**
 * The URL fragment as the app was opened.
 *
 * Two things arrive in the fragment and neither survives long: an invite token
 * (`/join#token=…`, kept out of every log because browsers never send a fragment), and the
 * session GoTrue's `/verify` hands to `/set-password`, which supabase-js consumes and clears.
 * Reading it once at module load, before anything renders, is what makes both readable.
 */
const initialHash = typeof window === 'undefined' ? '' : window.location.hash;

export function initialUrlHash(): string {
  return initialHash;
}

/** The error GoTrue puts in the fragment when a reset link is expired or already used. */
export function hashHasAuthError(hash: string): boolean {
  return new URLSearchParams(hash.replace(/^#/, '')).has('error');
}
