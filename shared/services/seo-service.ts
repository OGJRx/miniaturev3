import { D1Database } from "@cloudflare/workers-types";
import { CoreEnv } from "../types";
import { TelegramApiFactory } from "../security";
import { escapeHtml } from "../ui/formatters";
import { WhatsAppApi } from "../whatsapp/whatsapp-api";
import { BorgLogger } from "./borg-logger";

export class SeoService {
  static async processQueue(db: D1Database, env: CoreEnv) {
    const logger = new BorgLogger("SeoService", db);
    const now = new Date().toISOString();

    let pending;
    try {
      pending = await db
        .prepare(
          "SELECT q.id, q.ticket_id, q.msg_number, t.telegram_chat_id, t.platform " +
            "FROM seo_message_queue q JOIN tickets t ON q.ticket_id = t.ticket_id " +
            "WHERE q.status = 'pending' AND q.scheduled_for <= ?",
        )
        .bind(now)
        .all<{
          id: number;
          ticket_id: string;
          msg_number: number;
          telegram_chat_id: string;
          platform: "telegram" | "whatsapp";
        }>();
    } catch (e: unknown) {
      logger.error(
        "SEO_QUEUE_FETCH",
        `Error fetching SEO queue: ${e instanceof Error ? e.message : String(e)}`,
      );
      return;
    }

    const telegramApi = TelegramApiFactory.create(env, "frontend");
    const whatsappApi = new WhatsAppApi(env, logger);

    const messagesProcessed = pending.results.length;
    await db
      .prepare(
        "INSERT INTO business_metrics (metric_key, metric_value, bot_type) VALUES (?, ?, ?)",
      )
      .bind("messages_processed", messagesProcessed, "seo_cron")
      .run()
      .catch((e) => console.error("[SeoService] Metrics error:", e));

    for (const msg of pending.results) {
      try {
        const text = `👋 ¡Hola! Esperamos que tu servicio para el ticket ${msg.ticket_id} haya sido excelente. ¿Tienes alguna duda adicional?`;

        if (msg.platform === "telegram") {
          const htmlText = `👋 <b>¡Hola!</b> Esperamos que tu servicio para el ticket <code>${escapeHtml(msg.ticket_id)}</code> haya sido excelente. ¿Tienes alguna duda adicional?`;
          await telegramApi.sendMessage(msg.telegram_chat_id, htmlText, {
            parse_mode: "HTML",
          });
        } else if (msg.platform === "whatsapp") {
          await whatsappApi.sendMessage(msg.telegram_chat_id, text);
        } else {
          logger.warn(
            "SEO_DISPATCH",
            `Unknown platform '${msg.platform}' for ticket ${msg.ticket_id}`,
          );
          continue;
        }

        await db
          .prepare(
            "UPDATE seo_message_queue SET status = 'sent', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          )
          .bind(msg.id)
          .run();

        logger.info(
          "SEO_DISPATCH",
          `Message ${msg.msg_number} sent to ${msg.platform}:${msg.telegram_chat_id} for ticket ${msg.ticket_id}`,
        );
      } catch (e: unknown) {
        logger.error(
          "SEO_DISPATCH",
          `Failed to send SEO message ${msg.id}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }
}
