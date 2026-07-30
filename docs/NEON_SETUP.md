# Neon setup

The `neon` branch is isolated at `.worktrees/neon`. The application-side Neon
driver and initial schema are ready. Database provisioning is intentionally
deferred until the Vercel agent commits its Stripe Projects state.

## What is already ready

- Neon provider is linked to Stripe Projects.
- `@neondatabase/serverless` is installed.
- `frontend/src/lib/db.ts` reads `DATABASE_URL` server-side.
- `database/schema.sql` defines the initial application schema.

## Provisioning

Run these commands from the repository root:

```bash
stripe projects add neon/free --name neon-plan --accept-tos --yes
stripe projects add neon/postgres --name database --accept-tos --yes
stripe projects env --pull
```

Do not hand-edit `.projects/` or `.env`; the CLI owns both.

Confirm that the environment contains the database resource:

```bash
stripe projects status
stripe projects env
```

Stripe Projects provides `DATABASE_CONNECTION_STRING`, which the application
uses directly.

## Apply the schema

From `frontend/`, run:

```bash
npm run db:migrate
```

## Still missing

- Replace `frontend/src/lib/mock/store.ts` reads and writes with database
  queries.
- Map the authenticated Auth0 subject to `users.auth0_id`.
- Add migrations and seed data before production deployment.
- Add `DATABASE_URL` to Vercel and redeploy.
