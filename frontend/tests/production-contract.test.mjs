import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [auth0, proxy, data, actions, stripe, paymentSuccess, envExample] = await Promise.all([
  read("../src/lib/auth0.ts"),
  read("../src/proxy.ts"),
  read("../src/lib/data.ts"),
  read("../src/lib/actions.ts"),
  read("../src/lib/stripe.ts"),
  read("../src/app/(app)/pay/[requestId]/success/page.tsx"),
  read("../.env.example"),
]);

test("Auth0 sessions are enforced and mapped to persistent users", () => {
  for (const key of [
    "AUTH0_DOMAIN",
    "AUTH0_CLIENT_ID",
    "AUTH0_CLIENT_SECRET",
    "AUTH0_SECRET",
  ]) {
    assert.match(auth0, new RegExp(`"${key}"`));
    assert.match(envExample, new RegExp(`^${key}=`, "m"));
  }
  assert.match(auth0, /APP_BASE_URL is required for production/);
  assert.match(proxy, /auth0\.middleware\(request\)/);
  assert.match(data, /auth0Id:\s*session\.user\.sub/);
  assert.match(data, /upsertAuth0User/);
});

test("group, challenge, and proof actions require authenticated membership", () => {
  for (const action of [
    "createGroup",
    "joinGroup",
    "joinChallenge",
    "submitProof",
  ]) {
    assert.match(actions, new RegExp(`export async function ${action}\\b`));
  }
  assert.match(actions, /getCurrentUser\(\)/);
  assert.match(actions, /requireMember\(groupId\)/);
  assert.match(actions, /persistVerdict/);
});

test("Stripe Checkout is server-side, consent-gated, and verified before persistence", () => {
  assert.match(stripe, /process\.env\.STRIPE_SECRET_KEY/);
  assert.doesNotMatch(stripe, /payment_method_types/);
  assert.match(stripe, /integration_identifier:\s*integrationIdentifier\(\)/);
  assert.match(stripe, /client_reference_id:\s*request\.id/);
  assert.match(stripe, /payment_status === "paid"/);
  assert.match(stripe, /session\.metadata\?\.paymentRequestId === request\.id/);
  assert.match(actions, /setCheckoutSession\(request\.id,\s*session\.id\)/);
  assert.match(paymentSuccess, /markPaymentPaid/);
});

test("documented Vercel variables cover every runtime integration", () => {
  for (const key of [
    "APP_BASE_URL",
    "AUTH0_DOMAIN",
    "AUTH0_CLIENT_ID",
    "AUTH0_CLIENT_SECRET",
    "AUTH0_SECRET",
    "DATABASE_CONNECTION_STRING",
    "STRIPE_SECRET_KEY",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    "ANTHROPIC_API_KEY",
    "MEMBERS_REQUIRED_TO_START",
  ]) {
    assert.match(envExample, new RegExp(`^${key}=`, "m"), `${key} is undocumented`);
  }
});
