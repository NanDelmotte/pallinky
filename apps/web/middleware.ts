// apps/web/middleware.ts

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function shouldNeverCache(pathname: string) {
  return pathname.startsWith("/event/");
}

function isPlainEventPage(pathname: string) {
  return /^\/event\/[^/]+\/?$/.test(pathname);
}

function hardenEventResponse(request: NextRequest, response: NextResponse) {
  if (!shouldNeverCache(request.nextUrl.pathname)) {
    return response;
  }

  response.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, max-age=0, must-revalidate"
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("CDN-Cache-Control", "no-store");
  response.headers.set("Vercel-CDN-Cache-Control", "no-store");
  response.headers.set("Surrogate-Control", "no-store");

  if (isPlainEventPage(request.nextUrl.pathname) && !request.nextUrl.searchParams.has("token")) {
    response.cookies.delete("pallinky_guest_token");
    response.cookies.delete("pallinky_guest_email");
    request.cookies.getAll().forEach((cookie) => {
      if (cookie.name.startsWith("pallinky_guest_token_")) {
        response.cookies.delete(cookie.name);
      }
    });
  }

  return response;
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/auth/callback")) {
    return hardenEventResponse(request, NextResponse.next());
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If env vars are missing, skip middleware instead of crashing
  if (!supabaseUrl || !supabaseAnon) {
    return hardenEventResponse(request, NextResponse.next());
  }

  let response = NextResponse.next();

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );

        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  await supabase.auth.getUser();

  return hardenEventResponse(request, response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
