import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'misthos.db');
const db = new Database(dbPath);

// Enable WAL mode for high performance and concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    wallet_address TEXT,
    role TEXT DEFAULT 'client', -- 'client' or 'contractor'
    llm_provider TEXT,
    llm_base_url TEXT,
    llm_api_key TEXT,
    llm_model TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS contracts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    project_brief TEXT,
    client_id TEXT NOT NULL REFERENCES users(id),
    client_address TEXT NOT NULL,
    contractor_id TEXT REFERENCES users(id),
    contractor_address TEXT NOT NULL,
    total_amount TEXT NOT NULL, -- USDC base units (string)
    funded_amount TEXT NOT NULL DEFAULT '0', -- USDC base units (string)
    status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, AWAITING_ACCEPTANCE, AWAITING_FUNDING, ACTIVE, VERIFICATION_PENDING, PARTIALLY_SETTLED, COMPLETED, DISPUTED, CANCELLED
    escrow_contract_address TEXT,
    onchain_escrow_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS milestones (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    amount TEXT NOT NULL, -- USDC base units
    due_date INTEGER,
    deliverable_type TEXT NOT NULL DEFAULT 'GITHUB_PR', -- GITHUB_PR, CODE_COMMIT, CI_REPORT, DESIGN_TOKEN, FILE
    acceptance_criteria TEXT NOT NULL,
    verification_policy TEXT,
    evidence_requirements TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, FUNDED, IN_REVIEW, VERIFIED, APPROVED, REJECTED, PAID, DISPUTED
    allow_resubmission INTEGER NOT NULL DEFAULT 1, -- client decides: can the contractor resubmit after a rejected verdict?
    funded_amount TEXT NOT NULL DEFAULT '0',
    paid_amount TEXT NOT NULL DEFAULT '0',
    onchain_tx_hash TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    milestone_id TEXT NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
    contractor_id TEXT NOT NULL REFERENCES users(id),
    artifact_type TEXT NOT NULL,
    repo_url TEXT,
    branch TEXT,
    commit_sha TEXT,
    pull_request_url TEXT,
    description TEXT,
    evidence_urls TEXT,
    status TEXT NOT NULL DEFAULT 'SUBMITTED', -- SUBMITTED, PROCESSING, EVALUATED, FAILED
    submitted_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS verification_reports (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    milestone_id TEXT NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
    commit_sha TEXT NOT NULL,
    spec_version_hash TEXT,
    checks_executed TEXT NOT NULL, -- JSON array of checks
    test_results TEXT NOT NULL, -- JSON test execution stats & output
    failed_checks TEXT, -- JSON array of failing checks
    error_logs TEXT,
    security_findings TEXT, -- JSON security scan summary
    confidence_score INTEGER NOT NULL, -- 0-100
    decision TEXT NOT NULL, -- APPROVED, REJECTED, ESCALATED, PENDING
    remediation_feedback TEXT,
    oracle_signature TEXT,
    attestation_nonce INTEGER,
    attestation_payload TEXT,
    onchain_tx_hash TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    contract_id TEXT REFERENCES contracts(id),
    milestone_id TEXT REFERENCES milestones(id),
    tx_hash TEXT UNIQUE NOT NULL,
    tx_type TEXT NOT NULL, -- ESCROW_CREATE, FUND, MILESTONE_PAYOUT, REFUND
    amount TEXT NOT NULL, -- USDC base units
    sender TEXT NOT NULL,
    recipient TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'CONFIRMED', -- PENDING, CONFIRMED, REVERTED, FAILED
    block_number INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    actor_id TEXT,
    action TEXT NOT NULL,
    metadata TEXT,
    timestamp INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_contracts_client ON contracts(client_id);
  CREATE INDEX IF NOT EXISTS idx_contracts_contractor ON contracts(contractor_id);
  CREATE INDEX IF NOT EXISTS idx_milestones_contract ON milestones(contract_id);
  CREATE INDEX IF NOT EXISTS idx_submissions_milestone ON submissions(milestone_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_contract ON transactions(contract_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
`);

export default db;
