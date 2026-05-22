import { ResponseHelper } from "../../../shared/services/response-helper";
import { CoreEnv, BorgExecutionContext } from "../../../shared/types";

export interface AppointmentRow {
  ticket_id: string;
  vehiculo_tipo: string;
  servicio_solicitado: string;
  fecha_cita: string;
  hora_cita: string;
  estado: string;
}

export async function handleApiAppointments(
  req: Request,
  env: CoreEnv,
  _ctx: BorgExecutionContext,
): Promise<Response> {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const date = url.searchParams.get("date");

    let query =
      "SELECT ticket_id, vehiculo_tipo, servicio_solicitado, fecha_cita, hora_cita, estado " +
      "FROM tickets WHERE estado != 'cancelado'";
    const bindings: string[] = [];

    if (status) {
      query += " AND estado = ?";
      bindings.push(status);
    }
    if (date) {
      query += " AND fecha_cita = ?";
      bindings.push(date);
    }

    query += " ORDER BY fecha_cita ASC, hora_cita ASC LIMIT 200";

    const appointments = await env.DB.prepare(query)
      .bind(...bindings)
      .all<AppointmentRow>();

    return ResponseHelper.json(appointments.results);
  } catch (e: unknown) {
    return ResponseHelper.json({ error: String(e) }, 500);
  }
}
