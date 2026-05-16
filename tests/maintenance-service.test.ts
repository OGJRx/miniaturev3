import { describe, it, expect, vi, beforeEach } from "vitest";
import { MaintenanceService } from "../shared/services/maintenance-service";
import { D1Database } from "@cloudflare/workers-types";
import { CoreEnv } from "../shared/types";

describe("MaintenanceService", () => {
  let dbMock: any;
  let envMock: Partial<CoreEnv>;

  beforeEach(() => {
    dbMock = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({}),
    };
    envMock = {
      RETENTION_LOGS_DAYS: "5",
      RETENTION_UPDATES_HOURS: "12",
    };
  });

  it("runAudits should execute all cleanup queries", async () => {
    await MaintenanceService.runAudits(
      dbMock as unknown as D1Database,
      envMock as CoreEnv,
    );

    // Check if at least some of the expected tables are being cleaned
    expect(dbMock.prepare).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM system_logs"),
    );
    expect(dbMock.prepare).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM processed_updates"),
    );
    expect(dbMock.prepare).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM whatsapp_messages"),
    );
  });
});
