import { Api, Context, Bot } from "grammy";
import {
  CoreEnv,
  BorgContext,
  BorgContextFlavor,
  BorgExecutionContext,
} from "../types";
import { BorgLogger } from "../services/borg-logger";
import { Update } from "@grammyjs/types";

export interface InjectedUpdate extends Update {
  env: CoreEnv;
  executionContext: BorgExecutionContext;
}

function isInjectedUpdate(update: Update): update is InjectedUpdate {
  return (
    update !== null &&
    typeof update === "object" &&
    "env" in update &&
    "executionContext" in update
  );
}

export function setupBotMiddleware<C extends BorgContext<CoreEnv>>(
  bot: Bot<C>,
  componentName: string,
) {
  bot.use(async (ctx: C, next: () => Promise<void>) => {
    const update = ctx.update;
    if (isInjectedUpdate(update)) {
      const flavor: Partial<BorgContextFlavor<CoreEnv>> = {
        env: update.env,
        executionContext: update.executionContext,
      };
      ctx.env = flavor.env!;
      ctx.executionContext = flavor.executionContext!;
    }

    ctx.traceId = ctx.executionContext?.traceId || crypto.randomUUID();
    ctx.logger = new BorgLogger(
      componentName,
      ctx.env?.DB,
      ctx.traceId,
      ctx.executionContext,
    );
    await next();
  });
}

export async function safeSendMessage(
  a: Api,
  c: string | number,
  t: string,
  o: Record<string, unknown> = {},
): Promise<void> {
  await a.sendMessage(c, t, o);
}

export function idempotencyMiddleware() {
  return async (ctx: Context & { env: CoreEnv }, next: () => Promise<void>) => {
    const updateId = ctx.update.update_id;
    const userId = ctx.from?.id;
    const db = ctx.env?.DB;

    if (!userId || !db) return await next();

    try {
      await db
        .prepare(
          "INSERT INTO processed_updates (update_id, telegram_user_id) VALUES (?, ?)",
        )
        .bind(updateId, userId)
        .run();
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      if (error.includes("UNIQUE constraint failed")) {
        console.log(`[Idempotency] Duplicate update ignored: ${updateId}`);
        return;
      }
      console.error(`[Idempotency] Error tracking update ${updateId}:`, error);
    }
    return await next();
  };
}

export function parseBotInfo(info?: string): unknown {
  const defaults = {
    id: 1,
    first_name: "Borg",
    username: "borg_bot",
    is_bot: true as const,
    can_join_groups: false,
    can_read_all_group_messages: false,
    can_manage_bots: false,
    supports_inline_queries: false,
    can_connect_to_business: false,
    has_main_web_app: false,
    has_topics_enabled: false,
    allows_users_to_create_topics: false,
  };

  if (info) {
    try {
      return { ...defaults, ...JSON.parse(info) };
    } catch (_e) {
      /* ignore */
    }
  }
  return defaults;
}

export function isUpdate(update: unknown): update is Update {
  return typeof update === "object" && update !== null && "update_id" in update;
}
