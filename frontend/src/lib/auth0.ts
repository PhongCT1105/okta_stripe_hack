import { Auth0Client } from "@auth0/nextjs-auth0/server";

export const auth0 = new Auth0Client();

/**
 * Whether Auth0 credentials are present.
 *
 * `stripe projects add auth0/client` provisions these into the environment.
 * Until it has run there is no tenant to talk to, so the SDK throws on every
 * request — which takes down the whole app, including pages that don't need
 * auth at all.
 */
export const isAuth0Configured = Boolean(
  process.env.AUTH0_DOMAIN && process.env.AUTH0_CLIENT_ID,
);

/**
 * Session for the current request, or null when Auth0 isn't configured yet.
 *
 * This lets the UI be built and demoed against mock data before credentials
 * land, and starts enforcing auth automatically the moment they do — no code
 * change needed to switch over.
 *
 * Deliberately fails *closed* in production: an unconfigured deployment throws
 * rather than quietly serving every page as though nobody needed to log in.
 * The permissive path is local development only.
 */
export async function getOptionalSession() {
  if (!isAuth0Configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Auth0 is not configured. Set AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET and AUTH0_SECRET before deploying.",
      );
    }
    return null;
  }

  return auth0.getSession();
}
