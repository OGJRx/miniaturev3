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
import { BookingOrchestrator } from "./booking-orchestrator";
import { handleApiAppointments } from "./routes/appointments";
import { handleWhatsAppWebhook } from "./routes/webhook-whatsapp";
import { SeoService } from "../../shared/services/seo-service";
import { IaQueueService } from "../../shared/services/ia-queue";
import { timingSafeEqual, hmacSha256 } from "../../shared/security/crypto";
import { getVenezuelaTimeParts as getVETParts } from "../../shared/ui/timezone";
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
    const styleSrc = nonce ? `'nonce-${nonce}'` : "'self' 'unsafe-inline'";
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

function getFrontendBot(env: CoreEnv): Bot<FrontendContext> {
  if (frontendBot) return frontendBot;
  frontendBot = new Bot<FrontendContext>(env.FRONTEND_BOT_TOKEN, {
    botInfo: parseBotInfo(env.FRONTEND_BOT_INFO),
  });
  setupBotMiddleware(frontendBot, "Telegate-Frontend");
  frontendBot.use(idempotencyMiddleware());
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

  const ADMIN_PANEL_MESSAGE =
    "🔱 <b>Borg Admin Nexus</b>\n\nPanel de control del Taller Titanium...";

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
      await handleBackendTextMessage(ctx);
    } catch (error) {
      ctx.logger?.error("message_text", `Error in message:text: ${error}`);
      await ctx.reply("⚠️ Error al procesar mensaje.");
    }
  });

  backendBot.on("callback_query:data", async (ctx) => {
    try {
      const parsed = await parseCallback(
        ctx.callbackQuery?.data || "",
        ctx.env.BORG_SECRET_KEY,
      );
      if (!parsed?.valid) return ctx.answerCallbackQuery("⚠️ Invalido");
      const secret = ctx.env.BORG_SECRET_KEY;
      switch (parsed.action) {
        case "adm_main":
          await UiManager.safeEditOrReply(ctx, ADMIN_PANEL_MESSAGE, {
            reply_markup: await MenuFactory.buildAdminMainMenu(secret, ctx.env),
          });
          break;
        case "ia_obd":
          if (ctx.from) {
            await ObdSessionService.activate(ctx.env.DB, ctx.from.id);
            await ctx.reply("✅ Modo OBD-II Activo");
          }
          break;
        case "motor_help":
          await ctx.reply(MOTOR_HELP_MESSAGE, { parse_mode: "HTML" });
          break;
      }
      await ctx.answerCallbackQuery().catch(() => {});
    } catch (error) {
      ctx.logger?.error("callback_query", `Error in callback_query: ${error}`);
      await ctx.answerCallbackQuery("⚠️ Error interno").catch(() => {});
    }
  });

  return backendBot;
}

async function handleBackendTextMessage(ctx: FrontendContext) {
  try {
    const adminId = ctx.from?.id;
    if (!adminId) return;
    const text = ctx.message?.text || "";
    const obdActive = await ObdSessionService.isActive(ctx.env.DB, adminId);
    const agentName = obdActive ? "OBD_DIAGNOSTICO" : "CEREBRO";
    const prompt = obdActive
      ? AGENT_PROMPTS.OBD_DIAGNOSTICO
      : AGENT_PROMPTS.CEREBRO_ADMINISTRATIVO;

    const response = await AgentFactory.runAgent(
      agentName,
      prompt,
      text,
      [],
      ctx.env,
    );
    if (response.success) await UiManager.safeReply(ctx, response.text);
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
    const ctx: BorgExecutionContext = {
      traceId: crypto.randomUUID(),
      waitUntil: executionContext.waitUntil.bind(executionContext),
    };
    return await routeRequest(req, env, ctx);
  },
  async scheduled(
    _event: { cron: string },
    env: CoreEnv,
    executionContext: ExecutionContext,
  ) {
    const ctx: BorgExecutionContext = {
      traceId: crypto.randomUUID(),
      waitUntil: executionContext.waitUntil.bind(executionContext),
    };
    const db = env.DB;
    const now = getVETParts();
    if (now.minute % 10 === 0) await SeoService.processQueue(db, env);
    if (now.hour % 6 === 0 && now.minute === 0) {
      await IaQueueService.processPendingJobs(db, ctx, env);
      await MaintenanceService.runAudits(db, env);
    }
  },
};
