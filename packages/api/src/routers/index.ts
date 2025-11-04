import { protectedProcedure, publicProcedure, router } from "../index";
import { scamDetectorRouter } from "./scam-detector";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
  scamDetector: scamDetectorRouter,
});
export type AppRouter = typeof appRouter;
