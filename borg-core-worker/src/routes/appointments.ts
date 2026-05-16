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
  _req: Request,
  env: CoreEnv,
  _ctx: BorgExecutionContext,
): Promise<Response> {
  try {
    const appointments = await env.DB.prepare(
      "SELECT ticket_id, vehiculo_tipo, servicio_solicitado, fecha_cita, hora_cita, estado " +
        "FROM tickets WHERE estado != 'cancelado' " +
        "ORDER BY fecha_cita ASC, hora_cita ASC LIMIT 200",
    ).all<AppointmentRow>();

    return ResponseHelper.json(appointments.results);
  } catch (e: unknown) {
    return ResponseHelper.json({ error: String(e) }, 500);
  }
}
