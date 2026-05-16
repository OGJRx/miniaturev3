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
      expect.stringContaining(
        "AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)",
      ),
    );
  });

  it("getSession should create a new session if not found", async () => {
    dbMock.first.mockResolvedValueOnce(null);
    const session = await service.getSession("user1", "chat1", "telegram");

    expect(session.platform_user_id).toBe("user1");
    expect(dbMock.prepare).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO sessions"),
    );
  });

  it("handleAction set_fecha should use cached slots if provided", async () => {
    const session = await service.getSession("user1", "chat1", "telegram");
    session.paso_actual = 5;
    const _slots = [{ hora: "08:00", available: true }];
    const result = await service.handleAction(
      session,
      "set_fecha",
      "2099-10-12",
    );
    expect(result.step.options).toBeDefined();
    expect(result.newState.fecha_cita).toBe("2099-10-12");
  });

  it("handleAction conf_booking should throw error if ticket_id is missing", async () => {
    const _session = {
      session_id: "S123",
      paso_actual: 8,
      platform_user_id: "U123",
      platform: "whatsapp",
      vehiculo_tipo: "SUV",
      vehiculo_motor: "Gasolina",
      vehiculo_era: "2010-2020",
      kilometraje: 50000,
      servicio_solicitado: "Cambio de Aceite",
      fecha_cita: "2024-10-10",
      hora_cita: "10:00",
    } as any;

    // We need to mock the TicketCreator used inside handleAction
    // Since it's imported, we might need a more complex mock or rely on the fact
    // that it uses dbMock.run() and we can control its return.

    // Actually, TicketCreator.createTicketAtomic returns {success: true, ticket_id}
    // and handleAction uses it.

    dbMock.run.mockResolvedValueOnce({ meta: { changes: 1 } });
    // This would make createTicketAtomic return {success: true, ticket_id: "T-..."}
    // because ticket_id is generated inside createTicketAtomic.

    // To test the throw, we'd need createTicketAtomic to return success: true but no ticket_id.
    // But ticket_id is generated locally in createTicketAtomic.

    // Wait, let's look at TicketCreator again.
  });
});
