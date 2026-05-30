import { ResponseHelper } from "../../../shared/services/response-helper";
import { CoreEnv, BorgExecutionContext } from "../../../shared/types";

export async function handleApiNotifications(
  _req: Request,
  env: CoreEnv,
  _ctx: BorgExecutionContext,
): Promise<Response> {
  try {
    const tickets = await env.DB.prepare(
      "SELECT ticket_id, fecha_cita, hora_cita, vehiculo_tipo, estado " +
        "FROM tickets ORDER BY created_at DESC LIMIT 10",
    ).all<{
      ticket_id: string;
      fecha_cita: string;
      hora_cita: string;
      vehiculo_tipo: string;
      estado: string;
    }>();

    const notifs = await env.DB.prepare(
      "SELECT message, type, created_at FROM admin_notifications ORDER BY created_at DESC LIMIT 10",
    ).all<{ message: string; type: string; created_at: string }>();

    return ResponseHelper.json({
      tickets: tickets.results ?? [],
      notifications: notifs.results ?? [],
    });
  } catch (e: unknown) {
    return ResponseHelper.json({ error: String(e) }, 500);
  }
}
