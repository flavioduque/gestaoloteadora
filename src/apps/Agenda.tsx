import '../styles/agenda.css';
import { useState } from 'react';
import type { AppProps } from './registry';
import type { AgendaEvent } from '../domain/types';
import { agendaItems, type AgendaItem } from '../domain/derive';
import { can, commit, log, me } from '../domain/store';
import { D, DOW, MESL } from '../domain/util';
import { useDomain } from '../os/hooks';
import { go } from '../os/nav';
import { closeDialog, openDialog, toast } from '../os/overlay';
import { Btn, Field, Head, Seg, val } from '../ui/kit';
import { Icon } from '../os/icons';

const KIND: Record<AgendaItem['kind'], string> = { visita: 'Visita', reserva: 'Vence reserva', promesa: 'Promesa de pago', accion: 'Próxima acción', cuota: 'Cuota', reunion: 'Reunión', obra: 'Obra', otro: 'Otro' };
const monday = (s: string) => D.add(s, -((D.dow(s) + 6) % 7));

function openEvent(i: AgendaItem, e?: AgendaEvent) {
  if (i.go) return go(i.go);
  openDialog({
    title: i.title,
    body: <><p><b>{D.fmt(i.date)}{i.time ? ' · ' + i.time : ''}</b> · {KIND[i.kind]}</p><p className="meta">{i.sub}</p></>,
    foot: <>
      {e && (can('exec') || can('crm_edit')) && <Btn kind="ghost danger" onClick={() => {
        closeDialog();
        openDialog({ title: 'Eliminar evento', body: <p>¿Eliminar “{e.title}” del {D.fmt(e.date)}? Queda registrado en la auditoría.</p>, submit: 'Eliminar', danger: true,
          onSubmit: () => { log('Baja de evento', 'Agenda', e.id, `${e.title} · ${e.date}`); commit(s => { s.events = s.events.filter(x => x.id !== e.id); }); toast('Evento eliminado.'); } });
      }}>Eliminar</Btn>}
      <Btn onClick={closeDialog}>Cerrar</Btn>
    </>,
  });
}

function newEvent(T: string) {
  openDialog({
    title: 'Nuevo evento', submit: 'Agendar',
    body: <>
      <Field label="Título"><input type="text" name="title" required maxLength={90} /></Field>
      <div className="grid3">
        <Field label="Fecha"><input type="date" name="date" defaultValue={T} min={T} required /></Field>
        <Field label="Hora"><input type="time" name="time" defaultValue="10:00" /></Field>
        <Field label="Tipo"><select name="kind">{(['reunion', 'obra', 'visita', 'otro'] as const).map(k => <option key={k} value={k}>{KIND[k]}</option>)}</select></Field>
      </div>
      <Field label="Responsable"><input type="text" name="owner" defaultValue={me().user} maxLength={60} /></Field>
      <Field label="Nota (opcional)"><textarea name="note" maxLength={300} /></Field>
    </>,
    onSubmit: f => {
      const title = val(f, 'title'), date = val(f, 'date');
      if (title.length < 3) return 'Escribí un título.';
      if (!date || date < T) return 'La fecha debe ser hoy o posterior.';
      commit(s => {
        const id = 'EV-' + String(s.events.reduce((m, e) => Math.max(m, +e.id.slice(3) || 0), 0) + 1).padStart(3, '0');
        s.events.push({ id, date, time: val(f, 'time'), title, kind: val(f, 'kind') as AgendaEvent['kind'], owner: val(f, 'owner') || me().user, note: val(f, 'note') });
        log('Alta de evento', 'Agenda', id, `${title} · ${date}`);
      });
      toast('Evento agendado.');
    },
  });
}

function Item({ i, evs, full }: { i: AgendaItem; evs: AgendaEvent[]; full?: boolean }) {
  return <button type="button" className={'ag-it k-' + i.kind} onClick={() => openEvent(i, evs.find(e => e.id === i.id))} title={`${KIND[i.kind]} · ${i.title} · ${i.sub}`}>
    {i.time && <span className="ag-tm">{i.time}</span>}<span className="ag-tt">{i.title}</span>{full && <small>{i.sub}</small>}
  </button>;
}

export default function Agenda(_: AppProps) {
  const { S } = useDomain();
  const T = S.T;
  const [mode, setMode] = useState<'sem' | 'mes'>('sem');
  const [anchor, setAnchor] = useState(T);
  const from = mode === 'sem' ? monday(anchor) : monday(D.monthStart(anchor));
  const days = Array.from({ length: mode === 'sem' ? 7 : 42 }, (_, i) => D.add(from, i));
  const items = agendaItems(days[0], days[days.length - 1]);
  const byDay = (d: string) => items.filter(i => i.date === d);
  const soon = agendaItems(T, D.add(T, 1));
  const step = (n: number) => setAnchor(a => mode === 'sem' ? D.add(a, 7 * n) : D.addM(D.monthStart(a), n, 1));
  const a = D.parse(anchor);
  const label = mode === 'mes' ? `${MESL[a.getUTCMonth()]} ${a.getUTCFullYear()}` : `${D.fmtS(days[0])} – ${D.fmt(days[6])}`;
  const canNew = can('exec') || can('crm_edit');
  return <>
    <Head title="Agenda" lede="Visitas, vencimientos de reservas, promesas de pago, cuotas relevantes y próximas acciones, en un solo calendario. Solo ves lo que tu rol permite." actions={<Btn kind="primary" icon="plus" onClick={() => newEvent(T)} disabled={!canNew} why="Tu rol no puede agendar eventos">Nuevo evento</Btn>} />
    <div className="ag-bar">
      <div className="ag-nav">
        <button type="button" className="iconbtn" onClick={() => step(-1)} aria-label="Anterior"><Icon n="chevL" /></button>
        <button type="button" className="btn sm" onClick={() => setAnchor(T)}>Hoy</button>
        <button type="button" className="iconbtn" onClick={() => step(1)} aria-label="Siguiente"><Icon n="chev" /></button>
        <h2 className="ag-label">{label}</h2>
      </div>
      <Seg label="Vista" value={mode} onChange={setMode} items={[['sem', 'Semana'], ['mes', 'Mes']]} />
    </div>
    <div className="ag-layout">
      <div className={'ag-grid ' + mode}>
        {DOW.slice(1).concat(DOW[0]).map(d => <div key={d} className="ag-dow">{d}</div>)}
        {days.map(d => { const its = byDay(d); const out = mode === 'mes' && d.slice(0, 7) !== D.monthStart(anchor).slice(0, 7); return (
          <div key={d} className={'ag-day' + (d === T ? ' today' : '') + (out ? ' out' : '') + (d < T ? ' past' : '')}>
            <span className="ag-n">{D.parse(d).getUTCDate()}</span>
            {(mode === 'mes' ? its.slice(0, 3) : its).map(i => <Item key={i.id} i={i} evs={S.events} full={mode === 'sem'} />)}
            {mode === 'mes' && its.length > 3 && <button type="button" className="ag-more" onClick={() => { setAnchor(d); setMode('sem'); }}>+{its.length - 3} más</button>}
          </div>); })}
      </div>
      <aside className="ag-side">
        <h3>Hoy y mañana</h3>
        {soon.length ? soon.map(i => <Item key={i.id} i={i} evs={S.events} full />) : <p className="meta">Sin compromisos.</p>}
        <div className="ag-legend">{(Object.keys(KIND) as AgendaItem['kind'][]).map(k => <span key={k}><i className={'k-' + k} />{KIND[k]}</span>)}</div>
      </aside>
    </div>
  </>;
}
