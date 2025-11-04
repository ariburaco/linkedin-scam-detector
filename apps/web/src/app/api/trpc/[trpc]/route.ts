import { createContext } from "@acme/api/context";
import { appRouter } from "@acme/api/routers";
import { env } from "@acme/shared/env";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { NextRequest, NextResponse } from "next/server";

function getCorsHeaders(origin: string | null) {
  const headers = new Headers();

  // Allow Chrome extension origins
  const isChromeExtension = origin?.startsWith("chrome-extension://");
  const isAllowedOrigin =
    isChromeExtension ||
    origin === env.CORS_ORIGIN ||
    (process.env.NODE_ENV === "development" && origin?.includes("localhost"));

  if (isAllowedOrigin && origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Cookie, x-trpc-source, ngrok-skip-browser-warning"
    );
    headers.set("Access-Control-Max-Age", "86400");
  }

  return headers;
}

async function handler(req: NextRequest) {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(req),
    onError: ({ error, path }) => {
      console.error(`❌ tRPC failed on ${path ?? "<no-path>"}:`, error);
    },
  });

  // Add CORS headers to the response
  corsHeaders.forEach((value, key) => {
    response.headers.set(key, value);
  });

  return response;
}

export { handler as GET, handler as POST, handler as OPTIONS };
