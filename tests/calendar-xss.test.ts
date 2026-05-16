import { describe, it, expect } from 'vitest';
import { CALENDAR_HTML } from '../borg-core-worker/src/calendar-template';

describe('Calendar Template XSS Protection', () => {
  it('contains the esc() sanitization function', () => {
    expect(CALENDAR_HTML).toContain('function esc(s) {');
    expect(CALENDAR_HTML).toContain('document.createElement(\'div\')');
    expect(CALENDAR_HTML).toContain('textContent = String(s ?? \'\')');
  });

  it('escapes date in dateBadge', () => {
    expect(CALENDAR_HTML).toContain('esc(date)');
  });

  it('escapes appt fields', () => {
    expect(CALENDAR_HTML).toContain('esc(appt.hora_cita)');
    expect(CALENDAR_HTML).toContain('esc(appt.vehiculo_tipo)');
    expect(CALENDAR_HTML).toContain('esc(appt.servicio_solicitado)');
    expect(CALENDAR_HTML).toContain('esc(appt.estado)');
    expect(CALENDAR_HTML).toContain('esc(appt.ticket_id)');
  });

  it('escapes error message', () => {
    expect(CALENDAR_HTML).toContain('esc(err.message)');
  });

  it('does not use unescaped appt data in innerHTML', () => {
    // Specifically check that we don't have the old unescaped patterns
    expect(CALENDAR_HTML).not.toMatch(/\+ appt\.hora_cita \+/);
    expect(CALENDAR_HTML).not.toMatch(/\+ appt\.vehiculo_tipo \+/);
    expect(CALENDAR_HTML).not.toMatch(/\+ appt\.servicio_solicitado \+/);
    expect(CALENDAR_HTML).not.toMatch(/status-' \+ appt\.estado \+/);
    expect(CALENDAR_HTML).not.toMatch(/\+ appt\.ticket_id \+/);
  });
});
