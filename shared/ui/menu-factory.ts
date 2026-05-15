import { InlineKeyboard } from "grammy";
import { buildCallback } from "../security";

export class MenuFactory {
  static async buildAdminMainMenu(secret: string): Promise<InlineKeyboard> {
    return new InlineKeyboard()
      .text("🤖 IA Features", await buildCallback("adm_ia", "0", secret))
      .row()
      .text(
        "🔔 Notificaciones",
        await buildCallback("adm_notifs", "0", secret),
      );
  }

  static async buildIAFeaturesMenu(secret: string): Promise<InlineKeyboard> {
    return new InlineKeyboard()
      .text("🔍 Diagnóstico AI", await buildCallback("ia_diag", "0", secret))
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
