import { MV_T, PAY_ST, catLabel } from '../../domain/catalog';
import { planMethod } from '../../domain/finance';
import { getBuyer, getLot } from '../../domain/store';
import { D, usd, usd2 } from '../../domain/util';
import { useDomain } from '../../os/hooks';
import { Btn, DL, DSec, InspFrame, Note, Pill, RiskPill } from '../../ui/kit';
import { ScheduleTable } from '../../ui/plan';
import { openDispute, openPayNew, openPromise, openReverse } from '../dialogs/finance';
import CtrInsp from './CtrInsp';

/** Ficha de la cuenta de un contrato firmado. */
export default function AcctInsp({ id }: { id: string }) {
  const { S, DV } = useDomain();
  const a = DV.accts.get(id);
  if (!a) return <CtrInsp id={id} />;
  const c = a.c, b = getBuyer(c.buyerId), pl = c.plan;
  const pays = S.payments.filter(p => p.contractId === id).sort((x, y) => x.date < y.date ? 1 : -1);
  const mv = (DV.led.get(id) || []).slice().sort((x, y) => x.date < y.date ? 1 : -1);
  const lim = D.add(S.T, 120);
  const sched = a.rows.filter(r => r.due <= lim).slice(-14).concat(a.rows.filter(r => r.due > lim).slice(0, 1));
  return <InspFrame title={c.id} sub={<><RiskPill a={a} /> <span className="meta">{c.lotId} · {catLabel(getLot(c.lotId).category)} · {b.name}</span></>}
    foot={<><Btn kind="primary" perm="fin_edit" onClick={() => openPayNew(id)}>Registrar pago</Btn><Btn perm="fin_edit" onClick={() => openPromise(id)}>Registrar promesa</Btn><Btn kind="ghost" perm="fin_edit" onClick={() => openDispute(id)}>{a.disputed ? 'Quitar disputa' : 'Marcar en disputa'}</Btn></>}>
    <DL items={[['Precio contractual', usd(c.priceC)], ['Cobrado total', usd(a.paidTotalC)], ['Saldo pendiente', usd(a.outstandingC)],
      ['Vencido', a.overdueC ? <><span className="st-vencida">{usd2(a.overdueC)}</span> · {a.overdueRows.length} cuota(s)</> : '—'],
      ['Días de atraso', a.daysLate ? a.daysLate + ' días' : '—'], ['Próximo vencimiento', a.next ? `${D.fmt(a.next.due)} · ${usd2(a.next.left)}` : '—'],
      ['Pagos en revisión', a.pendingRevC ? usd2(a.pendingRevC) : '—'], ['Responsable de seguimiento', c.followUp],
      ['Canal preferido', `${b.pref}${b.optOut ? ' · baja de mensajes' : ''}`], ['Contacto', <span className="mono">{b.phone}</span>]]} />
    {c.disputed && <Note><b>En disputa desde {D.fmt(c.disputed.since)}:</b> {c.disputed.reason} No se envían mensajes de cobranza ni se computa como mora confirmada.</Note>}
    {a.promise && <Note><b>Promesa de pago {a.promise.status === 'vigente' ? 'vigente' : a.promise.status}:</b> {usd(a.promise.amountC)} para el {D.fmt(a.promise.date)}. {a.promise.note} <span className="muted">— {a.promise.by}</span></Note>}
    {a.favorC > 0 && <Note><b>Saldo a favor:</b> {usd2(a.favorC)} pendiente de aplicar.</Note>}
    <DSec title={`Calendario de cuotas · ${a.paidN} de ${pl.n} pagas`}><ScheduleTable rows={sched} /><p className="meta" style={{ marginTop: 6 }}>Mostrando las cuotas cercanas a hoy. {planMethod(pl)}</p></DSec>
    <DSec title="Libro de movimientos"><div className="tbl-wrap"><table className="tbl"><thead><tr><th>Fecha</th><th>Tipo</th><th className="num">Importe</th><th>Referencia</th><th>Aprobó</th></tr></thead><tbody>
      {mv.slice(0, 12).map(e => <tr key={e.id}><td>{D.fmtS(e.date)}</td><td>{MV_T[e.type]}{e.note && e.type !== 'pago' && <span className="sub">{e.note}</span>}</td><td className={'num' + (e.amountC < 0 ? ' amt-neg' : '')}>{usd2(e.amountC)}</td><td className="mono" style={{ fontSize: 12 }}>{e.ref}</td><td>{e.approvedBy || '—'}</td></tr>)}
    </tbody></table></div></DSec>
    <DSec title="Pagos"><div className="tbl-wrap"><table className="tbl"><thead><tr><th>Pago</th><th>Fecha</th><th className="num">Importe</th><th>Estado</th><th /></tr></thead><tbody>
      {pays.slice(0, 10).map(p => <tr key={p.id}><td className="mono">{p.id}<span className="sub">{p.source}</span></td><td>{D.fmtS(p.date)}</td><td className="num">{usd2(p.amountC)}</td><td><Pill cls={PAY_ST[p.status][1]}>{PAY_ST[p.status][0]}</Pill></td>
        <td className="num">{p.status === 'confirmado' && p.kind === 'cuota' ? <Btn sm kind="ghost" perm="fin_edit" onClick={() => openReverse(p.id)}>Revertir</Btn> : p.status === 'confirmado' ? <span className="sub">Recibo interno</span> : null}</td></tr>)}
    </tbody></table></div>
      <p className="meta" style={{ marginTop: 6 }}>Los recibos internos no son facturas fiscales. La facturación electrónica requiere integración con SIFEN mediante un proveedor habilitado.</p></DSec>
  </InspFrame>;
}
