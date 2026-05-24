import { InlineKeyboard } from "grammy";
import { buildCallback } from "../security";
import { CoreEnv } from "../types";

export class MenuFactory {
  static async buildAdminMainMenu(secret: string, env: CoreEnv) {
    const dashboardBaseUrl =
      env.DASHBOARD_URL || "https://borg-dashboard.pages.dev";
    const dashboardUrl = `${dashboardBaseUrl}?token=${secret}`;

    return new InlineKeyboard()
      .url("🌐 Dashboard Web", dashboardUrl)
      .row()
      .text("📊 Citas", await buildCallback("adm_appts", "0", secret))
      .row()
      .text("🤖 IA Features", await buildCallback("adm_ia", "0", secret))
      .row()
      .text("🔔 Notificaciones", await buildCallback("adm_notifs", "0", secret))
      .row()
      .text(
        "🔄 Actualizar Comandos",
        await buildCallback("refresh_cmds", "0", secret),
      );
  }

  static async buildAppointmentsMenu(secret: string): Promise<InlineKeyboard> {
    return new InlineKeyboard()
      .text("📅 Citas de Hoy", await buildCallback("adm_today", "0", secret))
      .row()
      .text(
        "🔜 Próximas Citas",
        await buildCallback("adm_upcoming", "0", secret),
      )
      .row()
      .text("🏠 Menú Principal", await buildCallback("adm_main", "0", secret));
  }

  static async buildIAFeaturesMenu(secret: string): Promise<InlineKeyboard> {
    return new InlineKeyboard()
      .text("🔍 Diagnóstico AI", await buildCallback("ia_ia", "0", secret))
      .row()
      .text("🏠 Menú Principal", await buildCallback("adm_main", "0", secret));
  }

  static async buildDiagnosticMenu(secret: string): Promise<InlineKeyboard> {
    return new InlineKeyboard()
      .text("🔢 Códigos OBD", await buildCallback("ia_obd", "0", secret))
      .row()
      .text("🏠 Menú Principal", await buildCallback("adm_main", "0", secret));
  }
}
