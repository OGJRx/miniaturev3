import { describe, it, expect, vi, beforeEach } from "vitest";
import { SlotValidator } from "../shared/services/slot-validator";

describe("SlotValidator", () => {
  let dbMock: any;

  beforeEach(() => {
    dbMock = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      all: vi.fn(),
    };
  });

  it("getAvailableSlots returns availability based on tickets and blocked slots", async () => {
    // Use a future date that is a workday (Monday 2099-10-12)
    const fecha = "2099-10-12";
    dbMock.all.mockResolvedValueOnce({
      results: [{ hora: "08:00" }, { hora: "10:00" }],
    });

    const validator = new SlotValidator(dbMock);
    const slots = await validator.getAvailableSlots(fecha);

    expect(slots.length).toBeGreaterThan(0);
    const slot8 = slots.find((s) => s.hora === "08:00");
    expect(slot8?.available).toBe(false);

    // Slot 09:00 should be available if 2099-10-10 is a workday and in the future
    const slot9 = slots.find((s) => s.hora === "09:00");
    if (slot9) {
      expect(slot9.available).toBe(true);
    }

    const slot10 = slots.find((s) => s.hora === "10:00");
    expect(slot10?.available).toBe(false);
  });
});
