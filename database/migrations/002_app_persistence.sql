ALTER TABLE users ADD COLUMN IF NOT EXISTS headline text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member';
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'proposed';
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS due_hour integer NOT NULL DEFAULT 17;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS start_date date NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS duration_days integer NOT NULL DEFAULT 7;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS agent_generated boolean NOT NULL DEFAULT false;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS rationale text;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS round_date date NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS proof text NOT NULL DEFAULT '';
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS agent_reason text;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS round_date date NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE challenges DROP CONSTRAINT IF EXISTS challenges_stake_amount_cents_check;
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_status_check;
ALTER TABLE payment_requests DROP CONSTRAINT IF EXISTS payment_requests_status_check;
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_challenge_id_user_id_key;
ALTER TABLE payment_requests DROP CONSTRAINT IF EXISTS payment_requests_challenge_id_user_id_key;
DROP INDEX IF EXISTS one_active_challenge_per_group;
CREATE UNIQUE INDEX IF NOT EXISTS challenges_one_active_per_group_uidx
  ON challenges(group_id) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS submissions_challenge_user_round_uidx
  ON submissions(challenge_id, user_id, round_date);
CREATE UNIQUE INDEX IF NOT EXISTS payment_requests_challenge_user_round_uidx
  ON payment_requests(challenge_id, user_id, round_date);

CREATE TABLE IF NOT EXISTS challenge_participants (
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stake_cents integer NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  role text NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  body text NOT NULL,
  challenge_id uuid REFERENCES challenges(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_group_id_created_at_idx ON chat_messages(group_id, created_at);
