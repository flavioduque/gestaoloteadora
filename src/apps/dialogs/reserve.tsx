import { useState } from 'react';
import { STAGES, STAGE_IX, catLabel } from '../../domain/catalog';
import { visibleProspects } from '../../domain/derive';
import { Server } from '../../domain/server';
import { autoRun, can, commit, getLot, getProspect, log, me } from '../../domain/store';
import { usd } from '../../domain/util';
import { openApp } from '../../os/nav';
import { openDialog, toast } from '../../os/overlay';
import { Field, val } from '../../ui/kit';

const COND = 'Precio bloqueado por 7 días corridos. Si no se formaliza, el lote vuelve a disponible. Devolución de la seña según política aprobada.';

/** Cuerpo del diálogo: el lote elegido fija la versión leída (concurrencia optimista) y el precio de lista. */
function ReserveBody({ lotIds, initial, prospectId }: { lotIds: string[]; initial: string; prospectId?: string }) {
  const [lotId, setLotId] = useState(initial);
  const l = getLot(lotId); const p = prospectId ? getProspect(prospectId) : undefined;
  const cands = visibleProspects().filter(x => ['calificado', 'visita_prog', 'visita_real', 'negociacion'].includes(x.stage));
  return <>
    <div className="grid2">
      <Field label="Lote">
        <select name="lot" value={lotId} onChange={e => setLotId(e.target.value)} disabled={!p}>{lotIds.map(id => { const x = getLot(id); return <option key={id} value={id}>{id} · {catLabel(x.category)} · {usd(x.priceC)}</option>; })}</select>
        <input type="hidden" name="lotId" value={lotId} /><input type="hidden" name="ver" value={l.version} />
      </Field>
      {p
        ? <Field label="Prospecto"><input type="text" value={p.name} readOnly /><input type="hidden" name="pid" value={p.id} /></Field>
        : <Field label="Prospecto"><select name="pid" defaultValue=""><option value="">Elegí un prospecto…</option>{cands.map(x => <option key={x.id} value={x.id}>{x.name} · {STAGES[STAGE_IX[x.stage]].label}</option>)}</select></Field>}
      <Field label="Precio acordado (USD)" hint={can('lot_admin') ? 'Dirección puede ajustar el precio acordado.' : 'Precio de lista vigente. Los descuentos requieren a Dirección.'}>
        <input key={lotId} type="number" name="price" defaultValue={l.priceC / 100} readOnly={!can('lot_admin')} min={1000} step={100} />
      </Field>
      <Field label="Seña (USD)"><input key={'s' + lotId} type="number" name="amount" defaultValue={l.category === 'ribera' ? 5000 : 2000} min={500} step={100} required /></Field>
    </div>
    <Field label="Condiciones"><textarea name="cond" defaultValue={COND} /></Field>
    <p className="meta">{can('approve_res') ? 'La reserva queda vigente al confirmar.' : 'La reserva queda pendiente de aprobación de Gerencia comercial. El lote se bloquea de inmediato para evitar reservas simultáneas.'} La disponibilidad se verifica en el servidor al enviar.</p>
  </>;
}

/** Diálogo “Solicitar reserva” (con control de concurrencia en el servidor simulado). */
export function openReserve({ lotId, prospectId }: { lotId?: string; prospectId?: string }) {
  const p = prospectId ? getProspect(prospectId) : undefined;
  const lots = p ? p.lotIds.filter(id => getLot(id).status === 'disponible') : lotId ? [lotId] : [];
  if (!lots.length) return toast('Ninguno de los lotes de interés está disponible. Actualizá los lotes del prospecto.', true);
  const initial = lotId && lots.includes(lotId) ? lotId : lots[0];
  openDialog({
    title: 'Solicitar reserva', submit: 'Reservar',
    body: <ReserveBody lotIds={lots} initial={initial} prospectId={prospectId} />,
    onSubmit: f => {
      const lot = val(f, 'lotId'); const pid = val(f, 'pid');
      if (!pid) return 'Elegí el prospecto que reserva.';
      const amount = +val(f, 'amount'); if (!(amount >= 500)) return 'La seña mínima es USD 500.';
      const price = +val(f, 'price'); if (!(price >= 1000)) return 'Precio inválido.';
      const pr = getProspect(pid)!;
      let msg = '';
      commit(S => {
        const res = Server.reserve(S, { lotId: lot, expectedVersion: +val(f, 'ver'), prospectId: pid, priceC: Math.round(price) * 100, amountC: Math.round(amount) * 100, advisorId: pr.advisorId, conditions: val(f, 'cond'), user: me().user, approved: can('approve_res') });
        if (!res.ok) { msg = res.error; return; }
        const r = res.reservation;
        pr.stage = 'reserva'; pr.lastActivity = S.T; if (!pr.lotIds.includes(lot)) pr.lotIds.unshift(lot);
        pr.history.push({ date: S.T, type: 'Reserva', text: `Reserva ${r.id} sobre ${lot} por ${usd(r.amountC)}${r.status === 'pendiente_aprobacion' ? ' (pendiente de aprobación)' : ''}.`, by: me().user });
        log('Creación de reserva', 'Reserva', r.id, `${lot} · ${usd(r.priceC)} · seña ${usd(r.amountC)}`, r.status === 'pendiente_aprobacion' ? 'Pendiente de aprobación' : '');
        autoRun('AUT-01', `${lot} bloqueado por ${r.id}`);
        toast(`Reserva ${r.id} creada. El lote ${lot} quedó bloqueado${r.status === 'pendiente_aprobacion' ? ' hasta la aprobación' : ''}.`);
      });
      if (msg) return msg;
      setTimeout(() => openApp('res'));
    },
  });
}
