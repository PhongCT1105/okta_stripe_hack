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
const schemaUrl = new URL("schema.sql", databaseUrlPath);
const migrationUrls = (await readdir(migrationUrl))
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => new URL(file, migrationUrl));

async function statementsFor(file) {
  const source = await readFile(file, "utf8");
  return source
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

// Existing databases may have older table shapes. Create missing tables first,
// apply additive migrations next, then create indexes that reference new
// columns. This ordering is also safe for a completely empty database.
const schemaStatements = await statementsFor(schemaUrl);
const schemaIndexes = schemaStatements.filter((statement) =>
  /^CREATE\s+(UNIQUE\s+)?INDEX\b/i.test(statement),
);
const schemaTables = schemaStatements.filter(
  (statement) => !/^CREATE\s+(UNIQUE\s+)?INDEX\b/i.test(statement),
);

for (const statement of schemaTables) await sql.query(statement);
for (const file of migrationUrls) {
  for (const statement of await statementsFor(file)) await sql.query(statement);
}
for (const statement of schemaIndexes) await sql.query(statement);

console.log("Database schema applied safely");
