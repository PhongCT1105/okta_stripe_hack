# Deployment checklist

- Apply `database/schema.sql` and every ordered file in `database/migrations/` to the production Neon database.
- Set Vercel Production variables: `APP_BASE_URL`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET`, `DATABASE_CONNECTION_STRING`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and optionally `ANTHROPIC_API_KEY` and `MEMBERS_REQUIRED_TO_START`.
- Set `APP_BASE_URL` to the canonical HTTPS origin. Omit it in Preview so Auth0 derives each preview origin.
- Keep all secret variables server-only and mark them Sensitive in Vercel. Prefer a least-privilege Stripe restricted key where supported.
- Register the exact production and preview callback, logout, and web-origin URLs in the Auth0 Regular Web Application.
- Run `npm run lint`, `npm run typecheck`, `npm run db:test`, `npm run test:integration`, and `npm run build` from `frontend/`.
- Smoke-test login, logout, protected routes, group create/join, challenge stake/activation, proof verdicts, payment approval, Checkout return verification, and persistence after a fresh session.
- Confirm Stripe webhook signatures before enabling any webhook-driven fulfillment.
