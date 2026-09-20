import { callGoTrue, type Fetch } from '../gotrue/http.js';

/**
 * GoTrue's admin API, with the service-role key. Sanctioned for exactly two callers (Technical
 * Architecture, "The RLS rule"): the email change, after the service has re-verified the user's
 * password, and the owner CLI's reset link. ESLint keeps every other module from importing this
 * one; route code receives only the narrow functions it needs.
 */
export interface GoTrueAdmin {
  /** PUT /admin/users/:id, confirmed at once: nothing is ever emailed. */
  changeEmail: (userId: string, email: string) => Promise<void>;
  /** POST /admin/generate_link with type recovery; returns the one-time link. */
  recoveryLink: (email: string, redirectTo: string) => Promise<string>;
}

export interface GoTrueAdminOptions {
  url: string;
  serviceRoleKey: string;
  fetch?: Fetch;
}

export function createGoTrueAdmin(options: GoTrueAdminOptions): GoTrueAdmin {
  const fetchFn = options.fetch ?? fetch;
  const key = options.serviceRoleKey;

  return {
    changeEmail: async (userId, email) => {
      await callGoTrue(fetchFn, options.url, {
        method: 'PUT',
        path: `/admin/users/${encodeURIComponent(userId)}`,
        apikey: key,
        bearer: key,
        body: { email, email_confirm: true },
      });
    },

    recoveryLink: async (email, redirectTo) => {
      const { body } = await callGoTrue(fetchFn, options.url, {
        method: 'POST',
        path: '/admin/generate_link',
        apikey: key,
        bearer: key,
        body: { type: 'recovery', email, redirect_to: redirectTo },
      });
      const record =
        typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
      // GoTrue returns the link at the top level; older versions nested it under properties.
      const properties = record['properties'];
      const link =
        record['action_link'] ??
        (typeof properties === 'object' && properties !== null
          ? (properties as Record<string, unknown>)['action_link']
          : undefined);
      if (typeof link !== 'string' || link === '') {
        throw new Error('GoTrue returned no recovery link');
      }
      return link;
    },
  };
}
