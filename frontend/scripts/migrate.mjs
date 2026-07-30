import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const databaseUrl =
  process.env.DATABASE_CONNECTION_STRING ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_CONNECTION_STRING is not configured");
}

const schemaUrl = new URL("../../database/schema.sql", import.meta.url);
const schema = await readFile(schemaUrl, "utf8");
const sql = neon(databaseUrl);

const statements = schema
  .split(";")
  .map((statement) => statement.trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
}

console.log("Database schema applied");
