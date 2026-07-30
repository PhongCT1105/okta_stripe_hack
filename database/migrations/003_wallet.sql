CREATE TABLE IF NOT EXISTS wallet_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL,
  kind text NOT NULL,
  memo text NOT NULL,
  challenge_id uuid REFERENCES challenges(id) ON DELETE SET NULL,
  round_date date,
  stripe_checkout_session_id text UNIQUE,
  stripe_payment_intent_id text,
  stripe_refund_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_entries_user_created_idx ON wallet_entries(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS wallet_signup_grant_user_uidx ON wallet_entries(user_id) WHERE kind = 'signup_grant';
CREATE UNIQUE INDEX IF NOT EXISTS wallet_forfeit_round_uidx
  ON wallet_entries(user_id, challenge_id, round_date) WHERE kind = 'forfeit';
