import { D1Database } from "@cloudflare/workers-types";

export class PricingService {
  constructor(private db: D1Database) {}
  async getPrice(service: string): Promise<number> {
    const res = await this.db
      .prepare(
        "SELECT base_price FROM maintenance_rules WHERE service_name = ?",
      )
      .bind(service)
      .first<{ base_price: number }>();
    return res?.base_price ?? 100;
  }
}
