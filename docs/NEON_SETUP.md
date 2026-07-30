# Neon setup

The `neon` branch is isolated at `.worktrees/neon`. The application-side Neon
driver and initial schema are ready. Database provisioning is intentionally
deferred until the Vercel agent commits its Stripe Projects state.

## What is already ready

- Neon provider is linked to Stripe Projects.
- `@neondatabase/serverless` is installed.
- `frontend/src/lib/db.ts` reads `DATABASE_URL` server-side.
- `database/schema.sql` defines the initial application schema.

## Provision after the Vercel work is committed

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

The exact connection variable name is determined by the CLI. The application
expects `DATABASE_URL`. If the generated key differs, bind or map it to
`DATABASE_URL` through Stripe Projects or the deployment environment.

## Apply the schema

Use the Neon SQL editor or `psql`:

```bash
psql "$DATABASE_URL" -f database/schema.sql
```

## Still missing

- Provision the Neon Free plan and Postgres resource.
- Apply `database/schema.sql`.
- Replace `frontend/src/lib/mock/store.ts` reads and writes with database
  queries.
- Map the authenticated Auth0 subject to `users.auth0_id`.
- Add migrations and seed data before production deployment.
- Add `DATABASE_URL` to Vercel and redeploy.
