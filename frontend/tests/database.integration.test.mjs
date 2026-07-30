import assert from "node:assert/strict";
import test from "node:test";

const databaseUrl = process.env.TEST_DATABASE_URL;

test(
  "Auth0 identity, groups, challenges, proof, payments, scores, and streaks persist",
  { skip: databaseUrl ? false : "Set TEST_DATABASE_URL to a disposable migrated Neon database" },
  async () => {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(databaseUrl);
    const marker = crypto.randomUUID();
    let userId;

    try {
      const [user] = await sql`
        INSERT INTO users (auth0_id, email, display_name)
        VALUES (${`auth0|integration-${marker}`}, ${`integration-${marker}@example.invalid`}, 'Integration User')
        ON CONFLICT (auth0_id) DO UPDATE SET display_name=EXCLUDED.display_name
        RETURNING id, auth0_id`;
      userId = user.id;
      assert.equal(user.auth0_id, `auth0|integration-${marker}`);

      const [group] = await sql`
        INSERT INTO groups (name, invite_code, owner_id)
        VALUES ('Integration Group', ${`IT${marker.replaceAll("-", "").slice(0, 10)}`}, ${userId})
        RETURNING id`;
      await sql`
        INSERT INTO group_members (group_id, user_id, role)
        VALUES (${group.id}, ${userId}, 'organizer')`;

      const [challenge] = await sql`
        INSERT INTO challenges
          (group_id, title, description, status, stake_amount_cents, due_at, start_date)
        VALUES
          (${group.id}, 'Integration Challenge', 'Submit proof', 'active', 500, now() + interval '1 day', CURRENT_DATE)
        RETURNING id`;
      await sql`
        INSERT INTO challenge_participants (challenge_id, user_id, stake_cents)
        VALUES (${challenge.id}, ${userId}, 500)`;

      await sql`
        INSERT INTO submissions
          (challenge_id, user_id, round_date, proof, status, agent_reason, reviewed_at)
        VALUES
          (${challenge.id}, ${userId}, CURRENT_DATE, 'integration-proof', 'passed', 'verified', now())`;
      await sql`
        UPDATE group_members SET score=score+10, streak=streak+1
        WHERE group_id=${group.id} AND user_id=${userId}`;

      const [payment] = await sql`
        INSERT INTO payment_requests
          (challenge_id, user_id, round_date, amount_cents, stripe_checkout_session_id, status, paid_at)
        VALUES
          (${challenge.id}, ${userId}, CURRENT_DATE - 1, 500, ${`cs_test_${marker}`}, 'paid', now())
        RETURNING id`;

      const [persisted] = await sql`
        SELECT u.auth0_id, gm.role, gm.score, gm.streak, c.status challenge_status,
               cp.stake_cents, s.proof, s.status submission_status,
               p.status payment_status, p.stripe_checkout_session_id
        FROM users u
        JOIN group_members gm ON gm.user_id=u.id
        JOIN challenges c ON c.group_id=gm.group_id
        JOIN challenge_participants cp ON cp.challenge_id=c.id AND cp.user_id=u.id
        JOIN submissions s ON s.challenge_id=c.id AND s.user_id=u.id
        JOIN payment_requests p ON p.challenge_id=c.id AND p.user_id=u.id
        WHERE u.id=${userId} AND p.id=${payment.id}`;

      assert.deepEqual(
        {
          auth0Id: persisted.auth0_id,
          role: persisted.role,
          score: persisted.score,
          streak: persisted.streak,
          challenge: persisted.challenge_status,
          stake: persisted.stake_cents,
          proof: persisted.proof,
          submission: persisted.submission_status,
          payment: persisted.payment_status,
          checkout: persisted.stripe_checkout_session_id,
        },
        {
          auth0Id: `auth0|integration-${marker}`,
          role: "organizer",
          score: 10,
          streak: 1,
          challenge: "active",
          stake: 500,
          proof: "integration-proof",
          submission: "passed",
          payment: "paid",
          checkout: `cs_test_${marker}`,
        },
      );
    } finally {
      if (userId) await sql`DELETE FROM users WHERE id=${userId}`;
    }
  },
);
