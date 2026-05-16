import { CoreEnv, BorgContext, EphemeralState } from "../../shared/types";
import { BookingCoreService } from "../../shared/services/booking-core";
import { buildCallback, parseCallback } from "../../shared/security";
import { InlineKeyboard } from "grammy";
import { UiManager } from "../../shared/ui/ui-manager";
import { AdminNotificationService } from "../../shared/services/admin-notification";
import {
  escapeHtml,
  formatHourTo12,
  formatDateFriendly,
} from "../../shared/ui/formatters";
import { MOTOR_HELP_MESSAGE } from "../../shared/ui/prompts";

export class BookingOrchestrator {
  private async getCore(ctx: BorgContext<CoreEnv>) {
    return new BookingCoreService(ctx.env.DB);
  }

  async handleUpdate(ctx: BorgContext<CoreEnv>) {
    const userId = ctx.from?.id;
    const chatId = ctx.chat?.id || userId;
    if (!userId || !chatId) return;

    const core = await this.getCore(ctx);
    const session = await core.getSession(
      String(userId),
      String(chatId),
      "telegram",
    );

    if (ctx.hasCommand("start")) {
      return await this.handleStart(ctx);
    }

    if (ctx.callbackQuery?.data) {
      return await this.handleCallback(ctx, session);
    }

    if (ctx.message?.text) {
      return await this.handleText(ctx, session);
    }
  }

  private async handleStart(ctx: BorgContext<CoreEnv>) {
    const secret = ctx.env.BORG_SECRET_KEY;
    const inlineKeyboard = new InlineKeyboard().text(
      "📅 Agendar Cita",
      await buildCallback("start_booking", "0", secret),
    );
    return await ctx
      .reply(
        "🔱 <b>Bienvenido al Taller Titanium</b>\n\nSoy Borg, tu asistente de servicio automotriz. A continuación puedes seleccionar una opción para comenzar:\n\n📅 <b>Agendar Cita</b> — Inicia el proceso de reservación. El agendado es gratuito y al finalizar tu reserva, recibirás la ubicación exacta de nuestras instalaciones para tu llegada.\n\nTambién puedes usar el menú persistente en tu teclado para un acceso rápido.",
        {
          parse_mode: "HTML",
          reply_markup: inlineKeyboard,
        },
      )
      .then(async (msg: { chat: { id: number } }) => {
        await ctx.api.sendMessage(
          msg.chat.id,
          "👇 Usa el botón o el menú del teclado:",
          {
            reply_markup: {
              keyboard: [[{ text: "📅 Agendar Cita" }]],
              resize_keyboard: true,
              input_field_placeholder: "Presiona el botón para agendar...",
            },
          },
        );
      });
  }

  private async handleCallback(
    ctx: BorgContext<CoreEnv>,
    session: EphemeralState,
  ) {
    const parsed = await parseCallback(
      ctx.callbackQuery?.data || "",
      ctx.env.BORG_SECRET_KEY,
    );
    if (!parsed || !parsed.valid)
      return ctx.answerCallbackQuery("⚠️ Error de sesión");

    const { action, value } = parsed;
    const core = await this.getCore(ctx);
    const secret = ctx.env.BORG_SECRET_KEY;

    if (action === "motor_help") {
      await ctx.reply(MOTOR_HELP_MESSAGE, { parse_mode: "HTML" });
      return await ctx.answerCallbackQuery();
    }

    const result = await core.handleAction(session, action, value);
    await this.renderStep(ctx, result.step, secret, result.newState);
    await ctx.answerCallbackQuery().catch(() => {});
  }

  private async renderStep(
    ctx: BorgContext<CoreEnv>,
    step: {
      status: "PROMPT" | "CONFIRMED" | "CANCELLED" | "EMPTY";
      message: string;
      options?: { label: string; value: string }[];
    },
    secret: string,
    session: EphemeralState,
  ) {
    if (step.status === "CONFIRMED") {
      return await this.handleConfirmed(ctx, step, session);
    }

    if (step.status === "CANCELLED") {
      return await UiManager.safeEditOrReply(ctx, "❌ <b>Cita cancelada.</b>", {
        parse_mode: "HTML",
      });
    }

    const k = new InlineKeyboard();
    if (step.options) {
      const buttons = await this.buildKeyboardButtons(
        step.options,
        session.paso_actual,
        secret,
      );
      this.populateKeyboard(k, buttons, session.paso_actual);
    }

    return await UiManager.safeEditOrReply(ctx, step.message, {
      reply_markup: k,
      parse_mode: "HTML",
    });
  }

  private async handleConfirmed(
    ctx: BorgContext<CoreEnv>,
    step: { options?: { label: string; value: string }[] },
    session: EphemeralState,
  ) {
    const ticketId = step.options?.find((o) => o.label === "ticket_id")?.value;
    if (!ticketId) {
      return await UiManager.safeEditOrReply(
        ctx,
        "⚠️ Error al generar ticket. Contacte soporte.",
      );
    }

    const notifPromise = AdminNotificationService.dispatch(
      ctx.env,
      session,
      ticketId,
      "telegram",
    );
    ctx.executionContext.waitUntil(notifPromise);

    const fechaFriendly = session.fecha_cita
      ? formatDateFriendly(new Date(session.fecha_cita + "T12:00:00"))
      : "N/A";

    const loc = {
      latitud: parseFloat(ctx.env.TALLER_LATITUD || "0"),
      longitud: parseFloat(ctx.env.TALLER_LONGITUD || "0"),
      mapsUrl: ctx.env.TALLER_MAPS_URL || "",
    };

    const summary =
      `✅ <b>¡Cita confirmada!</b>\n\n` +
      `📋 <b>Ticket:</b> <code>${escapeHtml(ticketId)}</code>\n` +
      `🚗 <b>Vehículo:</b> ${escapeHtml(session.vehiculo_tipo || "N/A")} / ${escapeHtml(session.vehiculo_motor || "N/A")}\n` +
      `📅 <b>Era:</b> ${escapeHtml(session.vehiculo_era || "N/A")}\n` +
      `📟 <b>Kilometraje:</b> ${session.kilometraje ?? "N/A"} km\n` +
      `🛠️ <b>Servicio:</b> ${escapeHtml(session.servicio_solicitado || "N/A")}\n` +
      `🗓️ <b>Fecha:</b> ${escapeHtml(fechaFriendly)}\n` +
      `⏰ <b>Hora:</b> ${escapeHtml(session.hora_cita ? formatHourTo12(session.hora_cita) : "N/A")}\n\n` +
      `📍 <b>¡Aquí nos encontramos!</b> Te esperamos en Autodiagnóstico JR. Usa el mapa para navegar directamente.`;

    const keyboard = new InlineKeyboard();
    if (loc.mapsUrl) {
      keyboard.url("🌐 Ver en Google Maps", loc.mapsUrl);
    }

    await UiManager.safeEditOrReply(ctx, summary, {
      parse_mode: "HTML",
      reply_markup: keyboard.inline_keyboard.length > 0 ? keyboard : undefined,
    });

    if (loc.latitud !== 0 && loc.longitud !== 0 && ctx.chat) {
      await ctx.api.sendLocation(ctx.chat.id, loc.latitud, loc.longitud);
    }
    return;
  }

  private async buildKeyboardButtons(
    options: { label: string; value: string }[],
    paso: number,
    secret: string,
  ) {
    const actionMap: Record<number, string> = {
      1: "set_tipo",
      2: "set_motor",
      3: "set_era",
      4: "set_km",
      5: "set_svc",
      6: "set_fecha",
      7: "set_hora",
      8: "conf_booking",
    };

    return await Promise.all(
      options.map(async (opt) => {
        const action =
          paso === 2 && opt.value === "HELP" ? "motor_help" : actionMap[paso];
        return {
          label: opt.label,
          callback: action
            ? await buildCallback(action, opt.value, secret)
            : "",
        };
      }),
    );
  }

  private populateKeyboard(
    k: InlineKeyboard,
    buttons: { label: string; callback: string }[],
    paso: number,
  ) {
    buttons.forEach((btn, i) => {
      if (!btn.callback) return;
      k.text(btn.label, btn.callback);
      if (paso === 1 && i % 2 === 1) k.row();
      else if (paso === 7 && i % 3 === 2) k.row();
      else if ([2, 3, 5, 6, 8].includes(paso) || btn.label === "❓ Ayuda")
        k.row();
    });
  }

  private async handleText(ctx: BorgContext<CoreEnv>, session: EphemeralState) {
    const core = await this.getCore(ctx);
    if (ctx.message?.text === "📅 Agendar Cita") {
      const result = await core.handleAction(session, "start_booking", "0");
      return await this.renderStep(
        ctx,
        result.step,
        ctx.env.BORG_SECRET_KEY,
        result.newState,
      );
    }

    if (session.paso_actual === 4 && ctx.message?.text) {
      const km = parseInt(ctx.message.text);
      if (isNaN(km))
        return await ctx.reply(
          "❌ Por favor ingresa un número válido para el kilometraje.",
        );
      const result = await core.handleAction(session, "set_km", String(km));
      return await this.renderStep(
        ctx,
        result.step,
        ctx.env.BORG_SECRET_KEY,
        result.newState,
      );
    }
  }
}
