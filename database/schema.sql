CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), auth0_id text UNIQUE NOT NULL,
 email text UNIQUE NOT NULL, display_name text NOT NULL, avatar_url text, headline text,
 interests text[] NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS groups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, invite_code text UNIQUE NOT NULL,
 owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS group_members (
 group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, role text NOT NULL DEFAULT 'member',
 score integer NOT NULL DEFAULT 0, streak integer NOT NULL DEFAULT 0,
 joined_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(group_id,user_id)
);
CREATE TABLE IF NOT EXISTS challenges (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
 title text NOT NULL, description text NOT NULL, status text NOT NULL DEFAULT 'proposed',
 stake_amount_cents integer NOT NULL DEFAULT 0, due_at timestamptz NOT NULL, due_hour integer NOT NULL DEFAULT 17,
 start_date date NOT NULL DEFAULT CURRENT_DATE, duration_days integer NOT NULL DEFAULT 7,
 agent_generated boolean NOT NULL DEFAULT false, rationale text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS challenge_participants (
 challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, stake_cents integer NOT NULL DEFAULT 0,
 joined_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(challenge_id,user_id)
);
CREATE TABLE IF NOT EXISTS chat_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
 role text NOT NULL, user_id uuid REFERENCES users(id) ON DELETE SET NULL, body text NOT NULL,
 challenge_id uuid REFERENCES challenges(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, round_date date NOT NULL DEFAULT CURRENT_DATE,
 proof text NOT NULL DEFAULT '', proof_url text, status text NOT NULL, agent_reason text,
 submitted_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz,
 UNIQUE (challenge_id, user_id, round_date)
);
CREATE TABLE IF NOT EXISTS payment_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, round_date date NOT NULL DEFAULT CURRENT_DATE,
 amount_cents integer NOT NULL, stripe_payment_link_url text, stripe_checkout_session_id text UNIQUE,
 status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now(), paid_at timestamptz,
 UNIQUE (challenge_id, user_id, round_date)
);
CREATE TABLE IF NOT EXISTS wallet_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 amount_cents integer NOT NULL, kind text NOT NULL, memo text NOT NULL,
 challenge_id uuid REFERENCES challenges(id) ON DELETE SET NULL, round_date date,
 stripe_checkout_session_id text UNIQUE, stripe_payment_intent_id text,
 stripe_refund_id text UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS group_members_user_id_idx ON group_members(user_id);
CREATE INDEX IF NOT EXISTS challenges_group_id_idx ON challenges(group_id);
CREATE UNIQUE INDEX IF NOT EXISTS challenges_one_active_per_group_uidx ON challenges(group_id) WHERE status='active';
CREATE INDEX IF NOT EXISTS chat_messages_group_id_created_at_idx ON chat_messages(group_id,created_at);
CREATE INDEX IF NOT EXISTS submissions_challenge_id_idx ON submissions(challenge_id);
CREATE INDEX IF NOT EXISTS payment_requests_challenge_id_idx ON payment_requests(challenge_id);
CREATE INDEX IF NOT EXISTS wallet_entries_user_created_idx ON wallet_entries(user_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS wallet_signup_grant_user_uidx ON wallet_entries(user_id) WHERE kind='signup_grant';
CREATE UNIQUE INDEX IF NOT EXISTS wallet_forfeit_round_uidx ON wallet_entries(user_id,challenge_id,round_date) WHERE kind='forfeit';
