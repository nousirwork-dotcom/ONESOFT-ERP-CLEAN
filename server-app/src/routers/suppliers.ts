import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { suppliers } from '../schema.js';
import { eq, and } from 'drizzle-orm';

export const suppliersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.suppliers.findMany({
      where: and(eq(suppliers.orgId, ctx.user.orgId), eq(suppliers.isActive, true)),
      orderBy: (s, { asc }) => [asc(s.name)],
    });
  }),
});
