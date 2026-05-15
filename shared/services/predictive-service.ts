import { D1Database } from "@cloudflare/workers-types";

export class PredictiveService {
  static async checkAlerts(db: D1Database) {
    const dueSoon = await db
      .prepare(
        "SELECT vehicle_id, user_id, service_name, interval_km, current_mileage FROM vw_maintenance_due_soon",
      )
      .all<{
        vehicle_id: number;
        user_id: number;
        service_name: string;
        interval_km: number;
        current_mileage: number | null;
      }>();

    for (const row of dueSoon.results) {
      const km = row.current_mileage ?? 0;
      const buffer = 500;
      if (km + buffer >= row.interval_km) {
        await db
          .prepare(
            "INSERT INTO predictive_alerts (vehicle_id, rule_id, due_at_km, status) " +
              "SELECT ?, id, ?, 'pending' FROM maintenance_rules WHERE service_name = ? " +
              "AND NOT EXISTS (SELECT 1 FROM predictive_alerts WHERE vehicle_id = ? AND rule_id = maintenance_rules.id AND status = 'pending')",
          )
          .bind(
            row.vehicle_id,
            row.interval_km,
            row.service_name,
            row.vehicle_id,
          )
          .run();
      }
    }
  }
}
