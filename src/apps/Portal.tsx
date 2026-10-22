import { useState } from 'react';
import type { AppProps } from './registry';
import { SECTOR, catLabel } from '../domain/catalog';
import { planMethod } from '../domain/finance';
import { Server } from '../domain/server';
import { commit, getBuyer, getContract, getLot, log, me, nowTs, role, st } from '../domain/store';
import { D, m2, uid, usd2, usdK } from '../domain/util';
import { useDomain } from '../os/hooks';
import { Mono } from '../os/icons';
import { openDialog, toast } from '../os/overlay';
import { Box, Btn, DL, Field, Lnk, Note, Pill, Timeline, val } from '../ui/kit';
import { ScheduleTable } from '../ui/plan';

const ownerAudit = (contractId: string, action: string, entity: string, entityId: string, detail: string, reason = '') =>
  st().audit.unshift({ ts: nowTs(), user: getBuyer(getContract(contractId).buyerId).name, role: 'Propietario', action, entity, entityId, detail, reason });

export default function Portal(_: AppProps) {
  const { S, DV } = useDomain();
  const owners = S.contracts.filter(c => c.status === 'firmado');
  const [sel, setSel] = useState<string>(() => (owners.find(c => { const a = DV.accts.get(c.id)!; return a.overdueC === 0 && a.next && D.diff(a.next.due, S.T) <= 25 && a.paidN >= 3; }) || owners[0]).id);
  const cid = owners.some(o => o.id === sel) ? sel : owners[0].id;
  const c = getContract(cid), b = getBuyer(c.buyerId), l = getLot(c.lotId), a = DV.accts.get(c.id)!;
  const pays = S.payments.filter(p => p.contractId === c.id && p.status !== 'rechazado').sort((x, y) => x.date < y.date ? 1 : -1);
  const reqs = S.requests.filter(r => r.contractId === c.id);
  const upcoming = a.rows.filter(r => r.left > 0).slice(0, 6);
  const isOwner = role() === 'propietario';

  const pay = () => { const sug = a.overdueRows[0] || a.next; const key = uid('PORTAL'); openDialog({
    title: 'Informar un pago', submit: 'Enviar aviso',
    body: <><div className="grid2"><Field label="Fecha del pago"><input type="date" name="date" defaultValue={S.T} max={S.T} required /></Field>
      <Field label="Importe (USD)"><input type="number" name="amount" min={0.01} step={0.01} defaultValue={sug ? (sug.left / 100).toFixed(2) : ''} required /></Field></div>
      <Field label="Referencia u operación bancaria"><input type="text" name="ref" required maxLength={60} defaultValue={`${c.id} CUOTA ${sug ? sug.n : ''}`} /></Field>
      <Field label="Comprobante (opcional)"><input type="file" name="file" accept="image/*,.pdf" /></Field>
      <p className="meta">Tu pago se verifica contra el extracto bancario. Hasta entonces figura “En verificación” y no cambia tu saldo.</p></>,
    onSubmit: f => {
      const am = +val(f, 'amount'), d = val(f, 'date'), ref = val(f, 'ref');
      if (!(am > 0)) return 'Ingresá el importe.'; if (!d || d > st().T) return 'La fecha no puede ser futura.'; if (ref.length < 3) return 'Ingresá la referencia bancaria.';
      const file = f.get('file'); const has = file instanceof File && file.size > 0;
      const r = Server.registerPayment(st(), { key, contractId: c.id, date: d, amountC: Math.round(am * 100), ref, method: 'Transferencia' + (has ? ' (comprobante adjunto)' : ''), source: 'Portal del propietario', by: 'Propietario', confirm: false });
      if (r.duplicate) { toast('Ese aviso ya fue enviado.', true); return; }
      ownerAudit(c.id, 'Aviso de pago desde el portal', 'Pago', r.payment.id, `${usd2(r.payment.amountC)} · ${c.id}`, has ? 'Comprobante adjunto' : '');
      commit(); toast('Recibimos tu aviso. Lo verificamos con el banco y te avisamos cuando se acredite.');
    } }); };

  const sched = () => openDialog({ title: 'Calendario completo', wide: true, submit: null, body: <><p className="meta">{planMethod(c.plan)}</p><ScheduleTable rows={a.rows} /></> });

  const receipt = (pid: string) => { const p = S.payments.find(x => x.id === pid)!; openDialog({ title: 'Comprobante interno', submit: null,
    body: <div className="ficha"><div className="ficha-top"><div><div className="cat">Comprobante interno de pago</div><div className="id" style={{ fontSize: 28 }}>{p.id}</div></div><Mono /></div>
      <div className="ficha-b"><DL items={[['Titular', b.name], ['Lote', c.lotId], ['Contrato', c.id], ['Fecha', D.fmt(p.date)], ['Importe', usd2(p.amountC)], ['Referencia', p.ref], ['Medio', p.method], ['Conciliado por', p.approvedBy || '—']]} />
        <p className="meta">Este comprobante no es una factura fiscal.</p></div></div> }); };

  const newReq = () => openDialog({ title: 'Nueva solicitud', submit: 'Enviar solicitud',
    body: <><Field label="Tipo"><select name="type"><option>Administrativa</option><option>Documentación</option><option>Infraestructura</option><option>Plan de pagos</option><option>Otra</option></select></Field>
      <Field label="Detalle"><textarea name="text" required maxLength={500} /></Field></>,
    onSubmit: f => { const t = val(f, 'text'); if (t.length < 5) return 'Contanos un poco más.';
      const id = 'SOL-' + String(19 + st().requests.length).padStart(3, '0');
      ownerAudit(c.id, 'Nueva solicitud', 'Solicitud', id, val(f, 'type'));
      commit(S => S.requests.push({ id, contractId: c.id, buyerId: c.buyerId, type: val(f, 'type'), text: t, created: S.T, status: 'abierta', updates: [{ date: S.T, text: 'Recibida', by: 'Sistema' }] }));
      toast(`Solicitud ${id} enviada.`); } });

  const contact = () => openDialog({ title: 'Actualizar datos de contacto', submit: 'Guardar',
    body: <><div className="grid2"><Field label="Correo"><input type="email" name="email" defaultValue={b.email} required /></Field><Field label="Teléfono"><input type="tel" name="phone" defaultValue={b.phone} required /></Field>
      <Field label="Canal preferido"><select name="pref" defaultValue={b.pref}><option>WhatsApp</option><option>Correo</option></select></Field></div>
      <label className="chk"><input type="checkbox" name="opt" defaultChecked={!b.optOut} /><span>Acepto recibir recordatorios de vencimiento</span></label>
      <p className="meta">Los cambios de correo y teléfono quedan pendientes hasta que la administración los verifique.</p></>,
    onSubmit: f => { const em = val(f, 'email'), ph = val(f, 'phone');
      if (!/^\S+@\S+\.\S+$/.test(em)) return 'Correo inválido.'; if (!/^[+\d\s()-]{6,}$/.test(ph)) return 'Teléfono inválido.';
      commit(() => { b.pref = val(f, 'pref') as 'WhatsApp' | 'Correo'; b.optOut = !f.get('opt'); if (em !== b.email || ph !== b.phone) b.pendingChange = { date: st().T, email: em, phone: ph }; });
      ownerAudit(c.id, 'Actualización de datos de contacto', 'Cliente', b.id, `Canal ${b.pref}; recordatorios ${b.optOut ? 'desactivados' : 'activados'}`, b.pendingChange ? 'Cambio de correo/teléfono pendiente de verificación' : '');
      commit(); toast('Datos guardados.'); } });

  const open = reqs.find(r => r.status === 'abierta');
  return <>
    <div className="owner-pick">
      {!isOwner && <Pill cls="info" dot={false}>Vista previa</Pill>}
      <label className="meta" htmlFor="own-sel">{isOwner ? 'Demo: elegí el propietario' : 'Ver como el propietario de'}</label>
      <select id="own-sel" value={cid} onChange={e => setSel(e.target.value)}>{owners.map(o => <option key={o.id} value={o.id}>{o.lotId} · {getBuyer(o.buyerId).name}</option>)}</select>
      {!isOwner && <span className="meta">En producción cada propietario ingresa con su cuenta y solo ve sus datos.</span>}
    </div>
    <div className="portal">
      <div className="portal-hero">
        <svg className="waves" width="320" height="200" viewBox="0 0 320 200" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1.2">{[0, 1, 2, 3, 4, 5, 6].map(i => <path key={i} d={`M0 ${40 + i * 22} c40 -16 80 16 120 0 s80 16 120 0 s80 16 120 0`} />)}</g></svg>
        <div><p className="sub">Viva Lago Country · Portal del propietario</p><h1>Hola, {b.name.split(' ')[0]}</h1><p className="sub">Lote {l.id} · {catLabel(l.category)} · {SECTOR[l.sector]} · {m2(l.area)}</p></div>
        <div className="row">
          <div><div className="l">Contrato</div><div className="v">Firmado</div><div className="sub">{D.fmt(c.signedDate)}</div></div>
          <div><div className="l">Próximo vencimiento</div><div className="v">{a.next ? D.fmtS(a.next.due) : '—'}</div><div className="sub">{a.next ? usd2(a.next.left) : 'Plan cancelado'}</div></div>
          <div><div className="l">Saldo pendiente</div><div className="v">{usdK(a.outstandingC)}</div><div className="sub">{a.overdueC ? <span style={{ color: '#F1C9BC' }}>{usd2(a.overdueC)} vencidos</span> : 'Al día'}</div></div>
          <div><div className="l">Cuotas</div><div className="v">{a.paidN} / {c.plan.n}</div><div className="progress" style={{ marginTop: 8 }}><i style={{ width: `${Math.round(a.paidN / c.plan.n * 100)}%` }} /></div></div>
        </div>
      </div>
      {a.overdueC > 0 && <Note><b>Tenés {usd2(a.overdueC)} vencidos.</b> Si ya pagaste, informá el pago y lo verificamos con el banco. Si necesitás un plan para regularizar, escribinos desde Solicitudes.</Note>}
      <div className="portal-grid">
        <Box><h2 className="h3">Próximas cuotas</h2><span className="meta">Plan: {c.plan.downPct} % de entrada y {c.plan.n} cuotas {c.plan.rate ? 'con interés' : 'sin interés'}</span>
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th className="num">Cuota</th><th>Vence</th><th className="num">Importe</th><th>Estado</th></tr></thead><tbody>
            {upcoming.map(r => <tr key={r.n}><td className="num">{r.n}</td><td>{D.fmt(r.due)}</td><td className="num">{usd2(r.left)}</td>
              <td className={r.st.includes('vencida') ? 'st-vencida' : r.st.startsWith('parcial') ? 'st-parcial' : 'st-pendiente'}>{r.st.includes('vencida') ? 'Vencida' : r.st.startsWith('parcial') ? 'Pago parcial' : 'Pendiente'}</td></tr>)}
            {!upcoming.length && <tr><td colSpan={4} className="empty">No quedan cuotas pendientes.</td></tr>}
          </tbody></table></div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}><Btn kind="primary" onClick={pay}>Informar un pago</Btn><Btn kind="ghost" onClick={sched}>Ver calendario completo</Btn></div>
        </Box>
        <Box><h2 className="h3">Pagos y comprobantes</h2><span className="meta">Comprobantes internos · no son facturas fiscales</span>
          <Timeline items={pays.slice(0, 7).map(p => [D.fmtS(p.date), <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span>{usd2(p.amountC)} · {p.kind === 'entrada' ? 'Entrada' : 'Cuota'} {p.status === 'en_revision' ? <Pill cls="warn">En verificación</Pill> : p.status === 'revertido' ? <Pill cls="neutral">Revertido</Pill> : null}</span>
            {p.status === 'confirmado' && <Lnk onClick={() => receipt(p.id)}>Comprobante</Lnk>}</span>])} />
        </Box>
      </div>
      <div className="portal-grid">
        <Box><h2 className="h3">Solicitudes a la administración</h2><span className="meta">{reqs.filter(r => r.status === 'abierta').length} abiertas</span>
          {reqs.length ? <Timeline items={reqs.map(r => [r.id, <><b>{r.type}</b> · {r.text} <Pill cls={r.status === 'abierta' ? 'warn' : 'ok'}>{r.status === 'abierta' ? 'Abierta' : 'Respondida'}</Pill>{r.updates.length > 1 && <><br /><span className="muted">{r.updates[r.updates.length - 1].text}</span></>}</>])} /> : <p className="meta">No tenés solicitudes.</p>}
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}><Btn onClick={newReq}>Nueva solicitud</Btn>{!isOwner && open && <Btn kind="ghost" onClick={() => openReqAnswer(open.id)}>Responder (administración)</Btn>}</div>
        </Box>
        <Box><h2 className="h3">Comunicaciones del desarrollo</h2><span className="meta">Publicadas por la administración</span>
          <Timeline items={S.comms.map(m => [D.fmtS(m.date), <><b>{m.title}</b><br /><span className="muted">{m.text}</span></>])} /></Box>
      </div>
      <div className="portal-grid">
        <Box><h2 className="h3">Mis datos de contacto</h2><div style={{ marginTop: 8 }}><DL items={[['Correo', <span className="mono">{b.email}</span>], ['Teléfono', <span className="mono">{b.phone}</span>], ['Canal preferido', b.pref], ['Mensajes de cobranza', b.optOut ? 'Desactivados' : 'Activados']]} /></div>
          {b.pendingChange && <p className="note" style={{ marginTop: 8 }}>Cambio solicitado el {D.fmt(b.pendingChange.date)}: pendiente de verificación por la administración.</p>}
          <div style={{ marginTop: 10 }}><Btn kind="ghost" onClick={contact}>Actualizar datos</Btn></div></Box>
        <Box><h2 className="h3">Servicios del country</h2><p className="meta" style={{ marginTop: 6 }}>Reservas de instalaciones, actividades náuticas, visitas y eventos se habilitarán acá cuando la administración los confirme. La estructura ya está prevista.</p></Box>
      </div>
    </div>
  </>;
}

/** Respuesta de la administración a una solicitud del propietario (cierra la solicitud). */
export function openReqAnswer(id: string) {
  openDialog({ title: `Responder ${id}`, submit: 'Responder y cerrar',
    body: <Field label="Respuesta al propietario"><textarea name="text" required /></Field>,
    onSubmit: f => { const t = val(f, 'text'); if (t.length < 5) return 'Escribí la respuesta.'; const r = st().requests.find(x => x.id === id)!;
      log('Respuesta a solicitud', 'Solicitud', r.id, r.type, '');
      commit(() => { r.status = 'respondida'; r.updates.push({ date: st().T, text: t, by: me().user }); });
      toast('Respuesta enviada al portal del propietario.'); } });
}
