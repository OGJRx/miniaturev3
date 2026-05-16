import { describe, it, expect, vi, beforeEach } from "vitest";
import { BookingCoreService } from "../shared/services/booking-core";
import { D1Database } from "@cloudflare/workers-types";

describe("BookingCoreService", () => {
  let dbMock: any;
  let service: BookingCoreService;

  beforeEach(() => {
    dbMock = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
      all: vi.fn().mockResolvedValue({ results: [] }),
    };
    service = new BookingCoreService(dbMock as unknown as D1Database);
  });

  it("getSession should filter by expires_at", async () => {
    dbMock.first.mockResolvedValueOnce(null); // No session found
    await service.getSession("user1", "chat1", "telegram");

    expect(dbMock.prepare).toHaveBeenCalledWith(
      expect.stringContaining("AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)")
    );
  });

  it("getSession should create a new session if not found", async () => {
    dbMock.first.mockResolvedValueOnce(null);
    const session = await service.getSession("user1", "chat1", "telegram");

    expect(session.platform_user_id).toBe("user1");
    expect(dbMock.prepare).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO sessions")
    );
  });

  it("handleAction set_fecha should use cached slots if provided", async () => {
     // This is more of an internal optimization test.
     // In the code, set_fecha calls renderStep(newState, slots)
  });
});
