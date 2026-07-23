/**
 * transfersRouter — stub router for warehouse transfers
 * The client Transfers.tsx page references these procedures.
 * Full implementation is tracked as a separate task.
 */
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';

const transferItemSchema = z.object({
  productId: z.number(),
  productName: z.string(),
  quantity: z.string(),
});

const transferShape = z.object({
  id: z.number(),
  status: z.enum(['pending', 'approved', 'rejected']),
  fromWarehouseId: z.number(),
  toWarehouseId: z.number(),
  notes: z.string().nullable().optional(),
  createdAt: z.date().optional(),
  fromWarehouse: z.object({ id: z.number(), name: z.string() }).optional().nullable(),
  toWarehouse: z.object({ id: z.number(), name: z.string() }).optional().nullable(),
  items: z.array(z.object({ productId: z.number(), productName: z.string(), quantity: z.string() })).optional(),
  createdByUser: z.object({ id: z.number(), name: z.string() }).optional().nullable(),
  requestedBy: z.number().optional().nullable(),
  rejectionReason: z.string().nullable().optional(),
});

export type Transfer = z.infer<typeof transferShape>;

export const transfersRouter = router({
  list: protectedProcedure
    .input(z.object({ status: z.enum(['pending', 'approved', 'rejected']).optional() }).optional())
    .query(async (): Promise<Transfer[]> => {
      return [];
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (): Promise<Transfer | null> => {
      return null;
    }),

  create: protectedProcedure
    .input(z.object({
      fromWarehouseId: z.number(),
      toWarehouseId: z.number(),
      items: z.array(transferItemSchema),
      notes: z.string().optional(),
    }))
    .mutation(async (): Promise<{ id: number }> => {
      throw new Error('Transfers feature not yet implemented');
    }),

  approve: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (): Promise<{ ok: boolean }> => {
      throw new Error('Transfers feature not yet implemented');
    }),

  reject: protectedProcedure
    .input(z.object({ id: z.number(), reason: z.string().optional() }))
    .mutation(async (): Promise<{ ok: boolean }> => {
      throw new Error('Transfers feature not yet implemented');
    }),
});
