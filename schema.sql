-- D1 schema for SideHustle Radar
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_platform TEXT,
  source_name TEXT,
  source_url TEXT,
  posted_at TEXT,
  type TEXT,
  skills_json TEXT,
  budget TEXT,
  location TEXT,
  contact TEXT,
  description TEXT,
  notes TEXT,
  clear_scope INTEGER DEFAULT 0,
  clear_budget INTEGER DEFAULT 0,
  requires_deposit INTEGER DEFAULT 0,
  asks_invite INTEGER DEFAULT 0,
  asks_private_key INTEGER DEFAULT 0,
  mentions_guarantee_income INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leads_posted_at ON leads(posted_at);
CREATE INDEX IF NOT EXISTS idx_leads_source_platform ON leads(source_platform);
CREATE INDEX IF NOT EXISTS idx_leads_type ON leads(type);
