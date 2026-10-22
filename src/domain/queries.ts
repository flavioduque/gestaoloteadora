import type { Perm } from './types';
import { STAGES, STAGE_IX, advName, isClosed } from './catalog';
import { dv, idleDays, matchBank, score, visibleProspects, type Target } from './derive';
import { getBuyer, nowTs, st } from './store';
import { D, MESL, m2, usd, usd2 } from './util';

/* Consultas ejecutivas: cada respuesta sale de una consulta definida sobre los registros, nunca de texto libre. */

export type Cell = string | { text: string; open: Target };
export interface QResult { big: string; text: string; table?: { h: string[]; r: Cell[][] }; period: string; def: string; src: string; ts: string }

export const QUERIES: { k: string; q: string; perm: Perm; kw: string[] }[] = [
  { k: 'cobrar_mes', q: '¿Cuánto tenemos pendiente de cobrar este mes?', perm: 'fin_view', kw: ['cobrar', 'mes', 'pendiente de cobro', 'cobro'] },
  { k: 'ribera_disp', q: '¿Qué lotes siguen disponibles en la categoría de ribera?', perm: 'plan', kw: ['ribera', 'disponible', 'lotes'] },
  { k: 'prioridad', q: '¿Qué cuentas requieren seguimiento prioritario?', perm: 'fin_view', kw: ['cuentas', 'prioritario', 'mora', 'moroso', 'seguimiento prioritario'] },
  { k: 'oport_7d', q: '¿Qué oportunidades llevan siete días sin actividad?', perm: 'crm', kw: ['oportunidades', 'sin actividad', 'siete', '7', 'abandonad'] },
  { k: 'concil', q: '¿Qué diferencias de conciliación siguen sin resolverse?', perm: 'fin_view', kw: ['conciliaci', 'banco', 'diferencia'] },
  { k: 'venc_sem', q: '¿Qué vencimientos importantes tenemos durante la próxima semana?', perm: 'fin_view', kw: ['vencimiento', 'semana', 'próxima', 'proxima'] },
];

/** Consulta con más palabras clave en la pregunta, o null si ninguna coincide. */
export function matchQuery(text: string) {
  const ql = text.toLowerCase();
  const hit = QUERIES.map(x => ({ x, s: x.kw.filter(k => ql.includes(k)).length })).sort((a, b) => b.s - a.s)[0];
  return hit && hit.s ? hit.x : null;
}

export function runQuery(k: string): QResult {
  const S = st(), DV = dv(), T = S.T, ts = nowTs().replace('T', ' ').slice(0, 16);
  const meta = (period: string, def: string, src: string) => ({ period, def, src, ts });
  const acct = (id: string): Cell => ({ text: id, open: { kind: 'insp', insp: 'acct', id } });
  if (k === 'cobrar_mes') {
    const ms = D.monthStart(T), me_ = D.add(D.addM(ms, 1, 1), -1); let due = 0, paid = 0, left = 0, rest = 0, n = 0;
    DV.accts.forEach(a => a.rows.forEach(r => { if (r.due >= ms && r.due <= me_) { due += r.amountC; paid += r.paid; left += r.left; n++; if (r.due >= T) rest += r.left; } }));
    return { big: usd(left), text: `De ${usd(due)} con vencimiento en ${MESL[+ms.slice(5, 7) - 1]}, ya se cobraron ${usd(paid)}. Quedan ${usd(left)} pendientes: ${usd(left - rest)} ya vencidos y ${usd(rest)} por vencer hasta fin de mes.`, ...meta(`${D.fmt(ms)} – ${D.fmt(me_)}`, 'Saldo impago de cuotas con vencimiento en el mes calendario actual. Aplica pagos conciliados por antigüedad.', `${n} cuotas de ${DV.accts.size} contratos firmados`) };
  }
  if (k === 'ribera_disp') {
    const ls = S.lots.filter(l => l.category === 'ribera' && l.status === 'disponible');
    return { big: `${ls.length} lotes`, table: { h: ['Lote', 'Superficie', 'Precio', 'USD/m²'], r: ls.map(l => [{ text: l.id, open: { kind: 'insp', insp: 'lot', id: l.id } }, m2(l.area), usd(l.priceC), usd(l.priceC / l.area)]) }, text: `Valor total disponible en ribera: ${usd(ls.reduce((s, l) => s + l.priceC, 0))}.`, ...meta('Al corte', 'Lotes de categoría Ribera con estado Disponible. Excluye reservados, bloqueados y en regularización.', `${S.lots.filter(l => l.category === 'ribera').length} lotes de ribera en el registro maestro`) };
  }
  if (k === 'prioridad') {
    const as = [...DV.accts.values()].filter(a => a.overdueC > 0 && !a.disputed).sort((a, b) => b.daysLate - a.daysLate || b.overdueC - a.overdueC).slice(0, 8);
    return { big: `${as.length} cuentas`, table: { h: ['Contrato', 'Titular', 'Vencido', 'Atraso', 'Promesa'], r: as.map(a => [acct(a.c.id), getBuyer(a.c.buyerId).name, usd(a.overdueC), a.daysLate + ' d', a.promise ? `${a.promise.status === 'vigente' ? 'Vigente' : 'Incumplida'} ${D.fmtS(a.promise.date)}` : '—']) }, text: 'Ordenadas por días de atraso y luego por importe vencido. Las cuentas en disputa se listan aparte en Finanzas.', ...meta('Al corte', 'Cuentas con al menos una cuota vencida e impaga, sin disputa abierta.', `${DV.accts.size} cuentas evaluadas`) };
  }
  if (k === 'oport_7d') {
    const ps = visibleProspects().filter(p => !isClosed(p.stage) && idleDays(p) >= 7).sort((a, b) => score(b) - score(a));
    return { big: `${ps.length} oportunidades`, table: { h: ['Prospecto', 'Etapa', 'Sin actividad', 'Asesor', 'Prob. est.'], r: ps.map(p => [{ text: p.name, open: { kind: 'insp', insp: 'prospect', id: p.id } }, STAGES[STAGE_IX[p.stage]].label, idleDays(p) + ' d', advName(p.advisorId), score(p) + ' %']) }, text: 'La probabilidad es una estimación por reglas; los días sin actividad son dato observado.', ...meta(`Última actividad antes del ${D.fmt(D.add(T, -6))}`, 'Prospectos activos (sin ganar ni perder) cuya última actividad registrada tiene 7 días o más.', `${visibleProspects().length} prospectos visibles para tu rol`) };
  }
  if (k === 'concil') {
    const ms = S.bank.filter(b => b.status === 'pendiente').map(b => ({ b, m: matchBank(b) })).filter(x => x.m.conf !== 'alta' || x.m.dup);
    return { big: `${ms.length} movimientos`, table: { h: ['Movimiento', 'Fecha', 'Importe', 'Situación'], r: ms.map(({ b, m }) => [b.id, D.fmtS(b.date), usd2(b.amountC), (m.dup ? 'Posible duplicado · ' : '') + (m.conf === 'nula' ? 'Sin correspondencia' : 'Coincidencia parcial')]) }, text: 'Las coincidencias de confianza alta no se cuentan como diferencias, pero igual requieren confirmación manual.', ...meta('Extracto vigente', 'Movimientos bancarios pendientes sin coincidencia exacta o marcados como posible duplicado.', `${S.bank.filter(b => b.status === 'pendiente').length} movimientos pendientes`) };
  }
  // venc_sem
  const to = D.add(T, 7); const rows: { id: string; due: string; left: number; overdueC: number }[] = [];
  DV.accts.forEach(a => a.rows.forEach(r => { if (r.left > 0 && r.due >= T && r.due <= to) rows.push({ id: a.c.id, due: r.due, left: r.left, overdueC: a.overdueC }); }));
  rows.sort((x, y) => y.left - x.left);
  const tot = rows.reduce((s, x) => s + x.left, 0);
  return { big: usd(tot), table: { h: ['Contrato', 'Vence', 'Importe', 'Historial del titular'], r: rows.slice(0, 10).map(x => [acct(x.id), D.fmtS(x.due), usd2(x.left), x.overdueC ? `ya tiene ${usd(x.overdueC)} vencidos` : 'al día']) }, text: `${rows.length} cuotas vencen en los próximos 7 días. Se muestran las 10 de mayor importe.`, ...meta(`${D.fmt(T)} – ${D.fmt(to)}`, 'Cuotas impagas con vencimiento entre hoy y dentro de 7 días.', `${rows.length} cuotas`) };
}

export const cellText = (c: Cell) => typeof c === 'string' ? c : c.text;
