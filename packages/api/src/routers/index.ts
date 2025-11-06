import { protectedProcedure, publicProcedure, router } from "../index";

import { featureFlagsRouter } from "./feature-flags";
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
  featureFlags: featureFlagsRouter,
});
export type AppRouter = typeof appRouter;
