import type { auth } from "@acme/auth";
import { adminClient, anonymousClient } from "better-auth/client/plugins";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";


import { AUTH_URL } from "@/constants/constants";

export const authClient = createAuthClient({
  baseURL: AUTH_URL,
  fetchOptions: {
    headers: {
      "ngrok-skip-browser-warning": "skip",
    },
  },
  plugins: [
    adminClient(),
    anonymousClient(),
    inferAdditionalFields<typeof auth>(),
  ],
});
