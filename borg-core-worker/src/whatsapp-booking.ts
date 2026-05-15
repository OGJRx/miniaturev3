import {
  CoreEnv,
  BorgExecutionContext,
  EphemeralState,
} from "../../shared/types";
import { BookingCoreService } from "../../shared/services/booking-core";
import { WhatsAppApi } from "../../shared/whatsapp/whatsapp-api";
import { AdminNotificationService } from "../../shared/services/admin-notification";
import { formatHourTo12, formatDateFriendly } from "../../shared/ui/formatters";

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
    const session = await this.core.getSession(
      phoneNumber,
      phoneNumber,
      "whatsapp",
    );

    const lowerText = text.toLowerCase();
    if (lowerText.includes("agendar") || lowerText === "hola" || text === "1") {
      if (session.paso_actual === 0 || lowerText.includes("agendar")) {
        const result = await this.core.handleAction(
          session,
          "start_booking",
          "0",
        );
        return await this.renderStep(phoneNumber, result.step, result.newState);
      }
    }

    if (session.paso_actual > 0) {
      const selection = parseInt(text.trim(), 10);
      if (!isNaN(selection)) {
        const processed = await this.handleSelection(
          phoneNumber,
          session,
          selection,
        );
        if (processed) return;
      }

      if (session.paso_actual === 4) {
        const km = parseInt(text, 10);
        if (!isNaN(km)) {
          const result = await this.core.handleAction(
            session,
            "set_km",
            String(km),
          );
          return await this.renderStep(
            phoneNumber,
            result.step,
            result.newState,
          );
        }
      }
    }

    await this.api.sendMessage(
      phoneNumber,
      "🔱 *Taller Titanium*\n\nEscribe *Agendar* para iniciar tu cita.",
    );
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

    const opt = step.options[selection - 1]!;
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
    step: { message: string; options?: { label: string; value: string }[] },
    session: EphemeralState,
  ) {
    if (step.message === "CONFIRMED") {
      const ticketId = step.options?.find(
        (o) => o.label === "ticket_id",
      )?.value;

      const notifPromise = AdminNotificationService.dispatch(
        this.env,
        session,
        ticketId!,
        "whatsapp",
      );
      this.ctx.waitUntil(notifPromise);

      const fechaFriendly = session.fecha_cita
        ? formatDateFriendly(new Date(session.fecha_cita + "T12:00:00"))
        : "N/A";

      const summary =
        `✅ *¡Cita confirmada!*\n\n` +
        `📋 *Ticket:* \`${ticketId}\`\n` +
        `🚗 *Vehículo:* ${session.vehiculo_tipo} / ${session.vehiculo_motor}\n` +
        `📅 *Era:* ${session.vehiculo_era}\n` +
        `📟 *Kilometraje:* ${session.kilometraje} km\n` +
        `🛠️ *Servicio:* ${session.servicio_solicitado}\n` +
        `🗓️ *Fecha:* ${fechaFriendly}\n` +
        `⏰ *Hora:* ${session.hora_cita ? formatHourTo12(session.hora_cita) : "N/A"}\n\n` +
        `📍 *Ubicación:* ${this.env.TALLER_MAPS_URL || "Autodiagnóstico JR"}`;

      return await this.api.sendMessage(phoneNumber, summary);
    }

    if (step.message === "CANCELLED") {
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
