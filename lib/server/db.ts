import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { seedDatabase } from "@/lib/server/seed";

let database: DatabaseSync | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS portfolios (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan_json TEXT NOT NULL,
  weights_json TEXT NOT NULL,
  metrics_json TEXT NOT NULL,
  fx REAL NOT NULL,
  inception_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  replay INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS holdings (
  id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL,
  instrument_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  vehicle TEXT NOT NULL,
  listing TEXT NOT NULL,
  trading_currency TEXT NOT NULL,
  role TEXT NOT NULL,
  yahoo_symbol TEXT,
  proxy_yahoo TEXT,
  expense_ratio REAL,
  expense_note TEXT NOT NULL,
  price_note TEXT NOT NULL,
  unit_note TEXT NOT NULL,
  access_json TEXT NOT NULL,
  note TEXT,
  target_weight REAL NOT NULL,
  amount REAL NOT NULL,
  units REAL NOT NULL,
  entry_price REAL NOT NULL,
  core_alternative TEXT
);
CREATE TABLE IF NOT EXISTS price_bars (
  symbol TEXT NOT NULL,
  date TEXT NOT NULL,
  close REAL NOT NULL,
  currency TEXT NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY (symbol, date)
);
CREATE TABLE IF NOT EXISTS news_items (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  url TEXT,
  published_at TEXT NOT NULL,
  sentiment REAL NOT NULL,
  method TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  portfolio_id TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL,
  symbol TEXT,
  asset_class TEXT,
  title TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  action TEXT NOT NULL,
  action_detail TEXT NOT NULL,
  created_at TEXT NOT NULL,
  dismissed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS alert_settings (
  user_id TEXT PRIMARY KEY,
  price_move_pct REAL NOT NULL,
  drift_pp REAL NOT NULL,
  sentiment_delta REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  alert_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_holdings_portfolio ON holdings(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id, dismissed);
CREATE INDEX IF NOT EXISTS idx_news_symbol ON news_items(symbol);
`;

export function getDb(): DatabaseSync {
  if (database) return database;
  const directory = path.join(process.cwd(), "data");
  fs.mkdirSync(directory, { recursive: true });
  const instance = new DatabaseSync(path.join(directory, "sathorn.sqlite"));
  instance.exec("PRAGMA journal_mode = WAL");
  instance.exec("PRAGMA foreign_keys = ON");
  instance.exec(SCHEMA);
  seedDatabase(instance);
  database = instance;
  return instance;
}
