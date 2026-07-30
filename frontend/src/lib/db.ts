import { neon } from "@neondatabase/serverless";

function getDatabaseUrl(): string {
  const databaseUrl =
    process.env.DATABASE_CONNECTION_STRING ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_CONNECTION_STRING is not configured");
  }
  return databaseUrl;
}

export function db() {
  return neon(getDatabaseUrl());
}
