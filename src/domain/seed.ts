import type { AgendaEvent, AuditEntry, BankEntry, Buyer, Category, Comm, Contract, LedgerEntry, Lot, OwnerRequest, Payment, PromiseToPay, Prospect, Reservation, Sector, Stage, State } from './types';
import { ADVISORS, CAT, FIN_OWNERS, HORIZON, LOST_REASONS, SECTOR, SOURCES, STAGE_IX, advName } from './catalog';
import { makePlan } from './finance';
import { D, mulberry32, usd, usd2 } from './util';

const FIRST = ['Martín', 'Lucía', 'Federico', 'Valeria', 'Gustavo', 'Natalia', 'Andrés', 'Paula', 'Hernán', 'Carolina', 'Javier', 'Mariana', 'Ricardo', 'Florencia', 'Esteban', 'Gabriela', 'Óscar', 'Daniela', 'Pablo', 'Verónica', 'Tomás', 'Alejandra', 'Sergio', 'Romina', 'Iván', 'Cecilia', 'Julián', 'Lorena', 'Marcelo', 'Silvia', 'Bruno', 'Patricia', 'Emilio', 'Rocío', 'Fabián', 'Mónica', 'Nicolás', 'Elena', 'Raúl', 'Belén'];
const LAST = ['Benítez', 'Giménez', 'Ortiz', 'Cáceres', 'Villalba', 'Ayala', 'Rojas', 'Duarte', 'Franco', 'Martínez', 'González', 'Acosta', 'Ramírez', 'Riveros', 'Sanabria', 'Ojeda', 'Galeano', 'Báez', 'Insfrán', 'Escobar', 'Amarilla', 'Medina', 'Núñez', 'Torres', 'Paredes', 'Brítez', 'Cabrera', 'Fleitas', 'Zárate', 'Mendoza'];

/** Costa ficticia del lago (x en función de y sobre el plano de 1000×680). */
export function shoreX(y: number) { return 226 + 16 * Math.sin(y / 58) + 7 * Math.sin(y / 23 + 1.3); }

const slug = (name: string) => name.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function seedDemo(T: string): State {
  const rng = mulberry32(20261019);
  const R = (a: number, b: number) => a + rng() * (b - a);
  const RI = (a: number, b: number) => Math.floor(R(a, b + 1));
  const pick = <X,>(arr: X[]) => arr[Math.floor(rng() * arr.length)];
  const round1 = (v: number) => Math.round(v * 10) / 10;

  /* ---- Lotes y geometría ficticia ---- */
  const lots: Lot[] = [];
  function mkLot(id: string, sector: Sector, category: Category, poly: number[][], cx: number, cy: number) {
    const c = CAT[category];
    const front = round1(R(c.front[0], c.front[1])), depth = round1(R(c.depth[0], c.depth[1]));
    const area = Math.round(front * depth * 100) / 100;
    const price = Math.round(area * c.ppm * R(.97, 1.05) / 500) * 500;
    const hist = [
      { date: D.add(T, -910), priceC: Math.round(price * .86 / 500) * 500 * 100, by: 'Dirección', reason: 'Precio de lanzamiento' },
      { date: D.add(T, -430), priceC: Math.round(price * .93 / 500) * 500 * 100, by: 'Dirección', reason: 'Actualización anual de lista' },
      { date: D.add(T, -62), priceC: price * 100, by: 'Dirección', reason: 'Ajuste por avance de obra' },
    ];
    lots.push({
      id, sector, category, front, depth, area, priceC: price * 100, currency: 'USD', status: 'disponible', statusReason: '', version: 1,
      poly: poly.map(p => p.map(v => Math.round(v * 10) / 10).join(',')).join(' '), cx, cy, priceHistory: hist, notes: '',
      features: category === 'ribera' ? ['Frente al lago', 'Acceso al agua (a confirmar)'] : category === 'vista' ? ['Vista al lago', 'Frente a avenida principal'] : category === 'parque' ? ['Frente a parque central', 'Cercano al club house'] : ['Calle interna arbolada'],
    });
  }
  { const top = 36, bot = 644, N = 18, h = (bot - top) / N;
    for (let i = 0; i < N; i++) { const y0 = top + i * h, y1 = y0 + h; const pts = [[shoreX(y0) + 14, y0], [352, y0], [352, y1]];
      for (let y = y1; y > y0; y -= 4) pts.push([shoreX(y) + 14, y]);
      mkLot('A-' + String(i + 1).padStart(2, '0'), 'A', 'ribera', pts, (shoreX((y0 + y1) / 2) + 14 + 352) / 2, (y0 + y1) / 2 + 3); } }
  { const cols: [number, number, Category, number][] = [[396, 476, 'vista', 0], [476, 556, 'interno', 17]]; const blocks: [number, number, number][] = [[36, 298, 8], [336, 644, 9]];
    cols.forEach(([x0, x1, cat, off]) => { let k = 1; blocks.forEach(([t, b, N]) => { const h = (b - t) / N; for (let i = 0; i < N; i++, k++) { const y0 = t + i * h, y1 = y0 + h;
      mkLot('B-' + String(k + off).padStart(2, '0'), 'B', cat, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], (x0 + x1) / 2, (y0 + y1) / 2 + 3); } }); }); }
  { const cols: [number, number, Category, number][] = [[596, 676, 'interno', 0], [676, 756, 'parque', 12]]; const blocks: [number, number, number][] = [[36, 298, 6], [336, 644, 6]];
    cols.forEach(([x0, x1, cat, off]) => { let k = 1; blocks.forEach(([t, b, N]) => { const h = (b - t) / N; for (let i = 0; i < N; i++, k++) { const y0 = t + i * h, y1 = y0 + h;
      mkLot('C-' + String(k + off).padStart(2, '0'), 'C', cat, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], (x0 + x1) / 2, (y0 + y1) / 2 + 3); } }); }); }
  const L = (id: string) => lots.find(l => l.id === id)!;

  Object.assign(L('A-18'), { status: 'bloqueado', statusReason: 'Reservado por la desarrolladora para uso institucional' });
  Object.assign(L('C-12'), { status: 'bloqueado', statusReason: 'Servidumbre de paso en revisión' });
  Object.assign(L('B-30'), { status: 'regularizacion', statusReason: 'Rectificación de mensura pendiente' });
  Object.assign(L('B-12'), { front: null, depth: null, notes: 'Mensura recibida sin frente y fondo cargados.' });
  const pSold: Record<Category, number> = { ribera: .6, vista: .5, parque: .42, interno: .36 };
  const keepFree = new Set(['A-04', 'A-07', 'A-11', 'A-15', 'B-03', 'B-05', 'B-21', 'B-26', 'C-02', 'C-15', 'C-20', 'C-08', 'B-12', 'A-02', 'B-10', 'C-17']);
  lots.forEach(l => { if (l.status === 'disponible' && !keepFree.has(l.id) && rng() < pSold[l.category]) l.status = 'vendido'; });

  /* ---- Personas (compradores) ---- */
  const used = new Set<string>(); const person = () => { let n; do { n = pick(FIRST) + ' ' + pick(LAST) + ' ' + pick(LAST); } while (used.has(n)); used.add(n); return n; };
  const buyers: Buyer[] = []; let bseq = 1;
  const mkBuyer = () => { const name = person(); const b: Buyer = { id: 'CL-' + String(bseq++).padStart(3, '0'), name, email: slug(name) + '.' + String(bseq) + '@ejemplo.com', phone: '+595 000 000 ' + String(100 + bseq), pref: rng() < .7 ? 'WhatsApp' : 'Correo', optOut: false }; buyers.push(b); return b; };

  /* ---- Contratos firmados para lotes vendidos ---- */
  const contracts: Contract[] = [], payments: Payment[] = [], ledger: LedgerEntry[] = [], bank: BankEntry[] = [], audit: AuditEntry[] = [], promises: PromiseToPay[] = [];
  let cseq = 1, pseq = 1, lseq = 1, bseq2 = 1;
  const pg = () => 'PG-' + String(pseq++).padStart(5, '0');
  const mv = () => 'MV-' + String(lseq++).padStart(5, '0');
  const bk = () => 'BK-' + String(bseq2++).padStart(4, '0');
  const priceAt = (lot: Lot, date: string) => { let p = lot.priceHistory[0].priceC; lot.priceHistory.forEach(h => { if (h.date <= date) p = h.priceC; }); return p; };
  lots.filter(l => l.status === 'vendido').forEach((lot, idx) => {
    const b = mkBuyer();
    const signed = D.add(T, idx === 1 ? -RI(6, 12) : idx === 4 ? -RI(16, 26) : -RI(32, 860));
    const disc = pick([0, 0, 0, .02, .03]);
    const priceC = Math.round(priceAt(lot, signed) * (1 - disc) / 10000) * 10000;
    const rate = (idx % 5 === 2) ? .08 : 0;
    const plan = makePlan({ priceC, downPct: pick([20, 25, 30, 30, 40]), n: pick([36, 48, 48, 60, 72]), rate, firstDue: D.addM(signed, 1, 10) });
    const id = 'VLC-' + String(cseq++).padStart(4, '0');
    let beh = 'puntual';
    if (idx % 9 === 3) beh = 'moroso_alto'; else if (idx % 9 === 7) beh = 'moroso'; else if (idx % 7 === 5) beh = 'tardio'; else if (idx % 11 === 4) beh = 'parcial';
    contracts.push({
      id, lotId: lot.id, buyerId: b.id, priceC, status: 'firmado', created: D.add(signed, -4), signedDate: signed, signMode: 'Firma física · acta escaneada', advisorId: ADVISORS[idx % 4].id, plan, behavior: beh,
      docs: [{ name: 'Contrato de compraventa', v: 1, date: signed }, { name: 'Plan de financiación (anexo I)', v: 1, date: signed }, { name: 'Cédula del comprador', v: 1, date: D.add(signed, -5) }, { name: 'Plano del lote (anexo II)', v: 1, date: signed }],
      followUp: FIN_OWNERS[idx % 2], disputed: null,
    });
    lot.holderId = b.id; lot.contractId = id; lot.version++;
    const pay0: Payment = { id: pg(), contractId: id, date: signed, amountC: plan.downC, method: 'Transferencia', ref: `${id} ENTRADA`, status: 'confirmado', source: 'Administración', kind: 'entrada', by: 'Laura Méndez', approvedBy: 'Laura Méndez' };
    payments.push(pay0); ledger.push({ id: mv(), contractId: id, date: signed, type: 'entrada', amountC: plan.downC, ref: pay0.ref, paymentId: pay0.id, by: 'Laura Méndez', approvedBy: 'Laura Méndez', note: 'Entrada contractual' });
    const dueRows = plan.installments.filter(i => i.due <= T);
    const unpaidTail = beh === 'moroso_alto' ? Math.min(dueRows.length, RI(4, 6)) : beh === 'moroso' ? Math.min(dueRows.length, RI(2, 3)) : 0;
    dueRows.forEach((ins, k) => {
      if (k >= dueRows.length - unpaidTail) return;
      const pd = beh === 'tardio' ? D.add(ins.due, RI(7, 24)) : D.add(ins.due, RI(-4, 3));
      if (pd > T) return;
      let amt = ins.amountC;
      if (beh === 'parcial' && k === dueRows.length - 1) amt = Math.round(ins.amountC * .5 / 100) * 100;
      const recent = D.diff(T, pd) <= 4;
      const p: Payment = { id: pg(), contractId: id, date: pd, amountC: amt, method: 'Transferencia', ref: `${id} CUOTA ${ins.n}`, status: recent ? 'en_revision' : 'confirmado', source: 'Banco', kind: 'cuota', by: 'Laura Méndez', approvedBy: recent ? null : 'Laura Méndez' };
      payments.push(p);
      if (!recent) ledger.push({ id: mv(), contractId: id, date: pd, type: 'pago', amountC: amt, ref: p.ref, paymentId: p.id, by: 'Laura Méndez', approvedBy: 'Laura Méndez', note: `Cuota ${ins.n}` });
    });
  });

  // Reversión histórica (cheque rechazado) + reposición
  { const c = contracts.find(c => c.behavior === 'puntual' && D.diff(T, c.signedDate!) > 300);
    if (c) { const p = payments.filter(p => p.contractId === c.id && p.kind === 'cuota' && p.status === 'confirmado' && D.diff(T, p.date) > 70 && D.diff(T, p.date) < 140)[0];
      if (p) { p.status = 'revertido'; p.method = 'Cheque'; const rd = D.add(p.date, 3);
        ledger.push({ id: mv(), contractId: c.id, date: rd, type: 'reversion', amountC: -p.amountC, ref: p.ref, paymentId: p.id, by: 'Laura Méndez', approvedBy: 'Dirección', note: 'Cheque rechazado por el banco (sin fondos)' });
        const np: Payment = { id: pg(), contractId: c.id, date: D.add(rd, 5), amountC: p.amountC, method: 'Transferencia', ref: p.ref + ' REPOSICIÓN', status: 'confirmado', source: 'Banco', kind: 'cuota', by: 'Laura Méndez', approvedBy: 'Laura Méndez' };
        payments.push(np); ledger.push({ id: mv(), contractId: c.id, date: np.date, type: 'pago', amountC: np.amountC, ref: np.ref, paymentId: np.id, by: 'Laura Méndez', approvedBy: 'Laura Méndez', note: 'Reposición de cheque rechazado' });
        audit.push({ ts: rd + 'T10:12:00', user: 'Laura Méndez', role: 'Administración financiera', action: 'Reversión de pago', entity: 'Pago', entityId: p.id, detail: `${usd2(p.amountC)} · ${c.id}`, reason: 'Cheque rechazado por el banco (sin fondos)' });
      } } }
  { const c = contracts.filter(c => c.behavior === 'puntual')[3];
    if (c) { const d = D.add(T, -48); ledger.push({ id: mv(), contractId: c.id, date: d, type: 'nota_credito', amountC: 30000, ref: 'NC interna 0007', by: 'Laura Méndez', approvedBy: 'Dirección', note: 'Bonificación por pago anticipado aprobada por Dirección' });
      audit.push({ ts: d + 'T16:40:00', user: 'Dirección General', role: 'Dirección', action: 'Aprobación de nota de crédito', entity: 'Contrato', entityId: c.id, detail: 'USD 300,00', reason: 'Bonificación por pago anticipado' }); } }
  const morosos = contracts.filter(c => c.behavior.startsWith('moroso'));
  if (morosos[0]) promises.push({ id: 'PR-001', contractId: morosos[0].id, date: D.add(T, 4), amountC: morosos[0].plan.installments[0].amountC * 2, note: 'Se comprometió a regularizar dos cuotas tras cobro de cosecha.', by: 'Laura Méndez', created: D.add(T, -3), status: 'vigente' });
  if (morosos[2]) promises.push({ id: 'PR-002', contractId: morosos[2].id, date: D.add(T, -2), amountC: morosos[2].plan.installments[0].amountC, note: 'Prometió transferencia el viernes.', by: 'Diego Ocampo', created: D.add(T, -9), status: 'incumplida' });
  const disp = contracts.find(c => c.behavior.startsWith('moroso') && c.plan.rate > 0) || morosos[1];
  if (disp) disp.disputed = { since: D.add(T, -12), reason: 'El comprador objeta el cálculo de intereses; en revisión con asesoría legal.' };

  /* ---- Extracto bancario (últimos 20 días) ---- */
  const bankFrom = D.add(T, -20);
  { const seen = new Set<string>(); const recent = payments.filter(p => p.kind === 'cuota' && p.status === 'confirmado' && contracts.find(c => c.id === p.contractId)!.behavior === 'puntual').sort((a, b) => a.date < b.date ? 1 : -1).filter(p => { if (seen.has(p.contractId)) return false; seen.add(p.contractId); return true; }).slice(0, 4);
    recent.forEach((p, i) => { p.status = 'en_revision'; p.approvedBy = null; p.date = D.add(T, -(1 + i)); const k = ledger.findIndex(e => e.paymentId === p.id); if (k >= 0) ledger.splice(k, 1); }); }
  payments.filter(p => p.date >= bankFrom && p.kind !== 'entrada').sort((a, b) => a.date < b.date ? -1 : 1).forEach(p => {
    if (p.status === 'confirmado') bank.push({ id: bk(), date: p.date, desc: 'TRANSF. RECIBIDA', ref: p.ref, amountC: p.amountC, status: 'conciliada', paymentId: p.id, approvedBy: 'Laura Méndez', approvedAt: p.date });
  });
  const pend = payments.filter(p => p.status === 'en_revision').sort((a, b) => a.date < b.date ? 1 : -1);
  pend.forEach((p, i) => {
    if (i === pend.length - 1) { p.source = 'Portal del propietario'; p.method = 'Transferencia (comprobante adjunto)'; p.by = 'Propietario'; return; }
    const bd = D.add(p.date, i % 2); bank.push({ id: bk(), date: bd > T ? T : bd, desc: 'TRANSF. RECIBIDA', ref: p.ref.replace(' CUOTA', ' CTA'), amountC: p.amountC, status: 'pendiente' });
  });
  if (pend.length > 1) { const p = pend[0]; bank.push({ id: bk(), date: p.date, desc: 'TRANSF. RECIBIDA', ref: p.ref.replace(' CUOTA', ' CTA'), amountC: p.amountC, status: 'pendiente' }); }
  if (morosos[1]) { const c = morosos[1]; bank.push({ id: bk(), date: D.add(T, -1), desc: 'DEPÓSITO EN VENTANILLA', ref: c.id, amountC: Math.round(c.plan.installments[0].amountC * .5 / 100) * 100, status: 'pendiente' }); }
  bank.push({ id: bk(), date: D.add(T, -2), desc: 'TRANSF. RECIBIDA 0045821', ref: '', amountC: 125000, status: 'pendiente' });
  bank.sort((a, b) => a.date < b.date ? 1 : -1);

  /* ---- Prospectos ---- */
  const prospects: Prospect[] = []; let qseq = 101;
  const histBy = (p: Prospect) => advName(p.advisorId);
  const mkProspect = (stage: Stage, extra: { category?: Category; last?: number } = {}) => {
    const name = person(); const adv = ADVISORS[qseq % 4];
    const cat: Category = extra.category || pick<Category>(['ribera', 'ribera', 'vista', 'parque', 'interno']);
    const created = D.add(T, -RI(stage === 'nuevo' ? 0 : 6, stage === 'nuevo' ? 3 : 120));
    const last = extra.last != null ? D.add(T, -extra.last) : D.add(T, -RI(0, 6));
    const src = pick(SOURCES);
    const budgetC = Math.round(({ ribera: R(95e3, 150e3), vista: R(50e3, 70e3), parque: R(48e3, 66e3), interno: R(32e3, 45e3) }[cat]) / 1000) * 100000;
    const q = STAGE_IX[stage] >= 2;
    const p: Prospect = {
      id: 'P-' + (qseq++), name, phone: '+595 000 000 ' + String(300 + qseq), email: '', source: src, advisorId: adv.id, created, firstResponseMin: RI(4, 300),
      interest: ({ ribera: 'Lote frente al lago para casa de fin de semana', vista: 'Lote con vista al lago para vivienda permanente', parque: 'Lote amplio cerca del club house', interno: 'Primer lote, prioriza financiación' })[cat],
      budgetC: q ? budgetC : null, category: q ? cat : null, location: q ? SECTOR[({ ribera: 'A', vista: 'B', interno: 'B', parque: 'C' } as const)[cat]] : '', horizon: q ? pick(HORIZON.slice(0, 3)) : null,
      stage, lastActivity: last, nextAction: null, visitDate: null, lotIds: [], lostReason: null, history: [], reached: stage,
    };
    p.history.push({ date: created, type: 'Ingreso', text: `Ingresó por ${src}.`, by: 'Sistema' });
    if (STAGE_IX[stage] >= 1 && stage !== 'perdido') p.history.push({ date: created, type: 'WhatsApp', text: 'Primer contacto, se envió brochure y lista de precios vigente.', by: adv.name });
    if (q && stage !== 'perdido') p.history.push({ date: D.add(created, 3), type: 'Llamada', text: 'Calificación: presupuesto y horizonte de compra confirmados.', by: adv.name });
    prospects.push(p); return p;
  };
  for (let i = 0; i < 4; i++) mkProspect('nuevo', { last: RI(0, 2) });
  for (let i = 0; i < 5; i++) mkProspect('contactado', { last: i === 1 ? 11 : RI(1, 5) });
  for (let i = 0; i < 5; i++) mkProspect('calificado', { last: i === 2 ? 9 : RI(1, 5) });
  for (let i = 0; i < 3; i++) { const p = mkProspect('visita_prog', { last: RI(1, 4) }); p.visitDate = D.add(T, i + 1); p.nextAction = { text: 'Confirmar visita y enviar ubicación', date: D.add(T, i) }; p.history.push({ date: D.add(T, -2), type: 'Visita', text: `Visita agendada para el ${D.fmt(p.visitDate)}.`, by: histBy(p) }); }
  for (let i = 0; i < 3; i++) { const p = mkProspect('visita_real', { last: i === 0 ? 13 : RI(1, 5) }); p.visitDate = D.add(T, -RI(2, 10)); p.history.push({ date: p.visitDate, type: 'Visita', text: 'Recorrió el desarrollo; interesado en dos lotes.', by: histBy(p) }); }
  const freeOf = (cat: Category) => lots.filter(l => l.status === 'disponible' && l.category === cat && l.front != null);
  const negs: Prospect[] = [];
  for (let i = 0; i < 4; i++) { const cat = (['ribera', 'vista', 'parque', 'ribera'] as Category[])[i]; const p = mkProspect('negociacion', { category: cat, last: i === 3 ? 8 : RI(0, 4) }); const cands = freeOf(cat); p.lotIds = [cands[(i * 2) % cands.length].id, cands[(i * 2 + 1) % cands.length].id]; p.visitDate = D.add(T, -RI(8, 20)); p.history.push({ date: D.add(T, -RI(1, 6)), type: 'Reunión', text: `Negociando ${p.lotIds.join(' o ')}. Pidió plan con entrada del 30 %.`, by: histBy(p) }); p.nextAction = { text: 'Enviar propuesta de plan de pago', date: D.add(T, 1) }; negs.push(p); }

  /* ---- Reservas ---- */
  const reservations: Reservation[] = []; let rseq = 41;
  const resv = (cat: Category, status: Reservation['status'], createdAgo: number, stage: Stage = 'reserva') => {
    const lot = freeOf(cat).find(l => !negs.some(n => n.lotIds.includes(l.id)) && !keepFree.has(l.id)) || freeOf(cat).find(l => !negs.some(n => n.lotIds.includes(l.id)))!;
    const p = mkProspect(stage, { category: cat, last: createdAgo });
    p.lotIds = [lot.id]; p.visitDate = D.add(T, -createdAgo - 6);
    const created = D.add(T, -createdAgo);
    const r: Reservation = {
      id: 'R-' + String(rseq++).padStart(4, '0'), lotId: lot.id, prospectId: p.id, priceC: lot.priceC, amountC: cat === 'ribera' ? 500000 : 200000, created, expires: D.add(created, 7), advisorId: p.advisorId, status, renewals: 0, approvedBy: status === 'pendiente_aprobacion' ? null : 'Gerencia comercial',
      conditions: 'Precio bloqueado por 7 días corridos. Si no se formaliza, el lote vuelve a disponible. Devolución de la seña según política aprobada.',
      docs: [{ k: 'ci', label: 'Cédula del comprador', ok: true }, { k: 'pago', label: 'Comprobante del pago de reserva', ok: status !== 'pendiente_aprobacion' }, { k: 'form', label: 'Formulario de reserva firmado', ok: createdAgo > 2 }],
    };
    lot.status = 'reservado'; lot.reservationId = r.id; lot.version++;
    p.history.push({ date: created, type: 'Reserva', text: `Reserva ${r.id} sobre ${lot.id} por ${usd(r.amountC)}.`, by: histBy(p) });
    reservations.push(r); return { r, p, lot };
  };
  resv('ribera', 'vigente', 6); resv('ribera', 'vigente', 2); resv('vista', 'vigente', 5); resv('parque', 'pendiente_aprobacion', 0); resv('interno', 'vigente', 7);
  ([['vista', 9], ['interno', 11]] as [Category, number][]).forEach(([cat, ago], i) => {
    const { r, p, lot } = resv(cat, 'convertida', ago, 'contrato');
    const b = mkBuyer(); b.name = p.name; b.fromProspect = p.id; b.email = slug(p.name) + '.' + b.id.slice(3) + '@ejemplo.com';
    const plan = makePlan({ priceC: r.priceC, downPct: 30, n: 60, rate: 0, firstDue: D.addM(T, 1, 10) });
    const id = 'VLC-' + String(cseq++).padStart(4, '0');
    contracts.push({ id, lotId: lot.id, buyerId: b.id, priceC: r.priceC, status: 'pendiente_firma', created: D.add(T, -ago + 3), signedDate: null, signMode: null, advisorId: p.advisorId, plan, behavior: 'nuevo', reservationId: r.id,
      docs: [{ name: 'Contrato de compraventa (borrador)', v: i === 0 ? 2 : 1, date: D.add(T, -ago + 3) }, { name: 'Plan de financiación (anexo I)', v: 1, date: D.add(T, -ago + 3) }, { name: 'Cédula del comprador', v: 1, date: D.add(T, -ago) }], followUp: FIN_OWNERS[i], disputed: null });
    r.contractId = id; lot.contractId = id; lot.holderId = b.id;
    p.history.push({ date: D.add(T, -ago + 3), type: 'Contrato', text: `Contrato ${id} generado, pendiente de firma.`, by: 'Gerencia comercial' });
  });
  reservations.push({ id: 'R-0039', lotId: 'B-05', prospectId: null, prospectName: '(prospecto perdido)', priceC: L('B-05').priceC, amountC: 200000, created: D.add(T, -30), expires: D.add(T, -23), advisorId: 'ADV2', status: 'cancelada', renewals: 0, approvedBy: 'Gerencia comercial', conditions: '', docs: [], closeReason: 'El comprador desistió; seña devuelta según política.' });
  reservations.push({ id: 'R-0040', lotId: 'C-15', prospectId: null, prospectName: '(prospecto perdido)', priceC: L('C-15').priceC, amountC: 200000, created: D.add(T, -21), expires: D.add(T, -14), advisorId: 'ADV3', status: 'vencida', renewals: 1, approvedBy: 'Gerencia comercial', conditions: '', docs: [], closeReason: 'Venció sin formalizar; lote liberado por automatización.' });

  contracts.filter(c => c.status === 'firmado' && D.diff(T, c.signedDate!) < 150).forEach(c => {
    const b = buyers.find(x => x.id === c.buyerId)!;
    const p = mkProspect('ganado', { last: D.diff(T, c.signedDate!), category: L(c.lotId).category }); p.name = b.name; p.lotIds = [c.lotId]; p.advisorId = c.advisorId; p.created = D.add(c.signedDate!, -RI(20, 70)); p.reached = 'ganado';
  });
  for (let i = 0; i < 5; i++) { const p = mkProspect('perdido', { last: RI(10, 60) }); p.lostReason = LOST_REASONS[i]; p.reached = (['contactado', 'calificado', 'visita_real', 'negociacion', 'reserva'] as Stage[])[i]; p.history.push({ date: p.lastActivity, type: 'Cierre', text: `Perdido: ${p.lostReason}.`, by: histBy(p) }); }
  prospects.forEach(p => { if (!p.nextAction && !['ganado', 'perdido', 'contrato'].includes(p.stage)) p.nextAction = { text: p.stage === 'nuevo' ? 'Primer contacto' : 'Seguimiento', date: D.add(p.lastActivity, 3) }; });

  /* ---- Solicitudes y comunicaciones del portal ---- */
  const requests: OwnerRequest[] = [];
  const owner0 = contracts.find(c => c.status === 'firmado' && c.behavior === 'puntual');
  if (owner0) requests.push({ id: 'SOL-018', contractId: owner0.id, buyerId: owner0.buyerId, type: 'Documentación', text: 'Solicito copia del plano de mensura de mi lote.', created: D.add(T, -8), status: 'abierta', updates: [{ date: D.add(T, -8), text: 'Recibida', by: 'Sistema' }] });
  const comms: Comm[] = [
    { id: 'COM-002', date: D.add(T, -5), title: 'Avance de obra: pavimento de Calle Los Sauces', text: 'Se completó el 70 % del pavimento. Los trabajos continúan de lunes a sábado de 7 a 17 h.', audience: 'Todos los propietarios', by: 'Dirección General' },
    { id: 'COM-001', date: D.add(T, -19), title: 'Corte programado de agua', text: 'El jueves de 9 a 12 h se realizará mantenimiento en la red interna del Sector Parque.', audience: 'Sector Parque', by: 'Dirección General' },
  ];

  /* ---- Agenda interna (las visitas y vencimientos se derivan de los registros) ---- */
  const events: AgendaEvent[] = [
    { id: 'EV-001', date: D.add(T, 1), time: '09:00', title: 'Reunión semanal comercial', kind: 'reunion', owner: 'Gerencia comercial', note: 'Revisar embudo y reservas que vencen en la semana.' },
    { id: 'EV-002', date: D.add(T, 3), time: '14:00', title: 'Inspección del pavimento — Calle Los Sauces', kind: 'obra', owner: 'Dirección General', note: 'Recorrido con la constructora sobre el avance del 70 %.' },
    { id: 'EV-003', date: D.add(T, 6), time: '10:30', title: 'Cierre mensual de cartera', kind: 'reunion', owner: 'Laura Méndez', note: 'Conciliación final e informe para Dirección.' },
  ];

  /* ---- Auditoría histórica ---- */
  audit.push({ ts: D.add(T, -62) + 'T09:05:00', user: 'Dirección General', role: 'Dirección', action: 'Actualización de lista de precios', entity: 'Lotes', entityId: '76 lotes', detail: 'Ajuste por avance de obra', reason: 'Aprobado en reunión de directorio' });
  contracts.filter(c => c.status === 'firmado').slice(-6).forEach(c => audit.push({ ts: c.signedDate + 'T15:30:00', user: 'Gerencia comercial', role: 'Gerencia comercial', action: 'Registro de firma de contrato', entity: 'Contrato', entityId: c.id, detail: `${c.lotId} · ${usd(c.priceC)}`, reason: 'Firma física con escribanía' }));
  reservations.filter(r => r.status === 'vigente').forEach(r => audit.push({ ts: r.created + 'T11:20:00', user: advName(r.advisorId), role: 'Asesor/a', action: 'Creación de reserva', entity: 'Reserva', entityId: r.id, detail: `${r.lotId} · ${usd(r.amountC)}`, reason: '' }));
  audit.push({ ts: D.add(T, -14) + 'T00:05:00', user: 'Automatización', role: 'Sistema', action: 'Liberación de lote por reserva vencida', entity: 'Lote', entityId: 'C-15', detail: 'Reserva R-0040 vencida', reason: 'Regla: reserva vencida sin formalizar' });
  audit.sort((a, b) => a.ts < b.ts ? 1 : -1);

  return {
    v: 2, T, generatedAt: new Date().toISOString(), lots, buyers, contracts, payments, ledger, bank, prospects, reservations, promises, requests, comms, audit,
    autoRuns: [
      { ts: D.add(T, -14) + 'T00:05:00', rule: 'AUT-02', result: 'ok', detail: 'R-0040 vencida → C-15 liberado' },
      { ts: D.add(T, -1) + 'T07:00:00', rule: 'AUT-04', result: 'ok', detail: 'Tareas de cobranza generadas para vencimientos de los próximos 5 días' },
      { ts: D.add(T, -1) + 'T07:00:02', rule: 'AUT-06', result: 'ok', detail: 'Alertas de oportunidades sin actividad recalculadas' },
    ],
    tasks: [], resolved: [], idem: {}, events,
    seq: { c: cseq, p: pseq, l: lseq, b: bseq2, r: rseq, q: qseq },
    collSeq: [
      { k: 'pre', off: -5, label: 'Recordatorio previo', channel: 'WhatsApp', on: true, tpl: 'Hola {nombre}, te recordamos que el {vence} vence la cuota {n} de tu lote {lote} por {importe}. Podés pagar por transferencia indicando la referencia {ref}.' },
      { k: 'd0', off: 0, label: 'Aviso de vencimiento', channel: 'WhatsApp', on: true, tpl: 'Hola {nombre}, hoy vence la cuota {n} de tu lote {lote} por {importe}. Si ya pagaste, ignorá este mensaje.' },
      { k: 'd3', off: 3, label: 'Notificación de atraso', channel: 'Correo', on: true, tpl: 'Estimado/a {nombre}: registramos un saldo vencido de {vencido} en tu cuenta del lote {lote}. Te pedimos regularizarlo o contactarnos para acordar una fecha.' },
      { k: 'd10', off: 10, label: 'Seguimiento de cobranza', channel: 'Llamada', on: true, tpl: 'Llamada de seguimiento: confirmar fecha de pago y registrar promesa.' },
      { k: 'd20', off: 20, label: 'Derivación a responsable', channel: 'Interno', on: true, tpl: 'Derivar a {responsable} para evaluación de acuerdo de pago.' },
    ],
    riskCfg: { atencion: 1, riesgo: 31, critico: 91 },
  };
}
