import { CTR_ST, LOT_ST, RES_ST, SECTOR, advName, catLabel } from '../../domain/catalog';
import { can, commit, getBuyer, getContract, getLot, getProspect, getRes, log, me, st } from '../../domain/store';
import type { Lot } from '../../domain/types';
import { D, m2, nf1, usd } from '../../domain/util';
import { useDomain } from '../../os/hooks';
import { Mono } from '../../os/icons';
import { openInsp } from '../../os/nav';
import { closeDialog, openDialog, toast } from '../../os/overlay';
import { Btn, DL, DSec, Field, InspFrame, L, Note, Pill, REASON_ERR, ReasonField, StPill, Tag, Timeline, reasonOf, val } from '../../ui/kit';
import { openReserve } from '../dialogs/reserve';
import { planUI, setPlanUI, usePlanUI } from '../planState';

const refCuota = (l: Lot) => Math.round(l.priceC * .7 / 60);

function openFicha(l: Lot) {
  const txt = `Viva Lago Country\nLote ${l.id} · ${catLabel(l.category)} · ${SECTOR[l.sector]}\nSuperficie: ${m2(l.area)}${l.front != null ? ` (${nf1.format(l.front)} × ${nf1.format(l.depth!)} m)` : ''}\nPrecio: ${usd(l.priceC)}\nPlan de referencia: 30 % de entrada y 60 cuotas de ${usd(refCuota(l))} sin interés (sujeto a aprobación).\n${l.features.join(' · ')}`;
  openDialog({ title: 'Ficha comercial',
    body: <><div className="ficha"><div className="ficha-top"><div><div className="cat">{catLabel(l.category)} · {SECTOR[l.sector]}</div><div className="id">Lote {l.id}</div></div><Mono /></div>
      <div className="ficha-b"><div className="price">{l.status === 'disponible' ? usd(l.priceC) : 'No disponible'}</div>
        <DL items={[['Superficie', m2(l.area)], ['Frente × fondo', l.front != null ? `${nf1.format(l.front)} × ${nf1.format(l.depth!)} m` : '—'], ['Plan de referencia', `30 % + 60 × ${usd(refCuota(l))}`], ['Precio por m²', l.area ? usd(l.priceC / l.area) : '—']]} />
        <div className="chips">{l.features.map(f => <Tag key={f}>{f}</Tag>)}</div>
        <p className="meta">Valores de referencia de la demo. Plan sujeto a aprobación comercial. Sin datos personales ni información interna.</p></div></div>
      <p className="meta">Podés imprimirla o guardarla como PDF desde el navegador, o copiarla para enviarla por WhatsApp.</p></>,
    foot: <><Btn kind="ghost" onClick={closeDialog}>Cerrar</Btn><Btn icon="file" onClick={() => window.print()}>Imprimir</Btn>
      <Btn kind="primary" icon="copy" onClick={() => navigator.clipboard?.writeText(txt).then(() => toast('Ficha copiada al portapapeles.'), () => toast('Tu navegador no permitió copiar.', true))}>Copiar para WhatsApp</Btn></> });
}

function addCompare(id: string) {
  const c = planUI().compare;
  if (c.includes(id)) return toast(`${id} ya está en la comparación.`);
  if (c.length >= 3) return toast('Podés comparar hasta 3 lotes. Quitá uno primero.', true);
  setPlanUI({ compare: [...c, id] }); toast(`${id} agregado a la comparación (Masterplan).`);
}

function openPrice(l: Lot) {
  openDialog({ title: `Cambiar precio · ${l.id}`, submit: 'Guardar precio',
    body: <><p className="meta">Precio vigente {usd(l.priceC)}. El historial anterior se conserva.</p><Field label="Nuevo precio (USD)"><input type="number" name="price" min={1000} step={500} defaultValue={l.priceC / 100} required /></Field><ReasonField /></>,
    onSubmit: f => { const r = reasonOf(f); if (!r) return REASON_ERR; const p = Math.round(+val(f, 'price')); if (!(p >= 1000)) return 'Ingresá un precio válido.'; if (p * 100 === l.priceC) return 'El precio es igual al vigente.';
      const old = l.priceC; log('Cambio de precio', 'Lote', l.id, `${usd(old)} → ${usd(p * 100)}`, r);
      commit(() => { l.priceC = p * 100; l.priceHistory.push({ date: st().T, priceC: l.priceC, by: me().user, reason: r }); l.version++; });
      toast(`Precio de ${l.id} actualizado.`); } });
}

function openBlock(l: Lot, block: boolean) {
  openDialog({ title: `${block ? 'Bloquear' : 'Desbloquear'} lote ${l.id}`, submit: block ? 'Bloquear' : 'Desbloquear',
    body: <>{block && <p className="meta">Un lote bloqueado no se puede reservar ni vender hasta que Dirección lo libere.</p>}<ReasonField /></>,
    onSubmit: f => { const r = reasonOf(f); if (!r) return REASON_ERR; if (block && l.status !== 'disponible') return 'Solo se bloquean lotes disponibles.';
      log(block ? 'Bloqueo de lote' : 'Desbloqueo de lote', 'Lote', l.id, '', r);
      commit(() => { l.status = block ? 'bloqueado' : 'disponible'; l.statusReason = block ? r : ''; l.version++; });
      toast(`Lote ${l.id} ${block ? 'bloqueado' : 'disponible'}.`); } });
}

export default function LotInsp({ id }: { id: string }) {
  const { S, DV } = useDomain();
  const { commercial: comm, compare } = usePlanUI();
  const l = getLot(id);
  if (!l) return <InspFrame title={`Lote ${id}`}>El lote no existe.</InspFrame>;
  const avail = l.status === 'disponible';
  const ppm = l.area ? l.priceC / l.area : 0;
  const inCmp = compare.includes(id);
  const head = <><DL items={[['Superficie registrada', m2(l.area)], ['Frente × fondo', l.front != null ? `${nf1.format(l.front)} m × ${nf1.format(l.depth!)} m` : <span className="st-vencida">Sin registrar</span>], ['Sector', SECTOR[l.sector]], ['Categoría', catLabel(l.category)], ['Precio vigente', <>{usd(l.priceC)} <span className="muted">· {l.currency}</span></>], ['Precio por m²', ppm ? usd(ppm) : '—']]} />
    <div className="chips">{l.features.map(f => <Tag key={f}>{f}</Tag>)}</div></>;

  if (comm) return <InspFrame title={`Lote ${l.id}`} sub={<><Pill cls={avail ? 'disp' : 'neutral'}>{avail ? 'Disponible' : 'No disponible'}</Pill><span className="meta">{catLabel(l.category)} · {SECTOR[l.sector]}</span></>}
    foot={avail ? <><Btn onClick={() => openFicha(l)}>Ficha comercial</Btn><Btn kind="ghost" onClick={() => addCompare(id)}>{inCmp ? 'En comparación' : 'Agregar a comparación'}</Btn></> : undefined}>
    {avail ? <>{head}<p className="meta">Plan de referencia: 30 % de entrada y 60 cuotas sin interés de {usd(refCuota(l))}. Sujeto a aprobación comercial.</p></> : <p className="meta">Este lote no está disponible para la venta.</p>}
  </InspFrame>;

  const r = l.reservationId ? getRes(l.reservationId) : undefined;
  const c = l.contractId ? getContract(l.contractId) : undefined;
  const a = c ? DV.accts.get(c.id) : undefined;
  const b = c ? getBuyer(c.buyerId) : undefined;
  const hist = S.audit.filter(e => e.entityId === l.id || (e.detail || '').includes(l.id)).slice(0, 8);
  const docs: [string, string][] = [['Plano de mensura', l.front != null ? 'Vinculado' : 'Pendiente de carga'], ['Ficha técnica del sector', 'Vinculado'], ...(c ? [['Contrato ' + c.id, c.status === 'firmado' ? 'Firmado' : 'Borrador'] as [string, string]] : [])];
  const interested = S.prospects.filter(p => p.lotIds.includes(l.id) && !['ganado', 'perdido'].includes(p.stage) && (can('crm_all') || p.advisorId === me().advisorId));

  return <InspFrame title={`Lote ${l.id}`}
    sub={<><StPill st={l.status} />{a && a.overdueC > 0 && <Pill cls="crit">Cuota vencida</Pill>}<span className="meta">{catLabel(l.category)} · {SECTOR[l.sector]} · versión {l.version}</span></>}
    foot={<>{avail && <Btn kind="primary" perm="reserve" onClick={() => openReserve({ lotId: id })}>Reservar</Btn>}
      <Btn perm="lot_admin" why="Solo Dirección modifica precios" onClick={() => openPrice(l)}>Cambiar precio</Btn>
      {l.status === 'bloqueado' ? <Btn perm="lot_admin" onClick={() => openBlock(l, false)}>Desbloquear</Btn> : avail && <Btn kind="ghost" perm="lot_admin" why="Solo Dirección bloquea lotes" onClick={() => openBlock(l, true)}>Bloquear</Btn>}
      <Btn kind="ghost" onClick={() => openFicha(l)}>Ficha comercial</Btn>
      <Btn kind="ghost" onClick={() => addCompare(id)}>{inCmp ? 'En comparación' : 'Comparar'}</Btn></>}>
    {l.statusReason && <Note><b>{LOT_ST[l.status].label}:</b> {l.statusReason}</Note>}
    {l.notes && <Note><b>Observación:</b> {l.notes}</Note>}
    <div>{head}</div>
    {r && ['vigente', 'pendiente_aprobacion'].includes(r.status) && <DSec title="Reserva"><DL items={[['Reserva', <><span className="mono">{r.id}</span> · {RES_ST[r.status][0]}</>], ['Vence', `${D.fmt(r.expires)} (${D.diff(r.expires, S.T)} d)`], ['Prospecto', r.prospectId ? <L kind="prospect" id={r.prospectId} mono={false}>{getProspect(r.prospectId)?.name ?? '—'}</L> : '—'], ['Asesor', advName(r.advisorId)], ['Precio acordado', usd(r.priceC)], ['Seña', usd(r.amountC)]]} /></DSec>}
    {c && <DSec title="Titularidad y contrato"><DL items={[['Titular', can('holder') ? b!.name : 'Visible para perfiles autorizados'], ['Contrato', <><L kind="ctr" id={c.id} /> · {CTR_ST[c.status][0]}</>], ['Precio contractual', can('holder') ? usd(c.priceC) : '—'], ['Firma', c.signedDate ? D.fmt(c.signedDate) : 'Pendiente'], ['Plan', can('holder') ? `${c.plan.downPct} % + ${c.plan.n} cuotas` : '—'], ['Cambios de titularidad', 'Ninguno registrado']]} /></DSec>}
    {a && can('fin_view') && <DSec title="Situación financiera"><DL items={[['Cobrado', usd(a.paidTotalC)], ['Saldo pendiente', usd(a.outstandingC)], ['Cuotas pagas', `${a.paidN} de ${c!.plan.n}`], ['Vencido', a.overdueC ? <span className="st-vencida">{usd(a.overdueC)} · {a.daysLate} d</span> : 'Al día']]} /><p style={{ marginTop: 8 }}><Btn sm onClick={() => openInsp('acct', c!.id)}>Abrir cuenta</Btn></p></DSec>}
    {can('crm') && interested.length > 0 && <DSec title={`Prospectos interesados (${interested.length})`}><Timeline items={interested.map(p => [`${p.id}`, <L kind="prospect" id={p.id} mono={false}>{p.name}</L>])} /></DSec>}
    <DSec title="Historial de precios"><div className="tbl-wrap"><table className="tbl"><thead><tr><th>Fecha</th><th className="num">Precio</th><th>Motivo</th><th>Autorizó</th></tr></thead><tbody>{[...l.priceHistory].reverse().map((h, i) => <tr key={i}><td>{D.fmt(h.date)}</td><td className="num">{usd(h.priceC)}</td><td>{h.reason}</td><td>{h.by}</td></tr>)}</tbody></table></div></DSec>
    <DSec title="Documentación vinculada"><Timeline items={docs.map(([d, s]) => [s === 'Pendiente de carga' ? <span className="st-vencida">falta</span> : 'ok', <>{d} · <span className="muted">{s}</span></>])} /></DSec>
    <DSec title="Actividad">{hist.length ? <Timeline items={hist.map(e => [e.ts.slice(0, 10), <><b>{e.action}</b> · {e.user}{e.reason ? ` · ${e.reason}` : ''}</>])} /> : <p className="meta">Sin cambios registrados en la auditoría de esta demo.</p>}</DSec>
  </InspFrame>;
}
