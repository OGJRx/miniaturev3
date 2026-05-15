import { D1Database } from "@cloudflare/workers-types";
import { AiConversationItem } from "../types";

export class AgentConversationService {
  static async appendToHistory(
    db: D1Database,
    adminId: number,
    mode: string,
    historyItems: AiConversationItem[],
  ): Promise<void> {
    const res = await db
      .prepare(
        "SELECT history FROM agent_conversations WHERE admin_id = ? AND agent_mode = ?",
      )
      .bind(adminId.toString(), mode)
      .first<{ history: string }>();

    let currentHistory: AiConversationItem[] = [];
    if (res?.history) {
      try {
        currentHistory = JSON.parse(res.history);
      } catch (_e) {
        currentHistory = [];
      }
    }

    currentHistory.push(...historyItems);
    if (currentHistory.length > 20) {
      currentHistory = currentHistory.slice(-20);
    }

    const historyStr = JSON.stringify(currentHistory);
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 86400000).toISOString();

    await db
      .prepare(
        "INSERT INTO agent_conversations (admin_id, agent_mode, history, message_count, updated_at, expires_at) " +
          "VALUES (?, ?, ?, ?, ?, ?) " +
          "ON CONFLICT(admin_id, agent_mode) DO UPDATE SET " +
          "history = ?, message_count = message_count + ?, updated_at = ?, expires_at = ?",
      )
      .bind(
        adminId.toString(),
        mode,
        historyStr,
        historyItems.length,
        now,
        expiresAt,
        historyStr,
        historyItems.length,
        now,
        expiresAt,
      )
      .run();
  }

  static async getHistory(
    db: D1Database,
    adminId: number,
    mode: string,
  ): Promise<AiConversationItem[]> {
    const res = await db
      .prepare(
        "SELECT history FROM agent_conversations WHERE admin_id = ? AND agent_mode = ?",
      )
      .bind(adminId.toString(), mode)
      .first<{ history: string }>();

    if (res?.history) {
      try {
        return JSON.parse(res.history);
      } catch (_e) {
        return [];
      }
    }
    return [];
  }
}
