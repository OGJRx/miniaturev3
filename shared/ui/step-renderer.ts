import { EphemeralState } from "../types";
import { InlineKeyboard } from "grammy";
import { buildCallback } from "../security";
import {
  VEHICLE_OPTIONS,
  KILOMETRAJE_RANGES,
  SERVICE_OPTIONS,
  OFFICE_HOURS,
} from "../types/constants";
import { formatDateISO, formatDateFriendly } from "./formatters";
import { getVenezuelaNow, getVenezuelaTimeParts } from "./timezone";
import { D1Database } from "@cloudflare/workers-types";
import { SlotValidator } from "../services/slot-validator";

export interface StepResult {
  success: boolean;
  message: string;
  keyboard?: InlineKeyboard;
}

export class StepRenderer {
  async renderStepTipo(secret: string): Promise<StepResult> {
    const k = new InlineKeyboard();
    for (let i = 0; i < VEHICLE_OPTIONS.TYPES.length; i++) {
      const t = VEHICLE_OPTIONS.TYPES[i]!;
      k.text(t, await buildCallback("set_tipo", t, secret));
      if (i % 2 === 1) k.row();
    }
    return {
      success: true,
      message:
        "🚗 <b>Selecciona el tipo de vehículo:</b>\n\n" +
        "Elige la categoría que mejor describa tu vehículo. Esto nos ayuda a asignar la bahía con la capacidad y herramientas adecuadas.",
      keyboard: k,
    };
  }

  async renderStepMotor(secret: string): Promise<StepResult> {
    const k = new InlineKeyboard();
    for (const m of VEHICLE_OPTIONS.MOTORS) {
      k.text(m, await buildCallback("set_motor", m, secret)).row();
    }
    k.text("❓ Ayuda", await buildCallback("motor_help", "0", secret));
    return {
      success: true,
      message:
        "⚙️ <b>Selecciona el tipo de motor:</b>\n\n" +
        "Indica la tecnología de propulsión de tu vehículo. Si no estás seguro, usa el botón de ayuda.",
      keyboard: k,
    };
  }

  async renderStepEra(secret: string): Promise<StepResult> {
    const k = new InlineKeyboard();
    for (const e of VEHICLE_OPTIONS.ERAS) {
      k.text(e, await buildCallback("set_era", e, secret)).row();
    }
    return {
      success: true,
      message:
        "📅 <b>Selecciona el rango de año:</b>\n\n" +
        "Elige el periodo de fabricación aproximado de tu vehículo.",
      keyboard: k,
    };
  }

  async renderStepKilometraje(secret: string): Promise<StepResult> {
    const k = new InlineKeyboard();
    for (let i = 0; i < KILOMETRAJE_RANGES.length; i++) {
      const r = KILOMETRAJE_RANGES[i]!;
      k.text(
        r.label,
        await buildCallback("set_km", r.value.toString(), secret),
      );
      if (i % 2 === 1) k.row();
    }
    return {
      success: true,
      message: "📟 <b>Selecciona el rango de kilometraje:</b>",
      keyboard: k,
    };
  }

  async renderStepServicio(secret: string): Promise<StepResult> {
    const k = new InlineKeyboard();
    const icons: Record<string, string> = {
      Diagnóstico: "🔍",
      Mantenimiento: "⚙️",
      "Reparación/Revisión": "🛠️",
      "Limpieza de Inyectores": "🧪",
      "Escáner de Vehículo": "📟",
    };
    for (const s of SERVICE_OPTIONS) {
      const label = `${icons[s] || "🔧"} ${s}`;
      k.text(label, await buildCallback("set_svc", s, secret)).row();
    }
    return {
      success: true,
      message:
        "🛠️ <b>Selecciona el servicio solicitado:</b>\n\n" +
        "Contamos con servicios especializados para cada necesidad de tu vehículo.",
      keyboard: k,
    };
  }

  async renderStepFecha(secret: string): Promise<StepResult> {
    const k = new InlineKeyboard();
    const today = getVenezuelaNow();
    const todayISO = formatDateISO(today);
    let count = 0;
    for (let i = 0; i <= 14 && count < 6; i++) {
      const d = new Date(today.getTime() + i * 86400000);
      const parts = getVenezuelaTimeParts(d);
      if (OFFICE_HOURS.IS_WORK_DAY(parts.dayOfWeek)) {
        const iso = formatDateISO(d);
        const friendly = formatDateFriendly(d);
        const label =
          iso === todayISO ? `🔥 ${friendly} (Hoy)` : `📅 ${friendly}`;
        k.text(label, await buildCallback("set_fecha", iso, secret)).row();
        count++;
      }
    }
    if (count === 0) {
      return {
        success: false,
        message: "❌ No hay días laborables disponibles en la próxima semana.",
      };
    }
    return {
      success: true,
      message: "📅 <b>Selecciona una fecha:</b>",
      keyboard: k,
    };
  }

  async renderStepHora(
    db: D1Database,
    fecha: string,
    secret: string,
  ): Promise<StepResult> {
    const validator = new SlotValidator(db);
    const slots = await validator.getAvailableSlots(fecha);
    const k = new InlineKeyboard();
    const available = slots.filter((s) => s.available);

    if (available.length === 0) {
      return {
        success: false,
        message:
          "❌ No hay horas disponibles para esta fecha. El horario laboral ya ha concluido o todos los slots están ocupados.",
      };
    }

    for (let i = 0; i < available.length; i++) {
      const s = available[i]!;
      k.text(s.hora, await buildCallback("set_hora", s.hora, secret));
      if (i % 3 === 2) k.row();
    }
    return {
      success: true,
      message: `⏰ <b>Horas disponibles para ${fecha}:</b>`,
      keyboard: k,
    };
  }

  async renderConfirmacion(
    s: EphemeralState,
    secret: string,
  ): Promise<StepResult> {
    const fechaDisplay = s.fecha_cita
      ? formatDateFriendly(new Date(s.fecha_cita + "T12:00:00"))
      : "N/A";
    const msg =
      `✅ <b>Resumen de tu Cita:</b>\n\n` +
      `🚗 Tipo: ${s.vehiculo_tipo || "N/A"}\n` +
      `⚙️ Motor: ${s.vehiculo_motor || "N/A"}\n` +
      `📅 Era: ${s.vehiculo_era || "N/A"}\n` +
      `📟 KM: ${s.kilometraje}\n` +
      `🛠️ Servicio: ${s.servicio_solicitado || "N/A"}\n` +
      `🗓️ Fecha: ${fechaDisplay}\n` +
      `⏰ Hora: ${s.hora_cita || "N/A"}\n\n` +
      `¿Deseas confirmar esta cita?`;
    const k = new InlineKeyboard()
      .text(
        "✅ Confirmar Cita",
        await buildCallback("conf_booking", "yes", secret),
      )
      .row()
      .text("❌ Cancelar", await buildCallback("conf_booking", "no", secret));
    return { success: true, message: msg, keyboard: k };
  }
}
