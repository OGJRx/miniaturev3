export const CALENDAR_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Calendario Titanium</title>
    <style nonce="__NONCE__">
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 1rem; }
        @media (min-width: 768px) { body { padding: 2rem; } }
        .max-w-4xl { max-width: 56rem; margin-left: auto; margin-right: auto; }
        .flex { display: flex; }
        .justify-between { justify-content: space-between; }
        .items-center { align-items: center; }
        .mb-8 { margin-bottom: 2rem; }
        .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
        .font-bold { font-weight: 700; }
        .text-blue-400 { color: #60a5fa; }
        .text-slate-400 { color: #94a3b8; }
        .bg-blue-600 { background-color: #2563eb; }
        .bg-blue-600:hover { background-color: #1d4ed8; }
        .text-white { color: #fff; }
        .px-4 { padding-left: 1rem; padding-right: 1rem; }
        .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
        .rounded-lg { border-radius: 0.5rem; }
        .transition { transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
        .space-y-4 > :not([hidden]) ~ :not([hidden]) { margin-top: 1rem; }
        .justify-center { justify-content: center; }
        .py-12 { padding-top: 3rem; padding-bottom: 3rem; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .rounded-full { border-radius: 9999px; }
        .h-12 { height: 3rem; }
        .w-12 { width: 3rem; }
        .border-b-2 { border-bottom-width: 2px; }
        .border-blue-500 { border-color: #3b82f6; }
        .text-center { text-align: center; }
        .text-slate-500 { color: #64748b; }
        .italic { font-style: italic; }
        .bg-slate-800 { background-color: #1e293b; }
        .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
        .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
        .rounded-md { border-radius: 0.375rem; }
        .mb-6 { margin-bottom: 1.5rem; }
        .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
        .font-semibold { font-weight: 600; }
        .text-slate-300 { color: #cbd5e1; }
        .mb-3 { margin-bottom: 0.75rem; }
        .grid { display: grid; }
        .gap-3 { gap: 0.75rem; }
        .appointment-card { background: #1e293b; border-left: 4px solid #38bdf8; padding: 1rem; border-radius: 0.5rem; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
        .status-pendiente { color: #ffb703; }
        .status-confirmado { color: #2ecc71; }
        .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
        .gap-2 { gap: 0.5rem; }
        .text-blue-300 { color: #93c5fd; }
        .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
        .mt-1 { margin-top: 0.25rem; }
        .text-right { text-align: right; }
        .text-xs { font-size: 0.75rem; line-height: 1rem; }
        .uppercase { text-transform: uppercase; }
        .tracking-wider { letter-spacing: 0.05em; }
        .text-\\[10px\\] { font-size: 10px; }
        .text-red-200 { color: #fecaca; }
        .bg-red-900\\/20 { background-color: rgba(127, 29, 29, 0.2); }
        .border-red-500 { border-color: #ef4444; }
        .p-4 { padding: 1rem; }
    </style>
</head>
<body class="p-4 md:p-8">
    <div class="max-w-4xl mx-auto">
        <header class="flex justify-between items-center mb-8">
            <div>
                <h1 class="text-3xl font-bold text-blue-400">🔱 Titanium Core</h1>
                <p class="text-slate-400">Panel de Control de Citas</p>
            </div>
            <button onclick="fetchAppointments()" class="bg-blue-600 text-white px-4 py-2 rounded-lg transition">
                Actualizar
            </button>
        </header>

        <div id="appointments-container" class="space-y-4">
            <div class="flex justify-center py-12">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        </div>
    </div>

    <script nonce="__NONCE__">
        function esc(s) { const d = document.createElement('div'); d.textContent = String(s ?? ''); return d.innerHTML; }
        async function fetchAppointments() {
            const container = document.getElementById('appointments-container');
            try {
                const res = await fetch('/api/appointments');
                if (!res.ok) throw new Error('No autorizado');
                const data = await res.json();

                if (data.length === 0) {
                    container.innerHTML = '<div class="text-center py-12 text-slate-500 italic">No hay citas programadas</div>';
                    return;
                }

                const grouped = data.reduce((acc, appt) => {
                    const date = appt.fecha_cita;
                    if (!acc[date]) acc[date] = [];
                    acc[date].push(appt);
                    return acc;
                }, {});

                container.innerHTML = Object.entries(grouped)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([date, appts]) => {
                        const dateBadge = '<span class="bg-slate-800 px-3 py-1 rounded-md">' + esc(date) + '</span>';
                        const cards = appts.sort((a, b) => a.hora_cita.localeCompare(b.hora_cita)).map(appt => {
                            return '<div class="appointment-card flex justify-between items-center">' +
                                        '<div>' +
                                            '<div class="flex items-center gap-2">' +
                                                '<span class="text-blue-300 font-mono font-bold text-lg">' + esc(appt.hora_cita) + '</span>' +
                                                '<span class="text-slate-500">|</span>' +
                                                '<span class="font-semibold">' + esc(appt.vehiculo_tipo) + '</span>' +
                                            '</div>' +
                                            '<div class="text-slate-400 text-sm mt-1">' + esc(appt.servicio_solicitado) + '</div>' +
                                        '</div>' +
                                        '<div class="text-right">' +
                                            '<div class="text-xs uppercase font-bold tracking-wider status-' + esc(appt.estado) + '">' + esc(appt.estado) + '</div>' +
                                            '<div class="text-[10px] text-slate-600 mt-1 font-mono">' + esc(appt.ticket_id) + '</div>' +
                                        '</div>' +
                                    '</div>';
                        }).join('');

                        return '<div class="mb-6">' +
                                    '<h2 class="text-lg font-semibold text-slate-300 mb-3 flex items-center">' + dateBadge + '</h2>' +
                                    '<div class="grid gap-3">' + cards + '</div>' +
                                '</div>';
                    }).join('');

            } catch (err) {
                container.innerHTML = '<div class="bg-red-900/20 border border-red-500 text-red-200 p-4 rounded-lg text-center">' +
                    '⚠️ Error: ' + esc(err.message) + '. Asegúrate de estar autenticado.' +
                '</div>';
            }
        }
        fetchAppointments();
    </script>
</body>
</html>`;
