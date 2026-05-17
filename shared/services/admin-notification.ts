import { D1Database } from "@cloudflare/workers-types";
import { AdminNotificationRecord, EphemeralState, CoreEnv } from "../types";
import { AdminAuthService, TelegramApiFactory } from "../security";
import { escapeHtml } from "../ui/formatters";

export class AdminNotificationService {
  constructor(private db: D1Database) {}

  async saveNotification(record: AdminNotificationRecord): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO admin_notifications (ticket_id, vehiculo_tipo, vehiculo_motor, vehiculo_era, " +
          "servicio_solicitado, fecha_cita, hora_cita, kilometraje, telegram_user_id) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        record.ticket_id,
        record.vehiculo_tipo,
        record.vehiculo_motor,
        record.vehiculo_era,
        record.servicio_solicitado,
        record.fecha_cita,
        record.hora_cita,
        record.kilometraje,
        record.telegram_user_id,
      )
      .run();
  }

  async getRecentNotifications(
    limit: number = 5,
    offset: number = 0,
  ): Promise<AdminNotificationRecord[]> {
    const res = await this.db
      .prepare(
        "SELECT id, ticket_id, vehiculo_tipo, vehiculo_motor, vehiculo_era, " +
          "servicio_solicitado, fecha_cita, hora_cita, kilometraje, telegram_user_id, created_at " +
          "FROM admin_notifications ORDER BY created_at DESC LIMIT ? OFFSET ?",
      )
      .bind(limit, offset)
      .all<AdminNotificationRecord>();
    return res.results;
  }

  async getTotalCount(): Promise<number> {
    const res = await this.db
      .prepare("SELECT COUNT(*) as total FROM admin_notifications")
      .first<{ total: number }>();
    return res?.total ?? 0;
  }

  static async dispatch(
    env: CoreEnv,
    session: EphemeralState,
    ticketId: string,
    platform: "telegram" | "whatsapp",
  ): Promise<void> {
    const backendApi = TelegramApiFactory.create(env, "backend");
    const adminIds = AdminAuthService.parseAdminIds(env);
    const notifBody =
      `🔔 <b>Nueva Cita Confirmada</b>\n\n` +
      `📋 <b>Ticket:</b> <code>${escapeHtml(ticketId)}</code>\n` +
      `📱 <b>Origen:</b> ${platform === "whatsapp" ? "WhatsApp" : "Telegram"}\n` +
      `🚗 <b>Vehículo:</b> ${escapeHtml(session.vehiculo_tipo || "N/A")} / ${escapeHtml(session.vehiculo_motor || "N/A")}\n` +
      `📅 <b>Era:</b> ${escapeHtml(session.vehiculo_era || "N/A")}\n` +
      `📻 <b>Km:</b> ${session.kilometraje ?? "N/A"}\n` +
      `🔧 <b>Servicio:</b> ${escapeHtml(session.servicio_solicitado || "N/A")}\n` +
      `📆 <b>Fecha:</b> ${escapeHtml(session.fecha_cita || "N/A")}\n` +
      `🕐 <b>Hora:</b> ${escapeHtml(session.hora_cita || "N/A")}`;

    let successCount = 0;
    for (const adminId of adminIds) {
      await backendApi
        .sendMessage(adminId, notifBody, { parse_mode: "HTML" })
        .then(() => {
          successCount++;
        })
        .catch((err: unknown) => {
          console.error("[AdminNotif] Failed to send to:", adminId, {
            error: err instanceof Error ? err.message : String(err),
          });
        });
    }
    console.log(
      `[AdminNotif] Dispatched ${successCount}/${adminIds.length} for ticket:`,
      ticketId,
    );

    const service = new AdminNotificationService(env.DB);
    await service.saveNotification({
      ticket_id: ticketId,
      vehiculo_tipo: session.vehiculo_tipo || "",
      vehiculo_motor: session.vehiculo_motor || "",
      vehiculo_era: session.vehiculo_era || "",
      servicio_solicitado: session.servicio_solicitado || "",
      fecha_cita: session.fecha_cita || "",
      hora_cita: session.hora_cita || "",
      kilometraje: session.kilometraje ?? 0,
      telegram_user_id: session.telegram_user_id,
    });
  }
}
