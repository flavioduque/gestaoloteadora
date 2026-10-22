import { STAGES, advName, catLabel, isClosed, stageLabel } from '../../domain/catalog';
import { idleDays, reachedIx, score, stageGate } from '../../domain/derive';
import { can, getProspect, me } from '../../domain/store';
import { D, fmtMin, usd } from '../../domain/util';
import { useDomain } from '../../os/hooks';
import { Btn, DL, DSec, InspFrame, L, Note, Pill, Timeline } from '../../ui/kit';
import { advance, openActivity, openLost, openLots, openQualify, openVisit } from '../dialogs/prospect';
import { openReserve } from '../dialogs/reserve';

export default function ProspectInsp({ id }: { id: string }) {
  useDomain();
  const p = getProspect(id);
  if (!p) return <InspFrame title={id}><p className="meta">El prospecto ya no existe.</p></InspFrame>;
  const ix = reachedIx(p);
  const own = can('crm_all') || p.advisorId === me().advisorId;
  const ed = can('crm_edit') && own && !isClosed(p.stage);
  const g = stageGate(p);
  const idle = idleDays(p);
  return <InspFrame title={p.name}
    sub={<><Pill cls={p.stage === 'perdido' ? 'crit' : p.stage === 'ganado' ? 'ok' : 'info'}>{stageLabel(p.stage)}</Pill>{!isClosed(p.stage) && <span className="score">Prob. estimada {score(p)} %</span>}<span className="meta mono">{p.id}</span></>}
    foot={ed ? <>
      <Btn onClick={() => openActivity(id)}>Registrar actividad</Btn>
      {(p.stage === 'nuevo' || p.stage === 'contactado') && <Btn onClick={() => openQualify(id)}>Calificar</Btn>}
      {['calificado', 'visita_prog'].includes(p.stage) && <Btn onClick={() => openVisit(id)}>Programar visita</Btn>}
      {['visita_real', 'negociacion'].includes(p.stage) && <Btn onClick={() => openLots(id)}>Lotes de interés</Btn>}
      {p.stage === 'negociacion' && <Btn kind="primary" perm="reserve" onClick={() => openReserve({ prospectId: id, lotId: p.lotIds[0] })}>Crear reserva</Btn>}
      {g.ok && g.next && <Btn kind="primary" onClick={() => advance(id)}>Avanzar a {g.next.label}</Btn>}
      <Btn kind="ghost danger" onClick={() => openLost(id)}>Marcar perdido</Btn>
    </> : <span className="meta">{own ? 'Prospecto cerrado.' : 'Solo lectura.'}</span>}>
    <div className="stepper" aria-label="Avance">{STAGES.slice(0, 9).map((s, i) => <i key={s.k} className={i <= ix ? 'on' : ''} title={s.label} />)}</div>
    {p.nextAction && ed && <Note><b>Próxima acción:</b> {p.nextAction.text} · {D.fmt(p.nextAction.date)}{idle > 7 && <> · <span className="st-vencida">{idle} días sin actividad</span></>}</Note>}
    {p.lostReason && <Note><b>Motivo de pérdida:</b> {p.lostReason}</Note>}
    <DSec title="Perfil"><DL items={[
      ['Fuente', p.source], ['Asesor responsable', advName(p.advisorId)], ['Primer contacto', D.fmt(p.created)], ['Tiempo de respuesta inicial', fmtMin(p.firstResponseMin)],
      ['Interés declarado', p.interest], ['Presupuesto estimado', p.budgetC ? usd(p.budgetC) : '—'], ['Categoría buscada', catLabel(p.category)], ['Ubicación preferida', p.location || '—'],
      ['Horizonte de compra', p.horizon || '—'], ['Teléfono', <span className="mono">{p.phone}</span>], ['Visita', p.visitDate ? D.fmt(p.visitDate) : '—'],
      ['Lotes de interés', p.lotIds.length ? p.lotIds.map((l, i) => <span key={l}>{i > 0 && ', '}<L kind="lot" id={l} /></span>) : '—'],
    ]} /></DSec>
    {g.next && ed && <DSec title={`Para avanzar a “${g.next.label}”`}>{g.ok ? <p className="st-pagada">Condiciones cumplidas.</p> : <ul style={{ margin: 0, paddingLeft: 18 }}>{g.miss.map(m => <li key={m}>{m}</li>)}</ul>}</DSec>}
    <DSec title="Historial"><Timeline items={[...p.history].reverse().map(h => [D.fmtS(h.date), <><b>{h.type}</b> · {h.text} <span className="muted">— {h.by}</span></>])} /></DSec>
  </InspFrame>;
}
