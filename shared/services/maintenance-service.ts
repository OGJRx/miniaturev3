import { D1Database } from "@cloudflare/workers-types";

export class MaintenanceService {
  static async runAudits(db: D1Database) {
    await db
      .prepare(
        "UPDATE circuit_breakers SET status = 'closed', opened_at = NULL WHERE status = 'open' AND opened_at < ?",
      )
      .bind(new Date(Date.now() - 3600000).toISOString())
      .run();

    await db
      .prepare("DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP")
      .run();

    await db
      .prepare("DELETE FROM rate_limits WHERE window_end < ?")
      .bind(Math.floor(Date.now() / 1000))
      .run();
  }
}
