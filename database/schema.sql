CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth0_id text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
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
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0),
  streak integer NOT NULL DEFAULT 0 CHECK (streak >= 0),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  stake_amount_cents integer NOT NULL CHECK (stake_amount_cents > 0),
  due_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX one_active_challenge_per_group
  ON challenges(group_id);

CREATE TABLE submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  proof_url text,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE (challenge_id, user_id)
);

CREATE TABLE payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_payment_link_url text,
  stripe_checkout_session_id text UNIQUE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  status text NOT NULL CHECK (status IN ('pending', 'paid', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  UNIQUE (challenge_id, user_id)
);

CREATE INDEX group_members_user_id_idx ON group_members(user_id);
CREATE INDEX challenges_group_id_idx ON challenges(group_id);
CREATE INDEX submissions_challenge_id_idx ON submissions(challenge_id);
CREATE INDEX payment_requests_challenge_id_idx ON payment_requests(challenge_id);
