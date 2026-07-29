-- ─── Migration 0021: Support Tickets ─────────────────────────────────────────

-- Sequence for ticket numbers
CREATE SEQUENCE IF NOT EXISTS support_ticket_seq START 1;

-- ── Client-side: tickets submitted by users ──────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets_local (
  id                   SERIAL PRIMARY KEY,
  ticket_number        VARCHAR(30)  NOT NULL UNIQUE,
  org_id               INTEGER      NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by_user_id   INTEGER      NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
  subject              VARCHAR(500) NOT NULL,
  description          TEXT         NOT NULL,
  category             VARCHAR(50)  NOT NULL DEFAULT 'general',
  priority             VARCHAR(20)  NOT NULL DEFAULT 'normal',
  status               VARCHAR(30)  NOT NULL DEFAULT 'draft',
  source_info          JSONB,
  is_offline_draft     BOOLEAN      NOT NULL DEFAULT FALSE,
  submitted_at         TIMESTAMP,
  lc_ticket_ref        VARCHAR(50),
  last_reply_at        TIMESTAMP,
  unread_replies       INTEGER      NOT NULL DEFAULT 0,
  rating               INTEGER,
  rating_comment       TEXT,
  rated_at             TIMESTAMP,
  cancelled_at         TIMESTAMP,
  resolved_at          TIMESTAMP,
  created_at           TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_ticket_messages_local (
  id           SERIAL   PRIMARY KEY,
  ticket_id    INTEGER  NOT NULL REFERENCES support_tickets_local(id) ON DELETE CASCADE,
  sender_type  VARCHAR(20) NOT NULL DEFAULT 'user',
  sender_name  VARCHAR(200),
  body         TEXT     NOT NULL,
  is_read      BOOLEAN  NOT NULL DEFAULT FALSE,
  sent_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  lc_msg_ref   VARCHAR(50),
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_ticket_attachments_local (
  id           SERIAL   PRIMARY KEY,
  ticket_id    INTEGER  NOT NULL REFERENCES support_tickets_local(id) ON DELETE CASCADE,
  message_id   INTEGER  REFERENCES support_ticket_messages_local(id) ON DELETE SET NULL,
  filename     VARCHAR(300) NOT NULL,
  file_path    TEXT     NOT NULL,
  file_size    INTEGER,
  mime_type    VARCHAR(100),
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── LC-side: received tickets (managed by support team) ──────────────────────
CREATE TABLE IF NOT EXISTS lc_support_tickets (
  id               SERIAL   PRIMARY KEY,
  ticket_number    VARCHAR(30)  NOT NULL UNIQUE,
  client_id        INTEGER  REFERENCES lc_clients(id) ON DELETE SET NULL,
  org_id           VARCHAR(50),
  org_name         VARCHAR(300),
  subject          VARCHAR(500) NOT NULL,
  description      TEXT         NOT NULL,
  category         VARCHAR(50)  NOT NULL DEFAULT 'general',
  priority         VARCHAR(20)  NOT NULL DEFAULT 'normal',
  status           VARCHAR(30)  NOT NULL DEFAULT 'open',
  submitter_name   VARCHAR(200),
  submitter_email  VARCHAR(200),
  source_info      JSONB,
  assigned_to      VARCHAR(200),
  resolved_at      TIMESTAMP,
  closed_at        TIMESTAMP,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lc_support_ticket_messages (
  id                   SERIAL   PRIMARY KEY,
  ticket_id            INTEGER  NOT NULL REFERENCES lc_support_tickets(id) ON DELETE CASCADE,
  sender_type          VARCHAR(20) NOT NULL DEFAULT 'client',
  sender_name          VARCHAR(200),
  body                 TEXT     NOT NULL,
  is_read_by_client    BOOLEAN  NOT NULL DEFAULT FALSE,
  is_read_by_support   BOOLEAN  NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lc_support_ticket_attachments (
  id          SERIAL  PRIMARY KEY,
  ticket_id   INTEGER NOT NULL REFERENCES lc_support_tickets(id) ON DELETE CASCADE,
  message_id  INTEGER REFERENCES lc_support_ticket_messages(id) ON DELETE SET NULL,
  filename    VARCHAR(300) NOT NULL,
  file_url    TEXT    NOT NULL,
  file_size   INTEGER,
  mime_type   VARCHAR(100),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lc_support_ticket_notes (
  id          SERIAL  PRIMARY KEY,
  ticket_id   INTEGER NOT NULL REFERENCES lc_support_tickets(id) ON DELETE CASCADE,
  author      VARCHAR(200),
  body        TEXT    NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
