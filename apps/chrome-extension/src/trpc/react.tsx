import { API_URL, IS_DEV } from "@/constants/constants";
import { getStoredCookies } from "@/shared/sessionManager";
import type { AppRouter } from "@acme/api/routers";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { useState } from "react";
import superjson from "superjson";

export const api = createTRPCReact<AppRouter>();

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
      },
    },
  });

  // Create a more aggressive TRPC client
  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        loggerLink({
          enabled: (opts) =>
            IS_DEV ||
            (opts.direction === "down" && opts.result instanceof Error),
          colorMode: "ansi",
        }),
        httpBatchLink({
          transformer: superjson,
          url: `${API_URL}/api/trpc`,
          async headers() {
            const headers = new Map<string, string>();
            headers.set("x-trpc-source", "chrome-extension");
            headers.set("ngrok-skip-browser-warning", "skip");

            // Add the origin header for CORS
            headers.set("Origin", window.location.origin);

            const cookies = await getStoredCookies();
            if (cookies) {
              headers.set("Cookie", cookies);
            }

            return Object.fromEntries(headers);
          },
        }),
      ],
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {props.children}
      </api.Provider>
    </QueryClientProvider>
  );
}
