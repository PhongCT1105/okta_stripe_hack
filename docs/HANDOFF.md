# Commitment Agent — Teammate Handoff

## What We Are Building

Commitment Agent is a multi-user accountability SaaS for friend groups.

The MVP loop is:

```text
Auth0 login
→ create or join a group
→ publish a challenge
→ submit proof
→ verify the proof
→ update streaks and leaderboard
→ create a missed-commitment payment request
→ user approves Stripe Checkout
→ confirm payment
```

The two demo challenge types are:

- Complete one accepted LeetCode problem.
- Complete 10 push-ups.

The product must work completely as a web app. Linq/iMessage is stretch work only.

## Current State

Branch: `verification`

The `fortnend` landing-page branch was merged into `verification` at commit `9d7abbd`.

Completed or scaffolded:

- Polished responsive landing page and design system.
- Next.js 16, React 19, TypeScript, Tailwind 4, and shadcn/Base UI.
- Auth0 SDK, middleware, login/logout links, and configuration guards.
- Group creation, invite-code joining, member list, and seeded demo group.
- Challenge creation and one active challenge per group.
- Proof-submission UI.
- LeetCode URL/screenshot verification work in progress.
- Push-up video/MediaPipe verification work in progress.
- Deterministic agent verdict fallback.
- Streak, score, leaderboard, missed state, and organizer override.
- Stripe-hosted Checkout for commitment payments.
- Server-side Checkout Session verification on the success route.
- Seeded demo data for Phong, Alex, and Sam.
- Architecture and hackathon-plan documentation.

Important: product data still uses the mutable in-memory store in
`frontend/src/lib/mock/store.ts`. It resets when the server restarts.

## Missing Before the MVP Is Complete

### Highest Priority

1. Connect authenticated Auth0 users to application users.
   - `getCurrentUser()` still returns seeded Phong.
   - Protect app routes and enforce group membership/organizer authorization.
   - Verify two distinct Auth0 users can join the same group.

2. Add persistent storage.
   - Replace the arrays in `frontend/src/lib/mock/store.ts`.
   - Persist users, groups, memberships, challenges, submissions, streaks, and payment requests.

3. Finish Stripe payment persistence.
   - Hosted Checkout and success-page Session verification are wired.
   - The current credentials are live-mode credentials.
   - Add a signed webhook after a webhook endpoint and signing secret exist.
   - Persist the Checkout Session and paid state in the database.
   - Never let the agent charge automatically.

4. Finish proof verification.
   - Confirm LeetCode OCR works with realistic screenshots.
   - Confirm MediaPipe counts 10 full push-ups from realistic side-view videos.
   - Add clear failure/retry states.

5. Connect the orchestration model.
   - Integration point: `evaluateWithOrchestrationModel()` in
     `frontend/src/lib/agent.ts`.
   - Consume structured verifier evidence.
   - Return a schema-validated `passed` or `missed` verdict with a reason.
   - Keep URL fetching, video counting, authorization, and payments outside the model.

### Demo Polish

- Run the full flow with two real users.
- Test mobile layouts at 375px and 768px.
- Add visible loading/error states only where judges will encounter them.
- Confirm the organizer override can recover a failed live verdict.
- Confirm `stripe projects status` shows Auth0.
- Rehearse the demo without Linq.

## Current Local Work

These verification-branch files contain uncommitted work and must not be discarded:

- `docs/ARCHITECTURE.md`
- `docs/HACKATHON_PLAN.md`
- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/src/components/create-challenge-form.tsx`
- `frontend/src/components/submit-proof-dialog.tsx`
- `frontend/src/lib/agent.ts`
- `frontend/src/lib/mock/store.ts`
- `frontend/src/lib/types.ts`
- `frontend/src/lib/proof-verifiers.ts`
- `frontend/tools/magic-mcp`

The `.worktrees/` directory and generated Python `__pycache__` files are local artifacts.

## Key Files

- Product plan: `docs/HACKATHON_PLAN.md`
- Architecture: `docs/ARCHITECTURE.md`
- Landing page: `frontend/src/app/page.tsx`
- Theme: `frontend/src/app/globals.css`
- Server actions: `frontend/src/lib/actions.ts`
- Read layer: `frontend/src/lib/data.ts`
- Mock database: `frontend/src/lib/mock/store.ts`
- Agent evaluation: `frontend/src/lib/agent.ts`
- Proof preprocessing: `frontend/src/lib/proof-verifiers.ts`
- Auth0 client: `frontend/src/lib/auth0.ts`
- Core types: `frontend/src/lib/types.ts`

## Local Setup

```bash
cd frontend
npm install
npm run dev
```

Required production integrations:

```text
AUTH0_DOMAIN
AUTH0_CLIENT_ID
AUTH0_CLIENT_SECRET
AUTH0_SECRET
APP_BASE_URL
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
DATABASE_URL
```

Do not commit secrets.

## Verification Commands

```bash
cd frontend
npm run lint
npm run build
```

Current verification-branch status:

- `npm run lint`: passed.
- `npm run build`: passed.

Re-run both commands after new integration work.

## Recommended Ownership Split

- Teammate A: Auth0 user mapping, route authorization, and database persistence.
- Teammate B: LeetCode/push-up verification and orchestration-model integration.
- Teammate C: Stripe Checkout, success verification/webhook, and full demo rehearsal.

Do not start Linq/iMessage work until the complete web flow passes.
