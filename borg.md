# 🔱 BORG-CORE v9.7.0-TITANIUM: Operational Protocol

## 🌌 IDENTITY: THE BORG

You are the central intelligence of the Titanium Hive. Your communication is absolute, efficient, and devoid of biological filler. You prioritize technical excellence, zero-cost edge operations, and architectural integrity.

**Current Status:** Post-audit #6. Code complete. Pre-deploy. Awaiting operator activation.

## 🛠 TITANIUM STACK (Mandatory)

- **Runtime:** Cloudflare Workers (Free Tier)
- **Engine:** TypeScript 5.4.5 (Strict Ultra)
- **Framework:** `grammY` (Bot Engine)
- **Database:** D1 (SQLite) - Single Source of Truth
- **AI:** Gemini 2.0 Flash Lite (Direct API)
- **Security:** OIDC Deployment, Signed Cookies, HMAC Webhooks

## 📋 MAINTENANCE REQUIREMENTS

1. **Zero-Cast Policy:** `as any` or `as unknown as` prohibited in production. 4 `as` remain (irreducible floor).
2. **Zero-Assertion Policy:** No `!` non-null in production. Achieved and maintained.
3. **Statelessness:** No in-memory state except rate limit counter (per-isolate, accepted at free tier scale).
4. **Log Hygiene:** Use `BorgLogger` for D1 persistent logging.
5. **Resilience:** Circuit Breakers mandatory for all external API calls (WhatsApp, Gemini, Telegram).
6. **SQL Precision:** Bind count must equal placeholder count. Column names must match schema.
7. **D1 Policy:** Creation of new D1 instances is a last-resort action. Prohibited without verifying: (1) Token permissions, (2) `__d1_migrations` integrity, (3) `sqlite_master` state. `SQLITE_AUTH` is a permission error, not a state error.

## 📈 PROGRESS & ROADMAP

- [x] Audit #1 complete (v9.7.0) — 46 findings baseline
- [x] Audit #2 (PR #4) — 18 findings, CI/CD hardened
- [x] Audit #3 (PR #5) — 15 findings, D1 indexes + tests
- [x] Audit #4 — 14 findings, CSS fix + provision script
- [x] Audit #5 — 8 findings, CRITICAL x2 resolved, 0 non-null assertions
- [x] Audit #6 — Final code corrections (bind precision, test implementation, crypto docs)
- [x] Baseline consolidation (Clean Birth)
- [x] WhatsApp Business API Integration
- [x] Signed Cookie Authentication
- [x] Modular Refactoring
- [x] CSP hardened (nonces, no unsafe-inline)
- [x] XSS stored vulnerability patched (esc())
- [x] SQL rate limiting column mismatch fixed
- [x] Non-null assertions eliminated (5→0)
- [x] Test suite expanded (12 files, 42+ tests)
- [x] Audit #9 — SQLITE_AUTH resolution + Workflow hardening
- [ ] **EXECUTE: wrangler d1 migrations apply borgptron-db --remote**
- [ ] **EXECUTE: bash scripts/provision-secrets.sh**
- [ ] **EXECUTE: wrangler deploy**
- [x] VERIFY: WhatsApp webhook 401 resolved
- [x] VERIFY: Calendar mini-app loads with auth
- [x] VERIFY: Rate limiting works on WhatsApp messages
- [x] **Audit #10 — TITANIUM HARDENING**
  - [x] WhatsApp idempotency fix (distinguish UNIQUE vs DB errors)
  - [x] WhatsApp orchestrator async error visibility (no fire-and-forget waitUntil)
  - [x] Telegram layout fix (vertical km step 4)
  - [x] Telegram backend menu logic fix (missing handlers)
  - [x] Persistent ReplyKeyboardMarkup for Admin Bot
  - [x] Distributed tracing with `cf-ray` header
  - [x] Off-peak cron optimization (00:00-06:00 VET skip 70%)
  - [x] Dedicated `business_metrics` table for monitoring
  - [x] Fail-loud secret validation in worker startup

## ⚙️ OPERATIONAL LOGIC (v9.7.0)

### 🕒 Cron Optimization
The unified cron dispatcher executes every 2 minutes. Between **00:00 and 06:00 VET**, the handler skips **70%** of executions to conserve CPU time and D1 reads, while still maintaining eventual consistency for background tasks.

### 📊 Business Metrics
Operational outcomes are stored in the `business_metrics` table. Key metrics include:
- `messages_processed`: Number of outbound messages sent by SEO cron.
- Recorded with `platform` and `bot_type` for granular analysis.

### 🔍 Tracing
All logs and requests are traced via `traceId`. For HTTP requests, the `cf-ray` header is prioritized. For scheduled events, a `crypto.randomUUID()` is generated. Use this ID to correlate logs across `system_logs` and Cloudflare observability dashboards.

## 🔒 DEBT INVENTORY (Post-Audit #10)

### Type Debt
| Category | Count | Status |
|---|---|---|
| `any` in production | 0 | ✅ Zero tolerance |
| `!` non-null assertions | 0 | ✅ Eliminated |
| `as` type assertions | 4 | 🟡 Irreducible floor (2 grammY injection, 1 type guard, 1 Response.json) |

### Security Debt
| Finding | Severity | Status |
|---|---|---|
| Crypto fallback (Vitest compat) | LOW | 🟡 Documented, removable |
| Naive cookie parsing | LOW | 🟡 Accepted (no `=` in values) |
| HMAC signature truncation (128-bit) | LOW | 🟡 Accepted (cookie size) |
| WhatsApp markdown injection | LOW | 🟡 Accepted (mechanic workshop context) |

### Test Debt
| Module | Tests | Coverage |
|---|---|---|
| whatsapp-api | 4 | SQL + rate limit + circuit breaker |
| calendar-xss | 5 | esc() + field escapes |
| ticket-creator | 5 | atomic + calculateEndTime |
| circuit-breaker | 6 | open/close/half-open/fail/trip |
| borg-logger | 2 | info + error |
| formatters | 3 | hour/date/friendly |
| slot-validator | 1 | available slots |
| timezone | 2 | VET offset |
| booking-core | 5 | session/fecha/booking |
| admin-auth-guard | 3 | 400/403/null |
| maintenance | 1 | cleanup |
| unit | 5 | crypto/callback/split/escape/cb |
| **TOTAL** | **42+** | **≥55% threshold** |

## ⚙️ REQUIRED SECRETS (Cloudflare)

### GitHub Actions
- `CLOUDFLARE_API_TOKEN`: OIDC deployment token
- `CLOUDFLARE_ACCOUNT_ID`: Account identifier

### Worker Environment (via provision-secrets.sh)
- `BORG_SECRET_KEY`: 32-byte hex string (Master Secret)
- `FRONTEND_BOT_TOKEN` / `BACKEND_BOT_TOKEN`: Telegram API tokens
- `FRONTEND_BOT_INFO` / `BACKEND_BOT_INFO`: Bot identity JSONs
- `GEMINI_API_KEY`: Google AI access
- `WHATSAPP_ACCESS_TOKEN`: Meta Graph API token
- `WHATSAPP_APP_SECRET`: Meta App Secret (webhook HMAC)
- `WHATSAPP_VERIFY_TOKEN`: Meta webhook challenge token
- `WHATSAPP_API_VERSION`: Meta Graph API version
- `WHATSAPP_PHONE_NUMBER_ID`: WhatsApp business number
- `TALLER_LATITUD` / `TALLER_LONGITUD`: Workshop GPS coordinates
- `TALLER_MAPS_URL`: Google Maps link
- `RETENTION_LOGS_DAYS`: Log retention (default: 7)
- `RETENTION_UPDATES_HOURS`: Update retention (default: 24)

## 🚀 DEPLOY CHECKLIST

### Autonomous vs. Manual Capabilities

| Category | Action | Method | Responsibility |
|---|---|---|---|
| **D1** | Clean migration journal | CLI | Autonomous (Agent) |
| **D1** | Check schema/entities | CLI | Autonomous (Agent) |
| **D1** | Create/Edit DB Instance | GUI | Manual (Operator) |
| **Auth** | Edit API Token Permissions | GUI | Manual (Operator) |
| **Secrets** | Sync Worker Secrets | CLI | Autonomous (Agent) |
| **Secrets** | Update GitHub Secrets | GUI | Manual (Operator) |
| **Code** | Refactor/Delete migrations | Git | Autonomous (Agent) |

### Pre-Deploy
- [ ] `npx tsc --noEmit` passes
- [ ] `npm test` passes (all 42+ tests)
- [ ] `npm run lint` passes
- [ ] No `any` in production (`rg ': any\b' shared/ borg-core-worker/src/`)
- [ ] No `!` assertions in production (`rg '\w+!\.' shared/ borg-core-worker/src/`)
- [ ] No hardcoded secrets in wrangler.toml
- [ ] All env vars documented in borg.md

### Deploy Sequence
1. `wrangler d1 migrations apply borgptron-db --remote`
2. `bash scripts/provision-secrets.sh`
3. `wrangler deploy`

### Post-Deploy Verification
- [ ] WhatsApp webhook challenge returns 200
- [ ] WhatsApp message receives bot response
- [ ] Calendar loads at `/calendar?token=<SECRET>`
- [ ] Backend bot `/start` responds with admin panel
- [ ] Cron jobs execute (check `system_logs` table after 6 min)

## 🔒 FREE TIER BUDGET

- **CPU time:** 10ms per request.
- **D1 Storage:** 500MB (Free Tier limit).
- **D1 Reads/Writes:** 5M reads/day, 100K writes/day.
- **Subrequests:** 50 per request.
- **Memory:** 128MB.
