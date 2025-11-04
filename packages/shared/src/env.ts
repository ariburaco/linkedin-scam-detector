import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    // Database
    DATABASE_URL: z.string().url().min(1),

    // Better Auth
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.string().url().min(1),

    // CORS
    CORS_ORIGIN: z.string().url().min(1),

    // // Polar Payments
    // POLAR_ACCESS_TOKEN: z.string().min(1),
    // POLAR_SUCCESS_URL: z.string().url().min(1),

    // Google AI (Gemini)
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),

    // Node Environment
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .optional()
      .default("development"),
  },
  client: {
    // Public environment variables (if needed in the future)
    // NEXT_PUBLIC_API_URL: z.string().url().optional(),
  },
  experimental__runtimeEnv: {
    // Client-side runtime env (if needed)
    // NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  skipValidation: !!process.env.CI || !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
