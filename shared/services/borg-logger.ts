import { D1Database } from "@cloudflare/workers-types";
import { BorgExecutionContext } from "../types";

export class BorgLogger {
  constructor(
    private comp: string,
    private db?: D1Database,
    private traceId?: string,
    private exec?: BorgExecutionContext,
  ) {}
  setTraceId(traceId: string) {
    this.traceId = traceId;
  }
  info(action: string, m: string) {
    console.log(`[${this.comp}] ${m}`);
    if (this.db) this.persistToDb("INFO", action, m);
  }
  warn(action: string, m: string) {
    console.warn(`[${this.comp}] ${m}`);
    if (this.db) this.persistToDb("WARN", action, m);
  }
  error(action: string, m: string) {
    console.error(`[${this.comp}] ${m}`);
    if (this.db) this.persistToDb("ERROR", action, m);
  }
  success(action: string, m: string) {
    console.log(`[${this.comp}] ${m}`);
    if (this.db) this.persistToDb("SUCCESS", action, m);
  }

  private persistToDb(level: string, action: string, message: string) {
    if (!this.db) return;
    const metadata = JSON.stringify({ action });
    const p = this.db
      .prepare(
        "INSERT INTO system_logs (component, log_level, message, metadata, trace_id) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(this.comp, level, message, metadata, this.traceId || null)
      .run()
      .catch((e: unknown) => {
        console.error("[BorgLogger] DB persist error:", e);
      });

    if (this.exec) {
      this.exec.waitUntil(p);
    }
  }
}
