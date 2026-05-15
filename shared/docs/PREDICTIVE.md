# 🔮 PROTOCOLO ORÁCULO - MANTENIMIENTO PREDICTIVO v9.0.0

## 📜 FILOSOFÍA

El **Protocolo Oráculo** es el sistema de anticipación técnica de Titanium Core. No se basa en el azar, sino en la proyección matemática del desgaste vehicular basada en datos reales de uso urbano en LATAM.

## 🏗️ INFRAESTRUCTURA (D1)

El sistema opera sobre tres pilares de persistencia:

1.  **`vehicles`**: Almacena el kilometraje real (`current_mileage`) y la tasa de desgaste diaria (`avg_daily_km`).
2.  **`maintenance_rules`**: Define los intervalos críticos de servicio (km y meses) y su prioridad.
3.  **`predictive_alerts`**: Registro de alertas generadas, pendientes de aprobación humana.

## ⚙️ REGLAS DE NEGOCIO (DIRECTRICES DE ACERO)

### 1. Captura y Sincronización

- El kilometraje se captura en cada agendamiento (Paso 2).
- La tabla `vehicles` **solo** se actualiza cuando un ticket es **aprobado** por un administrador.
- El `avg_daily_km` inicial es de **30 km/día**. Se recalibra automáticamente tras el segundo punto de datos real.

### 2. Generación de Alertas

- El `PredictiveService` se ejecuta cada 6 horas vía CRON.
- Proyecta el kilometraje actual usando: `proyectado = actual + (avg_daily * dias_desde_update)`.
- Genera alertas cuando el kilometraje proyectado está dentro del **+/- 5%** del intervalo de una regla.
- **REGLA DE ORO:** Ninguna alerta se envía al cliente sin aprobación manual del Administrador.

### 3. Excreción de Datos (Mantenimiento)

Para mantener el sistema libre de basura, el `MaintenanceService` aplica:

- Alertas `sent`, `rejected` o `expired` > **9 días** son eliminadas.
- Alertas `pending` > **3 días** sin acción administrativa son eliminadas.

## 🛡️ SEGURIDAD Y RESILIENCIA

- **Fail-Closed:** Si `TELEGRAM_ADMIN_IDS` no está configurado, el sistema bloquea las notificaciones administrativas.
- **L1 Cache:** Uso de `BorgCache` con namespaces para optimizar la carga de alertas en la Master Console.
- **Integridad:** JOINs críticos usan `CAST(telegram_user_id AS TEXT)` para garantizar compatibilidad entre tipos de datos en SQLite.
