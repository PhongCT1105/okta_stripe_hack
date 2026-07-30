import { NextResponse } from "next/server";
import { auth0, isAuth0Configured } from "./lib/auth0";

/**
 * Mounts Auth0's /auth/* routes and refreshes the session cookie.
 *
 * This matcher covers every route, so when Auth0 credentials are absent the
 * SDK throws before any page renders and the entire app 500s. Standing down
 * until it's configured keeps the UI workable during development; once the
 * env vars are set this activates on its own.
 *
 * lib/auth0.ts validates complete credentials and the canonical production
 * origin when this module loads, so partial production configuration fails
 * closed.
 */
export async function proxy(request: Request) {
  if (!isAuth0Configured) return NextResponse.next();

  return auth0.middleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
