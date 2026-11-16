-- Goku sync (zero-knowledge). The server stores only encrypted blobs and hashes; it can never read anyone's data.
-- Apply with: npx wrangler d1 execute goku-sync --file=schema.sql (add --remote for the real database)

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,          -- the username, lower case
  auth_salt TEXT NOT NULL,            -- server-side salt for the login hash
  auth_hash TEXT NOT NULL,            -- SHA-256(salt + login key); the login key itself is derived on the phone
  rec_salt TEXT NOT NULL,
  rec_hash TEXT NOT NULL,             -- same, for the recovery key
  wrap_pw TEXT NOT NULL,              -- the data key, locked with the password (JSON {iv, ct})
  wrap_rec TEXT NOT NULL,             -- the data key, locked with the recovery key
  kdf TEXT NOT NULL,                  -- how the phone turns the password into keys (JSON)
  seq INTEGER NOT NULL DEFAULT 0,     -- change counter for this account
  fails INTEGER NOT NULL DEFAULT 0,   -- wrong passwords in a row
  locked_until INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tokens (
  hash TEXT PRIMARY KEY,              -- SHA-256 of the sign-in token a phone keeps
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created INTEGER NOT NULL,
  last_used INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tokens_user ON tokens(user_id);

CREATE TABLE IF NOT EXISTS records (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rid TEXT NOT NULL,                  -- an opaque id (a keyed hash made on the phone), never the real entry id
  v INTEGER NOT NULL,                 -- the entry's last-edit time; an older copy never replaces a newer one
  seq INTEGER NOT NULL,               -- when the server last changed it, for "what's new since"
  del INTEGER NOT NULL DEFAULT 0,     -- 1 = deleted (kept so other phones delete it too)
  blob TEXT NOT NULL,                 -- encrypted entry (AES-GCM), base64
  PRIMARY KEY (user_id, rid)
);
CREATE INDEX IF NOT EXISTS records_seq ON records(user_id, seq);

CREATE TABLE IF NOT EXISTS signups (  -- a few new accounts per network per day, so nobody can flood the database
  ip_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (ip_hash, day)
);
