# Commitment Agent

An AI accountability SaaS for friend groups. Members create shared challenges, commit to consequences, submit proof, and track progress together. Auth0 verifies every participant, while Stripe handles subscriptions and user-approved commitment payments.

> Working hackathon name. The product is framed as accountability and commitment, not gambling or peer-to-peer money transmission.

## Problem

Friends often make goals together, but reminders disappear in group chats and there is no shared accountability. Existing habit trackers are usually individual tools and require users to remember to open another app.

## Solution

Commitment Agent gives each friend group a shared challenge dashboard and an AI accountability agent that:

- creates or recommends daily challenges;
- tracks submissions and streaks;
- evaluates simple proof;
- reminds unfinished members;
- updates a shared leaderboard; and
- generates a Stripe Checkout request when a member confirms a missed commitment.

The complete MVP works as a web application. Group-chat delivery through Linq/iMessage is a stretch feature added only after the core flow is complete.

## Core Demo

1. A user signs in with Auth0.
2. The user creates a group and a daily challenge.
3. Friends join through an invite link and authenticate.
4. Members complete the challenge and submit proof.
5. The agent evaluates the submission and updates the leaderboard.
6. A missed challenge produces a payment request.
7. The member explicitly approves and completes a Stripe test payment.
8. A Stripe webhook confirms the payment and updates the group dashboard.

## Architecture

```text
Browser
  |
  v
Next.js application
  |-- Auth0 SDK ----------> Auth0
  |-- Server actions/API
  |       |-- Group and challenge logic
  |       |-- Accountability agent
  |       |-- Stripe Checkout sessions ------> Stripe
  |       |-- Stripe webhook <---------------- Stripe
  |       `-- Database
  |
  `-- Optional share link / Linq adapter
```

### Responsibility Split

| Component | Responsibility |
| --- | --- |
| Stripe Projects | Provisions and connects development services from the Stripe CLI |
| Auth0 client | Authenticates users and returns their verified identity to the Next.js app |
| Next.js | UI, protected routes, API endpoints, and orchestration |
| Database | Groups, memberships, challenges, submissions, streaks, and payment state |
| Accountability agent | Generates challenges, evaluates proof, and explains decisions |
| Stripe Checkout | Collects subscriptions or user-approved commitment payments |
| Stripe webhook | Confirms payment completion server-side |
| Linq, optional | Posts challenge updates to an existing group chat and receives replies |

## Stripe Projects and Auth0

Stripe Projects is the setup layer, not the payment processor for the application.

```bash
stripe projects init
stripe projects add auth0/client
stripe projects status
```

`auth0/client` provisions or connects an Auth0 application and returns its credentials to the project environment. The Next.js Auth0 SDK then uses those credentials to implement login, logout, sessions, and protected routes.

Stripe Checkout is a separate runtime integration used when the application needs to collect a payment.

## Auth0 Model

Auth0 owns identity. The application database owns product data.

```text
Auth0 user ID
   |
   v
Application user
   |-- belongs to groups
   |-- submits challenge proof
   |-- owns payment requests
   `-- has organizer/member permissions
```

Suggested application roles:

- `organizer`: creates groups and challenges;
- `member`: joins groups and submits proof;
- `admin`: optional hackathon-only moderation role.

The agent may prepare a payment request, but it cannot approve a payment for the user.

## Stripe Model

Use two simple Stripe flows:

1. **SaaS monetization:** an organizer can upgrade to a Pro subscription.
2. **Commitment payment:** a member voluntarily approves a Checkout payment after acknowledging a missed challenge.

For the hackathon, all transactions use Stripe test mode. Do not implement pooled wallets, automatic charges, winner-takes-all payouts, or peer-to-peer transfers.

## Suggested Data Model

```text
User
- id
- auth0UserId
- displayName

Group
- id
- name
- inviteCode
- ownerId

GroupMember
- groupId
- userId
- role
- streak
- score

Challenge
- id
- groupId
- title
- description
- dueAt
- commitmentAmount

Submission
- id
- challengeId
- userId
- proofUrl
- status
- agentReason

PaymentRequest
- id
- challengeId
- userId
- amount
- stripeCheckoutSessionId
- status
```

## MVP Scope

### Must Have

- Auth0 login and protected dashboard;
- create a group and invite link;
- join a group;
- create or generate one challenge;
- submit proof;
- agent pass/fail decision;
- leaderboard and streak update;
- Stripe test Checkout;
- Stripe webhook or verified success callback.

### Stretch

- scheduled reminders;
- AI-generated daily challenge rotation;
- image-based proof analysis;
- Stripe subscription tier;
- share-to-Messages button;
- Linq/iMessage group-chat adapter.

### Explicitly Out of Scope

- real pooled funds or escrow;
- autonomous charging;
- cash prizes or winner payouts;
- peer-to-peer transfers;
- refunds, disputes, taxes, or production compliance;
- native iOS application;
- production-grade fraud prevention.

## Proposed Stack

- Next.js and TypeScript
- Auth0 Next.js SDK
- Stripe Projects
- Stripe Checkout and webhooks
- PostgreSQL, Supabase, Neon, or a lightweight hackathon database
- OpenAI-compatible model for challenge generation and proof evaluation
- Vercel or local demo deployment

## Environment Variables

Exact Auth0 variable names depend on the generated integration. Expected values include:

```env
AUTH0_SECRET=
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

DATABASE_URL=
LLM_API_KEY=
```

Never commit `.env`, `.env.local`, or `.projects/vault/`.

## Demo Pitch

> Commitment Agent is an authenticated accountability partner for friend groups. It creates shared challenges, verifies progress, maintains the leaderboard, and turns missed commitments into user-approved Stripe payments. Auth0 guarantees that every action belongs to the correct person, while Stripe makes the financial commitment real.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Hackathon MVP Plan](docs/HACKATHON_PLAN.md)
