# BORG WORKLOG

---

Task ID: 1
Agent: Auditor DevOps (Sesión 6)
Task: Auditoría de Deuda Técnica — Bug Calendario + Exterminio Analizar Foto

Work Log:

- Sincronizado con repositorio local (rama `titan`, commit `614f99b`, sin remote configurado)
- Leídos `borg-core-worker/src/index.ts` (887 líneas) y `shared/core.ts` (1728→1700 líneas tras limpieza)
- Verificada compilación TypeScript: `tsc --noEmit` → limpio
- Verificados tests: `vitest run` → 24/24 pasan
- Análisis estático de CALENDAR_HTML: 0 backticks internos, 0 `${}` sin escapar, template literal seguro
- Prueba de `timingSafeEqual` local: lógica SHA-256 correcta (same=true, wrong=false)
- curl al worker deployed: `/calendar?token=<secret>` → 401 Unauthorized (ruta existe, token rechazado)
- curl a `/nonexistent` → 404 "Not Found" (confirma que `/calendar` SÍ está deployed)
- curl a `/api/appointments?token=<secret>` → 401 Unauthorized (mismo problema de token)
- Root cause calendario: BORG_SECRET_KEY deployed en Cloudflare difiere del proporcionado
- Exterminados: BotAction.VISION_APPROVE, BotAction.VISION_DISCARD
- Comentado: BorgAgentMode (no referenciado en ningún lado)
- Limpio prompt CEREBRO: "fotografías" → "códigos de falla OBD-II"
- Eliminados 6 métodos muertos de MenuFactory: buildDiagnosticMenu, appendHomeButton, appendNewThreadButton, buildNewThreadButton, buildTicketActionKeyboard, buildIAContinueKeyboard
- Limpio comentario residual en load_test_d1.js
- Eliminado JSDoc duplicado para `withDb`

Stage Summary:

- Bug calendario: ROOT CAUSE identificado — BORG_SECRET_KEY desincronizado entre callback URL generator y handleCalendar. Fix requerido: `wrangler secret put BORG_SECRET_KEY` con el valor correcto + redeploy
- Analizar Foto: Exterminado completamente del codebase (menú, handlers, prompt, enums)
- Código muerto: 6 métodos MenuFactory eliminados, 2 enum values eliminados, 1 enum comentado
- Tests: 24/24 pasan post-limpieza
- Estado: cambios en working directory (unstaged), requieren commit + push + deploy

---

Task ID: 2
Agent: Jules (Auditor Jefe de Deuda Técnica)
Task: Migración de Infraestructura (borgptron-db -> borg) + Hardening

Work Log:

- Identificado bug crítico 401: Desincronización de BORG_SECRET_KEY.
- Hardened `calendarAuthMiddleware` en `shared/security/index.ts` con logging detallado para diagnóstico instantáneo.
- Creada nueva base de datos D1 `borg` (ID: `f93be66c-cfd1-4f03-a698-57d5938ac156`).
- Refactorizado repositorio completo: Reemplazadas 8 referencias de `borgptron-db` por `borg`.
- Actualizado `wrangler.toml` con nuevo `database_id`.
- Sincronizados Workflows de GitHub Actions para usar la nueva base de datos `borg`.
- Actualizados `README.md` y `borg.md` con instrucciones de despliegue post-migración.
- Verificación técnica: El sistema ahora apunta a la nueva infraestructura limpia.

Estado: Listo para commit y ejecución de despliegue por el operador.
