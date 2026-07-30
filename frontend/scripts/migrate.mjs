import { readFile, readdir } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const databaseUrl =
  process.env.DATABASE_CONNECTION_STRING ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_CONNECTION_STRING is not configured");
}

const sql = neon(databaseUrl);
const databaseUrlPath = new URL("../../database/", import.meta.url);
const migrationUrl = new URL("migrations/", databaseUrlPath);
const files = [
  new URL("schema.sql", databaseUrlPath),
  ...(await readdir(migrationUrl))
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => new URL(file, migrationUrl)),
];

for (const file of files) {
  const source = await readFile(file, "utf8");
  const statements = source
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) await sql.query(statement);
}

console.log("Database schema applied safely");
