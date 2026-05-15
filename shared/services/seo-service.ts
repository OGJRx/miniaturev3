import { D1Database } from "@cloudflare/workers-types";
import { CoreEnv } from "../types";
import { TelegramApiFactory } from "../security";
import { escapeHtml } from "../ui/formatters";

export class SeoService {
  static async processQueue(db: D1Database, env: CoreEnv) {
    const now = new Date().toISOString();
    const pending = await db
      .prepare(
        "SELECT q.id, q.ticket_id, q.msg_number, t.telegram_chat_id FROM seo_message_queue q JOIN tickets t ON q.ticket_id = t.ticket_id WHERE q.status = 'pending' AND q.scheduled_for <= ?",
      )
      .bind(now)
      .all<{
        id: number;
        ticket_id: string;
        msg_number: number;
        telegram_chat_id: number;
      }>();

    const api = TelegramApiFactory.create(env, "frontend");

    for (const msg of pending.results) {
      try {
        const text = `👋 <b>¡Hola!</b> Esperamos que tu servicio para el ticket <code>${escapeHtml(msg.ticket_id)}</code> haya sido excelente. ¿Tienes alguna duda adicional?`;
        await api.sendMessage(msg.telegram_chat_id, text, {
          parse_mode: "HTML",
        });

        await db
          .prepare(
            "UPDATE seo_message_queue SET status = 'sent', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          )
          .bind(msg.id)
          .run();
      } catch (_e) {
        /* ignore */
      }
    }
  }
}
