# Wiring the real database

The app works end to end today, but every read and write goes through the
in-memory store in `frontend/src/lib/mock/store.ts`. That store is module state:
it survives across requests inside one running process and resets on restart.

That is fine locally and **broken on Vercel**, where each serverless invocation
may hit a different instance with its own copy. A message one person posts can
vanish on the next page load, and credit balances won't accumulate. Wiring
Postgres is what makes the deployed version behave like the local one.

## The good news

Persistence is confined to two files:

- `frontend/src/lib/data.ts` — every read
- `frontend/src/lib/actions.ts` — every write

Nothing else imports the store except `frontend/src/app/(app)/wallet/success/page.tsx`
and `frontend/src/lib/agent-tools.ts`, both of which write through the same
collections. No component knows where data comes from, and every read function
is already `async`, so their signatures don't change.

## What already exists

- Neon is provisioned and linked through Stripe Projects (`docs/NEON_SETUP.md`).
- `frontend/src/lib/db.ts` returns a `neon()` client from
  `DATABASE_CONNECTION_STRING` or `DATABASE_URL`.
- `frontend/scripts/migrate.mjs` applies `database/schema.sql`, run as
  `npm run db:migrate` from `frontend/`. It reads the repo-root `.env`
  (`--env-file=../.env`), not `frontend/.env` — the connection string has to
  live there.
- `database/schema.sql` now matches the current domain model, including the
  three tables the original schema predated: `chat_messages`,
  `challenge_participants`, and `wallet_entries`.

Nothing imports `db.ts` yet. That's the work.

## Order to do it in

1. **Apply the schema.** `npm run db:migrate` from `frontend/`. It needs
   `DATABASE_CONNECTION_STRING` (or `DATABASE_URL`) in the **repo-root** `.env`,
   which neither `.env` currently has — run `stripe projects env --pull` first
   (see `docs/NEON_SETUP.md`). Confirm the tables land before touching
   application code.

   The schema has not been executed against a live database yet, so treat the
   first run as part of the work rather than a formality.

2. **Port the reads in `data.ts`.** Start with `getCurrentUser`, because
   everything else depends on the user existing. Note it does an upsert: first
   Auth0 login creates the app user *and* their signup grant. Both writes have
   to happen in one transaction, or a crash between them leaves an account with
   no credits.

3. **Port the writes in `actions.ts`.** The ones with real invariants:
   - `submitProof` — the forfeit must not double-charge on a re-submission.
     `one_forfeit_per_round` enforces this in the database now, so let the
     unique violation be the guard rather than a read-then-write race.
   - `joinChallenge` — reads the participant count, then may flip the challenge
     to `active`. Two people staking simultaneously can both see "1 participant"
     and neither will start it. Do the count and the update in one statement.
   - `cashOut` — issues Stripe refunds, then records ledger entries. If the
     process dies between the two, the money left but the ledger doesn't know.
     Record intent first, or reconcile against Stripe on startup.

4. **Delete `mock/store.ts`** once nothing imports it. The seed data in it is
   worth keeping as a SQL seed file — the demo depends on that seeded
   conversation being there for the agent to read.

## Things that will bite

- **Balance is `SUM(amount_cents)`, not a column.** Keep it that way. A stored
  balance can drift from the ledger; a sum cannot.
- **Money is integer cents everywhere.** Never `float`, never `money`.
- **Round dates are local `YYYY-MM-DD`**, produced by `localDate()`. They are
  not timestamps and must not be converted to UTC — a round is a calendar day
  in the member's own day, and shifting it moves which day a miss belongs to.
- **`getCurrentRound()` derives the round from the calendar** rather than
  storing rows per day. Keep that; it's why there's no scheduler.
- **Only Stripe-funded credits are withdrawable.** `getRefundableTopUps` nets
  each top-up against refunds already drawn from it. If that logic moves into
  SQL, keep the netting — otherwise the same money can be cashed out twice.

## Deploy checklist

Environment variables on Vercel:

```
DATABASE_CONNECTION_STRING   # or DATABASE_URL
ANTHROPIC_API_KEY            # without it the agent silently uses keyword rules
AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_SECRET
STRIPE_SECRET_KEY            # currently sk_test
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
APP_BASE_URL                 # the Vercel URL, not localhost
```

`APP_BASE_URL` is the one that silently breaks things: Stripe builds its success
and cancel URLs from it, so a stale localhost value sends people back to their
own machine after paying. The deployed URL also has to be in Auth0's Allowed
Callback and Logout URLs.

`MEMBERS_REQUIRED_TO_START` defaults to 2. It exists so one person can walk the
whole loop while testing; leave it unset in production.
