# Hackathon MVP Plan

## Objective

Deliver a complete, judgeable workflow before adding optional integrations.

The core product is a multi-user accountability SaaS. Linq/iMessage is a stretch layer only.

## Build Order

### Phase 1 — Foundation

- Initialize Next.js and TypeScript.
- Run Stripe Projects setup.
- Provision Auth0 with `stripe projects add auth0/client`.
- Add Auth0 login/logout and a protected dashboard.
- Add a minimal database connection.

**Checkpoint:** two users can authenticate and reach a protected page.

### Phase 2 — Multi-User SaaS Core

- Create `User`, `Group`, and `GroupMember` entities.
- Build group creation.
- Generate an invite link.
- Let a second authenticated user join.
- Display the member list.

**Checkpoint:** the demo visibly has multiple authenticated users in one shared group.

### Phase 3 — Accountability Loop

- Add the two MVP challenge types: one accepted LeetCode problem or 10 push-ups.
- Add one optional AI-generated challenge.
- Verify LeetCode using an accepted submission link or screenshot OCR.
- Count push-ups from an uploaded video using pretrained pose landmarks.
- Add structured agent evaluation.
- Update streaks and leaderboard.
- Include organizer override for demo recovery.

**Checkpoint:** one member passes and one member misses a challenge.

### Phase 4 — Stripe

- Create a pending commitment payment for the missed member.
- Create a Stripe Checkout Session in test mode.
- Add success and cancel pages.
- Add Stripe webhook confirmation if time permits; otherwise verify the Session server-side on the success route.
- Update payment status in the dashboard.

**Checkpoint:** a judge can see a real Stripe test Checkout and the completed state in the app.

### Phase 5 — Polish

- Seed a polished demo group.
- Add empty, loading, and error states only where visible in the demo.
- Prepare one architecture diagram.
- Confirm `stripe projects status` shows Auth0.
- Rehearse the demo flow.

### Stretch — Messaging

Only after the core demo works:

1. Add a Share Challenge button that copies a group invite message.
2. Add a Messages share link or native share sheet.
3. Add Linq outbound challenge notifications.
4. Add Linq webhook handling for replies.

Stop immediately if messaging threatens the working web demo.

## Priority Matrix

| Feature | Priority | Demo value | Risk |
| --- | --- | --- | --- |
| Auth0 login | Must | High | Low |
| Shared group | Must | High | Low |
| Challenge creation | Must | High | Low |
| Proof submission | Must | High | Low |
| Agent evaluation | Must | High | Medium |
| Leaderboard | Must | High | Low |
| Stripe Checkout | Must | Very high | Medium |
| Webhook confirmation | Should | High | Medium |
| Pro subscription | Could | Medium | Medium |
| Share-to-Messages | Could | Medium | Low |
| Linq integration | Stretch | High | High |
| Real payouts | Do not build | Low | Very high |

## Recommended Demo Data

Group:

```text
30-Day Builder Challenge
```

Challenge:

```text
Complete one LeetCode problem before 5:00 PM.
Commitment: $5 after a confirmed miss.
```

Members:

- Phong — completed, 5-day streak;
- Alex — completed, 3-day streak;
- Sam — missed, payment pending.

This creates an immediate reason to show the agent decision, leaderboard, and Stripe Checkout.

## Demo Script

### Opening

> Friends make commitments in group chats, but there is no shared system that remembers, verifies, and follows through. WIP AI turns those promises into authenticated challenges with real, user-approved financial accountability.

### Walkthrough

1. Sign in through Auth0.
2. Open the shared group and show multiple members.
3. Create or reveal today's challenge.
4. Submit proof for one member.
5. Show the agent's pass decision and updated streak.
6. Open the missed member's payment request.
7. Complete Stripe test Checkout.
8. Return to the dashboard and show `paid` status.
9. Briefly show `stripe projects status` or the architecture slide.

### Sponsor Explanation

> Stripe Projects provisioned our Auth0 client and delivered its credentials to the application environment. Auth0 verifies every participant and protects each group. Stripe Checkout handles the user-approved commitment payment, while the signed Stripe event updates the application state.

### Closing

> Today the agent lives in the web app. The next adapter lets it post these same challenges directly into an existing iMessage group without changing the core product.

## Fallbacks

- If AI evaluation fails, use a deterministic rule or organizer override.
- If webhook tunneling fails, retrieve the Checkout Session on the success route.
- If the database fails, seed local demo data and preserve Auth0 plus Stripe integration.
- If Linq fails, remove it entirely from the live demo.
- Never perform provisioning live during judging; show already-provisioned services.

## Definition of Done

Before adding stretch work, verify:

- [ ] Auth0 login works.
- [ ] Two distinct users can join one group.
- [ ] A challenge is visible.
- [ ] Proof can be submitted.
- [ ] The result changes the leaderboard.
- [ ] A payment request can open Stripe Checkout.
- [ ] Payment completion returns to the app.
- [ ] No secrets are committed.
- [ ] The demo can run from beginning to end without Linq.
