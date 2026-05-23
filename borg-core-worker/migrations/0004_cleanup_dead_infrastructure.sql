-- 🔱 TITANIUM CORE - Cleanup Dead Infrastructure & Optimization
-- Auditoría de Deuda Técnica v9.7.0-TITANIUM

-- 1. Eliminar tablas muertas sin referencias en el código TypeScript
DROP TABLE IF EXISTS vehicles;
DROP TABLE IF EXISTS predictive_alerts;
DROP TABLE IF EXISTS maintenance_rules;
DROP TABLE IF EXISTS agent_conversations;

-- 2. Eliminar columna muerta bay_number de la tabla sessions
-- SQLite no soporta DROP COLUMN directamente en versiones antiguas de D1 sin recrear tabla,
-- pero D1 (SQLite 3.35+) sí soporta DROP COLUMN.
ALTER TABLE sessions DROP COLUMN bay_number;

-- 3. Optimización de rendimiento: Índice compuesto para consultas de calendario y reportes
CREATE INDEX IF NOT EXISTS idx_tickets_fecha_estado ON tickets(fecha_cita, estado);

-- 4. Registro de limpieza en métricas de negocio
INSERT INTO business_metrics (metric_name, metric_value, updated_at)
VALUES ('system_cleanup_applied', 1, datetime('now'));
