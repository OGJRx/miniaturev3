import { CoreEnv } from "../types";
import { BorgLogger } from "../services/borg-logger";

export class WhatsAppApi {
  constructor(
    private env: CoreEnv,
    private logger?: BorgLogger,
  ) {}

  async sendMessage(to: string, text: string): Promise<unknown> {
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

    const data = await response.json();
    if (!response.ok) {
      this.logger?.error(
        "whatsapp_api",
        `Failed to send message: ${JSON.stringify(data)}`,
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
