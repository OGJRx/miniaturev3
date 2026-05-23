import { D1Database } from "@cloudflare/workers-types";

export class ObdSessionService {
  static async activate(
    db: D1Database,
    adminId: number,
    ttlMs = 3600000,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    await db
      .prepare(
        "INSERT INTO obd_sessions (admin_id, activated_at, expires_at) VALUES (?, CURRENT_TIMESTAMP, ?) " +
          "ON CONFLICT(admin_id) DO UPDATE SET activated_at = CURRENT_TIMESTAMP, expires_at = ?",
      )
      .bind(adminId, expiresAt, expiresAt)
      .run();
  }

  static async deactivate(db: D1Database, adminId: number): Promise<void> {
    await db
      .prepare("DELETE FROM obd_sessions WHERE admin_id = ?")
      .bind(adminId)
      .run();
  }

  static async isActive(db: D1Database, adminId: number): Promise<boolean> {
    const res = await db
      .prepare(
        "SELECT 1 as found FROM obd_sessions WHERE admin_id = ? AND expires_at > CURRENT_TIMESTAMP",
      )
      .bind(adminId)
      .first<{ found: number }>();
    return res !== null;
  }
}
