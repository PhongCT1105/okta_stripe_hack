-- Commitment Agent schema.
--
-- Mirrors the domain types in frontend/src/lib/types.ts, which is still the
-- source of truth while the app runs on the in-memory store in
-- frontend/src/lib/mock/store.ts. Port that store to these tables and the rest
-- of the app is unaffected: only frontend/src/lib/data.ts (reads) and
-- frontend/src/lib/actions.ts (writes) touch persistence.
--
-- Money is integer cents everywhere. Rounds are identified by a local date
-- string (YYYY-MM-DD), matching localDate() in the store.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Null for seeded demo members, who have no Auth0 identity.
  auth0_id text UNIQUE,
  email text UNIQUE,
  display_name text NOT NULL,
  -- Two-letter fallback shown when Auth0 gives us no avatar.
  initials text NOT NULL,
  avatar_url text,
  -- One line on what they're working toward. Null until profile setup is done,
  -- which is what gates the first-run redirect to /profile.
  headline text,
  -- Goal tags, constrained in the app to INTEREST_OPTIONS.
  interests text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  invite_code text UNIQUE NOT NULL,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE group_members (
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('organizer', 'member', 'admin')),
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0),
  streak integer NOT NULL DEFAULT 0 CHECK (streak >= 0),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- The group chat. Agent messages have role='agent' and a null user_id.
CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('member', 'agent')),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  body text NOT NULL,
  -- Set when the message announces a proposal, so the UI can link them.
  challenge_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((role = 'agent') = (user_id IS NULL))
);

CREATE TABLE challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  -- 'proposed' binds nobody; it becomes 'active' once enough members stake.
  status text NOT NULL CHECK (status IN ('proposed', 'active')),
  -- The agent's suggested per-miss stake. Members pick their own on opt-in.
  stake_amount_cents integer NOT NULL CHECK (stake_amount_cents >= 0),
  -- Rounds are daily, so the deadline is a time of day, not one instant.
  due_hour smallint NOT NULL CHECK (due_hour BETWEEN 0 AND 23),
  start_date date NOT NULL,
  duration_days smallint NOT NULL CHECK (duration_days BETWEEN 1 AND 30),
  agent_generated boolean NOT NULL DEFAULT false,
  -- Why the agent proposed this, quoted from the chat.
  rationale text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One active and one proposed challenge per group, but not more of either.
CREATE UNIQUE INDEX one_challenge_per_group_status
  ON challenges(group_id, status);

-- A member's opt-in. The stake is the approval: you're in because you put
-- money on it.
CREATE TABLE challenge_participants (
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stake_cents integer NOT NULL CHECK (stake_cents >= 0),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, user_id)
);

CREATE TABLE submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Which day this proves. One submission per member per round.
  round_date date NOT NULL,
  proof text NOT NULL,
  status text NOT NULL CHECK (status IN ('reviewing', 'passed', 'missed')),
  -- The agent's justification, shown to the member verbatim.
  agent_reason text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id, round_date)
);

-- Credit ledger. The balance is SUM(amount_cents), never a stored column, so
-- it cannot drift from the history that produced it.
CREATE TABLE wallet_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Positive puts credits in, negative takes them out.
  amount_cents integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('signup_grant', 'top_up', 'forfeit', 'cash_out')),
  memo text NOT NULL,
  -- Set on a forfeit, so a miss traces back to its round.
  challenge_id uuid REFERENCES challenges(id) ON DELETE SET NULL,
  round_date date,
  -- Set on a top-up. Unique because crediting is keyed on it: a refreshed
  -- success page must not mint credits twice.
  stripe_checkout_session_id text UNIQUE,
  -- The payment a top-up settled into. What a later cash-out refunds against.
  stripe_payment_intent_id text,
  -- Set on a cash-out, tracing the refund back to its Stripe record.
  stripe_refund_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One forfeit per member per round, enforced in the database rather than only
-- in the action — re-submitting a failed proof must not charge twice.
CREATE UNIQUE INDEX one_forfeit_per_round
  ON wallet_entries(user_id, challenge_id, round_date)
  WHERE kind = 'forfeit';

-- Fallback card settlement, used only when credits can't cover a stake.
CREATE TABLE payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  round_date date NOT NULL,
  stripe_checkout_session_id text UNIQUE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  status text NOT NULL CHECK (status IN ('pending', 'paid', 'canceled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  UNIQUE (challenge_id, user_id, round_date)
);

CREATE INDEX group_members_user_id_idx ON group_members(user_id);
CREATE INDEX chat_messages_group_id_idx ON chat_messages(group_id, created_at);
CREATE INDEX challenges_group_id_idx ON challenges(group_id);
CREATE INDEX challenge_participants_user_id_idx ON challenge_participants(user_id);
CREATE INDEX submissions_challenge_id_idx ON submissions(challenge_id, round_date);
CREATE INDEX wallet_entries_user_id_idx ON wallet_entries(user_id, created_at);
CREATE INDEX payment_requests_challenge_id_idx ON payment_requests(challenge_id);
