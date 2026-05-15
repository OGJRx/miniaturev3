import { EphemeralState, CoreEnv, BorgContext } from "../../shared/types";
import { StepRenderer } from "../../shared/ui/step-renderer";
import { D1Database } from "@cloudflare/workers-types";
import { buildCallback, parseCallback } from "../../shared/security";
import { InlineKeyboard } from "grammy";
import { UiManager } from "../../shared/ui/ui-manager";
import { todayVET, getVenezuelaTimeParts } from "../../shared/ui/timezone";
import { formatDateFriendly } from "../../shared/ui/formatters";
import { OFFICE_HOURS } from "../../shared/types/constants";
import { TicketCreator } from "../../shared/services/ticket-creator";
import { AdminNotificationService } from "../../shared/services/admin-notification";
import { escapeHtml, formatHourTo12 } from "../../shared/ui/formatters";
import { MOTOR_HELP_MESSAGE } from "../../shared/ui/prompts";

export class BookingOrchestrator {
  private renderer = new StepRenderer();

  async getSession(
    db: D1Database,
    userId: number,
    chatId: number,
  ): Promise<EphemeralState> {
    const res = await db
      .prepare(
        "SELECT session_id, telegram_user_id, telegram_chat_id, active_mode, estado_flujo, paso_actual, bot_type, updated_at, vehiculo_tipo, vehiculo_motor, vehiculo_era, kilometraje, servicio_solicitado, fecha_cita, hora_cita FROM sessions WHERE telegram_user_id = ? AND bot_type = 'frontend' ORDER BY updated_at DESC LIMIT 1",
      )
      .bind(userId)
      .first<EphemeralState>();

    if (res) return res;

    const sessionId = "S-" + Date.now() + "-" + userId;
    const newState: EphemeralState = {
      session_id: sessionId,
      telegram_user_id: userId,
      telegram_chat_id: chatId,
      estado_flujo: "iniciado",
      paso_actual: 0,
      version: 1,
      bot_type: "frontend",
    };

    await db
      .prepare(
        "INSERT INTO sessions (session_id, telegram_user_id, telegram_chat_id, bot_type, estado_flujo, paso_actual) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(sessionId, userId, chatId, "frontend", "iniciado", 0)
      .run();

    return newState;
  }

  async updateSession(
    db: D1Database,
    sessionId: string,
    data: Partial<EphemeralState>,
  ) {
    const allowedKeys: (keyof EphemeralState)[] = [
      "active_mode",
      "estado_flujo",
      "paso_actual",
      "vehiculo_tipo",
      "vehiculo_motor",
      "vehiculo_era",
      "kilometraje",
      "servicio_solicitado",
      "fecha_cita",
      "hora_cita",
      "bay_number",
    ];
    const entries = Object.entries(data).filter(([k]) =>
      allowedKeys.includes(k as keyof EphemeralState),
    );
    if (entries.length === 0) return;

    const sets = entries.map(([k]) => `${k} = ?`).join(", ");
    const values = entries.map(([, v]) => v);

    await db
      .prepare(
        `UPDATE sessions SET ${sets}, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?`,
      )
      .bind(...values, sessionId)
      .run();
  }

  async handleUpdate(ctx: BorgContext<CoreEnv>) {
    const userId = ctx.from?.id;
    const chatId = ctx.chat?.id || userId;
    if (!userId || !chatId) return;

    const session = await this.getSession(ctx.env.DB, userId, chatId);

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
    const db = ctx.env.DB;
    const secret = ctx.env.BORG_SECRET_KEY;

    switch (action) {
      case "start_booking":
        return await this.handleStartBooking(ctx, db, session, secret);
      case "set_tipo":
        return await this.handleSetTipo(ctx, db, session, secret, value);
      case "set_motor":
        return await this.handleSetMotor(ctx, db, session, secret, value);
      case "set_era":
        return await this.handleSetEra(ctx, db, session, secret, value);
      case "set_km":
        return await this.handleSetKm(ctx, db, session, secret, value);
      case "set_svc":
        return await this.handleSetSvc(ctx, db, session, secret, value);
      case "set_fecha":
        return await this.handleSetFecha(ctx, db, session, secret, value);
      case "set_hora":
        return await this.handleSetHora(ctx, db, session, secret, value);
      case "conf_booking":
        return await this.handleConfBooking(ctx, db, session, value);
      case "motor_help": {
        await ctx.reply(MOTOR_HELP_MESSAGE, { parse_mode: "HTML" });
        return await ctx.answerCallbackQuery();
      }
    }
    await ctx.answerCallbackQuery().catch(() => {});
  }

  private async handleStartBooking(
    ctx: BorgContext<CoreEnv>,
    db: D1Database,
    session: EphemeralState,
    secret: string,
  ) {
    await this.updateSession(db, session.session_id!, { paso_actual: 1 });
    const step = await this.renderer.renderStepTipo(secret);
    return await UiManager.safeEditOrReply(ctx, step.message, {
      ...(step.keyboard ? { reply_markup: step.keyboard } : {}),
      parse_mode: "HTML",
    });
  }

  private async handleSetTipo(
    ctx: BorgContext<CoreEnv>,
    db: D1Database,
    session: EphemeralState,
    secret: string,
    value: string,
  ) {
    await this.updateSession(db, session.session_id!, {
      vehiculo_tipo: value,
      paso_actual: 2,
    });
    const step = await this.renderer.renderStepMotor(secret);
    return await UiManager.safeEditOrReply(ctx, step.message, {
      ...(step.keyboard ? { reply_markup: step.keyboard } : {}),
      parse_mode: "HTML",
    });
  }

  private async handleSetMotor(
    ctx: BorgContext<CoreEnv>,
    db: D1Database,
    session: EphemeralState,
    secret: string,
    value: string,
  ) {
    await this.updateSession(db, session.session_id!, {
      vehiculo_motor: value,
      paso_actual: 3,
    });
    const step = await this.renderer.renderStepEra(secret);
    return await UiManager.safeEditOrReply(ctx, step.message, {
      ...(step.keyboard ? { reply_markup: step.keyboard } : {}),
      parse_mode: "HTML",
    });
  }

  private async handleSetEra(
    ctx: BorgContext<CoreEnv>,
    db: D1Database,
    session: EphemeralState,
    secret: string,
    value: string,
  ) {
    await this.updateSession(db, session.session_id!, {
      vehiculo_era: value,
      paso_actual: 4,
    });
    const step = await this.renderer.renderStepKilometraje(secret);
    return await UiManager.safeEditOrReply(ctx, step.message, {
      ...(step.keyboard ? { reply_markup: step.keyboard } : {}),
      parse_mode: "HTML",
    });
  }

  private async handleSetKm(
    ctx: BorgContext<CoreEnv>,
    db: D1Database,
    session: EphemeralState,
    secret: string,
    value: string,
  ) {
    const km = parseInt(value, 10);
    if (Number.isNaN(km)) return ctx.answerCallbackQuery("❌ Valor inválido");
    await this.updateSession(db, session.session_id!, {
      kilometraje: km,
      paso_actual: 5,
    });
    const step = await this.renderer.renderStepServicio(secret);
    return await UiManager.safeEditOrReply(ctx, step.message, {
      ...(step.keyboard ? { reply_markup: step.keyboard } : {}),
      parse_mode: "HTML",
    });
  }

  private async handleSetSvc(
    ctx: BorgContext<CoreEnv>,
    db: D1Database,
    session: EphemeralState,
    secret: string,
    value: string,
  ) {
    await this.updateSession(db, session.session_id!, {
      servicio_solicitado: value,
      paso_actual: 6,
    });
    const step = await this.renderer.renderStepFecha(secret);
    return await UiManager.safeEditOrReply(ctx, step.message, {
      ...(step.keyboard ? { reply_markup: step.keyboard } : {}),
      parse_mode: "HTML",
    });
  }

  private async handleSetFecha(
    ctx: BorgContext<CoreEnv>,
    db: D1Database,
    session: EphemeralState,
    secret: string,
    value: string,
  ) {
    const todayStr = todayVET();
    if (value < todayStr) {
      await ctx.answerCallbackQuery("❌ No puedes agendar una fecha pasada");
      return;
    }

    if (value === todayStr) {
      const now = getVenezuelaTimeParts();
      const latestSlotHour = OFFICE_HOURS.CLOSE - 1;
      const latestSlotMinute = 60 - OFFICE_HOURS.duracionSlot;
      if (
        now.hour > latestSlotHour ||
        (now.hour === latestSlotHour && now.minute >= latestSlotMinute)
      ) {
        await ctx.answerCallbackQuery(
          "❌ No quedan horas disponibles para hoy. Selecciona otro día.",
        );
        return;
      }
    }

    const dateParts = getVenezuelaTimeParts(new Date(value + "T12:00:00"));
    if (!OFFICE_HOURS.IS_WORK_DAY(dateParts.dayOfWeek)) {
      await ctx.answerCallbackQuery(
        "❌ El taller no labora los fines de semana",
      );
      return;
    }

    await this.updateSession(db, session.session_id!, {
      fecha_cita: value,
      paso_actual: 7,
    });
    const step = await this.renderer.renderStepHora(db, value, secret);
    return await UiManager.safeEditOrReply(ctx, step.message, {
      ...(step.keyboard ? { reply_markup: step.keyboard } : {}),
      parse_mode: "HTML",
    });
  }

  private async handleSetHora(
    ctx: BorgContext<CoreEnv>,
    db: D1Database,
    session: EphemeralState,
    secret: string,
    value: string,
  ) {
    await this.updateSession(db, session.session_id!, {
      hora_cita: value,
      paso_actual: 8,
    });
    const step = await this.renderer.renderConfirmacion(
      { ...session, hora_cita: value },
      secret,
    );
    return await UiManager.safeEditOrReply(ctx, step.message, {
      ...(step.keyboard ? { reply_markup: step.keyboard } : {}),
      parse_mode: "HTML",
    });
  }

  private async handleConfBooking(
    ctx: BorgContext<CoreEnv>,
    db: D1Database,
    session: EphemeralState,
    value: string,
  ) {
    if (value === "yes") {
      const creator = new TicketCreator(db);
      const res = await creator.createTicket(session);
      const notifPromise = AdminNotificationService.dispatch(
        ctx.env,
        session,
        res.ticket_id,
      );
      ctx.executionContext.waitUntil(notifPromise);
      await this.updateSession(db, session.session_id!, {
        estado_flujo: "confirmado",
      });

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
        `📋 <b>Ticket:</b> <code>${escapeHtml(res.ticket_id)}</code>\n` +
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
        reply_markup:
          keyboard.inline_keyboard.length > 0 ? keyboard : undefined,
      });

      if (loc.latitud !== 0 && loc.longitud !== 0 && ctx.chat) {
        await ctx.api.sendLocation(ctx.chat.id, loc.latitud, loc.longitud);
      }
      return;
    }
    await this.updateSession(db, session.session_id!, {
      estado_flujo: "cancelado",
    });
    return await UiManager.safeEditOrReply(ctx, "❌ <b>Cita cancelada.</b>", {
      parse_mode: "HTML",
    });
  }

  private async handleText(ctx: BorgContext<CoreEnv>, session: EphemeralState) {
    if (ctx.message?.text === "📅 Agendar Cita") {
      await this.updateSession(ctx.env.DB, session.session_id!, {
        paso_actual: 1,
      });
      const step = await this.renderer.renderStepTipo(ctx.env.BORG_SECRET_KEY);
      return await ctx.reply(step.message, {
        ...(step.keyboard ? { reply_markup: step.keyboard } : {}),
        parse_mode: "HTML",
      });
    }

    if (session.paso_actual === 4 && ctx.message?.text) {
      const km = parseInt(ctx.message.text);
      if (isNaN(km))
        return await ctx.reply(
          "❌ Por favor ingresa un número válido para el kilometraje.",
        );
      await this.updateSession(ctx.env.DB, session.session_id!, {
        kilometraje: km,
        paso_actual: 5,
      });
      const step = await this.renderer.renderStepServicio(
        ctx.env.BORG_SECRET_KEY,
      );
      return await ctx.reply(step.message, {
        ...(step.keyboard ? { reply_markup: step.keyboard } : {}),
        parse_mode: "HTML",
      });
    }
  }
}
