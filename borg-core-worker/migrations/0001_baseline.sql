-- TITANIUM BASELINE v9.7.0
-- Clean birth: Purge all legacy tables and recreate only the required ones.

-- 1. EXTIRPATION OF PHANTOM ASSETS
DROP TABLE IF EXISTS _cf_KV;
DROP TABLE IF EXISTS kv_store;
DROP TABLE IF EXISTS checkpoints;
DROP TABLE IF EXISTS short_states;
DROP TABLE IF EXISTS cache_models;
DROP TABLE IF EXISTS ephemeral_notifications;
DROP TABLE IF EXISTS ai_queue;
DROP TABLE IF EXISTS emails;
DROP TABLE IF EXISTS memory;
DROP TABLE IF EXISTS webhook_logs;
DROP TABLE IF EXISTS ephemeral_callbacks;
DROP TABLE IF EXISTS system_counters;
DROP TABLE IF EXISTS admin_config;
DROP TABLE IF EXISTS workshop_config;
DROP TABLE IF EXISTS marketing_content;
DROP TABLE IF EXISTS obd2_dictionary;
DROP TABLE IF EXISTS obd2_scans;
DROP TABLE IF EXISTS service_history;
DROP TABLE IF EXISTS pending_notifications;
DROP TABLE IF EXISTS blocked_slots; -- Re-created below if needed, but starting clean
DROP TABLE IF EXISTS bays; -- Re-created below if needed

-- 2. CORE INFRASTRUCTURE
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT UNIQUE NOT NULL,
    telegram_username TEXT,
    first_name TEXT NOT NULL,
    last_name TEXT,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_interaction_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    telegram_user_id INTEGER NOT NULL,
    telegram_chat_id INTEGER NOT NULL,
    bot_type TEXT NOT NULL,
    estado_flujo TEXT DEFAULT 'iniciado',
    paso_actual INTEGER DEFAULT 0,
    vehiculo_tipo TEXT,
    vehiculo_motor TEXT,
    vehiculo_era TEXT,
    kilometraje INTEGER,
    servicio_solicitado TEXT,
    fecha_cita TEXT,
    hora_cita TEXT,
    active_mode TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME
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
    estado TEXT DEFAULT 'pendiente',
    kilometraje INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    vehicle_type TEXT,
    vehicle_motor TEXT,
    vehicle_era TEXT,
    current_mileage INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS maintenance_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_name TEXT NOT NULL,
    interval_km INTEGER NOT NULL,
    base_price REAL NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS predictive_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL,
    rule_id INTEGER NOT NULL,
    due_at_km INTEGER,
    status TEXT CHECK(status IN ('pending', 'approved', 'sent', 'rejected')) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
    FOREIGN KEY (rule_id) REFERENCES maintenance_rules(id)
);

CREATE TABLE IF NOT EXISTS circuit_breakers (
    service TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK(status IN ('open', 'closed', 'half-open')),
    failure_count INTEGER DEFAULT 0,
    opened_at DATETIME,
    last_failure_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    component TEXT NOT NULL,
    log_level TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata TEXT,
    trace_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS processed_updates (
    update_id INTEGER PRIMARY KEY,
    telegram_user_id INTEGER,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rate_limits (
    identity_key TEXT PRIMARY KEY,
    request_count INTEGER,
    window_start INTEGER,
    window_end INTEGER
);

CREATE TABLE IF NOT EXISTS agent_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id TEXT NOT NULL,
    agent_mode TEXT NOT NULL,
    history TEXT NOT NULL,
    message_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    UNIQUE(admin_id, agent_mode)
);

-- 3. OBD INFRASTRUCTURE (Iteración 7)
CREATE TABLE IF NOT EXISTS obd_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    source TEXT NOT NULL,
    code_type TEXT,
    severity TEXT CHECK(severity IN ('BAJA', 'MEDIA', 'ALTA', 'CRITICA')) DEFAULT 'MEDIA',
    extra_metadata TEXT,
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

-- 4. TITANIUM EXTENSIONS (V9.7.0)
CREATE TABLE IF NOT EXISTS admin_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT NOT NULL,
    vehiculo_tipo TEXT,
    vehiculo_motor TEXT,
    vehiculo_era TEXT,
    servicio_solicitado TEXT,
    fecha_cita TEXT,
    hora_cita TEXT,
    kilometraje INTEGER,
    telegram_user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS obd_sessions (
    admin_id INTEGER PRIMARY KEY,
    activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wa_message_id TEXT UNIQUE,
    phone_number TEXT NOT NULL,
    direction TEXT CHECK(direction IN ('inbound', 'outbound')),
    status TEXT,
    payload TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blocked_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    hora TEXT NOT NULL,
    motivo TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seo_message_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT NOT NULL,
    msg_number INTEGER NOT NULL,
    scheduled_for DATETIME NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. INDICES
CREATE INDEX IF NOT EXISTS idx_ia_jobs_status_pending ON ia_jobs(status) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_sessions_user_bot ON sessions(telegram_user_id, bot_type);
CREATE INDEX IF NOT EXISTS idx_obd_codes_code ON obd_codes(code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_obd_codes_code_source ON obd_codes(code, source);
