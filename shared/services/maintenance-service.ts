import { D1Database } from "@cloudflare/workers-types";
import { CoreEnv } from "../types";
import { toSqliteDateTime } from "../ui/formatters";

export class MaintenanceService {
  static async runAudits(db: D1Database, env: CoreEnv) {
    await db
      .prepare(
        "UPDATE circuit_breakers SET status = 'closed', opened_at = NULL WHERE status = 'open' AND opened_at < ?",
      )
      .bind(toSqliteDateTime(new Date(Date.now() - 3600000)))
      .run();

    await db
      .prepare("DELETE FROM sessions WHERE expires_at < datetime('now')")
      .run();

    await db
      .prepare("DELETE FROM rate_limits WHERE window_end < ?")
      .bind(Math.floor(Date.now() / 60000))
      .run();

    const retentionLogs = parseInt(env.RETENTION_LOGS_DAYS || "7");
    const retentionUpdates = parseInt(env.RETENTION_UPDATES_HOURS || "24");
    const retentionWA = parseInt(env.RETENTION_WHATSAPP_DAYS || "30");

    await db
      .prepare("DELETE FROM system_logs WHERE created_at < ?")
      .bind(
        toSqliteDateTime(
          new Date(Date.now() - retentionLogs * 24 * 3600 * 1000),
        ),
      )
      .run();

    await db
      .prepare("DELETE FROM processed_updates WHERE processed_at < ?")
      .bind(
        toSqliteDateTime(new Date(Date.now() - retentionUpdates * 3600 * 1000)),
      )
      .run();

    await db
      .prepare("DELETE FROM processed_wa_messages WHERE processed_at < ?")
      .bind(
        toSqliteDateTime(new Date(Date.now() - retentionUpdates * 3600 * 1000)),
      )
      .run();

    await db
      .prepare("DELETE FROM whatsapp_messages WHERE created_at < ?")
      .bind(
        toSqliteDateTime(new Date(Date.now() - retentionWA * 24 * 3600 * 1000)),
      )
      .run();
  }
}
