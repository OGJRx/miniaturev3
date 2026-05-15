import { D1Database } from "@cloudflare/workers-types";
import { OFFICE_HOURS, BUFFER_LLEGADA_MINUTOS } from "../types/constants";
import { getVenezuelaTimeParts } from "../ui/timezone";

export function validateAppointmentSlot(
  f: string,
  h: string,
): { valid: boolean; errorCode?: string } {
  const fParts = f.split("-").map(Number);
  const y = fParts[0] ?? 0;
  const m = fParts[1] ?? 0;
  const d = fParts[2] ?? 0;
  const hParts = h.split(":").map(Number);
  const hh = hParts[0] ?? 0;
  const mm = hParts[1] ?? 0;
  const tentativeDate = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const parts = getVenezuelaTimeParts(tentativeDate);
  const localTimeValue = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  );
  const offsetMs = tentativeDate.getTime() - localTimeValue;
  const citaDateUTC = new Date(tentativeDate.getTime() + offsetMs);
  const now = new Date();
  if (
    citaDateUTC.getTime() <
    now.getTime() + BUFFER_LLEGADA_MINUTOS * 60 * 1000
  )
    return { valid: false, errorCode: "PAST_DATE" };

  if (!OFFICE_HOURS.IS_WORK_DAY(parts.dayOfWeek)) {
    return { valid: false, errorCode: "WEEKEND" };
  }

  return { valid: true };
}

export class SlotValidator {
  constructor(private db: D1Database) {}

  async getAvailableSlots(
    fecha: string,
  ): Promise<{ hora: string; available: boolean }[]> {
    const occupied = await this.db
      .prepare(
        "SELECT hora_cita FROM tickets WHERE fecha_cita = ? AND estado != 'cancelado' " +
          "UNION SELECT hora FROM blocked_slots WHERE fecha = ?",
      )
      .bind(fecha, fecha)
      .all<{ hora_cita?: string; hora?: string }>();

    const occupiedSet = new Set(
      occupied.results.map((r) => r.hora_cita || r.hora),
    );

    const allSlots = [];
    for (let h = OFFICE_HOURS.OPEN; h < OFFICE_HOURS.CLOSE; h++) {
      for (let m = 0; m < 60; m += OFFICE_HOURS.duracionSlot) {
        const hora = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        allSlots.push({
          hora,
          available:
            !occupiedSet.has(hora) &&
            validateAppointmentSlot(fecha, hora).valid,
        });
      }
    }
    return allSlots;
  }
}
