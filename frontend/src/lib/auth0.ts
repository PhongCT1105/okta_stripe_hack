import { Auth0Client } from "@auth0/nextjs-auth0/server";

const AUTH0_CREDENTIAL_KEYS = [
  "AUTH0_DOMAIN",
  "AUTH0_CLIENT_ID",
  "AUTH0_CLIENT_SECRET",
  "AUTH0_SECRET",
] as const;

function validateAppBaseUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("APP_BASE_URL must be a single absolute URL.");
  }

  const isLocalHttp =
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1");

  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new Error(
      "APP_BASE_URL must use HTTPS except for localhost development.",
    );
  }

  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "APP_BASE_URL must contain only the application origin, without credentials, a path, query, or fragment.",
    );
  }

  return url.origin;
}

export function validateAuth0Configuration() {
  const presentKeys = AUTH0_CREDENTIAL_KEYS.filter(
    (key) => process.env[key]?.trim(),
  );

  if (
    presentKeys.length > 0 &&
    presentKeys.length !== AUTH0_CREDENTIAL_KEYS.length
  ) {
    const missingKeys = AUTH0_CREDENTIAL_KEYS.filter(
      (key) => !process.env[key]?.trim(),
    );
    throw new Error(
      `Auth0 configuration is incomplete. Missing: ${missingKeys.join(", ")}.`,
    );
  }

  const configuredBaseUrl = process.env.APP_BASE_URL?.trim();
  if (configuredBaseUrl) validateAppBaseUrl(configuredBaseUrl);

  if (
    process.env.NODE_ENV === "production" &&
    process.env.VERCEL_ENV !== "preview" &&
    process.env.VERCEL_ENV !== "development" &&
    !configuredBaseUrl
  ) {
    throw new Error(
      "APP_BASE_URL is required for production. Set it to the canonical HTTPS application origin.",
    );
  }

  if (
    process.env.NODE_ENV === "production" &&
    presentKeys.length !== AUTH0_CREDENTIAL_KEYS.length
  ) {
    throw new Error(
      `Auth0 is not configured. Set ${AUTH0_CREDENTIAL_KEYS.join(", ")} before deploying.`,
    );
  }

  return {
    configured: presentKeys.length === AUTH0_CREDENTIAL_KEYS.length,
    appBaseUrl: configuredBaseUrl
      ? validateAppBaseUrl(configuredBaseUrl)
      : undefined,
  };
}

const configuration = validateAuth0Configuration();

export const auth0 = new Auth0Client({
  appBaseUrl: configuration.appBaseUrl,
  enableAccessTokenEndpoint: false,
});

/**
 * Whether Auth0 credentials are present.
 *
 * `stripe projects add auth0/client` provisions these into the environment.
 * Until it has run there is no tenant to talk to, so the SDK throws on every
 * request — which takes down the whole app, including pages that don't need
 * auth at all.
 */
export const isAuth0Configured = Boolean(
  configuration.configured,
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
    return null;
  }

  return auth0.getSession();
}
