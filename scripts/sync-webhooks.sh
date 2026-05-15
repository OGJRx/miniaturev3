#!/bin/bash

# sync-webhooks.sh - TITANIUM v8.3.8
# Sincroniza los webhooks de Telegram con el BORG_SECRET_KEY de 40 caracteres.

# REQUERIMIENTOS:
# - CLOUDFLARE_API_TOKEN
# - BORG_SECRET_KEY (40 chars)
# - BACKEND_BOT_TOKEN
# - FRONTEND_BOT_TOKEN
# - WORKER_URL (ej. https://borg-core-worker.marketceogjr.workers.dev)

if [ -z "$BACKEND_BOT_TOKEN" ] || [ -z "$FRONTEND_BOT_TOKEN" ] || [ -z "$BORG_SECRET_KEY" ] || [ -z "$WORKER_URL" ]; then
    echo "❌ Error: Faltan variables de entorno."
    echo "Asegúrate de tener: BACKEND_BOT_TOKEN, FRONTEND_BOT_TOKEN, BORG_SECRET_KEY, WORKER_URL"
    exit 1
fi

echo "🔄 Sincronizando Webhook BACKEND..."
curl -s -X POST "https://api.telegram.org/bot$BACKEND_BOT_TOKEN/setWebhook" \
     -d "url=$WORKER_URL/webhook/backend" \
     -d "secret_token=$BORG_SECRET_KEY" \
     -d "drop_pending_updates=true" | grep -q '"ok":true' && echo "✅ Backend OK" || echo "❌ Falló Backend"

echo "🔄 Sincronizando Webhook FRONTEND..."
curl -s -X POST "https://api.telegram.org/bot$FRONTEND_BOT_TOKEN/setWebhook" \
     -d "url=$WORKER_URL/webhook/frontend" \
     -d "secret_token=$BORG_SECRET_KEY" \
     -d "drop_pending_updates=true" | grep -q '"ok":true' && echo "✅ Frontend OK" || echo "❌ Falló Frontend"

echo "🏁 Sincronización completada."
