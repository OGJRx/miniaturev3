import { ResponseHelper } from "../../../shared/services/response-helper";
import { CoreEnv, BorgExecutionContext } from "../../../shared/types";

export async function handleApiAppointments(
  _req: Request,
  env: CoreEnv,
  _ctx: BorgExecutionContext,
): Promise<Response> {
  try {
    const appointments = await env.DB.prepare(
      "SELECT ticket_id, vehiculo_tipo, servicio_solicitado, fecha_cita, hora_cita, estado " +
        "FROM tickets WHERE estado != 'cancelado' " +
        "ORDER BY fecha_cita ASC, hora_cita ASC",
    ).all();

    return ResponseHelper.json(appointments.results);
  } catch (e: unknown) {
    return ResponseHelper.json({ error: String(e) }, 500);
  }
}
