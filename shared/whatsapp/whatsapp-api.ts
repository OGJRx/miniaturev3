import { CoreEnv, CircuitService } from "../types";
import { BorgLogger } from "../services/borg-logger";
import { TitaniumCircuitBreaker } from "../services/circuit-breaker";

let globalMessageCounter = 0;
let lastResetTime = Date.now();

export class WhatsAppApi {
  constructor(
    private env: CoreEnv,
    private logger?: BorgLogger,
  ) {}

  private async checkRateLimit(to: string): Promise<boolean> {
    const now = Date.now();
    // Global limit: 10 msg/sec
    if (now - lastResetTime > 1000) {
      globalMessageCounter = 0;
      lastResetTime = now;
    }
    if (globalMessageCounter >= 10) return false;
    globalMessageCounter++;

    // Per user limit: 3 msg/min
    const windowStart = Math.floor(now / 60000);
    const db = this.env.DB;
    try {
      const res = await db
        .prepare(
          "INSERT INTO rate_limits (identity_key, window_start, window_end, request_count) VALUES (?, ?, ?, 1) " +
            "ON CONFLICT(identity_key) DO UPDATE SET request_count = CASE WHEN window_end < ? THEN 1 ELSE request_count + 1 END, " +
            "window_end = CASE WHEN window_end < excluded.window_end THEN ? ELSE window_end END " +
            "RETURNING request_count, window_end",
        )
        .bind(to, windowStart, windowStart, windowStart, windowStart)
        .first<{ request_count: number }>();

      if (res && res.request_count > 3) return false;
    } catch (e) {
      this.logger?.error("whatsapp_api", `Rate limit DB error: ${e}`);
    }

    return true;
  }

  async sendMessage(to: string, text: string): Promise<unknown> {
    if (
      await TitaniumCircuitBreaker.shouldBlock(
        this.env,
        CircuitService.WHATSAPP,
      )
    ) {
      throw new Error("WhatsApp circuit breaker is open");
    }

    if (!(await this.checkRateLimit(to))) {
      this.logger?.warn("whatsapp_api", `Rate limit exceeded for ${to}`);
      return { error: "Rate limit exceeded" };
    }

    const url = `https://graph.facebook.com/${this.env.WHATSAPP_API_VERSION}/${this.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: { body: text },
      }),
    });

    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      this.logger?.error(
        "whatsapp_api",
        `Failed to send message: ${JSON.stringify(data)}`,
      );
      await TitaniumCircuitBreaker.recordFailure(
        this.env,
        CircuitService.WHATSAPP,
        response.status,
      );
    } else {
      await TitaniumCircuitBreaker.recordSuccess(
        this.env,
        CircuitService.WHATSAPP,
      );
    }
    return data;
  }

  async markAsRead(messageId: string): Promise<void> {
    const url = `https://graph.facebook.com/${this.env.WHATSAPP_API_VERSION}/${this.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    });
  }
}
