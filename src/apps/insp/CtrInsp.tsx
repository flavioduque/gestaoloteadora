import { CTR_ST, advName, catLabel } from '../../domain/catalog';
import { planMethod } from '../../domain/finance';
import { can, getBuyer, getContract, getLot } from '../../domain/store';
import { D, m2, usd, usd2 } from '../../domain/util';
import { useDomain } from '../../os/hooks';
import { ScheduleTable } from '../../ui/plan';
import { Btn, DL, DSec, InspFrame, L, Note, Pill, Timeline } from '../../ui/kit';
import { openSign } from '../Reservas';
import AcctInsp from './AcctInsp';

export default function CtrInsp({ id }: { id: string }) {
  useDomain();
  const c = getContract(id);
  if (!c) return <InspFrame title={id}><p className="meta">El contrato no existe.</p></InspFrame>;
  if (c.status === 'firmado' && can('fin_view')) return <AcctInsp id={id} />;
  const b = getBuyer(c.buyerId), pl = c.plan, l = getLot(c.lotId);
  const totInt = pl.installments.reduce((s, i) => s + i.interestC, 0);
  return <InspFrame title={c.id}
    sub={<><Pill cls={CTR_ST[c.status][1]}>{CTR_ST[c.status][0]}</Pill><span className="meta">{c.lotId} · {catLabel(l.category)}</span></>}
    foot={c.status === 'pendiente_firma' ? <Btn kind="primary" perm="contracts_edit" onClick={() => openSign(id)}>Registrar firma</Btn> : undefined}>
    <DL items={[['Comprador', can('holder') ? b.name : 'Reservado'], ['Lote', <><L kind="lot" id={c.lotId} /> · {m2(l.area)}</>], ['Precio contractual', usd(c.priceC)], ['Asesor', advName(c.advisorId)], ['Generado', D.fmt(c.created)], ['Firma', c.signedDate ? `${D.fmt(c.signedDate)} · ${c.signMode}` : 'Pendiente']]} />
    <DSec title="Plan de financiación">
      <DL items={[['Entrada', `${pl.downPct} % · ${usd(pl.downC)}`], ['Financiado', usd(pl.financedC)], ['Cuotas', `${pl.n} mensuales`], ['Primer vencimiento', D.fmt(pl.firstDue)], ['Interés total', usd2(totInt)], ['Total a pagar', usd2(pl.downC + pl.financedC + totInt)]]} />
      <div style={{ marginTop: 10 }}><Note><b>Método:</b> {planMethod(pl)}</Note></div>
    </DSec>
    <DSec title={`Calendario${c.status === 'firmado' ? '' : ' (se activa con la firma)'}`}><ScheduleTable rows={pl.installments} limit={6} /></DSec>
    <DSec title="Documentos"><Timeline items={c.docs.map(d => [`v${d.v} · ${D.fmtS(d.date)}`, d.name])} /></DSec>
  </InspFrame>;
}
