import type { BankEntry, Category, Contract, Installment, LedgerEntry, Payment, PromiseToPay, Prospect, Stage } from './types';
import { CAT, FIN_OWNERS, STAGES, STAGE_IX, advName, isClosed } from './catalog';
import { can, getBuyer, getContract, getProspect, me, st } from './store';
import { D, usd, usd2 } from './util';

/** Destino al que lleva un elemento (alerta, resultado de búsqueda, evento): una app o un inspector. */
export type InspKind = 'lot' | 'prospect' | 'acct' | 'ctr';
export type Target = { kind: 'app'; app: string; tab?: string } | { kind: 'insp'; insp: InspKind; id: string };

export interface Row extends Installment { paid: number; left: number; st: string }
export interface Acct {
  c: Contract; rows: Row[]; overdueRows: Row[]; overdueC: number; outstandingC: number; daysLate: number; next?: Row;
  entradaC: number; creditC: number; paidTotalC: number; risk: 'al_dia' | 'atencion' | 'riesgo' | 'critico';
  pendingRevC: number; promise: PromiseToPay | null; disputed: boolean; favorC: number; paidN: number;
}

export function computeAcct(c: Contract, led: Map<string, LedgerEntry[]>): Acct {
  const S = st(), T = S.T;
  const entries = led.get(c.id) || [];
  const credit = entries.reduce((s, e) => e.type !== 'entrada' ? s + e.amountC : s, 0);
  const entradaC = entries.reduce((s, e) => e.type === 'entrada' ? s + e.amountC : s, 0);
  let rem = credit;
  const rows: Row[] = c.plan.installments.map(i => {
    const paid = Math.max(0, Math.min(i.amountC, rem)); rem -= paid; const left = i.amountC - paid;
    const st_ = left === 0 ? 'pagada' : (i.due < T ? (paid > 0 ? 'parcial vencida' : 'vencida') : (paid > 0 ? 'parcial' : 'pendiente'));
    return { ...i, paid, left, st: st_ };
  });
  const overdueRows = rows.filter(r => r.left > 0 && r.due < T);
  const overdueC = overdueRows.reduce((s, r) => s + r.left, 0);
  const outstandingC = rows.reduce((s, r) => s + r.left, 0);
  const daysLate = overdueRows.length ? D.diff(T, overdueRows[0].due) : 0;
  const next = rows.find(r => r.left > 0 && r.due >= T);
  const cfg = S.riskCfg;
  const risk = daysLate >= cfg.critico ? 'critico' : daysLate >= cfg.riesgo ? 'riesgo' : daysLate >= cfg.atencion ? 'atencion' : 'al_dia';
  const pendingRevC = S.payments.filter(p => p.contractId === c.id && p.status === 'en_revision').reduce((s, p) => s + p.amountC, 0);
  const promise = S.promises.filter(p => p.contractId === c.id).sort((a, b) => a.created < b.created ? 1 : -1)[0] || null;
  const paidN = rows.filter(r => r.left === 0).length;
  return { c, rows, overdueRows, overdueC, outstandingC, daysLate, next, entradaC, creditC: credit, paidTotalC: entradaC + credit, risk, pendingRevC, promise, disputed: !!c.disputed, favorC: rem, paidN };
}

export interface Alert { key: string; sev: 'critica' | 'alta' | 'media'; area: string; title: string; cause: string; owner: string; due: string; action: string; go: Target }

export interface Derived {
  accts: Map<string, Acct>; led: Map<string, LedgerEntry[]>;
  inv: { total: number; byStatus: Record<string, number>; byCat: Record<Category, { total: number; disponible: number; reservado: number; vendido: number; otros: number; availC: number; areaAvail: number }>; availValueC: number };
  ar: { outstandingC: number; overdueC: number; disputedOverdueC: number; lateN: number; N: number; index: number };
  proj: { d30: number; d60: number; d90: number };
  pendingForm: { n: number; sumC: number; res: number; ctr: number };
  alerts: Alert[];
}

let cache: { ver: number; dv: Derived } | null = null;
let DV: Derived;
export const dv = () => DV;

/** Recalcula los derivados una vez por versión del estado. */
export function derive(ver: number): Derived {
  if (cache && cache.ver === ver) return (DV = cache.dv);
  const S = st(), T = S.T;
  const led = new Map<string, LedgerEntry[]>(); S.ledger.forEach(e => { if (!led.has(e.contractId)) led.set(e.contractId, []); led.get(e.contractId)!.push(e); });
  const accts = new Map<string, Acct>(); S.contracts.forEach(c => { if (c.status === 'firmado') accts.set(c.id, computeAcct(c, led)); });
  const byStatus: Record<string, number> = { disponible: 0, reservado: 0, vendido: 0, bloqueado: 0, regularizacion: 0 };
  const byCat = {} as Derived['inv']['byCat']; (Object.keys(CAT) as Category[]).forEach(k => byCat[k] = { total: 0, disponible: 0, reservado: 0, vendido: 0, otros: 0, availC: 0, areaAvail: 0 });
  let availValueC = 0;
  S.lots.forEach(l => { byStatus[l.status]++; const b = byCat[l.category]; b.total++; if (l.status === 'disponible') { b.disponible++; b.availC += l.priceC; b.areaAvail += (l.area || 0); availValueC += l.priceC; } else if (l.status === 'reservado') b.reservado++; else if (l.status === 'vendido') b.vendido++; else b.otros++; });
  let outstandingC = 0, overdueC = 0, disputedOverdueC = 0, lateN = 0;
  accts.forEach(a => { outstandingC += a.outstandingC; if (a.disputed) disputedOverdueC += a.overdueC; else overdueC += a.overdueC; if (a.overdueC > 0) lateN++; });
  const ar = { outstandingC, overdueC, disputedOverdueC, lateN, N: accts.size, index: outstandingC ? overdueC / outstandingC : 0 };
  const proj = { d30: 0, d60: 0, d90: 0 };
  accts.forEach(a => a.rows.forEach(r => { if (r.left > 0 && r.due >= T) { const d = D.diff(r.due, T); if (d <= 30) proj.d30 += r.left; if (d <= 60) proj.d60 += r.left; if (d <= 90) proj.d90 += r.left; } }));
  const pendRes = S.reservations.filter(r => ['vigente', 'pendiente_aprobacion'].includes(r.status));
  const pendCtr = S.contracts.filter(c => c.status === 'pendiente_firma');
  const pendingForm = { n: pendRes.length + pendCtr.length, sumC: pendRes.reduce((s, r) => s + r.priceC, 0) + pendCtr.reduce((s, c) => s + c.priceC, 0), res: pendRes.length, ctr: pendCtr.length };
  DV = { accts, led, inv: { total: S.lots.length, byStatus, byCat, availValueC }, ar, proj, pendingForm, alerts: [] };
  DV.alerts = computeAlerts();
  cache = { ver, dv: DV };
  return DV;
}

/* ---- Ventanas de período ---- */
export function periodWin(p: string) { const T = st().T; if (p === 'todo') return { from: '2000-01-01', to: T, pFrom: null as string | null, pTo: null as string | null, label: 'Todo el histórico' }; const n = +p; return { from: D.add(T, -(n - 1)), to: T, pFrom: D.add(T, -(2 * n - 1)) as string | null, pTo: D.add(T, -n) as string | null, label: n === 365 ? 'Últimos 12 meses' : `Últimos ${n} días` }; }
export function salesIn(a: string, b: string) { const cs = st().contracts.filter(c => c.status === 'firmado' && c.signedDate! >= a && c.signedDate! <= b); return { n: cs.length, sumC: cs.reduce((s, c) => s + c.priceC, 0) }; }
export function cashIn(a: string, b: string) { return st().ledger.filter(e => ['entrada', 'pago', 'reversion'].includes(e.type) && e.date >= a && e.date <= b).reduce((s, e) => s + e.amountC, 0); }
export function duesIn(a: string, b: string) { let dueC = 0, paidC = 0; DV.accts.forEach(ac => ac.rows.forEach(r => { if (r.due >= a && r.due <= b) { dueC += r.amountC; paidC += r.paid; } })); return { dueC, paidC }; }

/* ---- Probabilidad estimada de cierre (reglas explícitas) ---- */
export function score(p: Prospect) {
  if (p.stage === 'ganado') return 100; if (p.stage === 'perdido') return 0;
  const base = ({ nuevo: 5, contactado: 10, calificado: 22, visita_prog: 32, visita_real: 45, negociacion: 60, reserva: 78, contrato: 90 } as Record<string, number>)[p.stage] || 0;
  const idle = D.diff(st().T, p.lastActivity);
  let s = base - (idle > 14 ? 20 : idle > 7 ? 10 : 0);
  if (p.budgetC && p.category) { const cheapest = st().lots.filter(l => l.status === 'disponible' && l.category === p.category).reduce((m, l) => Math.min(m, l.priceC), Infinity); if (cheapest !== Infinity) s += p.budgetC >= cheapest ? 5 : -8; }
  return Math.max(2, Math.min(97, s));
}
export const idleDays = (p: Prospect) => D.diff(st().T, p.lastActivity);
export function visibleProspects() { const r = me(); return st().prospects.filter(p => can('crm_all') || p.advisorId === r.advisorId); }
export const reachedIx = (p: Prospect) => STAGE_IX[p.stage === 'perdido' ? p.reached : p.stage];

/* ---- Alertas ejecutivas ---- */
function computeAlerts(): Alert[] {
  const S = st(), T = S.T, out: Alert[] = [];
  const resolvedKeys = new Set(S.resolved.map(r => r.key));
  DV.accts.forEach(a => {
    if (a.overdueC <= 0 || a.disputed) return;
    if (a.daysLate > 60 || a.overdueC >= 500000) {
      const b = getBuyer(a.c.buyerId);
      out.push({ key: `mora:${a.c.id}:${a.overdueRows[0].due}`, sev: a.daysLate > 90 ? 'critica' : 'alta', area: 'Cobranza', title: `${a.c.id} · ${a.c.lotId}: ${usd(a.overdueC)} vencidos hace ${a.daysLate} días`,
        cause: `${a.overdueRows.length} cuota(s) impaga(s) de ${b.name}. ${a.promise && a.promise.status === 'vigente' ? 'Tiene promesa de pago para el ' + D.fmt(a.promise.date) + '.' : a.promise && a.promise.status === 'incumplida' ? 'Incumplió la promesa del ' + D.fmt(a.promise.date) + '.' : 'Sin promesa de pago registrada.'}`,
        owner: a.c.followUp, due: D.add(T, 2), action: a.daysLate > 90 ? 'Contactar al titular, registrar compromiso y evaluar derivación legal con Dirección.' : 'Llamar al titular y registrar promesa de pago con fecha.', go: { kind: 'insp', insp: 'acct', id: a.c.id } });
    }
  });
  S.reservations.forEach(r => {
    if (!['vigente', 'pendiente_aprobacion'].includes(r.status)) return;
    const left = D.diff(r.expires, T); const p = getProspect(r.prospectId);
    if (left < 0) out.push({ key: `resv:${r.id}:venc`, sev: 'critica', area: 'Reservas', title: `Reserva ${r.id} (${r.lotId}) vencida sin formalizar`, cause: `Venció el ${D.fmt(r.expires)}. El lote sigue bloqueado para la venta.`, owner: advName(r.advisorId), due: T, action: 'Formalizar, renovar con aprobación o cancelar para liberar el lote.', go: { kind: 'app', app: 'res' } });
    else if (left <= 2) out.push({ key: `resv:${r.id}:prox`, sev: 'alta', area: 'Reservas', title: `Reserva ${r.id} (${r.lotId}) vence ${left === 0 ? 'hoy' : left === 1 ? 'mañana' : 'en 2 días'}`, cause: `${p ? p.name : 'Prospecto'} · documentación ${r.docs.filter(d => d.ok).length}/${r.docs.length} completa.`, owner: advName(r.advisorId), due: r.expires, action: 'Completar documentación y generar el contrato antes del vencimiento.', go: { kind: 'app', app: 'res' } });
    if (r.status === 'pendiente_aprobacion') out.push({ key: `resv:${r.id}:aprob`, sev: 'media', area: 'Reservas', title: `Reserva ${r.id} (${r.lotId}) pendiente de aprobación`, cause: `Solicitada por ${advName(r.advisorId)}. El lote ya está bloqueado mientras se decide.`, owner: 'Gerencia comercial', due: D.add(r.created, 1), action: 'Aprobar o rechazar la solicitud.', go: { kind: 'app', app: 'res' } });
  });
  S.contracts.filter(c => c.status === 'pendiente_firma').forEach(c => { const d = D.diff(T, c.created); if (d >= 3) out.push({ key: `ctr:${c.id}:firma`, sev: d >= 7 ? 'alta' : 'media', area: 'Contratos', title: `Contrato ${c.id} (${c.lotId}) pendiente de firma hace ${d} días`, cause: `${getBuyer(c.buyerId).name} · ${usd(c.priceC)}. El calendario de cuotas se activa recién con la firma.`, owner: advName(c.advisorId), due: D.add(T, 2), action: 'Coordinar firma con escribanía y registrar el acta.', go: { kind: 'insp', insp: 'ctr', id: c.id } }); });
  const pendBank = S.bank.filter(b => b.status === 'pendiente');
  const unmatched = pendBank.filter(b => matchBank(b).conf === 'nula');
  if (unmatched.length) out.push({ key: `conc:nula:${unmatched.map(b => b.id).join(',')}`, sev: 'media', area: 'Conciliación', title: `${unmatched.length} movimiento(s) bancario(s) sin correspondencia`, cause: unmatched.map(b => `${b.desc} ${usd2(b.amountC)} del ${D.fmtS(b.date)}`).join('; ') + '.', owner: FIN_OWNERS[0], due: D.add(T, 3), action: 'Identificar al pagador con el banco y asignar manualmente.', go: { kind: 'app', app: 'fin', tab: 'conc' } });
  const dups = pendBank.filter(b => matchBank(b).dup);
  if (dups.length) out.push({ key: `conc:dup:${dups.map(b => b.id).join(',')}`, sev: 'alta', area: 'Conciliación', title: `Posible acreditación duplicada (${dups.length} movimientos)`, cause: `Mismo importe, referencia y fecha: ${dups.map(b => b.id).join(', ')}.`, owner: FIN_OWNERS[0], due: D.add(T, 1), action: 'Confirmar con el banco antes de aplicar; aplicar solo uno.', go: { kind: 'app', app: 'fin', tab: 'conc' } });
  S.lots.filter(l => l.front == null || l.depth == null).forEach(l => out.push({ key: `lot:${l.id}:datos`, sev: 'media', area: 'Inventario', title: `Lote ${l.id} con información incompleta`, cause: 'Sin frente ni fondo registrados; la superficie no puede verificarse contra la mensura.', owner: 'Dirección', due: D.add(T, 5), action: 'Cargar dimensiones desde el plano de mensura.', go: { kind: 'insp', insp: 'lot', id: l.id } }));
  S.prospects.filter(p => !['ganado', 'perdido', 'contrato'].includes(p.stage) && STAGE_IX[p.stage] >= STAGE_IX.visita_real && idleDays(p) > 7).forEach(p => out.push({ key: `crm:${p.id}:${p.lastActivity}`, sev: 'alta', area: 'Comercial', title: `${p.name} sin seguimiento hace ${idleDays(p)} días`, cause: `Etapa ${STAGES[STAGE_IX[p.stage]].label.toLowerCase()} · probabilidad estimada ${score(p)} %${p.lotIds.length ? ' · interesado en ' + p.lotIds.join(', ') : ''}.`, owner: advName(p.advisorId), due: T, action: 'Retomar contacto hoy y registrar la próxima acción.', go: { kind: 'insp', insp: 'prospect', id: p.id } }));
  S.requests.filter(r => r.status === 'abierta' && D.diff(T, r.created) > 5).forEach(r => out.push({ key: `sol:${r.id}`, sev: 'media', area: 'Propietarios', title: `Solicitud ${r.id} abierta hace ${D.diff(T, r.created)} días`, cause: `${r.type}: ${r.text}`, owner: 'Atención al propietario', due: D.add(T, 2), action: 'Responder al propietario y cerrar la solicitud.', go: { kind: 'app', app: 'portal' } }));
  const ord = { critica: 0, alta: 1, media: 2 };
  return out.filter(a => !resolvedKeys.has(a.key)).sort((a, b) => ord[a.sev] - ord[b.sev] || (a.due < b.due ? -1 : 1));
}

/* ---- Conciliación: sugerencias ---- */
export const ctrCode = (s?: string) => { const m = String(s || '').match(/VLC-\d{4}/); return m ? m[0] : null; };
export interface Match { conf: 'alta' | 'media' | 'nula' | '-'; payment?: Payment; create?: boolean; contractId?: string; why: string[]; dup?: boolean; code?: string | null }
export function matchBank(b: BankEntry): Match {
  const S = st();
  if (b.status !== 'pendiente') return { conf: '-', why: [] };
  const code = ctrCode(b.ref) || ctrCode(b.desc);
  const dup = S.bank.some(o => o !== b && o.amountC === b.amountC && o.ref === b.ref && o.date === b.date && o.status !== 'descartada');
  const cands = S.payments.filter(p => p.status === 'en_revision' && !S.bank.some(o => o.status === 'conciliada' && o.paymentId === p.id));
  let best: Payment | null = null, bs = 0, why: string[] = [];
  cands.forEach(p => { let s = 0; const w: string[] = []; if (p.amountC === b.amountC) { s += 50; w.push('importe exacto'); } if (code && ctrCode(p.ref) === code) { s += 35; w.push('referencia ' + code); } if (Math.abs(D.diff(b.date, p.date)) <= 3) { s += 15; w.push('fecha ±3 días'); } if (s > bs) { bs = s; best = p; why = w; } });
  if (best && bs >= 85) return { conf: 'alta', payment: best, why, dup, code };
  if (best && bs >= 50) return { conf: 'media', payment: best, why, dup, code };
  if (code && getContract(code)) return { conf: 'media', create: true, contractId: code, why: ['referencia ' + code, 'sin pago registrado; se crearía uno nuevo'], dup, code };
  return { conf: 'nula', why: ['sin referencia reconocible ni importe coincidente'], dup };
}

/* ---- Condiciones para avanzar de etapa ---- */
export function stageGate(p: Prospect): { next: { k: Stage; label: string } | null; ok: boolean; miss: string[] } {
  const ix = STAGE_IX[p.stage]; const next = STAGES[ix + 1]; const miss: string[] = []; const T = st().T;
  if (!next || isClosed(p.stage)) return { next: null, ok: false, miss: ['Etapa final'] };
  switch (p.stage) {
    case 'nuevo': if (!p.history.some(h => h.type !== 'Ingreso')) miss.push('Registrar el primer contacto'); break;
    case 'contactado': if (!p.budgetC) miss.push('Presupuesto estimado'); if (!p.category) miss.push('Categoría de lote buscada'); if (!p.horizon) miss.push('Horizonte de compra'); break;
    case 'calificado': if (!p.visitDate || p.visitDate < T) miss.push('Fecha de visita programada'); break;
    case 'visita_prog': if (!p.visitDate || p.visitDate > T) miss.push('Que la visita haya ocurrido (fecha de visita ≤ hoy)'); break;
    case 'visita_real': if (!p.lotIds.length) miss.push('Al menos un lote de interés'); break;
    case 'negociacion': miss.push('Crear la reserva del lote (botón “Crear reserva”)'); break;
    case 'reserva': miss.push('Formalizar el contrato desde Reservas y contratos'); break;
    case 'contrato': miss.push('Registrar la firma del contrato'); break;
  }
  return { next, ok: !miss.length, miss };
}

/* ---- Cola de cobranza del día ---- */
export interface CollItem { a: Acct; b: ReturnType<typeof getBuyer>; step: string; label: string; channel: string; msg: string; status: 'pendiente' | 'tarea creada' | 'omitido'; why: string }
export function collQueue(): CollItem[] {
  const S = st(), T = S.T, out: CollItem[] = [];
  DV.accts.forEach(a => {
    const b = getBuyer(a.c.buyerId); let step: string | null = null; let row: Row | undefined;
    const nextDays = a.next ? D.diff(a.next.due, T) : null;
    if (a.overdueC > 0) { const d = a.daysLate; step = d >= 20 ? 'd20' : d >= 10 ? 'd10' : d >= 3 ? 'd3' : null; row = a.overdueRows[0]; }
    else if (a.next && nextDays === 0) { step = 'd0'; row = a.next; }
    else if (a.next && nextDays != null && nextDays >= 1 && nextDays <= 5) { step = 'pre'; row = a.next; }
    if (!step || !row) return;
    const cfg = S.collSeq.find(s => s.k === step)!;
    let status: CollItem['status'] = 'pendiente', why = '';
    if (!cfg.on) { status = 'omitido'; why = 'Paso desactivado en la secuencia'; }
    else if (a.disputed) { status = 'omitido'; why = 'Cuenta en disputa: comunicaciones suspendidas'; }
    else if (a.overdueC > 0 && a.pendingRevC >= a.overdueC) { status = 'omitido'; why = 'Hay un pago en revisión que cubre lo vencido'; }
    else if (b.optOut && ['WhatsApp', 'Correo'].includes(cfg.channel)) { status = 'omitido'; why = 'El titular pidió no recibir mensajes'; }
    else { const recent = S.tasks.find(t => t.contractId === a.c.id && D.diff(T, t.date) < 3); if (recent) { status = recent.date === T && recent.step === step ? 'tarea creada' : 'omitido'; if (status === 'omitido') why = 'Límite de frecuencia: 1 contacto cada 3 días'; } }
    const channel = ['pre', 'd0'].includes(step) ? b.pref : cfg.channel;
    const msg = cfg.tpl.replace('{nombre}', b.name.split(' ')[0]).replace('{vence}', D.fmt(row.due)).replace('{n}', String(row.n)).replace('{lote}', a.c.lotId).replace('{importe}', usd2(row.left)).replace('{ref}', a.c.id).replace('{vencido}', usd2(a.overdueC)).replace('{responsable}', a.c.followUp);
    out.push({ a, b, step, label: cfg.label, channel, msg, status, why });
  });
  const ord: Record<string, number> = { d20: 0, d10: 1, d3: 2, d0: 3, pre: 4 };
  return out.sort((x, y) => ord[x.step] - ord[y.step]);
}

/* ---- Simulador de escenarios ---- */
export interface SimParams { rate: number; adj: number; down: number; n: number; mor: number }
export function simBase(): SimParams {
  const S = st();
  const yr = S.contracts.filter(c => c.status === 'firmado' && D.diff(S.T, c.signedDate!) <= 365);
  const all = S.contracts.filter(c => c.status === 'firmado');
  const ns = all.map(c => c.plan.n).sort((a, b) => a - b);
  return { rate: Math.round(yr.length / 12 * 10) / 10 || 1, adj: 0, down: Math.round(all.reduce((s, c) => s + c.plan.downPct, 0) / all.length), n: ns[Math.floor(ns.length / 2)], mor: Math.round(DV.ar.index * 1000) / 10 };
}
export function simulate(p: SimParams) {
  const S = st(), T = S.T, H = 24, cur = D.monthStart(T);
  const mi = (d: string) => { const a = D.parse(cur), b = D.parse(d); return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth(); };
  const m = Array.from({ length: H }, () => ({ base: 0, neu: 0 })); const mor = p.mor / 100;
  DV.accts.forEach(a => a.rows.forEach(r => { if (r.left > 0 && r.due >= T) { const k = mi(r.due); if (k >= 0 && k < H) m[k].base += r.left * (1 - mor); } }));
  const avail = S.lots.filter(l => l.status === 'disponible');
  const avg = avail.length ? avail.reduce((s, l) => s + l.priceC, 0) / avail.length * (1 + p.adj / 100) : 0;
  let stock = avail.length, acc = 0, sold = 0, soldOut: number | null = null;
  for (let k = 0; k < H; k++) {
    acc += p.rate; let q = Math.floor(acc + 1e-9); acc -= q; q = Math.min(q, stock); stock -= q; sold += q; if (stock === 0 && soldOut == null && q > 0) soldOut = k + 1;
    for (let j = 0; j < q; j++) { m[k].neu += avg * p.down / 100; const cuota = avg * (1 - p.down / 100) / p.n; for (let t = 1; t <= p.n && k + t < H; t++) m[k + t].neu += cuota * (1 - mor); }
  }
  const sum = (a: number, b: number) => m.slice(a, b).reduce((s, x) => s + x.base + x.neu, 0);
  return { m, cash12: sum(0, 12), cash24: sum(0, 24), salesC: sold * avg, sold, soldOut, stock: avail.length };
}

/* ---- Agenda derivada: visitas, vencimientos de reservas, promesas, próximas acciones y eventos internos ---- */
export interface AgendaItem { id: string; date: string; time?: string; title: string; sub: string; kind: 'visita' | 'reserva' | 'promesa' | 'accion' | 'reunion' | 'obra' | 'otro' | 'cuota'; go?: Target; own?: boolean }
export function agendaItems(from: string, to: string): AgendaItem[] {
  const S = st(), out: AgendaItem[] = [];
  const inR = (d?: string | null) => !!d && d >= from && d <= to;
  const crm = can('crm');
  if (crm) visibleProspects().forEach(p => {
    if (inR(p.visitDate) && p.stage === 'visita_prog') out.push({ id: 'v' + p.id, date: p.visitDate!, title: `Visita · ${p.name}`, sub: `${advName(p.advisorId)}${p.category ? ' · ' + CAT[p.category].label : ''}`, kind: 'visita', go: { kind: 'insp', insp: 'prospect', id: p.id } });
    if (p.nextAction && inR(p.nextAction.date) && !isClosed(p.stage)) out.push({ id: 'a' + p.id, date: p.nextAction.date, title: p.nextAction.text, sub: `${p.name} · ${advName(p.advisorId)}`, kind: 'accion', go: { kind: 'insp', insp: 'prospect', id: p.id } });
  });
  if (can('res')) S.reservations.filter(r => ['vigente', 'pendiente_aprobacion'].includes(r.status) && inR(r.expires) && (can('crm_all') || me().advisorId == null || r.advisorId === me().advisorId))
    .forEach(r => out.push({ id: 'r' + r.id, date: r.expires, title: `Vence reserva ${r.id} · ${r.lotId}`, sub: getProspect(r.prospectId)?.name ?? '', kind: 'reserva', go: { kind: 'app', app: 'res' } }));
  if (can('fin_view')) {
    S.promises.filter(p => p.status === 'vigente' && inR(p.date)).forEach(p => out.push({ id: 'p' + p.id, date: p.date, title: `Promesa de pago · ${p.contractId}`, sub: usd(p.amountC), kind: 'promesa', go: { kind: 'insp', insp: 'acct', id: p.contractId } }));
    DV.accts.forEach(a => a.rows.forEach(r => { if (r.left >= 150000 && inR(r.due) && r.due >= S.T) out.push({ id: `c${a.c.id}-${r.n}`, date: r.due, title: `Cuota ${r.n} · ${a.c.id}`, sub: `${usd(r.left)} · ${getBuyer(a.c.buyerId).name}`, kind: 'cuota', go: { kind: 'insp', insp: 'acct', id: a.c.id } }); }));
  }
  if (can('exec') || can('crm')) S.events.filter(e => inR(e.date)).forEach(e => out.push({ id: e.id, date: e.date, time: e.time, title: e.title, sub: `${e.owner}${e.note ? ' · ' + e.note : ''}`, kind: e.kind, own: true }));
  return out.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || '99') < (b.time || '99') ? -1 : 1);
}
