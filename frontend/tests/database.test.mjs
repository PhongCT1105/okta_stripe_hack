import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schema = await readFile(new URL("../../database/schema.sql", import.meta.url), "utf8");
const migration = await readFile(
  new URL("../../database/migrations/002_app_persistence.sql", import.meta.url),
  "utf8",
);

test("schema contains every persistent domain entity", () => {
  for (const table of [
    "users", "groups", "group_members", "challenges", "challenge_participants",
    "chat_messages", "submissions", "payment_requests",
  ]) {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
});

test("daily submissions and payments have repeat-safe uniqueness", () => {
  assert.match(schema, /UNIQUE \(challenge_id, user_id, round_date\)/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS submissions_challenge_user_round_uidx/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS payment_requests_challenge_user_round_uidx/);
});

test("migration is additive and repeatable", () => {
  assert.doesNotMatch(migration, /\bDROP TABLE\b|\bTRUNCATE\b/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS/);
});
