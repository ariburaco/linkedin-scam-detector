import { auth } from "@acme/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@acme/shared/env";

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
      "Content-Type, Authorization, Cookie, ngrok-skip-browser-warning"
    );
    headers.set("Access-Control-Max-Age", "86400");
  }

  return headers;
}

const { GET: authGet, POST: authPost } = toNextJsHandler(auth.handler);

async function handleRequest(
  req: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const response = await handler(req);

  // Add CORS headers to the response
  corsHeaders.forEach((value, key) => {
    response.headers.set(key, value);
  });

  return response;
}

export async function GET(req: NextRequest) {
  return handleRequest(req, authGet);
}

export async function POST(req: NextRequest) {
  return handleRequest(req, authPost);
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
