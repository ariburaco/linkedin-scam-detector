import { z } from "zod";

export const updateUserSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
});

export type UpdateUserParams = z.infer<typeof updateUserSchema>;

// NOTE: Do NOT export env from here - it contains server-side environment variables
// that should not be accessible to client-side code (Chrome extension, web app client)
// Import env directly from "@acme/shared/env" if needed in server-side code only

// Export feature flags
export {
  DEFAULT_FEATURE_FLAGS,
  FEATURE_FLAG_KEYS,
  type FeatureFlagKey,
  type FeatureFlags,
} from "./feature-flags";
