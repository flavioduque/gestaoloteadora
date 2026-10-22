import type { Reservation, State } from './types';
import { LOT_ST } from './catalog';
import { nowTs } from './store';
import { D } from './util';

/* Servidor simulado: operaciones transaccionales que reciben el estado explícito,
   así las pruebas de integridad pueden ejecutarlas sobre una copia. */
export const Server = {
  /** Reserva con control de concurrencia optimista: exige la versión del lote leída por el cliente. */
  reserve(state: State, { lotId, expectedVersion, prospectId, priceC, amountC, advisorId, conditions, user, approved }: { lotId: string; expectedVersion: number; prospectId: string | null; priceC: number; amountC: number; advisorId: string; conditions: string; user: string; approved: boolean }): { ok: true; reservation: Reservation } | { ok: false; error: string } {
    const lot = state.lots.find(l => l.id === lotId);
    if (!lot) return { ok: false, error: 'El lote no existe.' };
    if (lot.status !== 'disponible') return { ok: false, error: `El lote ${lotId} ya no está disponible (estado actual: ${LOT_ST[lot.status].label.toLowerCase()}). Tu solicitud no se registró.` };
    if (lot.version !== expectedVersion) return { ok: false, error: `El lote ${lotId} cambió mientras completabas la reserva (versión ${expectedVersion} → ${lot.version}). Volvé a abrirlo y revisá su estado.` };
    const id = 'R-' + String(state.seq.r++).padStart(4, '0');
    const created = state.T;
    const r: Reservation = { id, lotId, prospectId, priceC, amountC, created, expires: D.add(created, 7), advisorId, status: approved ? 'vigente' : 'pendiente_aprobacion', renewals: 0, approvedBy: approved ? user : null, conditions,
      docs: [{ k: 'ci', label: 'Cédula del comprador', ok: false }, { k: 'pago', label: 'Comprobante del pago de reserva', ok: false }, { k: 'form', label: 'Formulario de reserva firmado', ok: false }] };
    state.reservations.push(r); lot.status = 'reservado'; lot.reservationId = id; lot.version++;
    return { ok: true, reservation: r };
  },
  /** Registro de pago idempotente: la misma clave nunca crea dos pagos. */
  registerPayment(state: State, { key, contractId, date, amountC, ref, method, source, by, confirm }: { key: string; contractId: string; date: string; amountC: number; ref: string; method: string; source: string; by: string; confirm: boolean }) {
    if (state.idem[key]) return { ok: true, duplicate: true, payment: state.payments.find(p => p.id === state.idem[key])! };
    const p = { id: 'PG-' + String(state.seq.p++).padStart(5, '0'), contractId, date, amountC, method, ref, status: confirm ? 'confirmado' as const : 'en_revision' as const, source, kind: 'cuota' as 'cuota' | 'entrada', by, approvedBy: confirm ? by : null };
    state.payments.push(p); state.idem[key] = p.id;
    if (confirm) state.ledger.push({ id: 'MV-' + String(state.seq.l++).padStart(5, '0'), contractId, date, type: 'pago', amountC, ref, paymentId: p.id, by, approvedBy: by, note: 'Pago registrado' });
    return { ok: true, duplicate: false, payment: p };
  },
  confirmPayment(state: State, { paymentId, bankId, by }: { paymentId: string; bankId?: string; by: string }) {
    const p = state.payments.find(x => x.id === paymentId); const b = bankId ? state.bank.find(x => x.id === bankId) : undefined;
    if (!p || p.status !== 'en_revision') return { ok: false, error: 'El pago ya no está en revisión.' };
    if (b && b.status !== 'pendiente') return { ok: false, error: 'El movimiento bancario ya fue conciliado.' };
    p.status = 'confirmado'; p.approvedBy = by;
    state.ledger.push({ id: 'MV-' + String(state.seq.l++).padStart(5, '0'), contractId: p.contractId, date: p.date, type: p.kind === 'entrada' ? 'entrada' : 'pago', amountC: p.amountC, ref: p.ref, paymentId: p.id, by: p.by, approvedBy: by, note: 'Conciliado con ' + (b ? b.id : 'extracto') });
    if (b) { b.status = 'conciliada'; b.paymentId = p.id; b.approvedBy = by; b.approvedAt = nowTs(); }
    return { ok: true, error: '' };
  },
  reversePayment(state: State, { paymentId, reason, by }: { paymentId: string; reason: string; by: string }) {
    const p = state.payments.find(x => x.id === paymentId);
    if (!p || p.status !== 'confirmado') return { ok: false, error: 'Solo se pueden revertir pagos confirmados.' };
    if (p.kind === 'entrada') return { ok: false, error: 'La entrada contractual se corrige con un ajuste aprobado, no con una reversión.' };
    p.status = 'revertido';
    state.ledger.push({ id: 'MV-' + String(state.seq.l++).padStart(5, '0'), contractId: p.contractId, date: state.T, type: 'reversion', amountC: -p.amountC, ref: p.ref, paymentId: p.id, by, approvedBy: by, note: reason });
    return { ok: true, error: '' };
  },
};
