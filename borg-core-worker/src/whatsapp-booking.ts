import {
  CoreEnv,
  BorgExecutionContext,
  EphemeralState,
} from "../../shared/types";
import { BookingCoreService } from "../../shared/services/booking-core";
import { WhatsAppApi } from "../../shared/whatsapp/whatsapp-api";
import { AdminNotificationService } from "../../shared/services/admin-notification";
import { KILOMETRAJE_RANGES } from "../../shared/types/constants";
import { formatHourTo12, formatDateFriendly } from "../../shared/ui/formatters";
import { BorgLogger } from "../../shared/services/borg-logger";
import { getPlatformErrorFallback } from "../../shared/services/response-helper";

export class WhatsAppBookingOrchestrator {
  private api: WhatsAppApi;
  private core: BookingCoreService;

  constructor(
    private env: CoreEnv,
    private ctx: BorgExecutionContext,
  ) {
    this.api = new WhatsAppApi(env);
    this.core = new BookingCoreService(env.DB);
  }

  async handleMessage(phoneNumber: string, text: string) {
    try {
      const session = await this.core.getSession(
        phoneNumber,
        phoneNumber,
        "whatsapp",
      );

      const cleanText = text.trim().toLowerCase();

      // Keywords handling
      if (cleanText === "cancelar") {
        const result = await this.core.handleAction(
          session,
          "conf_booking",
          "no",
        );
        return await this.renderStep(phoneNumber, result.step, result.newState);
      }

      if (cleanText === "reiniciar" || cleanText === "ayuda") {
        const result = await this.core.handleAction(
          session,
          "start_booking",
          "0",
        );
        return await this.renderStep(phoneNumber, result.step, result.newState);
      }

      if (session.paso_actual > 0) {
        // Selection handling (Numeric options)
        if (session.paso_actual !== 4) {
          const selection = parseInt(text.trim(), 10);
          if (!isNaN(selection)) {
            const processed = await this.handleSelection(
              phoneNumber,
              session,
              selection,
            );
            if (processed) return;
          }
        }

        // Kilometer handling (Step 4)
        if (session.paso_actual === 4) {
          const km = parseInt(text, 10);
          if (!isNaN(km)) {
            const range = KILOMETRAJE_RANGES.reduce((prev, curr) =>
              Math.abs(curr.value - km) < Math.abs(prev.value - km)
                ? curr
                : prev,
            );
            const result = await this.core.handleAction(
              session,
              "set_km",
              String(range.value),
            );
            return await this.renderStep(
              phoneNumber,
              result.step,
              result.newState,
            );
          }
        }

        // If we reach here and we were in an active flow, it means input was invalid
        const currentStep = await this.core.renderStep(session);
        let errorMsg =
          "❌ Opción inválida. Responde con el número de tu elección (1, 2, 3...) o escribe *cancelar* para abortar.";

        if (session.paso_actual === 4) {
          errorMsg =
            "❌ Kilometraje inválido. Por favor ingresa solo números (ej: 50000) o escribe *cancelar* para abortar.";
        }

        return await this.renderStep(
          phoneNumber,
          {
            ...currentStep,
            message: `${errorMsg}\n\n${currentStep.message}`,
          },
          session,
        );
      }

      // No active session or just started
      const result = await this.core.handleAction(
        session,
        "start_booking",
        "0",
      );
      return await this.renderStep(phoneNumber, result.step, result.newState);
    } catch (error) {
      const logger = new BorgLogger(
        "WhatsAppBookingOrchestrator",
        this.env.DB,
        this.ctx.traceId,
        this.ctx,
      );
      logger.error(
        "handleMessage",
        `Error in handleMessage: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      await this.api
        .sendMessage(phoneNumber, getPlatformErrorFallback("whatsapp"))
        .catch(() => {});
    }
  }

  private async handleSelection(
    phoneNumber: string,
    session: EphemeralState,
    selection: number,
  ): Promise<boolean> {
    const step = await this.core.renderStep(session);
    if (!step.options || selection <= 0 || selection > step.options.length) {
      return false;
    }

    const opt = step.options[selection - 1];
    if (!opt) return false;
    const actionMap: Record<number, string> = {
      1: "set_tipo",
      2: opt.value === "HELP" ? "motor_help" : "set_motor",
      3: "set_era",
      4: "set_km",
      5: "set_svc",
      6: "set_fecha",
      7: "set_hora",
      8: "conf_booking",
    };

    const action = actionMap[session.paso_actual];
    if (!action) return false;

    if (action === "motor_help") {
      await this.api.sendMessage(
        phoneNumber,
        "⚙️ *Ayuda de Motor*\n\nIndica la tecnología de propulsión. Si tienes dudas, consulta el manual de tu vehículo.",
      );
      return true;
    }

    const result = await this.core.handleAction(session, action, opt.value);
    await this.renderStep(phoneNumber, result.step, result.newState);
    return true;
  }

  private async renderStep(
    phoneNumber: string,
    step: {
      status: "PROMPT" | "CONFIRMED" | "CANCELLED" | "EMPTY";
      message: string;
      options?: { label: string; value: string }[];
    },
    session: EphemeralState,
  ) {
    if (step.status === "CONFIRMED") {
      const ticketId = step.options?.find(
        (o) => o.label === "ticket_id",
      )?.value;

      if (!ticketId) {
        return await this.api.sendMessage(
          phoneNumber,
          "⚠️ Error al generar ticket. Contacte soporte.",
        );
      }

      const notifPromise = AdminNotificationService.dispatch(
        this.env,
        session,
        ticketId,
        "whatsapp",
      );
      this.ctx.waitUntil(notifPromise);

      const fechaFriendly = session.fecha_cita
        ? formatDateFriendly(new Date(session.fecha_cita + "T12:00:00"))
        : "N/A";

      let summary =
        `✅ *¡Cita confirmada!*\n\n` +
        `📋 *Ticket:* \`${ticketId}\`\n` +
        `🚗 *Vehículo:* ${session.vehiculo_tipo} / ${session.vehiculo_motor}\n` +
        `📅 *Era:* ${session.vehiculo_era}\n` +
        `📟 *Kilometraje:* ${session.kilometraje} km\n` +
        `🛠️ *Servicio:* ${session.servicio_solicitado}\n` +
        `🗓️ *Fecha:* ${fechaFriendly}\n` +
        `⏰ *Hora:* ${session.hora_cita ? formatHourTo12(session.hora_cita) : "N/A"}`;

      if (this.env.TALLER_MAPS_URL) {
        summary += `\n\n📍 *Ubicación:* ${this.env.TALLER_MAPS_URL}`;
      } else if (
        this.env.TALLER_LATITUD &&
        this.env.TALLER_LATITUD !== "0" &&
        this.env.TALLER_LONGITUD &&
        this.env.TALLER_LONGITUD !== "0"
      ) {
        summary += `\n\n📍 *Ubicación:* Autodiagnóstico JR`;
      }

      return await this.api.sendMessage(phoneNumber, summary);
    }

    if (step.status === "CANCELLED") {
      return await this.api.sendMessage(phoneNumber, "❌ *Cita cancelada.*");
    }

    let fullMessage =
      step.message.replace(/<b>/g, "*").replace(/<\/b>/g, "*") + "\n\n";
    if (step.options) {
      step.options.forEach((opt, i) => {
        fullMessage += `${i + 1}. ${opt.label}\n`;
      });
      fullMessage += "\n_Responde con el número de tu opción._";
    }

    return await this.api.sendMessage(phoneNumber, fullMessage);
  }
}
