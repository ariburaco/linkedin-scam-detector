import { z } from "zod";

export const updateUserSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
});

export type UpdateUserParams = z.infer<typeof updateUserSchema>;
