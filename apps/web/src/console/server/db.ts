// SQLite store for the console, via Node's built-in node:sqlite. The file lives at
// <repo>/runs/console.db (runs/ is gitignored). Migrations are idempotent and run on first open.
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

/** The parts of node:sqlite we use (@types/node 20 has no typings for it). */
export interface Statement {
  run(...params: SqlValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get(...params: SqlValue[]): Record<string, SqlValue> | undefined;
  all(...params: SqlValue[]): Record<string, SqlValue>[];
}
export interface Database {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  close(): void;
}
export type SqlValue = string | number | bigint | null | Uint8Array;

/** Walks up from cwd to the folder that holds apps/api/flows (the repo root). */
export function repoRoot(): string {
  if (process.env.CONSOLE_REPO_ROOT) return path.resolve(process.env.CONSOLE_REPO_ROOT);
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(path.join(dir, "apps", "api", "flows"))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return path.resolve(process.cwd(), "..", "..");
}

export function dbPath(): string {
  return process.env.CONSOLE_DB_PATH ?? path.join(repoRoot(), "runs", "console.db");
}

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS workflows (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     flow TEXT NOT NULL,
     positions TEXT NOT NULL DEFAULT '{}',
     active INTEGER NOT NULL DEFAULT 0,
     updated_at TEXT NOT NULL,
     source TEXT NOT NULL CHECK (source IN ('file','db'))
   )`,
  `CREATE TABLE IF NOT EXISTS executions (
     id TEXT PRIMARY KEY,
     source_key TEXT UNIQUE,
     case_id TEXT NOT NULL,
     dataset TEXT NOT NULL,
     workflow_id TEXT NOT NULL,
     status TEXT NOT NULL CHECK (status IN ('running','success','error')),
     outcome TEXT,
     started_at TEXT NOT NULL,
     duration_ms REAL,
     cost_usd REAL,
     origin TEXT NOT NULL,
     simulated INTEGER NOT NULL DEFAULT 0,
     title TEXT,
     next_action TEXT,
     gate TEXT,
     error TEXT,
     trace TEXT,
     answer_md TEXT,
     reasoning_md TEXT,
     eval_pass INTEGER,
     eval_score REAL,
     eval_notes TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS executions_case ON executions (case_id, started_at)`,
  `CREATE INDEX IF NOT EXISTS executions_started ON executions (started_at)`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
];

/** Columns added after the first release (voice, PRD I5). ALTER TABLE ADD COLUMN is not idempotent, so check first. */
const ADDED_COLUMNS: { table: string; column: string; type: string }[] = [
  { table: "executions", column: "parent_execution_id", type: "TEXT" },
  { table: "executions", column: "outbox", type: "TEXT" },
  { table: "executions", column: "card", type: "TEXT" },
  { table: "executions", column: "voice", type: "TEXT" },
];

function migrate(db: Database) {
  for (const sql of MIGRATIONS) db.exec(sql);
  for (const c of ADDED_COLUMNS) {
    const have = db.prepare(`PRAGMA table_info(${c.table})`).all().some((r) => r.name === c.column);
    if (!have) db.exec(`ALTER TABLE ${c.table} ADD COLUMN ${c.column} ${c.type}`);
  }
}

const g = globalThis as unknown as { __consoleDb?: { path: string; db: Database } };
let migratedHere = false;

export function getDb(): Database {
  const file = dbPath();
  if (g.__consoleDb?.path === file) {
    // A handle cached across hot reloads was migrated by older code: re-run the (idempotent) migrations once.
    if (!migratedHere) {
      migrate(g.__consoleDb.db);
      migratedHere = true;
    }
    return g.__consoleDb.db;
  }
  migratedHere = true;
  mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = (process as unknown as { getBuiltinModule(id: string): unknown })
    .getBuiltinModule("node:sqlite") as { DatabaseSync: new (file: string) => Database };
  const db = new sqlite.DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  migrate(db);
  g.__consoleDb = { path: file, db };
  return db;
}

export function getSetting(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? String(row.value) : null;
}

export function setSetting(key: string, value: string) {
  getDb().prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}
