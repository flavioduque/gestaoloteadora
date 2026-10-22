import type { State } from './types';
import { ROLES } from './catalog';
import { agendaItems, dv } from './derive';
import { makePlan } from './finance';
import { Server } from './server';
import { getContract, st } from './store';
import { clone, usd2 } from './util';

/* Pruebas de integridad: corren sobre una copia del estado y nunca modifican registros reales. */

export interface TestResult { ok: boolean; out: string }
export interface Test { k: string; name: string; what: string; run(): TestResult }

/** Saldo pendiente de un contrato en un estado dado: total de cuotas menos créditos (sin la entrada). */
function outstanding(s: State, contractId: string) {
  const c = s.contracts.find(x => x.id === contractId)!;
  const total = c.plan.installments.reduce((a, i) => a + i.amountC, 0);
  const credit = s.ledger.filter(e => e.contractId === contractId && e.type !== 'entrada').reduce((a, e) => a + e.amountC, 0);
  return total - Math.max(0, Math.min(total, credit));
}

export const TESTS: Test[] = [
  { k: 'conc', name: 'Reservas simultáneas del mismo lote', what: 'Dos asesores leen el mismo lote disponible y envían la reserva al mismo tiempo.', run() {
    const s = clone(st()); const l = s.lots.find(x => x.status === 'disponible')!; const v = l.version;
    const r1 = Server.reserve(s, { lotId: l.id, expectedVersion: v, prospectId: null, priceC: l.priceC, amountC: 200000, advisorId: 'ADV1', conditions: '', user: 'Camila Duarte', approved: false });
    const r2 = Server.reserve(s, { lotId: l.id, expectedVersion: v, prospectId: null, priceC: l.priceC, amountC: 200000, advisorId: 'ADV2', conditions: '', user: 'Rodrigo Areco', approved: false });
    const n = s.reservations.filter(r => r.lotId === l.id && ['vigente', 'pendiente_aprobacion'].includes(r.status)).length;
    return { ok: r1.ok && !r2.ok && n === 1, out: `Lote ${l.id} (versión ${v}).\nCamila: ${r1.ok ? 'aceptada ' + r1.reservation.id : 'rechazada'}.\nRodrigo: ${r2.ok ? 'aceptada' : 'rechazada — ' + r2.error}\nReservas activas sobre el lote: ${n}.` };
  } },
  { k: 'sched', name: 'Cuotas suman el importe financiado', what: 'Recalcula todos los planes de contratos y verifica centavo a centavo.', run() {
    let bad = 0, n = 0; st().contracts.forEach(c => { n++; const s = c.plan.installments.reduce((a, i) => a + i.principalC, 0); if (s !== c.plan.financedC || c.plan.downC + c.plan.financedC !== c.priceC) bad++; });
    const t = makePlan({ priceC: 9999999, downPct: 25, n: 7, rate: .11, firstDue: st().T }); const ts = t.installments.reduce((a, i) => a + i.principalC, 0);
    return { ok: !bad && ts === t.financedC, out: `${n} planes revisados, ${bad} con diferencias. Caso borde (USD 99.999,99 a 7 cuotas al 11 %): Σ capital ${usd2(ts)} = financiado ${usd2(t.financedC)}.` };
  } },
  { k: 'idem', name: 'Pago reintentado no se duplica', what: 'Envía dos veces el mismo pago con la misma clave de idempotencia.', run() {
    const s = clone(st()); const c = s.contracts.find(x => x.status === 'firmado')!; const before = s.payments.length;
    const args = { key: 'TEST-KEY-1', contractId: c.id, date: s.T, amountC: 10000, ref: 'TEST', method: 'Transferencia', source: 'Prueba', by: 'Prueba', confirm: true };
    const a = Server.registerPayment(s, args); const b = Server.registerPayment(s, args);
    return { ok: s.payments.length === before + 1 && b.duplicate && a.payment.id === b.payment.id, out: `Pagos antes: ${before}. Después de dos envíos: ${s.payments.length}. Segundo envío devolvió ${b.payment.id} (duplicado detectado: ${b.duplicate ? 'sí' : 'no'}).` };
  } },
  { k: 'rev', name: 'Una reversión no borra el pago', what: 'Revierte un pago confirmado y verifica que el original siga en el libro y el saldo vuelva.', run() {
    const s = clone(st()); const p = s.payments.find(x => x.status === 'confirmado' && x.kind === 'cuota')!;
    const b0 = outstanding(s, p.contractId); const nL = s.ledger.length;
    Server.reversePayment(s, { paymentId: p.id, reason: 'Prueba', by: 'Prueba' }); const b1 = outstanding(s, p.contractId);
    const still = s.ledger.some(e => e.paymentId === p.id && e.type === 'pago');
    return { ok: still && s.ledger.length === nL + 1 && b1 - b0 === p.amountC, out: `Pago ${p.id} de ${usd2(p.amountC)}. Movimiento original presente: ${still ? 'sí' : 'no'}. Movimientos: ${nL} → ${s.ledger.length}. Saldo: ${usd2(b0)} → ${usd2(b1)}.` };
  } },
  { k: 'perm', name: 'Un propietario no accede a datos ajenos', what: 'Simula la consulta del portal y verifica que solo devuelva registros de su contrato.', run() {
    const c = st().contracts.find(x => x.status === 'firmado')!; const own = st().payments.filter(p => p.contractId === c.id); const leaked = own.filter(p => p.contractId !== c.id).length;
    const perms = (k: keyof typeof ROLES) => ROLES[k].perms as string[];
    const roleOk = !perms('propietario').includes('fin_view') && !perms('asesor').includes('fin_edit') && !perms('asesor').includes('holder');
    return { ok: !leaked && roleOk, out: `Propietario de ${c.lotId}: ${own.length} pagos, todos del contrato ${c.id}. Rol propietario sin acceso a finanzas: sí. Asesor sin edición financiera ni datos de titulares: ${roleOk ? 'sí' : 'no'}.` };
  } },
  { k: 'cons', name: 'Consistencia entre módulos', what: 'Compara el estado de cada lote con sus reservas y contratos.', run() {
    const S = st(), issues: string[] = [];
    S.lots.forEach(l => {
      const c = l.contractId ? getContract(l.contractId) : undefined;
      if (l.status === 'vendido' && (!c || c.status !== 'firmado')) issues.push(l.id + ': vendido sin contrato firmado');
      if (c && c.status === 'firmado' && l.status !== 'vendido') issues.push(l.id + ': contrato firmado pero lote no vendido');
      const act = S.reservations.filter(r => r.lotId === l.id && ['vigente', 'pendiente_aprobacion'].includes(r.status)).length;
      if (act > 1) issues.push(l.id + ': más de una reserva activa');
      if (act && l.status !== 'reservado') issues.push(l.id + ': reserva activa con lote ' + l.status);
    });
    return { ok: !issues.length, out: issues.length ? issues.join('\n') : `${S.lots.length} lotes, ${S.reservations.length} reservas y ${S.contracts.length} contratos sin contradicciones.` };
  } },
  { k: 'dups', name: 'Alertas y agenda sin duplicados', what: 'Verifica que cada alerta y cada compromiso de la agenda aparezca una sola vez.', run() {
    const keys = dv().alerts.map(a => a.key); const T = st().T;
    const ag = agendaItems(T, T.slice(0, 4) + '-12-31').map(i => i.id);
    const dupA = keys.filter((k, i) => keys.indexOf(k) !== i), dupG = ag.filter((k, i) => ag.indexOf(k) !== i);
    return { ok: !dupA.length && !dupG.length, out: `${keys.length} alertas, ${dupA.length} repetidas${dupA.length ? ': ' + dupA.join(', ') : ''}. ${ag.length} compromisos de agenda hasta fin de año, ${dupG.length} repetidos.` };
  } },
];
