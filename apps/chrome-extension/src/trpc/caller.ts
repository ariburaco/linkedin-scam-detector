import type { AppRouter } from "@acme/api/routers";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import superjson from "superjson";

import { API_URL, IS_DEV } from "@/constants/constants";
import { getStoredCookies } from "@/shared/sessionManager";

console.log("🚀 ~ IS_DEV:", IS_DEV);

export const callerApi = createTRPCClient<AppRouter>({
  links: [
    loggerLink({
      enabled: (opts) =>
        IS_DEV || (opts.direction === "down" && opts.result instanceof Error),
      colorMode: "ansi",
    }),
    httpBatchLink({
      transformer: superjson,
      url: `${API_URL}/api/trpc`,
      async headers() {
        const headers = new Map<string, string>();
        headers.set("x-trpc-source", "chrome-extension");

        headers.set("ngrok-skip-browser-warning", "skip");

        const cookies = await getStoredCookies();
        if (cookies) {
          headers.set("Cookie", cookies);
        }

        return Object.fromEntries(headers);
      },
    }),
  ],
});
