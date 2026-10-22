import type { FastifyPluginAsync } from 'fastify';
import {
  billIdParamsSchema,
  billPaymentParamsSchema,
  createBillRequestSchema,
  householdIdParamsSchema,
  moveBillRequestSchema,
  payBillRequestSchema,
  updateBillPaymentRequestSchema,
  updateBillRequestSchema,
} from '@hearth/shared';
import { parse, type RouteContext } from '../http/context.js';
import {
  archiveBill,
  confirmBillUsage,
  createHouseholdBill,
  createPersonalBill,
  deleteBill,
  deleteBillPayment,
  getBill,
  listBills,
  moveBill,
  payBill,
  skipBill,
  updateBill,
  updateBillPayment,
} from '../services/bills.js';
import { getSubscriptions } from '../services/subscriptions.js';

/**
 * Bills, the payment log, skip, archive, and subscriptions. `/bills/:id` routes do not name a
 * household in the path, so the service functions find it from the row, the same convention
 * `/recipes/:id` and `/meal-plan/:id` follow.
 */
export const billRoutes: FastifyPluginAsync<{ ctx: RouteContext }> = (app, { ctx }) => {
  app.get('/api/households/:id/bills', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    return ctx.inHousehold(user, id, (db) => listBills(db, id, user.id));
  });

  app.post('/api/households/:id/bills', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    const body = parse(createBillRequestSchema, request.body);
    const bill = await ctx.inHousehold(user, id, (db) =>
      createHouseholdBill(db, id, user.id, body),
    );
    return reply.code(201).send(bill);
  });

  app.post('/api/users/me/bills', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const body = parse(createBillRequestSchema, request.body);
    const bill = await ctx.asUser(user, (db) => createPersonalBill(db, user.id, body));
    return reply.code(201).send(bill);
  });

  app.get('/api/households/:id/subscriptions', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    return ctx.inHousehold(user, id, (db) => getSubscriptions(db, id, user.id));
  });

  app.get('/api/bills/:id', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(billIdParamsSchema, request.params);
    return ctx.asUser(user, (db) => getBill(db, id));
  });

  app.patch('/api/bills/:id', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(billIdParamsSchema, request.params);
    const body = parse(updateBillRequestSchema, request.body);
    return ctx.asUser(user, (db) => updateBill(db, id, body));
  });

  app.delete('/api/bills/:id', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(billIdParamsSchema, request.params);
    await ctx.asUser(user, (db) => deleteBill(db, id));
    return reply.code(204).send();
  });

  app.post('/api/bills/:id/pay', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(billIdParamsSchema, request.params);
    const body = parse(payBillRequestSchema, request.body ?? {});
    const payment = await ctx.asUser(user, (db) => payBill(db, id, user.id, body));
    return reply.code(201).send(payment);
  });

  app.post('/api/bills/:id/skip', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(billIdParamsSchema, request.params);
    const payment = await ctx.asUser(user, (db) => skipBill(db, id, user.id));
    return reply.code(201).send(payment);
  });

  app.post('/api/bills/:id/archive', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(billIdParamsSchema, request.params);
    return ctx.asUser(user, (db) => archiveBill(db, id));
  });

  app.post('/api/bills/:id/confirm-usage', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(billIdParamsSchema, request.params);
    return ctx.asUser(user, (db) => confirmBillUsage(db, id));
  });

  app.post('/api/bills/:id/move', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(billIdParamsSchema, request.params);
    const body = parse(moveBillRequestSchema, request.body);
    return ctx.asUser(user, (db) => moveBill(db, id, user.id, body));
  });

  app.patch('/api/bills/:id/payments/:paymentId', async (request) => {
    const user = await ctx.authenticate(request);
    const { id, paymentId } = parse(billPaymentParamsSchema, request.params);
    const body = parse(updateBillPaymentRequestSchema, request.body);
    return ctx.asUser(user, (db) => updateBillPayment(db, id, paymentId, body));
  });

  app.delete('/api/bills/:id/payments/:paymentId', async (request, reply) => {
    const user = await ctx.authenticate(request);
    const { id, paymentId } = parse(billPaymentParamsSchema, request.params);
    await ctx.asUser(user, (db) => deleteBillPayment(db, id, paymentId));
    return reply.code(204).send();
  });

  return Promise.resolve();
};
