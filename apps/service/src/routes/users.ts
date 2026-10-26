import type { FastifyPluginAsync } from 'fastify';
import {
  changeEmailRequestSchema,
  changePasswordRequestSchema,
  deletePushSubscriptionRequestSchema,
  pushSubscriptionRequestSchema,
  setActiveHouseholdRequestSchema,
  updateNotificationPreferenceRequestSchema,
  updateProfileRequestSchema,
} from '@hestia/shared';
import { newPasswordSchema } from '@hestia/shared/common-passwords';
import { isRecentRecovery } from '../auth/jwt.js';
import { parse, type RouteContext } from '../http/context.js';
import { fail } from '../problem.js';
import { markHouseholdActive } from '../services/households.js';
import {
  deletePushSubscription,
  listNotificationPreferences,
  savePushSubscription,
  updateNotificationPreference,
} from '../services/notifications.js';
import { getProfile, setActiveHousehold, updateProfile } from '../services/users.js';

/** The wire schema with the common-password list applied, which is the full policy. */
const changePasswordBodySchema = changePasswordRequestSchema.extend({
  newPassword: newPasswordSchema,
});

export const userRoutes: FastifyPluginAsync<{ ctx: RouteContext }> = (app, { ctx }) => {
  app.get('/api/users/me', async (request) => {
    const user = await ctx.authenticate(request);
    return ctx.asUser(user, (db) => getProfile(db, user.id, ctx.isOwner(user)));
  });

  app.patch('/api/users/me', async (request) => {
    const user = await ctx.authenticate(request);
    const body = parse(updateProfileRequestSchema, request.body);
    return ctx.asUser(user, async (db) => {
      await updateProfile(db, user.id, body);
      return getProfile(db, user.id, ctx.isOwner(user));
    });
  });

  app.put('/api/users/me/active-household', async (request) => {
    const user = await ctx.authenticate(request);
    const body = parse(setActiveHouseholdRequestSchema, request.body);
    return ctx.asUser(user, async (db) => {
      await setActiveHousehold(db, user.id, body.householdId);
      // Switching to a household is a request against it.
      await markHouseholdActive(db, body.householdId);
      return getProfile(db, user.id, ctx.isOwner(user));
    });
  });

  // Re-verify the current password unless the session came from a reset link, apply the policy,
  // then GoTrue's PUT /user as the caller.
  app.post('/api/users/me/password', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const body = parse(changePasswordBodySchema, request.body);
    if (body.currentPassword === undefined) {
      if (!isRecentRecovery(user)) throw fail(400, 'Enter your current password.');
    } else if (
      !(await ctx.deps.gotrue.verifyPassword(user.email, body.currentPassword, request.ip))
    ) {
      throw fail(403, 'The current password is incorrect.');
    }
    await ctx.deps.gotrue.updatePassword(user.token, body.newPassword, request.ip);
    return reply.code(204).send();
  });

  // The admin API is the only way to change an email without sending mail, so this is one of
  // the sanctioned service-role uses, and only after the password is re-verified.
  app.post('/api/users/me/email', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const body = parse(changeEmailRequestSchema, request.body);
    if (!(await ctx.deps.gotrue.verifyPassword(user.email, body.currentPassword, request.ip))) {
      throw fail(403, 'The current password is incorrect.');
    }
    await ctx.deps.changeEmail(user.id, body.newEmail);
    return reply.code(204).send();
  });

  app.get('/api/users/me/notification-preferences', async (request) => {
    const user = await ctx.authenticate(request);
    return ctx.asUser(user, (db) => listNotificationPreferences(db, user.id));
  });

  app.patch('/api/users/me/notification-preferences', async (request) => {
    const user = await ctx.authenticate(request);
    const body = parse(updateNotificationPreferenceRequestSchema, request.body);
    return ctx.asUser(user, (db) => updateNotificationPreference(db, user.id, body));
  });

  // Registered per device: the browser's subscription is the unit, and `endpoint` identifies it.
  app.post('/api/users/me/push-subscriptions', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const body = parse(pushSubscriptionRequestSchema, request.body);
    await ctx.asUser(user, (db) => savePushSubscription(db, user.id, body));
    return reply.code(204).send();
  });

  app.delete('/api/users/me/push-subscriptions', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const body = parse(deletePushSubscriptionRequestSchema, request.body);
    await ctx.asUser(user, (db) => deletePushSubscription(db, user.id, body.endpoint));
    return reply.code(204).send();
  });

  return Promise.resolve();
};
