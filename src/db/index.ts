import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'cases.db')

export const db = new Database(DB_PATH)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,
    case_number TEXT UNIQUE NOT NULL,
    org_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    priority TEXT NOT NULL DEFAULT 'normal',
    type TEXT NOT NULL DEFAULT 'question',
    issue_type TEXT NOT NULL DEFAULT 'post_sales',
    channel TEXT NOT NULL DEFAULT 'web',
    category TEXT,
    subcategory TEXT,
    contact_id TEXT,
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    account_id TEXT,
    assignee_id TEXT,
    cc_email_addresses TEXT NOT NULL DEFAULT '[]',
    is_escalated INTEGER NOT NULL DEFAULT 0,
    is_closed INTEGER NOT NULL DEFAULT 0,
    resolution TEXT,
    sla_breach_at TEXT,
    first_response_at TEXT,
    resolved_at TEXT,
    closed_at TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    custom_fields TEXT NOT NULL DEFAULT '{}',
    comment_count INTEGER NOT NULL DEFAULT 0,
    attachment_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES cases(id),
    org_id TEXT NOT NULL,
    body TEXT NOT NULL,
    author_id TEXT,
    author_name TEXT,
    is_public INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    org_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    type TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    actor_id TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES cases(id),
    filename TEXT NOT NULL,
    content_type TEXT,
    size_bytes INTEGER,
    url TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_cases_org ON cases(org_id);
  CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(org_id, status);
  CREATE INDEX IF NOT EXISTS idx_events_case ON events(case_id);
  CREATE INDEX IF NOT EXISTS idx_events_org ON events(org_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_comments_case ON comments(case_id);
`)
