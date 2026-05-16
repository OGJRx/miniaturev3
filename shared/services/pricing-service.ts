import { D1Database } from "@cloudflare/workers-types";
import { BorgLogger } from "./borg-logger";

export class PricingService {
  constructor(private db: D1Database) {}
  async getPrice(service: string): Promise<number> {
    const logger = new BorgLogger("PricingService", this.db);
    const res = await this.db
      .prepare(
        "SELECT base_price FROM maintenance_rules WHERE service_name = ?",
      )
      .bind(service)
      .first<{ base_price: number }>();

    if (!res) {
      logger.warn(
        "PRICING_FALLBACK",
        `No price found for service '${service}'. Using default 100.`,
      );
      return 100;
    }
    return res.base_price;
  }
}
