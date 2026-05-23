import { ExecutionContext } from "@cloudflare/workers-types";
import { CoreEnv, BorgContext, BorgExecutionContext } from "../../shared/types";
import {
  setupBotMiddleware,
  parseBotInfo,
  idempotencyMiddleware,
  isUpdate,
  InjectedUpdate,
} from "../../shared/security/bot-setup";
import { Bot } from "grammy";
import { MenuFactory } from "../../shared/ui/menu-factory";
import {
  parseCallback,
  webhookValidator,
  calendarAuthMiddleware,
  adminAuthGuard,
} from "../../shared/security";
import { UiManager } from "../../shared/ui/ui-manager";
import { ObdSessionService } from "../../shared/services/obd-session";
import { MaintenanceService } from "../../shared/services/maintenance-service";
import { AgentFactory } from "../../shared/services/agent-factory";
import { AGENT_PROMPTS, MOTOR_HELP_MESSAGE } from "../../shared/ui/prompts";
import { ObdLookupService } from "../../shared/obd-lookup";
import { BookingOrchestrator } from "./booking-orchestrator";
import { handleApiAppointments } from "./routes/appointments";
import { handleWhatsAppWebhook } from "./routes/webhook-whatsapp";
import { SeoService } from "../../shared/services/seo-service";
import { IaQueueService } from "../../shared/services/ia-queue";
import { timingSafeEqual, hmacSha256 } from "../../shared/security/crypto";
import {
  getVenezuelaTimeParts as getVETParts,
  todayVET,
} from "../../shared/ui/timezone";
import { CALENDAR_HTML } from "./calendar-template";

type FrontendContext = BorgContext<CoreEnv>;
type Handler = (
  req: Request,
  env: CoreEnv,
  ctx: BorgExecutionContext,
) => Promise<Response>;

const routes = new Map<string, Handler>();

async function routeRequest(
  req: Request,
  env: CoreEnv,
  ctx: BorgExecutionContext,
): Promise<Response> {
  const url = new URL(req.url);
  const handler = routes.get(url.pathname);

  if (!handler) {
    return new Response("Not Found", { status: 404 });
  }

  if (url.pathname === "/webhook/whatsapp" && whatsappDisabled) {
    return new Response("WhatsApp Disabled", { status: 503 });
  }

  const middlewares = [];
  if (
    url.pathname.includes("/webhook/") &&
    !url.pathname.includes("/webhook/whatsapp")
  ) {
    middlewares.push(webhookValidator);
  }
  if (["/calendar", "/admin", "/api/appointments"].includes(url.pathname))
    middlewares.push(calendarAuthMiddleware);
  if (url.pathname.includes("/backend") || url.pathname.includes("/admin"))
    middlewares.push(adminAuthGuard);

  for (const mw of middlewares) {
    const res = await mw(req, env, ctx);
    if (res) return res;
  }

  const response = await handler(req, env, ctx);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  const isHtml = response.headers.get("Content-Type")?.includes("text/html");
  if (!isHtml) {
    response.headers.set(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'",
    );
  } else {
    const nonce = response.headers.get("X-Borg-Nonce");
    const scriptSrc = nonce ? `'nonce-${nonce}'` : "'self'";
    const styleSrc = nonce ? `'nonce-${nonce}'` : "'self'";
    response.headers.set(
      "Content-Security-Policy",
      `default-src 'self'; style-src 'self' ${styleSrc}; font-src https://fonts.gstatic.com; script-src 'self' ${scriptSrc}; connect-src 'self'; frame-ancestors 'none'`,
    );
    response.headers.delete("X-Borg-Nonce");
  }

  return response;
}

let frontendBot: Bot<FrontendContext> | null = null;
let backendBot: Bot<FrontendContext> | null = null;
const orchestrator = new BookingOrchestrator();

let whatsappDisabled = false;

const ADMIN_PANEL_MESSAGE =
  "🔱 <b>Borg Admin Nexus</b>\n\nPanel de control del Taller Titanium...";

function validateWhatsAppConfig(env: CoreEnv) {
  const missing = [];
  if (!env.WHATSAPP_PHONE_NUMBER_ID) missing.push("WHATSAPP_PHONE_NUMBER_ID");
  if (!env.WHATSAPP_ACCESS_TOKEN) missing.push("WHATSAPP_ACCESS_TOKEN");
  if (!env.WHATSAPP_VERIFY_TOKEN) missing.push("WHATSAPP_VERIFY_TOKEN");
  if (!env.WHATSAPP_APP_SECRET) missing.push("WHATSAPP_APP_SECRET");

  if (missing.length > 0) {
    console.warn(
      `[Startup] WhatsApp integration disabled: missing ${missing.join(", ")}`,
    );
    whatsappDisabled = true;
  }
}

function getFrontendBot(env: CoreEnv): Bot<FrontendContext> {
  if (frontendBot) return frontendBot;
  frontendBot = new Bot<FrontendContext>(env.FRONTEND_BOT_TOKEN, {
    botInfo: parseBotInfo(env.FRONTEND_BOT_INFO),
  });
  setupBotMiddleware(frontendBot, "Telegate-Frontend");
  frontendBot.use(idempotencyMiddleware());

  frontendBot.api
    .setMyCommands([{ command: "start", description: "📅 Agendar Cita" }])
    .catch(() => {});

  frontendBot.on("message", async (ctx) => orchestrator.handleUpdate(ctx));
  frontendBot.on("callback_query", async (ctx) =>
    orchestrator.handleUpdate(ctx),
  );
  return frontendBot;
}

function getBackendBot(env: CoreEnv): Bot<FrontendContext> {
  if (backendBot) return backendBot;
  backendBot = new Bot<FrontendContext>(env.BACKEND_BOT_TOKEN, {
    botInfo: parseBotInfo(env.BACKEND_BOT_INFO),
  });
  setupBotMiddleware(backendBot, "Telegate-Backend");
  backendBot.use(idempotencyMiddleware());

  backendBot.api
    .setMyCommands([
      { command: "start", description: "📋 Panel Admin" },
      { command: "refresh_cmds", description: "🔄 Refresh Commands" },
    ])
    .catch(() => {});

  backendBot.command("start", async (ctx) => {
    try {
      const menu = await MenuFactory.buildAdminMainMenu(
        ctx.env.BORG_SECRET_KEY,
        ctx.env,
      );
      await ctx.reply(ADMIN_PANEL_MESSAGE, {
        parse_mode: "HTML",
        reply_markup: menu,
      });

      await ctx.reply("Selecciona una opción:", {
        reply_markup: {
          keyboard: [
            [{ text: "📋 Panel Admin" }],
            [{ text: "🤖 IA Features" }],
            [{ text: "🔔 Notificaciones" }],
          ],
          resize_keyboard: true,
          input_field_placeholder: "Escribe un comando...",
        },
      });
    } catch (error) {
      ctx.logger?.error("start_command", `Error in /start: ${error}`);
      await ctx.reply("⚠️ Error al iniciar panel admin.");
    }
  });

  backendBot.on("message:text", async (ctx) => {
    try {
      if (ctx.message?.text === "📋 Panel Admin") {
        return await ctx.reply(ADMIN_PANEL_MESSAGE, {
          parse_mode: "HTML",
          reply_markup: await MenuFactory.buildAdminMainMenu(
            ctx.env.BORG_SECRET_KEY,
            ctx.env,
          ),
        });
      }

      if (ctx.message?.text === "🤖 IA Features") {
        return await ctx.reply("🤖 <b>IA Features</b>", {
          parse_mode: "HTML",
          reply_markup: await MenuFactory.buildIAFeaturesMenu(
            ctx.env.BORG_SECRET_KEY,
          ),
        });
      }

      if (ctx.message?.text === "🔔 Notificaciones") {
        return await ctx.reply("🔔 Módulo de Notificaciones en desarrollo.");
      }

      await handleBackendTextMessage(ctx);
    } catch (error) {
      ctx.logger?.error("message_text", `Error in message:text: ${error}`);
      await ctx.reply("⚠️ Error al procesar mensaje.");
    }
  });

  backendBot.on("callback_query:data", async (ctx) => {
    try {
      await handleBackendCallbackQuery(ctx);
    } catch (error) {
      ctx.logger?.error("callback_query", `Error in callback_query: ${error}`);
      await ctx.answerCallbackQuery("⚠️ Error interno").catch(() => {});
    }
  });

  return backendBot;
}

async function handleBackendCallbackQuery(ctx: FrontendContext) {
  const parsed = await parseCallback(
    ctx.callbackQuery?.data || "",
    ctx.env.BORG_SECRET_KEY,
  );
  if (!parsed?.valid) return ctx.answerCallbackQuery("⚠️ Invalido");
  if (parsed.expired)
    return ctx.answerCallbackQuery("⚠️ Sesión expirada. Reinicia.");
  const secret = ctx.env.BORG_SECRET_KEY;

  if (parsed.action.startsWith("adm_")) {
    return handleAdminActions(ctx, parsed.action, secret);
  }

  if (parsed.action.startsWith("ia_")) {
    return handleIAActions(ctx, parsed.action, secret);
  }

  switch (parsed.action) {
    case "motor_help":
      await ctx.reply(MOTOR_HELP_MESSAGE, { parse_mode: "HTML" });
      break;
    case "refresh_cmds":
      await handleRefreshCmds(ctx);
      break;
  }
  await ctx.answerCallbackQuery().catch(() => {});
}

async function handleAdminActions(
  ctx: FrontendContext,
  action: string,
  secret: string,
) {
  switch (action) {
    case "adm_main":
      await UiManager.safeEditOrReply(ctx, ADMIN_PANEL_MESSAGE, {
        reply_markup: await MenuFactory.buildAdminMainMenu(secret, ctx.env),
        parse_mode: "HTML",
      });
      break;
    case "adm_appts":
      await UiManager.safeEditOrReply(
        ctx,
        "📊 <b>Gestión de Citas</b>\n\nSelecciona una vista:",
        {
          reply_markup: await MenuFactory.buildAppointmentsMenu(secret),
          parse_mode: "HTML",
        },
      );
      break;
    case "adm_today":
      await handleAdminToday(ctx, secret);
      break;
    case "adm_upcoming":
      await handleAdminUpcoming(ctx, secret);
      break;
    case "adm_ia":
      await UiManager.safeEditOrReply(
        ctx,
        "🤖 <b>IA Features</b>\n\nSelecciona una opción:",
        {
          reply_markup: await MenuFactory.buildIAFeaturesMenu(secret),
          parse_mode: "HTML",
        },
      );
      break;
    case "adm_notifs":
      await UiManager.safeEditOrReply(
        ctx,
        "🔔 Módulo de Notificaciones en desarrollo.",
      );
      break;
  }
  await ctx.answerCallbackQuery().catch(() => {});
}

async function handleIAActions(
  ctx: FrontendContext,
  action: string,
  secret: string,
) {
  switch (action) {
    case "ia_ia":
      await UiManager.safeEditOrReply(
        ctx,
        "🔍 <b>Diagnóstico AI</b>\n\nActiva el modo de diagnóstico para interpretar síntomas o códigos:",
        {
          reply_markup: await MenuFactory.buildDiagnosticMenu(secret),
          parse_mode: "HTML",
        },
      );
      break;
    case "ia_diag":
    case "ia_obd":
      if (ctx.from) {
        await ObdSessionService.activate(ctx.env.DB, ctx.from.id);
        const modeText = action === "ia_diag" ? "Diagnóstico IA" : "OBD-II";
        await ctx.reply(`✅ Modo ${modeText} Activo`);
      }
      break;
  }
  await ctx.answerCallbackQuery().catch(() => {});
}

async function handleAdminToday(ctx: FrontendContext, secret: string) {
  const today = todayVET();
  const results = await ctx.env.DB.prepare(
    "SELECT ticket_id, hora_cita, vehiculo_tipo, servicio_solicitado, estado FROM tickets WHERE fecha_cita = ? AND estado != 'cancelado' ORDER BY hora_cita ASC",
  )
    .bind(today)
    .all<{
      ticket_id: string;
      hora_cita: string;
      vehiculo_tipo: string;
      servicio_solicitado: string;
      estado: string;
    }>();

  let msg = `📊 <b>Citas de Hoy — ${today}</b>\n\n`;
  if (!results.results || results.results.length === 0) {
    msg += "📭 No hay citas para hoy.";
  } else {
    results.results.forEach((r, i) => {
      const statusEmoji = r.estado === "pendiente" ? "⏳" : "✅";
      msg += `${i + 1}. <code>${r.ticket_id}</code> | ${r.hora_cita} | ${r.vehiculo_tipo} | ${r.servicio_solicitado} | ${statusEmoji} ${r.estado}\n`;
    });
    msg += `\nTotal: ${results.results.length} cita(s)`;
  }
  await UiManager.safeEditOrReply(ctx, msg, {
    parse_mode: "HTML",
    reply_markup: await MenuFactory.buildAppointmentsMenu(secret),
  });
}

async function handleAdminUpcoming(ctx: FrontendContext, secret: string) {
  const today = todayVET();
  const results = await ctx.env.DB.prepare(
    "SELECT ticket_id, fecha_cita, hora_cita, vehiculo_tipo, estado FROM tickets WHERE fecha_cita >= ? AND estado = 'pendiente' ORDER BY fecha_cita ASC, hora_cita ASC LIMIT 10",
  )
    .bind(today)
    .all<{
      ticket_id: string;
      fecha_cita: string;
      hora_cita: string;
      vehiculo_tipo: string;
      estado: string;
    }>();

  let msg = `🔜 <b>Próximas 10 Citas Pendientes</b>\n\n`;
  if (!results.results || results.results.length === 0) {
    msg += "📭 No hay citas pendientes próximamente.";
  } else {
    results.results.forEach((r, i) => {
      msg += `${i + 1}. <code>${r.ticket_id}</code> | ${r.fecha_cita} ${r.hora_cita} | ${r.vehiculo_tipo}\n`;
    });
  }
  await UiManager.safeEditOrReply(ctx, msg, {
    parse_mode: "HTML",
    reply_markup: await MenuFactory.buildAppointmentsMenu(secret),
  });
}

async function handleRefreshCmds(ctx: FrontendContext) {
  try {
    await ctx.api.setMyCommands([
      { command: "start", description: "📋 Panel Admin" },
      { command: "refresh_cmds", description: "🔄 Refresh Commands" },
    ]);
    const fBot = getFrontendBot(ctx.env);
    await fBot.api.setMyCommands([
      { command: "start", description: "📅 Agendar Cita" },
    ]);
    await ctx.reply("✅ Comandos de bot actualizados.");
  } catch (e) {
    ctx.logger?.error("refresh_cmds", `Error: ${e}`);
    await ctx.reply("⚠️ Error actualizando comandos.");
  }
}

async function handleBackendTextMessage(ctx: FrontendContext) {
  try {
    const adminId = ctx.from?.id;
    if (!adminId) return;
    const text = ctx.message?.text || "";
    const obdActive = await ObdSessionService.isActive(ctx.env.DB, adminId);
    const agentName = obdActive ? "OBD_DIAGNOSTICO" : "CEREBRO";
    let prompt = obdActive
      ? AGENT_PROMPTS.OBD_DIAGNOSTICO
      : AGENT_PROMPTS.CEREBRO_ADMINISTRATIVO;

    if (obdActive) {
      const results = await ObdLookupService.getEnrichmentResults(
        ctx.env.DB,
        text,
      );
      prompt = ObdLookupService.enrichPrompt(prompt, results);
    }

    const response = await AgentFactory.runAgent(
      agentName,
      prompt,
      text,
      [],
      ctx.env,
    );
    if (response.success) {
      if (response.text.trim()) {
        await UiManager.safeReply(ctx, response.text);
      } else {
        ctx.logger?.warn(
          "AI_EMPTY_RESPONSE",
          `Agent ${agentName} returned empty. Prompt length: ${prompt.length}`,
        );
        await ctx.reply(
          "⚠️ La IA no generó una respuesta. Intenta reformular.",
        );
      }
    }
  } catch (error) {
    ctx.logger?.error(
      "handleBackendTextMessage",
      `Error in handleBackendTextMessage: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error.stack : undefined,
    );
    await ctx.reply("⚠️ Error del sistema en el backend.").catch(() => {});
  }
}

async function handleCalendarMiniApp(
  req: Request,
  env: CoreEnv,
): Promise<Response> {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const nonce = crypto.randomUUID();
  const html = CALENDAR_HTML.replace("__NONCE__", nonce);
  const response = new Response(html, {
    headers: {
      "Content-Type": "text/html",
      "X-Borg-Nonce": nonce,
    },
  });
  if (token && (await timingSafeEqual(token, env.BORG_SECRET_KEY))) {
    const ts = Math.floor(Date.now() / 1000).toString(16);
    const sig = (await hmacSha256(env.BORG_SECRET_KEY, ts)).substring(0, 32);
    response.headers.append(
      "Set-Cookie",
      `borg_session=${ts}.${sig}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`,
    );
  }
  return response;
}

routes.set("/webhook/frontend", async (req, env, ctx) => {
  const bot = getFrontendBot(env);
  const json = await req.json();
  if (isUpdate(json))
    await bot.handleUpdate({
      ...json,
      env,
      executionContext: ctx,
    } as InjectedUpdate);
  return new Response("OK");
});

routes.set("/webhook/backend", async (req, env, ctx) => {
  const bot = getBackendBot(env);
  const json = await req.json();
  if (isUpdate(json))
    await bot.handleUpdate({
      ...json,
      env,
      executionContext: ctx,
    } as InjectedUpdate);
  return new Response("OK");
});

routes.set("/calendar", handleCalendarMiniApp);
routes.set("/api/appointments", handleApiAppointments);
routes.set("/webhook/whatsapp", handleWhatsAppWebhook);

export default {
  async fetch(
    req: Request,
    env: CoreEnv,
    executionContext: ExecutionContext,
  ): Promise<Response> {
    validateWhatsAppConfig(env);
    const ctx: BorgExecutionContext = {
      traceId: req.headers.get("cf-ray") || crypto.randomUUID(),
      waitUntil: executionContext.waitUntil.bind(executionContext),
    };
    return await routeRequest(req, env, ctx);
  },
  async scheduled(
    _event: { cron: string },
    env: CoreEnv,
    executionContext: ExecutionContext,
  ) {
    const nowParts = getVETParts();
    // Off-peak: 00:00-06:00 VET. Skip 70% of runs.
    const isOffPeak = nowParts.hour >= 0 && nowParts.hour < 6;
    if (isOffPeak && Math.random() > 0.3) {
      return;
    }

    const ctx: BorgExecutionContext = {
      traceId: crypto.randomUUID(),
      waitUntil: executionContext.waitUntil.bind(executionContext),
    };
    const db = env.DB;

    await SeoService.processQueue(db, env, ctx);
    if (nowParts.hour % 6 === 0 && nowParts.minute === 0) {
      await IaQueueService.processPendingJobs(db, ctx, env);
      await MaintenanceService.runAudits(db, env);
    }
  },
};
// Deploy Trigger: 2026-05-19
