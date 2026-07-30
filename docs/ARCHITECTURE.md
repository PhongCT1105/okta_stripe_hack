# Application Architecture

## Goal

Build the smallest complete multi-user SaaS that demonstrates Auth0 identity, Stripe-powered monetization, an AI accountability workflow, and a clear path to optional group-chat delivery.

The web application is the product. Messaging integrations are adapters added later.

## System Overview

```text
                         +----------------------+
                         |       Auth0          |
                         | login, session, ID   |
                         +----------+-----------+
                                    |
                                    v
+---------+               +---------+----------+               +---------+
| Browser | <-----------> |      Next.js       | <-----------> | Database|
+---------+               | UI + server routes |               +---------+
                          +----+-----------+----+
                               |           |
                               |           +------------------+
                               v                              v
                    +----------+---------+          +---------+---------+
                    | Accountability AI |          |      Stripe       |
                    | generate/evaluate |          | Checkout/webhooks |
                    +-------------------+          +-------------------+

Optional later:
Next.js events <-> Messaging adapter <-> Linq/iMessage/SMS
```

## Request Flow

### Authentication

1. The browser starts Auth0 Universal Login.
2. Auth0 authenticates the user and returns a session to Next.js.
3. Next.js reads the Auth0 user identifier.
4. The application creates or retrieves the matching database user.
5. Protected routes use the authenticated user ID for authorization.

Auth0 answers **who the user is**. The application database answers **which groups and challenges the user can access**.

### Group and Challenge Flow

1. An authenticated organizer creates a group.
2. The backend creates a unique invite code.
3. Friends open the invite URL and authenticate through Auth0.
4. The backend creates `GroupMember` records.
5. The organizer creates a challenge manually or asks the agent to generate one.
6. The challenge appears on every member's dashboard.

### Submission Flow

1. A member submits text, a URL, or an image reference as proof.
2. The backend stores the submission with `pending` status.
3. The accountability agent receives the challenge criteria and proof.
4. The agent returns a structured decision:

```json
{
  "status": "passed",
  "confidence": 0.91,
  "reason": "The submitted URL shows an accepted solution before the deadline."
}
```

5. The backend saves the decision and updates score or streak state.
6. The UI refreshes the group leaderboard.

For demo stability, an organizer can manually override the agent decision.

### Payment Flow

1. A missed commitment creates a `PaymentRequest` with `pending` status.
2. The user opens the request and explicitly chooses to pay.
3. The backend creates a Stripe Checkout Session.
4. Stripe hosts the payment page in test mode.
5. Stripe redirects the user to a success page.
6. A Stripe webhook verifies the event server-to-server.
7. The backend marks the request `paid` and updates the dashboard.

The agent can prepare the request but cannot approve or execute the user's payment.

## Stripe Projects

Stripe Projects is used during setup:

```bash
stripe projects init
stripe projects add auth0/client
stripe projects status
```

It provisions or connects Auth0 and returns credentials to the environment. It may also provision another provider from the catalog, but this is not required for the core demo.

Stripe Projects is separate from Stripe Checkout:

```text
Stripe Projects = developer infrastructure setup
Stripe Checkout = customer payment experience
```

## Auth0 Client

`auth0/client` represents the Auth0 application used by the Next.js frontend and server.

Expected responsibilities:

- Universal Login;
- secure session cookies;
- login and logout routes;
- authenticated user profile;
- protection of private pages and APIs.

For the MVP, organizer/member authorization may live in the application database. Auth0 Organizations or advanced fine-grained authorization are optional stretch work.

## Core Components

### Next.js Frontend

Pages:

- landing page;
- login/logout;
- dashboard;
- group detail;
- create challenge;
- submit proof;
- payment request;
- Stripe success/cancel pages.

### Next.js Backend

Endpoints or server actions:

- create/join group;
- create/generate challenge;
- submit/evaluate proof;
- fetch leaderboard;
- create Checkout Session;
- receive Stripe webhook.

### Database

The database is the source of truth for product state.

Minimum entities:

- `User`
- `Group`
- `GroupMember`
- `Challenge`
- `Submission`
- `PaymentRequest`

### Accountability Agent

The agent has two bounded jobs:

1. Produce a challenge from organizer constraints.
2. Evaluate submitted proof against explicit challenge criteria.

It does not control identity, authorize access, or charge cards.

### Stripe

Use Stripe for:

- one-time commitment Checkout Sessions;
- optional Pro subscription;
- payment confirmation through signed webhooks.

### Optional Messaging Adapter

The web app publishes internal events such as:

```text
challenge.created
submission.reviewed
payment.requested
payment.completed
```

A future Linq adapter can subscribe to these events and send chat messages. Incoming replies can be normalized into the same submission endpoint used by the website.

This preserves one source of truth and prevents messaging failures from breaking the core app.

## Authorization Rules

- Users can view only groups they belong to.
- Only organizers can create or edit group challenges.
- Members can submit proof only for themselves.
- Users can open only their own payment requests.
- Stripe webhook endpoints verify Stripe signatures.
- Agent output is treated as untrusted structured input and validated before persistence.

## Demo Reliability Choices

These are hackathon simplifications, not production claims:

- Stripe test mode only;
- simple database schema;
- one agent evaluation request at a time;
- manual organizer override;
- no scheduled background workers required;
- no real redistribution or payout;
- no native messaging integration required.

## Success Criteria

The architecture is successful when the demo can show this complete loop:

```text
Auth0 login
-> create/join group
-> publish challenge
-> submit proof
-> agent evaluates
-> leaderboard updates
-> user approves Stripe Checkout
-> webhook confirms payment
```
