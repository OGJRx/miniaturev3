-- TITANIUM CLEANUP v9.7.0
-- Purge all legacy tables that are no longer part of the core infrastructure.
-- WARNING: This is a destructive operation.

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
DROP TABLE IF EXISTS bays;
