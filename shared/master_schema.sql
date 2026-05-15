-- ESQUEMA MAESTRO TITANIUM v9.0.0 (TITANIUM CORE)
-- Extracted from D1 live on 2026-04-18. Source of truth: D1 remote.

-- 1. Core Tables (Application Logic)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT UNIQUE NOT NULL,
    telegram_username TEXT,
    first_name TEXT NOT NULL,
    last_name TEXT,
    phone TEXT, 
    vehicle_type TEXT,           
    vehicle_motor TEXT,          
    vehicle_era TEXT,            
    vehicle_brand TEXT,          
    vehicle_model TEXT,          
    vehicle_year INTEGER,        
    mechanical_health_score INTEGER DEFAULT 100, 
    last_recontact_at DATETIME,  
    last_interaction_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
    last_promo_at DATETIME,      
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    recontact_count INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    deactivated_at DATETIME
);

CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    telegram_user_id INTEGER NOT NULL,
    telegram_chat_id INTEGER NOT NULL,
    paso_actual INTEGER DEFAULT 0,
    estado_flujo TEXT DEFAULT 'iniciado',
    vehiculo_tipo TEXT,
    vehiculo_motor TEXT,
    vehiculo_era TEXT,
    servicio_solicitado TEXT,
    fecha_cita TEXT,
    hora_cita TEXT,
    image_generating INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT,
    bay_number INTEGER DEFAULT NULL,
    hora_page INTEGER DEFAULT 0,
    kilometraje INTEGER,
    callback_hash TEXT,
    version INTEGER DEFAULT 1,
    active_mode TEXT,
    session_data TEXT,
    bot_type TEXT NOT NULL DEFAULT 'frontend'
);

CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT UNIQUE NOT NULL,
    session_id TEXT,
    telegram_user_id INTEGER NOT NULL,
    telegram_chat_id INTEGER NOT NULL,
    vehiculo_tipo TEXT NOT NULL,
    vehiculo_motor TEXT NOT NULL,
    vehiculo_era TEXT NOT NULL,
    servicio_solicitado TEXT NOT NULL,
    fecha_cita TEXT NOT NULL,
    hora_cita TEXT NOT NULL,
    hora_fin TEXT,
    check_in_at DATETIME,
    timezone TEXT DEFAULT 'America/Caracas',
    estado TEXT DEFAULT 'pendiente',
    notified INTEGER DEFAULT 0,
    notified_at DATETIME,
    notas_admin TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    bay_number INTEGER DEFAULT NULL,
    price_adjusted REAL DEFAULT NULL,
    price_notes TEXT,
    seo_sequence_sent INTEGER DEFAULT 0,
    kilometraje INTEGER
);

CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    vehicle_brand TEXT,
    vehicle_model TEXT,
    vehicle_year INTEGER,
    vehicle_type TEXT, 
    vehicle_motor TEXT,
    vehicle_era TEXT,
    current_mileage INTEGER DEFAULT 0,
    avg_daily_km INTEGER DEFAULT 30,
    last_mileage_update DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    row_version INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS maintenance_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_name TEXT NOT NULL,
    interval_km INTEGER NOT NULL,
    interval_months INTEGER,
    base_price REAL NOT NULL,
    labor_hours REAL,
    priority TEXT CHECK(priority IN ('CRITICA', 'ALTA', 'MEDIA', 'BAJA')) DEFAULT 'MEDIA',
    description TEXT
);

CREATE TABLE IF NOT EXISTS predictive_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL,
    rule_id INTEGER NOT NULL,
    due_at_km INTEGER,
    due_at_date DATETIME,
    status TEXT CHECK(status IN ('pending', 'approved', 'sent', 'rejected', 'send_failed')) DEFAULT 'pending',
    admin_approved INTEGER DEFAULT 0,
    approved_by TEXT,
    custom_price REAL,
    sent_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
    FOREIGN KEY (rule_id) REFERENCES maintenance_rules(id)
);

CREATE TABLE IF NOT EXISTS circuit_breakers (
    service TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK(status IN ('open', 'closed', 'half-open')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    opened_at TEXT,
    failure_count INTEGER DEFAULT 0,
    last_failure_at TEXT
);

CREATE TABLE IF NOT EXISTS ia_jobs (
  job_id TEXT PRIMARY KEY,
  telegram_user_id INTEGER NOT NULL,
  telegram_chat_id INTEGER NOT NULL,
  message_id INTEGER NOT NULL, 
  status TEXT DEFAULT 'PENDING', 
  prompt TEXT NOT NULL,
  result TEXT,
  error TEXT,
  trace_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ia_jobs_status_pending ON ia_jobs(status) WHERE status = 'PENDING' OR status = 'pending';
CREATE INDEX IF NOT EXISTS idx_ephemeral_callbacks_session ON ephemeral_callbacks(session_id);
CREATE INDEX IF NOT EXISTS idx_pending_notifications_attempts ON pending_notifications(attempts) WHERE attempts < 3;


-- ═══════════════════════════════════════════════════════════════
-- NON-CORE TABLES (Internal or secondary data structures)
-- ═══════════════════════════════════════════════════════════════


-- NON-CORE TABLES (Internal or secondary data structures)
CREATE TABLE IF NOT EXISTS _cf_KV (key TEXT PRIMARY KEY, value BLOB) WITHOUT ROWID; -- Cloudflare internal KV emulation
CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT, expires_at INTEGER); -- Legacy KV storage
CREATE TABLE IF NOT EXISTS system_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, component TEXT NOT NULL, log_level TEXT NOT NULL, message TEXT NOT NULL, metadata TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), trace_id TEXT); -- Structured system logging
CREATE TABLE IF NOT EXISTS marketing_content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    target_roi_service_id INTEGER,
    draft_content TEXT NOT NULL,
    google_grounding_refs TEXT,
    status TEXT CHECK(status IN ('DRAFT', 'APPROVED', 'SENT', 'REJECTED')) DEFAULT 'DRAFT',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (target_roi_service_id) REFERENCES maintenance_rules(id)
);
CREATE TABLE IF NOT EXISTS workshop_config (id INTEGER PRIMARY KEY CHECK (id = 1), name TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, total_bays INTEGER DEFAULT 5, funnel_interval INTEGER DEFAULT 15, last_funnel_run DATETIME, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP); -- Global workshop settings
CREATE TABLE IF NOT EXISTS checkpoints (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires_at INTEGER DEFAULT (strftime('%s', 'now') + 86400)); -- Flow checkpoints
CREATE TABLE IF NOT EXISTS cache_models (brand TEXT, year INTEGER, models TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (brand, year)); -- Cached vehicle models data
CREATE TABLE IF NOT EXISTS ephemeral_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id TEXT NOT NULL, message_id INTEGER NOT NULL, expires_at DATETIME NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP); -- Temporary bot notifications
CREATE TABLE IF NOT EXISTS ai_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id TEXT, task_type TEXT NOT NULL, payload TEXT, status TEXT DEFAULT 'pending', attempts INTEGER DEFAULT 0, max_attempts INTEGER DEFAULT 3, next_attempt_at TEXT, error_message TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (ticket_id) REFERENCES tickets(id)); -- Internal AI task queue
CREATE TABLE IF NOT EXISTS service_history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, ticket_id TEXT NOT NULL, service_type TEXT, notes TEXT, completed_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (ticket_id) REFERENCES tickets(id)); -- Historical service records
CREATE TABLE IF NOT EXISTS system_counters (key TEXT PRIMARY KEY, value INTEGER DEFAULT 0, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP); -- Global monotonic counters
CREATE TABLE IF NOT EXISTS short_states (id TEXT PRIMARY KEY, payload TEXT NOT NULL, user_id TEXT, expires_at DATETIME NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP); -- Short-lived state tokens
CREATE TABLE IF NOT EXISTS admin_config (key TEXT PRIMARY KEY, value TEXT NOT NULL, description TEXT); -- Admin panel configuration
CREATE TABLE IF NOT EXISTS blocked_slots (id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id TEXT, fecha TEXT NOT NULL, hora TEXT NOT NULL, duracion_min INTEGER DEFAULT 10, motivo TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP); -- Manual or automated schedule blocks
CREATE TABLE IF NOT EXISTS processed_updates (update_id INTEGER PRIMARY KEY, processed_at DATETIME DEFAULT CURRENT_TIMESTAMP, telegram_user_id INTEGER); -- Idempotency tracking for Telegram updates
CREATE TABLE IF NOT EXISTS rate_limits (identity_key TEXT PRIMARY KEY, request_count INTEGER, window_start INTEGER, window_end INTEGER); -- Stateless rate limiting
CREATE TABLE IF NOT EXISTS emails (id TEXT PRIMARY KEY, message_id TEXT UNIQUE, sender TEXT, recipient TEXT, subject TEXT, telegram_message_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP); -- Inbound/outbound email tracking
CREATE TABLE IF NOT EXISTS memory (key TEXT PRIMARY KEY, value TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP); -- Generic persistent memory
CREATE TABLE IF NOT EXISTS pending_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id TEXT NOT NULL, user_id INTEGER NOT NULL, message_type TEXT NOT NULL, payload TEXT, attempts INTEGER DEFAULT 0, last_error TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, trace_id TEXT); -- Outbound notification queue
CREATE TABLE IF NOT EXISTS webhook_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, chat_id TEXT, user_id TEXT, text TEXT, raw TEXT); -- Raw webhook payloads
CREATE TABLE IF NOT EXISTS seo_message_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id TEXT NOT NULL, msg_number INTEGER NOT NULL, scheduled_for DATETIME NOT NULL, status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP); -- SEO follow-up sequence
CREATE TABLE IF NOT EXISTS agent_conversations (id INTEGER PRIMARY KEY AUTOINCREMENT, admin_id TEXT NOT NULL, agent_mode TEXT NOT NULL, history TEXT NOT NULL, message_count INTEGER DEFAULT 0, thread_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, expires_at DATETIME DEFAULT (datetime('now', '+24 hours')), UNIQUE(admin_id, agent_mode)); -- Admin agent chat history
CREATE TABLE IF NOT EXISTS ephemeral_callbacks (hash TEXT PRIMARY KEY, session_id TEXT NOT NULL, action TEXT NOT NULL, value TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (session_id) REFERENCES "sessions"(session_id) ON DELETE CASCADE); -- Expiring callback data
CREATE TABLE IF NOT EXISTS bays (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Disponible' CHECK(status IN ('Disponible', 'Mantenimiento', 'Ocupada')), compatible_types TEXT NOT NULL, last_maintenance DATETIME DEFAULT CURRENT_TIMESTAMP, created_at DATETIME DEFAULT CURRENT_TIMESTAMP); -- Workshop bay management
CREATE TABLE IF NOT EXISTS obd2_dictionary (code TEXT PRIMARY KEY, summary TEXT NOT NULL, technical_logic TEXT, severity TEXT CHECK(severity IN ('BAJA', 'MEDIA', 'ALTA', 'CRITICA')) DEFAULT 'MEDIA', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP); -- Diagnostic code definitions
CREATE TABLE IF NOT EXISTS obd2_scans (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, codes_found TEXT NOT NULL, raw_log TEXT, ai_report TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE); -- User-submitted OBD-II scans

-- ═══════════════════════════════════════════════════════════════
-- OBD_CODES (Iteración 7)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS obd_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    source TEXT NOT NULL,
    code_type TEXT, 
    severity TEXT CHECK(severity IN ('BAJA', 'MEDIA', 'ALTA', 'CRITICA')) DEFAULT 'MEDIA',
    extra_metadata TEXT, 
    raw_hex TEXT,
    raw_decimal INTEGER,
    sources_available TEXT, 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE VIRTUAL TABLE IF NOT EXISTS obd_codes_fts USING fts5(
    code,
    description,
    code_type,
    content='obd_codes',
    content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS obd_codes_ai AFTER INSERT ON obd_codes BEGIN
  INSERT INTO obd_codes_fts(rowid, code, description, code_type) VALUES (new.id, new.code, new.description, new.code_type);
END;

CREATE TRIGGER IF NOT EXISTS obd_codes_ad AFTER DELETE ON obd_codes BEGIN
  INSERT INTO obd_codes_fts(obd_codes_fts, rowid, code, description, code_type) VALUES('delete', old.id, old.code, old.description, old.code_type);
END;

CREATE TRIGGER IF NOT EXISTS obd_codes_au AFTER UPDATE ON obd_codes BEGIN
  INSERT INTO obd_codes_fts(obd_codes_fts, rowid, code, description, code_type) VALUES('delete', old.id, old.code, old.description, old.code_type);
  INSERT INTO obd_codes_fts(rowid, code, description, code_type) VALUES (new.id, new.code, new.description, new.code_type);
END;

CREATE UNIQUE INDEX IF NOT EXISTS idx_obd_codes_code_source ON obd_codes(code, source);
CREATE INDEX IF NOT EXISTS idx_obd_codes_code ON obd_codes(code);
CREATE INDEX IF NOT EXISTS idx_obd_codes_type ON obd_codes(code_type);
CREATE INDEX IF NOT EXISTS idx_obd_codes_severity ON obd_codes(severity);

-- ═══════════════════════════════════════════════════════════════
-- VISTAS ANALÍTICAS (D8) - Ref v8.5.1
-- ═══════════════════════════════════════════════════════════════

CREATE VIEW IF NOT EXISTS vw_vehicle_km_projection AS 
SELECT 
  id as vehicle_id, 
  current_mileage as current_km, 
  last_mileage_update as last_read, 
  avg_daily_km as km_per_day 
FROM vehicles;

CREATE VIEW IF NOT EXISTS vw_maintenance_due_soon AS
SELECT 
  v.id as vehicle_id,
  v.user_id,
  r.service_name,
  r.interval_km,
  v.current_mileage
FROM vehicles v
CROSS JOIN maintenance_rules r;

-- Indices y Restricciones de Sesión (D32)
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_user_bot_active
ON sessions(telegram_user_id, bot_type)
WHERE estado_flujo NOT IN ('confirmado', 'cancelado');
