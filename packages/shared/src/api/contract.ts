import type { z } from 'zod';
import { sessionResponseSchema, signupRequestSchema } from './auth.js';
import { householdIdParamsSchema, inviteParamsSchema, memberParamsSchema } from './common.js';
import {
  createHouseholdRequestSchema,
  householdListSchema,
  householdSchema,
  joinHouseholdRequestSchema,
  memberListSchema,
  updateHouseholdRequestSchema,
} from './households.js';
import { createdInviteSchema, inviteListSchema } from './invites.js';
import {
  departRequestSchema,
  departResultSchema,
  departurePreviewSchema,
  transferAdminRequestSchema,
} from './membership.js';
import {
  clientErrorRequestSchema,
  deepHealthResponseSchema,
  healthResponseSchema,
} from './system.js';
import {
  changeEmailRequestSchema,
  changePasswordRequestSchema,
  profileResponseSchema,
  setActiveHouseholdRequestSchema,
  updateProfileRequestSchema,
} from './users.js';

/**
 * Every endpoint's shape, in one place. The service validates with these schemas and generates
 * its OpenAPI document from this list, and the PWA infers its types from the same schemas.
 */
export interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Fastify-style path (`:id`) under the origin. */
  path: string;
  summary: string;
  /** public: no JWT; user: a valid JWT; owner: the server owner's JWT. */
  access: 'public' | 'user' | 'owner';
  params?: z.ZodType;
  body?: z.ZodType;
  /** The success status and, unless it is 204, its body. */
  response: { status: number; schema?: z.ZodType };
}

export const endpoints = [
  {
    method: 'POST',
    path: '/api/signup',
    summary: 'Sign up with email and password',
    access: 'public',
    body: signupRequestSchema,
    response: { status: 200, schema: sessionResponseSchema },
  },
  {
    method: 'GET',
    path: '/api/users/me',
    summary: 'The caller’s profile and memberships',
    access: 'user',
    response: { status: 200, schema: profileResponseSchema },
  },
  {
    method: 'PATCH',
    path: '/api/users/me',
    summary: 'Update display name, timezone, quiet hours, or household-bill reminders',
    access: 'user',
    body: updateProfileRequestSchema,
    response: { status: 200, schema: profileResponseSchema },
  },
  {
    method: 'PUT',
    path: '/api/users/me/active-household',
    summary: 'Switch the active household',
    access: 'user',
    body: setActiveHouseholdRequestSchema,
    response: { status: 200, schema: profileResponseSchema },
  },
  {
    method: 'POST',
    path: '/api/users/me/password',
    summary: 'Change password (re-enter the current one unless signed in by a reset link)',
    access: 'user',
    body: changePasswordRequestSchema,
    response: { status: 204 },
  },
  {
    method: 'POST',
    path: '/api/users/me/email',
    summary: 'Change email (re-enter the current password)',
    access: 'user',
    body: changeEmailRequestSchema,
    response: { status: 204 },
  },
  {
    method: 'GET',
    path: '/api/households',
    summary: 'The caller’s households',
    access: 'user',
    response: { status: 200, schema: householdListSchema },
  },
  {
    method: 'POST',
    path: '/api/households',
    summary: 'Create a household; the caller becomes its admin and it becomes active',
    access: 'user',
    body: createHouseholdRequestSchema,
    response: { status: 201, schema: householdSchema },
  },
  {
    method: 'POST',
    path: '/api/households/join',
    summary: 'Join a household by invite link token or code',
    access: 'user',
    body: joinHouseholdRequestSchema,
    response: { status: 200, schema: householdSchema },
  },
  {
    method: 'GET',
    path: '/api/households/:id',
    summary: 'A household the caller belongs to',
    access: 'user',
    params: householdIdParamsSchema,
    response: { status: 200, schema: householdSchema },
  },
  {
    method: 'PATCH',
    path: '/api/households/:id',
    summary: 'Update name, postal code, or timezone (admin)',
    access: 'user',
    params: householdIdParamsSchema,
    body: updateHouseholdRequestSchema,
    response: { status: 200, schema: householdSchema },
  },
  {
    method: 'GET',
    path: '/api/households/:id/members',
    summary: 'The household’s members',
    access: 'user',
    params: householdIdParamsSchema,
    response: { status: 200, schema: memberListSchema },
  },
  {
    method: 'GET',
    path: '/api/households/:id/invites',
    summary: 'Outstanding invites (admin)',
    access: 'user',
    params: householdIdParamsSchema,
    response: { status: 200, schema: inviteListSchema },
  },
  {
    method: 'POST',
    path: '/api/households/:id/invites',
    summary: 'Create an invite; the link and code are returned only here (admin)',
    access: 'user',
    params: householdIdParamsSchema,
    response: { status: 201, schema: createdInviteSchema },
  },
  {
    method: 'DELETE',
    path: '/api/households/:id/invites/:inviteId',
    summary: 'Revoke an invite (admin)',
    access: 'user',
    params: inviteParamsSchema,
    response: { status: 204 },
  },
  {
    method: 'GET',
    path: '/api/households/:id/members/:userId/departure-preview',
    summary: 'What a departing member owns and must reassign',
    access: 'user',
    params: memberParamsSchema,
    response: { status: 200, schema: departurePreviewSchema },
  },
  {
    method: 'POST',
    path: '/api/households/:id/leave',
    summary: 'Reassign and leave; the last member deletes the household',
    access: 'user',
    params: householdIdParamsSchema,
    body: departRequestSchema,
    response: { status: 200, schema: departResultSchema },
  },
  {
    method: 'POST',
    path: '/api/households/:id/members/:userId/remove',
    summary: 'Reassign and remove another member (admin)',
    access: 'user',
    params: memberParamsSchema,
    body: departRequestSchema,
    response: { status: 200, schema: departResultSchema },
  },
  {
    method: 'POST',
    path: '/api/households/:id/transfer-admin',
    summary: 'Hand the admin role to another member (admin)',
    access: 'user',
    params: householdIdParamsSchema,
    body: transferAdminRequestSchema,
    response: { status: 204 },
  },
  {
    method: 'POST',
    path: '/api/client-error',
    summary: 'Report a scrubbed PWA error (10 per minute per IP)',
    access: 'public',
    body: clientErrorRequestSchema,
    response: { status: 204 },
  },
  {
    method: 'GET',
    path: '/api/health',
    summary: 'Liveness and database connectivity',
    access: 'public',
    response: { status: 200, schema: healthResponseSchema },
  },
  {
    method: 'GET',
    path: '/api/health/deep',
    summary: 'Job freshness and recent errors (server owner)',
    access: 'owner',
    response: { status: 200, schema: deepHealthResponseSchema },
  },
] as const satisfies readonly Endpoint[];
