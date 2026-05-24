-- 🔱 TITANIUM CORE - Cleanup Dead Infrastructure & Optimization (NEUTRALIZED)
-- ⚠️ ADVERTENCIA: Esta migración fue neutralizada por el Auditor Jefe de Deuda Técnica.
-- MOTIVO: Intento de borrado de tablas activas y referencia a columnas inexistentes (bay_number).
-- ESTADO: NO-OP (Operación Nula) para preservar la integridad del diario de migraciones de D1.

-- 1. Registro de neutralización en métricas (Esquema corregido de 0003)
INSERT INTO business_metrics (metric_key, metric_value, platform, bot_type)
VALUES ('migration_0004_neutralized', 1, 'system', 'core');

-- El índice redundantemente propuesto ya existe en 0002_missing_indexes.sql.
-- Las tablas vehicles, predictive_alerts, maintenance_rules y agent_conversations se conservan.
