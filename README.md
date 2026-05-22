# 🔱 BORGPTRON v9.0.0 (TITANIUM CORE)

![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen)
![Budget](https://img.shields.io/badge/Budget-%240-blue)
![Coverage](https://img.shields.io/badge/Coverage-%3E80%25-success)

BORGPTRON es un sistema de orquestación dual (Frontend/Backend) de alto rendimiento, diseñado para operar dentro de los límites del **Free Tier de Cloudflare**. Garantiza latencia mínima y resiliencia máxima mediante una arquitectura de "Díada Reactiva".

> "La latencia es un error de diseño; el costo es un fallo de arquitectura." 🏁🏆

---

## ⚡ Workflow de Operaciones (Borg CLI)

Este proyecto se gestiona prioritariamente desde la terminal. Utiliza estos comandos para mantener la integridad del núcleo.

### 🛠 Desarrollo y Calidad

```bash
# 1. Sincronización obligatoria (Protocolo de Agentes)
./scripts/agent-sync.sh

# 2. Validación de deuda técnica (Zero Tolerance Any-Scanner)
npm run any-scanner

# 3. Linting estricto y formateo (Bloqueante en CI)
npm run lint:strict

# 4. Suite de pruebas unitarias
npm run test
```

### 🛰 Infraestructura y Despliegue

```bash
# Sincronización de webhooks y agentes
./scripts/sync-webhooks.sh

# Aplicar migraciones D1 al entorno remoto
wrangler d1 migrations apply borg --remote

# Rotación de secretos de seguridad
./scripts/rotate-borg-secret.sh

# Despliegue manual del Worker principal
cd borg-core-worker && npx wrangler deploy
```

---

## 🏗 Arquitectura de Verdad Única

### 1. Díada Reactiva (Dual-Bot)

- **Frontend Bot (Telegate):** Interfaz para clientes. Optimizado para UX móvil, botones persistentes y agendamiento fluido.
- **Backend Bot (Brain):** El Oráculo de gestión. Procesa IA, genera reportes y coordina el triage de sistema.

### 2. Trazabilidad Atómica

Todo evento inyecta un `traceId` que se propaga desde el webhook hasta la última consulta D1.

- **TracedDatabase:** Captura automática de `duration_ms` para cada query.
- **Observabilidad:** Logs estructurados compatibles con `wrangler tail`.

---

## 🛡 Protocolos de Resiliencia (Titanium Standard)

- **D6 - Degradación Elegante:** Si Gemini (AI) falla, el sistema conmuta automáticamente al **"Modo Analógico"**. El usuario mantiene el control total mediante botones de respaldo.
- **Circuit Breaker:** Apertura automática tras **3 fallos consecutivos** de la API externa.
- **D1-Backed Async IA:** Gestión de colas para procesar intenciones complejas sin exceder el CPU time del Free Tier.
- **Purga de Entropía:** Auto-limpieza de la tabla `ia_jobs` cada 24h para mantener la agilidad de D1.

---

## 📖 Disciplina de Desarrollo (Titanium Workflow)

Para contribuir a BORGPTRON, se DEBEN seguir estas reglas de ingeniería:

1.  **Test-Driven Development (TDD):** Escribir el test fallido (Rojo) antes de la implementación (Verde).
2.  **Aislamiento por Worktrees:** Nunca trabajes directamente en `titan`. Crea un worktree aislado para cada feature: `git worktree add .worktrees/mi-feature -b feature/mi-feature`.
3.  **Zero 'any' Tolerance:** El Any-Scanner bloquea el despliegue si detecta tipos implícitos o `any` sin justificación estructural.
4.  **Git Notes para Auditoría:** Cada tarea completada debe llevar un resumen técnico adjunto mediante `git notes`.

---

## 🛠 Stack Tecnológico Estricto

| Componente       | Stack Aprobado               | 🚫 Prohibido              |
| :--------------- | :--------------------------- | :------------------------ |
| **Runtime**      | Cloudflare Workers           | Node.js / Docker          |
| **Persistencia** | D1 (SQLite) + Telegram Files | KV / R2 / External SQL    |
| **Framework**    | grammY (cloudflare-mod)      | Telegraf / Express        |
| **AI**           | Gemini API (Free)            | OpenAI / Anthropic (Paid) |

---

## 🔗 Recursos Adicionales

- [📖 **Manual del Operador (borg.md)**](borg.md) - Guía detallada de comandos CLI y diagnósticos de bajo nivel.
- [📈 **Estado del Sistema**](https://github.com/OGJRx/miniature-borg_core-journey/actions) - Logs de Entropy Guard y AI Ops.

---

© 2026 BORGPTRON Core Journey. Mantén la latencia baja, mantén el núcleo frío.
