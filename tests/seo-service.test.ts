import { describe, it, expect, vi, beforeEach } from "vitest";
import { SeoService } from "../shared/services/seo-service";
import { D1Database } from "@cloudflare/workers-types";
import { CoreEnv, BorgExecutionContext } from "../shared/types";
import { TelegramApiFactory } from "../shared/security";
import { WhatsAppApi } from "../shared/whatsapp/whatsapp-api";

vi.mock("../shared/security", () => ({
  TelegramApiFactory: {
    create: vi.fn(),
  },
}));

vi.mock("../shared/whatsapp/whatsapp-api", () => {
  return {
    WhatsAppApi: class {
      sendMessage = vi.fn().mockResolvedValue({});
    }
  };
});

describe("SeoService", () => {
  let dbMock: any;
  let envMock: CoreEnv;
  let ctxMock: BorgExecutionContext;
  let telegramApiMock: any;

  beforeEach(() => {
    vi.clearAllMocks();

    dbMock = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      all: vi.fn(),
      run: vi.fn().mockResolvedValue({ success: true }),
    };

    envMock = {
      FRONTEND_BOT_TOKEN: "f-token",
      BACKEND_BOT_TOKEN: "b-token",
      DB: dbMock,
    } as any;

    ctxMock = {
      traceId: "test-trace",
      waitUntil: vi.fn(),
    };

    telegramApiMock = {
      sendMessage: vi.fn().mockResolvedValue({}),
    };
    (TelegramApiFactory.create as any).mockReturnValue(telegramApiMock);
  });

  it("should process pending messages and update status to sent", async () => {
    // 1. Mock queue fetch
    dbMock.all.mockResolvedValueOnce({
      results: [
        { id: 1, ticket_id: "T1", msg_number: 1, telegram_chat_id: "C1", platform: "telegram" },
      ],
    });

    // 2. Mock tickets fetch
    dbMock.all.mockResolvedValueOnce({
      results: [
        { ticket_id: "T1", servicio_solicitado: "Cambio de aceite", vehiculo_tipo: "Toyota" },
      ],
    });

    await SeoService.processQueue(dbMock as unknown as D1Database, envMock, ctxMock);

    expect(telegramApiMock.sendMessage).toHaveBeenCalledWith(
      "C1",
      expect.stringContaining("Cambio de aceite"),
      expect.any(Object)
    );

    // Verify status update to 'sent'
    expect(dbMock.prepare).toHaveBeenCalledWith(expect.stringContaining("UPDATE seo_message_queue SET status = 'sent'"));
    expect(dbMock.bind).toHaveBeenCalledWith(1);

    // Verify metrics recording
    expect(ctxMock.waitUntil).toHaveBeenCalled();
  });

  it("should handle failed sends by updating status to failed", async () => {
    dbMock.all.mockResolvedValueOnce({
      results: [
        { id: 2, ticket_id: "T2", msg_number: 1, telegram_chat_id: "C2", platform: "telegram" },
      ],
    });
    dbMock.all.mockResolvedValueOnce({
      results: [
        { ticket_id: "T2", servicio_solicitado: "Frenos", vehiculo_tipo: "Ford" },
      ],
    });

    telegramApiMock.sendMessage.mockRejectedValueOnce(new Error("API Error"));

    await SeoService.processQueue(dbMock as unknown as D1Database, envMock, ctxMock);

    // Verify status update to 'failed'
    expect(dbMock.prepare).toHaveBeenCalledWith(expect.stringContaining("UPDATE seo_message_queue SET status = 'failed'"));
    expect(dbMock.bind).toHaveBeenCalledWith(2);

    // Verify metrics recording still happens (failed count)
    expect(ctxMock.waitUntil).toHaveBeenCalled();
  });

  it("should respect the LIMIT 25 in the query", async () => {
    dbMock.all.mockResolvedValueOnce({ results: [] });

    await SeoService.processQueue(dbMock as unknown as D1Database, envMock, ctxMock);

    expect(dbMock.prepare).toHaveBeenCalledWith(expect.stringContaining("LIMIT 25"));
  });
});
