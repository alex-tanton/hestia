import type { FastifyPluginAsync } from 'fastify';
import { barcodeParamsSchema, type BarcodeProduct } from '@hestia/shared';
import { parse, type RouteContext } from '../http/context.js';
import { fail } from '../problem.js';
import { lookupBarcode } from '../services/barcodes.js';

export const barcodeRoutes: FastifyPluginAsync<{ ctx: RouteContext }> = (app, { ctx }) => {
  app.get('/api/barcodes/:barcode', async (request): Promise<BarcodeProduct> => {
    const user = await ctx.authenticate(request);
    const { barcode } = parse(barcodeParamsSchema, request.params);

    return ctx.asUser(user, async (db) => {
      const product = await lookupBarcode(db, barcode, ctx.ownerEmail);
      if (!product) {
        throw fail(404, 'Product not found for scanned barcode.');
      }
      return product;
    });
  });

  return Promise.resolve();
};
