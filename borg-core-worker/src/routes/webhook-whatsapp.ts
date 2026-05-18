import { CoreEnv, BorgExecutionContext } from "../../../shared/types";
import { WhatsAppWebhookEventSchema } from "../../../shared/whatsapp/whatsapp-types";
import { hmacSha256, timingSafeEqual } from "../../../shared/security/crypto";
import { WhatsAppApi } from "../../../shared/whatsapp/whatsapp-api";
import { WhatsAppBookingOrchestrator } from "../whatsapp-booking";

export async function handleWhatsAppWebhook(
  req: Request,
  env: CoreEnv,
  ctx: BorgExecutionContext,
): Promise<Response> {
  const url = new URL(req.url);

  // 1. GET Challenge (Verification)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === env.WHATSAPP_VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // 2. POST Webhook (Events)
  if (req.method === "POST") {
    const signature = req.headers.get("X-Hub-Signature-256");
    if (!signature) return new Response("No signature", { status: 401 });

    const body = await req.text();
    const expectedSignature =
      "sha256=" + (await hmacSha256(env.WHATSAPP_APP_SECRET, body));

    if (!(await timingSafeEqual(signature, expectedSignature))) {
      return new Response("Invalid signature", { status: 401 });
    }

    try {
      const payload = WhatsAppWebhookEventSchema.parse(JSON.parse(body));
      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          if (change.value.messages) {
            for (const msg of change.value.messages) {
              // 1. Idempotency check
              try {
                await env.DB.prepare(
                  "INSERT INTO processed_wa_messages (wa_message_id, phone_number) VALUES (?, ?)",
                )
                  .bind(msg.id, msg.from)
                  .run();
              } catch (e: unknown) {
                const errMsg = e instanceof Error ? e.message : String(e);
                if (
                  !errMsg.includes("UNIQUE constraint") &&
                  !errMsg.includes("SQLITE_CONSTRAINT")
                ) {
                  console.error(`[WhatsAppWebhook] DB error: ${errMsg}`);
                  return new Response("Internal Server Error", { status: 500 });
                }
                console.log(`[WhatsAppWebhook] Duplicate message: ${msg.id}`);
                continue;
              }

              // 2. Mark as read
              const waApi = new WhatsAppApi(env);
              ctx.waitUntil(waApi.markAsRead(msg.id));

              // 3. Persist message to D1
              ctx.waitUntil(
                env.DB.prepare(
                  "INSERT INTO whatsapp_messages (wa_message_id, phone_number, direction, status, payload) VALUES (?, ?, 'inbound', 'received', ?)",
                )
                  .bind(msg.id, msg.from, JSON.stringify(msg))
                  .run(),
              );

              // 4. Process with Orchestrator
              const orchestrator = new WhatsAppBookingOrchestrator(env, ctx);
              if (msg.type === "text" && msg.text) {
                try {
                  await orchestrator.handleMessage(msg.from, msg.text.body);
                } catch (err: unknown) {
                  console.error(`[WhatsAppWebhook] Orchestrator error:`, err);
                }
              }
            }
          }
        }
      }
    } catch (e: unknown) {
      console.error("[WhatsAppWebhook] Parse error:", e);
    }

    return new Response("OK", { status: 200 });
  }

  return new Response("Method not allowed", { status: 405 });
}
