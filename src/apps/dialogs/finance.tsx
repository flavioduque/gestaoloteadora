import { dv, matchBank, type Match } from '../../domain/derive';
import { Server } from '../../domain/server';
import { autoRun, commit, getBuyer, getContract, log, me, nowTs, st } from '../../domain/store';
import type { BankEntry } from '../../domain/types';
import { D, uid, usd, usd2 } from '../../domain/util';
import { openDialog, toast } from '../../os/overlay';
import { Field, ReasonField, REASON_ERR, reasonOf, val } from '../../ui/kit';

/* Diálogos financieros compartidos por Finanzas y la ficha de cuenta. */

export function openPayNew(id?: string) {
  const S = st(), DV = dv();
  const cs = [...DV.accts.values()].map(a => a.c);
  const a = id ? DV.accts.get(id) : undefined;
  const sug = a ? (a.overdueRows[0] || a.next) : undefined;
  const key = uid('IDEM'); // generada al abrir: reenviar el mismo formulario no duplica
  openDialog({
    title: 'Registrar pago', submit: 'Registrar pago',
    body: <>
      <div className="grid2">
        <Field label="Contrato"><select name="ctr" defaultValue={id} disabled={!!id}>{cs.map(c => <option key={c.id} value={c.id}>{c.id} · {c.lotId} · {getBuyer(c.buyerId).name}</option>)}</select></Field>
        <Field label="Fecha valor"><input type="date" name="date" defaultValue={S.T} max={S.T} required /></Field>
        <Field label="Importe (USD)"><input type="number" name="amount" min={0.01} step={0.01} defaultValue={sug ? (sug.left / 100).toFixed(2) : ''} required /></Field>
        <Field label="Medio"><select name="method"><option>Transferencia</option><option>Depósito</option><option>Cheque</option><option>Efectivo en caja</option></select></Field>
        <Field label="Referencia"><input type="text" name="ref" defaultValue={id && sug ? `${id} CUOTA ${sug.n}` : ''} required maxLength={60} /></Field>
        <Field label="Estado inicial"><select name="st"><option value="rev">En revisión: se confirma al conciliar</option><option value="conf">Confirmado: verificado en el banco</option></select></Field>
      </div>
      <Field label="N.º de operación bancaria (obligatorio si se confirma)"><input type="text" name="op" maxLength={40} /></Field>
      <p className="meta">El pago se aplica a las cuotas más antiguas. Un reintento con esta misma solicitud no crea un pago duplicado.</p>
    </>,
    onSubmit: f => {
      const ctr = id || val(f, 'ctr'); const amount = +val(f, 'amount'); const d = val(f, 'date'); const ref = val(f, 'ref'); const conf = val(f, 'st') === 'conf';
      if (!(amount > 0)) return 'Ingresá un importe mayor a cero.';
      if (!d || d > st().T) return 'La fecha valor no puede ser futura.';
      if (ref.length < 3) return 'Ingresá una referencia.';
      if (conf && val(f, 'op').length < 4) return 'Para confirmar sin conciliación automática, indicá el número de operación bancaria verificado.';
      const r = Server.registerPayment(st(), { key, contractId: ctr, date: d, amountC: Math.round(amount * 100), ref: ref + (conf ? ' · OP ' + val(f, 'op') : ''), method: val(f, 'method'), source: 'Administración', by: me().user, confirm: conf });
      if (r.duplicate) { toast('Esta solicitud ya había sido registrada; no se creó un pago duplicado.', true); return; }
      log('Registro de pago', 'Pago', r.payment.id, `${ctr} · ${usd2(r.payment.amountC)} · ${conf ? 'confirmado' : 'en revisión'}`, conf ? 'Operación bancaria ' + val(f, 'op') : '');
      if (conf) autoRun('AUT-05', `${r.payment.id} aplicado a ${ctr}`);
      commit();
      toast(conf ? `Pago ${r.payment.id} confirmado y aplicado.` : `Pago ${r.payment.id} registrado en revisión. Se confirma al conciliar con el banco.`);
    },
  });
}

export function openReverse(id: string) {
  const p = st().payments.find(x => x.id === id)!;
  openDialog({
    title: `Revertir pago ${id}`, submit: 'Revertir pago', danger: true,
    body: <><p>{usd2(p.amountC)} del {D.fmt(p.date)} · {p.ref}</p><p className="meta">El pago original queda en el libro. Se agrega un movimiento de reversión por el mismo importe y el saldo de la cuenta vuelve a aumentar.</p><ReasonField /></>,
    onSubmit: f => {
      const rs = reasonOf(f); if (!rs) return REASON_ERR;
      const r = Server.reversePayment(st(), { paymentId: id, reason: rs, by: me().user }); if (!r.ok) return r.error;
      log('Reversión de pago', 'Pago', id, `${usd2(p.amountC)} · ${p.contractId}`, rs); commit();
      toast(`Pago ${id} revertido. El saldo de ${p.contractId} se recalculó.`);
    },
  });
}

export function openPromise(id: string) {
  const a = dv().accts.get(id)!; const T = st().T;
  openDialog({
    title: `Promesa de pago · ${id}`, submit: 'Registrar promesa',
    body: <><div className="grid2">
      <Field label="Fecha comprometida"><input type="date" name="date" min={T} defaultValue={D.add(T, 5)} required /></Field>
      <Field label="Importe (USD)"><input type="number" name="amount" min={1} step={0.01} defaultValue={(a.overdueC || (a.next ? a.next.left : 0)) / 100} required /></Field>
    </div><Field label="Detalle"><textarea name="note" required placeholder="Qué se acordó y por qué medio" /></Field></>,
    onSubmit: f => {
      const d = val(f, 'date'); const am = +val(f, 'amount'); const note = val(f, 'note');
      if (!d || d < st().T) return 'La fecha debe ser hoy o posterior.';
      if (!(am > 0)) return 'Importe inválido.';
      if (note.length < 5) return 'Describí lo acordado.';
      log('Registro de promesa de pago', 'Contrato', id, `${usd(am * 100)} para el ${D.fmt(d)}`, note);
      commit(S => { S.promises.filter(p => p.contractId === id && p.status === 'vigente').forEach(p => { p.status = 'reemplazada'; }); S.promises.push({ id: uid('PR'), contractId: id, date: d, amountC: Math.round(am * 100), note, by: me().user, created: S.T, status: 'vigente' }); });
      toast('Promesa registrada.');
    },
  });
}

export function openDispute(id: string) {
  const c = getContract(id);
  openDialog({
    title: c.disputed ? `Quitar disputa · ${id}` : `Marcar en disputa · ${id}`, submit: 'Confirmar',
    body: <><p className="meta">{c.disputed ? 'La deuda vuelve a computarse como mora y se reanudan las comunicaciones de cobranza.' : 'Mientras esté en disputa, la deuda no se computa como mora confirmada y se suspenden los mensajes de cobranza.'}</p><ReasonField /></>,
    onSubmit: f => {
      const rs = reasonOf(f); if (!rs) return REASON_ERR;
      if (c.disputed) log('Fin de disputa', 'Contrato', c.id, '', rs); else log('Deuda marcada en disputa', 'Contrato', c.id, '', rs);
      commit(() => { c.disputed = c.disputed ? null : { since: st().T, reason: rs }; });
    },
  });
}

export function openPayReject(id: string) {
  openDialog({
    title: `Rechazar pago informado ${id}`, submit: 'Rechazar', danger: true,
    body: <ReasonField label="Motivo" ph="Por ejemplo: no se encontró el movimiento en el banco después de 5 días hábiles" />,
    onSubmit: f => {
      const rs = reasonOf(f); if (!rs) return REASON_ERR;
      const p = st().payments.find(x => x.id === id)!;
      log('Rechazo de pago informado', 'Pago', p.id, `${usd2(p.amountC)} · ${p.contractId}`, rs);
      commit(() => { p.status = 'rechazado'; }); toast(`Pago ${p.id} rechazado.`);
    },
  });
}

/* ---- Conciliación ---- */
function doBankConfirm(b: BankEntry, m: Match, note?: string) {
  const r = Server.confirmPayment(st(), { paymentId: m.payment!.id, bankId: b.id, by: me().user });
  if (!r.ok) { toast(r.error, true); return; }
  log('Conciliación de pago', 'Pago', m.payment!.id, `${b.id} · ${usd2(b.amountC)} → ${m.payment!.contractId}`, note || ('Coincidencia ' + m.conf + ': ' + m.why.join(', ')));
  autoRun('AUT-05', `${m.payment!.id} aplicado a ${m.payment!.contractId}`);
  commit(); toast(`Pago ${m.payment!.id} confirmado y aplicado a ${m.payment!.contractId}.`);
}
function doBankCreate(b: BankEntry, contractId: string, note: string) {
  const r = Server.registerPayment(st(), { key: 'BANK-' + b.id, contractId, date: b.date, amountC: b.amountC, ref: b.ref || b.desc, method: 'Transferencia', source: 'Banco', by: me().user, confirm: true });
  if (r.duplicate) { toast('Este movimiento ya generó un pago.', true); return; }
  Object.assign(b, { status: 'conciliada', paymentId: r.payment.id, approvedBy: me().user, approvedAt: nowTs() });
  log('Conciliación con creación de pago', 'Pago', r.payment.id, `${b.id} · ${usd2(b.amountC)} → ${contractId}`, note);
  autoRun('AUT-05', `${r.payment.id} aplicado a ${contractId}`);
  commit(); toast(`Pago ${r.payment.id} creado y aplicado a ${contractId}.`);
}

export function bankConfirm(id: string) {
  const b = st().bank.find(x => x.id === id)!; const m = matchBank(b); if (!m.payment) return;
  if (!m.dup) return doBankConfirm(b, m);
  openDialog({
    title: 'Posible duplicado', submit: 'Aplicar este movimiento',
    body: <><p>Hay otro movimiento con el mismo importe, referencia y fecha. Confirmá con el banco que se trata de dos acreditaciones distintas antes de aplicar.</p><ReasonField label="Verificación realizada" ph="Por ejemplo: el banco confirmó una sola acreditación; se aplica esta y se descarta la otra" /></>,
    onSubmit: f => { const rs = reasonOf(f); if (!rs) return REASON_ERR; const mm = matchBank(b); if (!mm.payment) return 'La sugerencia ya no está disponible.'; doBankConfirm(b, mm, rs); },
  });
}
export function bankCreate(id: string) {
  const b = st().bank.find(x => x.id === id)!; const m = matchBank(b); if (!m.create) return;
  doBankCreate(b, m.contractId!, 'Referencia ' + m.contractId);
}
export function bankAssign(id: string) {
  const b = st().bank.find(x => x.id === id)!;
  openDialog({
    title: `Asignar movimiento ${id}`, submit: 'Asignar y conciliar',
    body: <><p>{b.desc} · {usd2(b.amountC)} · {D.fmt(b.date)}</p>
      <Field label="Contrato"><select name="ctr">{[...dv().accts.values()].map(a => <option key={a.c.id} value={a.c.id}>{a.c.id} · {a.c.lotId} · {getBuyer(a.c.buyerId).name}{a.overdueC ? ` · vencido ${usd(a.overdueC)}` : ''}</option>)}</select></Field>
      <ReasonField label="Cómo se identificó al pagador" ph="Por ejemplo: el banco informó el titular de la cuenta de origen" /></>,
    onSubmit: f => { const rs = reasonOf(f); if (!rs) return REASON_ERR; doBankCreate(b, val(f, 'ctr'), rs); },
  });
}
export function bankDiscard(id: string) {
  openDialog({
    title: `Descartar movimiento ${id}`, submit: 'Descartar', danger: true,
    body: <><p className="meta">El movimiento queda registrado como descartado, con motivo y responsable.</p><ReasonField /></>,
    onSubmit: f => {
      const rs = reasonOf(f); if (!rs) return REASON_ERR; const b = st().bank.find(x => x.id === id)!;
      log('Movimiento bancario descartado', 'Extracto', b.id, usd2(b.amountC), rs);
      commit(() => Object.assign(b, { status: 'descartada', discardReason: rs, approvedBy: me().user, approvedAt: nowTs() }));
      toast(`Movimiento ${b.id} descartado.`);
    },
  });
}
