export const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const MESL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

// Fechas como texto ISO en UTC para que la aritmética no dependa del huso del navegador.
export const D = {
  iso(d: Date) { return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; },
  parse(s: string) { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); },
  add(s: string, n: number) { const d = D.parse(s); d.setUTCDate(d.getUTCDate() + n); return D.iso(d); },
  addM(s: string, n: number, day?: number) {
    const d = D.parse(s); const y = d.getUTCFullYear(), m = d.getUTCMonth() + n; const dd = day == null ? d.getUTCDate() : day;
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); return D.iso(new Date(Date.UTC(y, m, Math.min(dd, last))));
  },
  diff(a: string, b: string) { return Math.round((D.parse(a).getTime() - D.parse(b).getTime()) / 86400000); },
  fmt(s?: string | null) { if (!s) return '—'; const d = D.parse(s); return `${d.getUTCDate()} ${MES[d.getUTCMonth()]} ${d.getUTCFullYear()}`; },
  fmtS(s?: string | null) { if (!s) return '—'; const d = D.parse(s); return `${d.getUTCDate()} ${MES[d.getUTCMonth()]}`; },
  dow(s: string) { return D.parse(s).getUTCDay(); },
  ym(s: string) { return s.slice(0, 7); },
  monthStart(s: string) { return s.slice(0, 8) + '01'; },
  today() { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; },
};

export function mulberry32(a: number) {
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export const nf0 = new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 });
export const nf1 = new Intl.NumberFormat('es-PY', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const nf2 = new Intl.NumberFormat('es-PY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const usd = (c: number) => 'USD ' + nf0.format(Math.round(c / 100));
export const usd2 = (c: number) => 'USD ' + nf2.format(c / 100);
export const usdK = (c: number) => { const v = c / 100, a = Math.abs(v); if (a >= 1e6) return 'USD ' + nf2.format(v / 1e6) + ' M'; if (a >= 1e4) return 'USD ' + nf0.format(v / 1000) + ' mil'; return 'USD ' + nf0.format(v); };
export const m2 = (v: number | null | undefined) => v == null ? '—' : nf2.format(v) + ' m²';
export const pct = (v: number, d = 1) => (isFinite(v) ? (d ? nf1.format(v * 100) : nf0.format(v * 100)) : '—') + ' %';
export const uid = (p: string) => p + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
export const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
export const fmtMin = (m: number) => m >= 60 ? nf1.format(m / 60) + ' h' : nf0.format(m) + ' min';
export const plural = (n: number, s: string, p = s + 's') => `${n} ${n === 1 ? s : p}`;

/** Genera un CSV (separador ;) y dispara la descarga en el navegador. */
export function downloadCSV(name: string, rows: (string | number)[][]) {
  const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
