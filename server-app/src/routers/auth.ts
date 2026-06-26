import { router, publicProcedure } from '../trpc.js';

export const authRouter = router({
  me: publicProcedure.query(async ({ ctx }) => {
    return ctx.user ? {
      id: ctx.user.id,
      name: ctx.user.name,
      username: ctx.user.username,
      role: ctx.user.role,
      orgId: ctx.user.orgId,
    } : null;
  }),
});
