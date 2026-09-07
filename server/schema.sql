PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS Role (
  id TEXT PRIMARY KEY CHECK(id IN ('courier','supervisor','legal')),
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS User (
  id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  role TEXT NOT NULL REFERENCES Role(id), org TEXT NOT NULL,
  passwordHash TEXT NOT NULL, createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS Session (
  tokenHash TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
  createdAt TEXT NOT NULL, expiresAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS "Case" (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '待分类', risk TEXT NOT NULL DEFAULT '中' CHECK(risk IN ('高','中','低')),
  status TEXT NOT NULL DEFAULT '取证中' CHECK(status IN ('取证中','待补证','协商中','赔偿审批','法务处理中','已归档')),
  amount REAL NOT NULL DEFAULT 0 CHECK(amount >= 0), goods TEXT NOT NULL DEFAULT '',
  insured INTEGER NOT NULL DEFAULT 0, major INTEGER NOT NULL DEFAULT 0,
  criminalRisk INTEGER NOT NULL DEFAULT 0, escalated INTEGER NOT NULL DEFAULT 0,
  ownerId TEXT NOT NULL REFERENCES User(id), org TEXT NOT NULL, incidentAt TEXT NOT NULL,
  monitorDeadline TEXT, insuranceDeadline TEXT, proofDeadline TEXT,
  clarificationAnswers TEXT NOT NULL DEFAULT '{}', legalReviewedAt TEXT,
  currentHandlerRole TEXT NOT NULL DEFAULT 'courier', currentHandlerId TEXT REFERENCES User(id),
  handoffStatus TEXT NOT NULL DEFAULT 'self_handling', handoffNote TEXT, handoffAt TEXT,
  isDemo INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS Waybill (
  id TEXT PRIMARY KEY, caseId TEXT NOT NULL UNIQUE REFERENCES "Case"(id) ON DELETE CASCADE,
  number TEXT NOT NULL, goods TEXT NOT NULL DEFAULT '', insured INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS Evidence (
  id TEXT PRIMARY KEY, caseId TEXT NOT NULL REFERENCES "Case"(id) ON DELETE CASCADE,
  title TEXT NOT NULL, category TEXT NOT NULL, originalName TEXT NOT NULL,
  storageName TEXT NOT NULL UNIQUE, mimeType TEXT NOT NULL, size INTEGER NOT NULL,
  sha256 TEXT NOT NULL, uploadedBy TEXT NOT NULL REFERENCES User(id),
  status TEXT NOT NULL DEFAULT '已具备', createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS AIAnalysis (
  id TEXT PRIMARY KEY, caseId TEXT NOT NULL REFERENCES "Case"(id) ON DELETE CASCADE,
  result TEXT NOT NULL, mode TEXT NOT NULL, createdBy TEXT NOT NULL REFERENCES User(id),
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS Task (
  id TEXT PRIMARY KEY, caseId TEXT NOT NULL REFERENCES "Case"(id) ON DELETE CASCADE,
  title TEXT NOT NULL, kind TEXT NOT NULL, evidenceKey TEXT,
  status TEXT NOT NULL DEFAULT '待处理' CHECK(status IN ('待处理','已完成')),
  dueAt TEXT, priority TEXT NOT NULL CHECK(priority IN ('P0','P1','P2')),
  assignedTo TEXT NOT NULL REFERENCES User(id), createdAt TEXT NOT NULL,
  completedAt TEXT, completionNote TEXT
);
CREATE TABLE IF NOT EXISTS LegalDocument (
  id TEXT PRIMARY KEY, caseId TEXT NOT NULL REFERENCES "Case"(id) ON DELETE CASCADE,
  type TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT '待人工审核', createdBy TEXT NOT NULL REFERENCES User(id),
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS Knowledge (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL, content TEXT NOT NULL,
  sourceUrl TEXT NOT NULL DEFAULT '', version TEXT NOT NULL, keywords TEXT NOT NULL DEFAULT '[]',
  isDemo INTEGER NOT NULL DEFAULT 0, verifiedAt TEXT, createdBy TEXT REFERENCES User(id),
  reviewStatus TEXT NOT NULL DEFAULT '已审核', attachmentName TEXT NOT NULL DEFAULT '', storageName TEXT,
  mimeType TEXT NOT NULL DEFAULT '', size INTEGER NOT NULL DEFAULT 0, sha256 TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS AuditLog (
  id TEXT PRIMARY KEY, caseId TEXT REFERENCES "Case"(id), userId TEXT REFERENCES User(id),
  action TEXT NOT NULL, detail TEXT NOT NULL, org TEXT, createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_case_owner ON "Case"(ownerId,updatedAt);
CREATE INDEX IF NOT EXISTS idx_case_org ON "Case"(org,updatedAt);
CREATE INDEX IF NOT EXISTS idx_evidence_case ON Evidence(caseId);
CREATE INDEX IF NOT EXISTS idx_analysis_case ON AIAnalysis(caseId,createdAt);
CREATE INDEX IF NOT EXISTS idx_task_case ON Task(caseId,status,dueAt);
CREATE INDEX IF NOT EXISTS idx_audit_case ON AuditLog(caseId,createdAt);
