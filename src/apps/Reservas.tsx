import type { AppProps } from './registry';
import type { Contract, Reservation } from '../domain/types';
import { CTR_ST, FIN_OWNERS, RES_ST, catLabel } from '../domain/catalog';
import { makePlan } from '../domain/finance';
import { Server } from '../domain/server';
import { autoRun, can, commit, getBuyer, getContract, getLot, getProspect, getRes, log, me, role, st } from '../domain/store';
import { D, nf1, usd } from '../domain/util';
import { useDomain } from '../os/hooks';
import { openInsp } from '../os/nav';
import { openDialog, toast } from '../os/overlay';
import { Av, Btn, Empty, Field, Head, L, Note, Pill, ReasonField, REASON_ERR, reasonOf, Sec, Tabs, TR, useTab, val } from '../ui/kit';
import { PlanFields, readPlan } from '../ui/plan';

/* ——— Acciones sobre reservas y contratos ——— */

function openDocs(id: string) {
  const r = getRes(id); const ed = can('reserve') || can('approve_res');
  openDialog({
    title: `Documentación · ${id}`, submit: ed ? 'Guardar' : null,
    body: <>{r.docs.map(d => <label key={d.k} className="chk"><input type="checkbox" name="doc" value={d.k} defaultChecked={d.ok} disabled={!ed} /><span>{d.label}</span></label>)}<p className="meta">El contrato solo se genera con la documentación completa.</p></>,
    onSubmit: f => { const ok = f.getAll('doc').map(String); log('Actualización de documentación', 'Reserva', id, `${ok.length}/${r.docs.length} completos`); commit(() => { r.docs.forEach(d => { d.ok = ok.includes(d.k); }); }); },
  });
}

function approve(id: string) {
  const r = getRes(id); if (r.status !== 'pendiente_aprobacion') return;
  log('Aprobación de reserva', 'Reserva', r.id, `${r.lotId} · ${usd(r.priceC)}`);
  commit(S => { r.status = 'vigente'; r.approvedBy = me().user; getProspect(r.prospectId)?.history.push({ date: S.T, type: 'Reserva', text: `Reserva ${r.id} aprobada.`, by: me().user }); });
  toast(`Reserva ${r.id} aprobada. Vence el ${D.fmt(r.expires)}.`);
}

function openClose(id: string, mode: 'rechazada' | 'cancelada') {
  openDialog({
    title: `${mode === 'rechazada' ? 'Rechazar' : 'Cancelar'} reserva ${id}`, submit: mode === 'rechazada' ? 'Rechazar' : 'Cancelar reserva', danger: true,
    body: <><ReasonField /><p className="meta">{mode === 'rechazada' ? 'El lote vuelve a disponible en la misma operación.' : 'El lote vuelve a disponible. La devolución de la seña sigue la política que apruebe la empresa.'}</p></>,
    onSubmit: f => {
      const rs = reasonOf(f); if (!rs) return REASON_ERR;
      const r = getRes(id); const l = getLot(r.lotId);
      log(mode === 'rechazada' ? 'Rechazo de reserva' : 'Cancelación de reserva', 'Reserva', r.id, `${r.lotId} vuelve a disponible`, rs);
      commit(S => {
        r.status = 'cancelada'; r.closeReason = (mode === 'rechazada' ? 'Rechazada: ' : 'Cancelada: ') + rs;
        if (l.reservationId === r.id) { l.status = 'disponible'; l.reservationId = null; l.version++; }
        const p = getProspect(r.prospectId); if (p) { p.stage = 'negociacion'; p.history.push({ date: S.T, type: 'Reserva', text: `Reserva ${r.id} ${mode}: ${rs}`, by: me().user }); }
      });
      toast(`Reserva ${r.id} ${mode}. ${r.lotId} vuelve a estar disponible.`);
    },
  });
}

function openRenew(id: string) {
  const r = getRes(id);
  openDialog({
    title: `Renovar reserva ${id}`, submit: 'Renovar',
    body: <><p>Nuevo vencimiento: <b>{D.fmt(D.add(r.expires, 7))}</b>. Se permite una sola renovación.</p><ReasonField /></>,
    onSubmit: f => {
      const rs = reasonOf(f); if (!rs) return REASON_ERR;
      if (r.renewals >= 1) return 'La reserva ya fue renovada una vez.';
      const old = r.expires;
      log('Renovación de reserva', 'Reserva', r.id, `${D.fmt(old)} → ${D.fmt(D.add(old, 7))}`, rs);
      commit(() => { r.expires = D.add(r.expires, 7); r.renewals++; });
      toast(`Reserva renovada hasta el ${D.fmt(r.expires)}.`);
    },
  });
}

function openFormalize(id: string) {
  const r = getRes(id); const T = st().T;
  const miss = r.docs.filter(d => !d.ok).map(d => d.label);
  if (miss.length) return toast('Falta documentación: ' + miss.join(', ') + '.', true);
  const p = getProspect(r.prospectId);
  openDialog({
    title: `Formalizar ${r.id} · lote ${r.lotId}`, wide: true, submit: 'Generar contrato',
    body: <><p className="meta">Comprador: <b>{p ? p.name : '—'}</b>. El contrato queda pendiente de firma; el calendario se activa al registrar la firma.</p>
      <PlanFields init={{ price: r.priceC / 100, down: 30, n: 60, rate: 0, first: D.addM(T, 1, 10), round: 'centavo' }} /></>,
    onSubmit: f => {
      const v = readPlan(f);
      if (!(v.price >= 1000)) return 'Precio inválido.';
      if (!v.first || v.first <= T) return 'El primer vencimiento debe ser posterior a hoy.';
      if (v.rate < 0 || v.rate > 30) return 'Tasa fuera de rango.';
      const plan = makePlan({ priceC: Math.round(v.price * 100), downPct: v.down, n: v.n, rate: v.rate / 100, firstDue: v.first, rounding: v.round });
      if (plan.installments.reduce((s, i) => s + i.principalC, 0) !== plan.financedC) return 'El calendario no cuadra con el financiado. Revisá los parámetros.';
      let cid = '';
      commit(S => {
        const b = { id: 'CL-' + String(S.buyers.length + 1).padStart(3, '0'), name: p ? p.name : 'Comprador', email: 'pendiente@ejemplo.com', phone: p ? p.phone : '—', pref: 'WhatsApp' as const, optOut: false, fromProspect: p?.id };
        S.buyers.push(b);
        cid = 'VLC-' + String(S.seq.c++).padStart(4, '0'); const l = getLot(r.lotId);
        S.contracts.push({ id: cid, lotId: r.lotId, buyerId: b.id, priceC: plan.priceC, status: 'pendiente_firma', created: T, signedDate: null, signMode: null, advisorId: r.advisorId, plan, behavior: 'nuevo', reservationId: r.id,
          docs: [{ name: 'Contrato de compraventa (borrador)', v: 1, date: T }, { name: 'Plan de financiación (anexo I)', v: 1, date: T }, { name: 'Cédula del comprador', v: 1, date: r.created }], followUp: FIN_OWNERS[0], disputed: null });
        r.status = 'convertida'; r.contractId = cid; l.contractId = cid; l.holderId = b.id; l.version++;
        if (p) { p.stage = 'contrato'; p.lastActivity = T; p.history.push({ date: T, type: 'Contrato', text: `Contrato ${cid} generado (${v.down} % + ${v.n} cuotas).`, by: me().user }); }
        log('Generación de contrato', 'Contrato', cid, `${r.lotId} · ${usd(plan.priceC)} · ${v.down} % + ${v.n} cuotas${v.rate ? ' al ' + v.rate + ' %' : ''}`, 'Desde reserva ' + r.id);
      });
      toast(`Contrato ${cid} generado, pendiente de firma.`);
      setTimeout(() => openInsp('ctr', cid));
    },
  });
}

/** Registro de firma física (acta escaneada); activa el calendario y marca el lote como vendido. */
export function openSign(id: string) {
  const c = getContract(id); const T = st().T;
  openDialog({
    title: `Registrar firma · ${id}`, submit: 'Registrar firma',
    body: <>
      <div className="grid2"><Field label="Fecha de firma"><input type="date" name="date" defaultValue={T} max={T} required /></Field><Field label="Escribanía (opcional)"><input type="text" name="notary" maxLength={80} /></Field></div>
      <label className="chk"><input type="checkbox" name="acta" /><span>El acta de firma escaneada está adjunta al expediente.</span></label>
      <label className="chk"><input type="checkbox" name="down" defaultChecked /><span>Registrar la entrada de {usd(c.plan.downC)} como pago en revisión (se confirma al conciliar con el banco).</span></label>
      <Note>La firma digital no está integrada. No se marca ningún contrato como firmado digitalmente.</Note>
    </>,
    onSubmit: f => {
      const d = val(f, 'date'); if (!d || d > T) return 'La fecha de firma no puede ser futura.';
      if (!f.get('acta')) return 'Confirmá que el acta escaneada está adjunta al expediente.';
      if (c.plan.installments.reduce((s, i) => s + i.principalC, 0) !== c.plan.financedC) return 'El plan no cuadra; no se puede activar el calendario.';
      const down = !!f.get('down');
      commit(S => {
        const l = getLot(c.lotId);
        c.status = 'firmado'; c.signedDate = d; c.signMode = 'Firma física · acta escaneada' + (val(f, 'notary') ? ' · ' + val(f, 'notary') : '');
        c.docs.push({ name: 'Acta de firma (escaneada)', v: 1, date: d }); c.docs[0].name = 'Contrato de compraventa'; c.docs[0].v++; c.docs[0].date = d;
        l.status = 'vendido'; l.version++;
        const p = S.prospects.find(x => x.lotIds.includes(c.lotId) && x.stage === 'contrato'); if (p) { p.stage = 'ganado'; p.lastActivity = S.T; p.history.push({ date: S.T, type: 'Firma', text: `Contrato ${c.id} firmado.`, by: me().user }); }
        if (down) { const r = Server.registerPayment(S, { key: 'ENTRADA-' + c.id, contractId: c.id, date: d, amountC: c.plan.downC, ref: `${c.id} ENTRADA`, method: 'Transferencia', source: 'Administración', by: me().user, confirm: false }); r.payment.kind = 'entrada'; }
        autoRun('AUT-03', `${c.id}: calendario de ${c.plan.n} cuotas activado; ${c.lotId} vendido`);
        log('Registro de firma de contrato', 'Contrato', c.id, `${c.lotId} · ${usd(c.priceC)}`, 'Firma física con acta escaneada');
      });
      toast(`Contrato firmado. Calendario de ${c.plan.n} cuotas activado${down ? '; la entrada queda en revisión hasta conciliar' : ''}.`);
    },
  });
}

function Left({ r }: { r: Reservation }) {
  const d = D.diff(r.expires, st().T);
  return d < 0 ? <Pill cls="crit">Vencida hace {-d} d</Pill> : d === 0 ? <Pill cls="crit">Vence hoy</Pill> : d <= 2 ? <Pill cls="warn">{d} d</Pill> : <Pill cls="neutral" dot={false}>{d} d</Pill>;
}

export default function Reservas({ win }: AppProps) {
  const { S } = useDomain();
  const [ct, setCt] = useTab<'pend' | 'firm' | 'all'>(win, 'pend');
  const asesor = role() === 'asesor';
  const mine = (x: { advisorId: string }) => !asesor || x.advisorId === me().advisorId;
  const act = S.reservations.filter(r => ['vigente', 'pendiente_aprobacion'].includes(r.status) && mine(r)).sort((a, b) => a.expires < b.expires ? -1 : 1);
  const closed = S.reservations.filter(r => !['vigente', 'pendiente_aprobacion'].includes(r.status) && mine(r));
  const all = S.contracts.filter(mine);
  const nPend = all.filter(c => c.status === 'pendiente_firma').length, nFirm = all.filter(c => c.status === 'firmado').length;
  const ctrs: Contract[] = ct === 'pend' ? all.filter(c => c.status === 'pendiente_firma') : ct === 'firm' ? all.filter(c => c.status === 'firmado').sort((a, b) => a.signedDate! < b.signedDate! ? 1 : -1) : all;
  return <>
    <Head title="Reservas y contratos" lede="Una reserva bloquea el lote en el servidor apenas se solicita. Al formalizarla se genera el contrato con su plan de pagos, que se activa con la firma." />
    <Note><b>Supuestos de demo, a validar con Viva Lago:</b> vigencia de reserva 7 días corridos; una renovación de 7 días con aprobación de Gerencia comercial; seña USD 5.000 en ribera y USD 2.000 en el resto; al cancelar, el lote vuelve a disponible y la devolución sigue la política que apruebe la empresa. Las condiciones legales deben validarse con profesionales habilitados en Paraguay.</Note>
    <Sec title="Reservas activas" meta={`${act.length} · ordenadas por vencimiento`}>
      {act.length ? <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Reserva</th><th>Lote</th><th>Prospecto</th><th className="num">Precio acordado</th><th className="num">Seña</th><th>Vence</th><th>Documentación</th><th>Estado</th><th /></tr></thead>
        <tbody>{act.map(r => { const p = getProspect(r.prospectId); const dk = r.docs.filter(d => d.ok).length; return <tr key={r.id}>
          <td className="mono">{r.id}<span className="sub">{D.fmtS(r.created)} · <Av id={r.advisorId} /></span></td>
          <td><L kind="lot" id={r.lotId} /><span className="sub">{catLabel(getLot(r.lotId).category)}</span></td>
          <td>{p ? <L kind="prospect" id={p.id} mono={false}>{p.name}</L> : '—'}</td>
          <td className="num">{usd(r.priceC)}</td><td className="num">{usd(r.amountC)}</td>
          <td><Left r={r} /><span className="sub">{D.fmtS(r.expires)}{r.renewals ? ' · renovada' : ''}</span></td>
          <td><Btn sm kind={dk < r.docs.length ? '' : 'ghost'} onClick={() => openDocs(r.id)}>{dk}/{r.docs.length}</Btn></td>
          <td><Pill cls={RES_ST[r.status][1]}>{RES_ST[r.status][0]}</Pill></td>
          <td><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{r.status === 'pendiente_aprobacion'
            ? <><Btn sm kind="primary" perm="approve_res" onClick={() => approve(r.id)}>Aprobar</Btn><Btn sm perm="approve_res" onClick={() => openClose(r.id, 'rechazada')}>Rechazar</Btn></>
            : <><Btn sm kind="primary" perm="contracts_edit" onClick={() => openFormalize(r.id)}>Formalizar</Btn>{r.renewals < 1 && <Btn sm perm="approve_res" onClick={() => openRenew(r.id)}>Renovar</Btn>}<Btn sm kind="ghost" perm="approve_res" onClick={() => openClose(r.id, 'cancelada')}>Cancelar</Btn></>}</div></td>
        </tr>; })}</tbody></table></div> : <Empty>No hay reservas activas.</Empty>}
      {closed.length > 0 && <details className="resolved"><summary>Historial de reservas ({closed.length})</summary><div className="tbl-wrap" style={{ marginTop: 10 }}><table className="tbl"><thead><tr><th>Reserva</th><th>Lote</th><th>Creada</th><th>Estado</th><th>Detalle</th></tr></thead>
        <tbody>{closed.map(r => <tr key={r.id}><td className="mono">{r.id}</td><td className="mono">{r.lotId}</td><td>{D.fmt(r.created)}</td><td><Pill cls={RES_ST[r.status][1]}>{RES_ST[r.status][0]}</Pill></td><td>{r.closeReason || (r.contractId ? 'Contrato ' + r.contractId : '')}</td></tr>)}</tbody></table></div></details>}
    </Sec>
    <Sec title="Contratos" meta="Firma digital no integrada: se registra firma física con acta escaneada">
      <Tabs value={ct} onChange={setCt} items={[['pend', 'Pendientes de firma', nPend], ['firm', 'Firmados', nFirm], ['all', 'Todos', nPend + nFirm]]} />
      {ctrs.length ? <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Contrato</th><th>Lote</th><th>Comprador</th><th className="num">Precio</th><th>Plan</th><th>Estado</th><th>Firma</th><th /></tr></thead>
        <tbody>{ctrs.slice(0, 60).map(c => { const pl = c.plan; return <TR key={c.id} onOpen={() => openInsp('ctr', c.id)}>
          <td className="mono">{c.id}</td><td className="mono">{c.lotId}</td>
          <td>{can('holder') ? getBuyer(c.buyerId).name : <span className="muted">Reservado a perfiles autorizados</span>}</td>
          <td className="num">{usd(c.priceC)}</td>
          <td>{pl.downPct} % + {pl.n} × {usd(pl.installments[0].amountC)}<span className="sub">{pl.rate ? 'Sistema francés ' + nf1.format(pl.rate * 100) + ' %' : 'Sin interés'}</span></td>
          <td><Pill cls={CTR_ST[c.status][1]}>{CTR_ST[c.status][0]}</Pill></td>
          <td>{c.signedDate ? D.fmt(c.signedDate) : <span className="meta">generado hace {D.diff(S.T, c.created)} d</span>}</td>
          <td className="num" onClick={e => e.stopPropagation()}>{c.status === 'pendiente_firma' && <Btn sm kind="primary" perm="contracts_edit" onClick={() => openSign(c.id)}>Registrar firma</Btn>}</td>
        </TR>; })}</tbody></table></div> : <Empty>No hay contratos en esta vista.</Empty>}
      {ctrs.length > 60 && <p className="meta" style={{ marginTop: 6 }}>Mostrando 60 de {ctrs.length}.</p>}
    </Sec>
  </>;
}
