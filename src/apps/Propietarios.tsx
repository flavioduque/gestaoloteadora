import { useState } from 'react';
import type { AppProps } from './registry';
import { can, commit, getBuyer, getContract, log, me, st } from '../domain/store';
import { D } from '../domain/util';
import { useDomain } from '../os/hooks';
import { openDialog, toast } from '../os/overlay';
import { Btn, Empty, Field, Head, L, Pill, Seg, Tabs, Timeline, useTab, val } from '../ui/kit';
import { openReqAnswer } from './Portal';

const AUDIENCES = ['Todos los propietarios', 'Sector Ribera', 'Sector Los Sauces', 'Sector Parque'];

/** Atención al propietario: solicitudes recibidas desde el portal y comunicados del desarrollo. */
export default function Propietarios({ win }: AppProps) {
  const { S } = useDomain();
  const staff = can('comms');
  const [t, setT] = useTab<'sol' | 'com'>(win, staff ? 'sol' : 'com');
  const [f, setF] = useState<'abiertas' | 'todas'>('abiertas');
  const open = S.requests.filter(r => r.status === 'abierta').length;
  const reqs = S.requests.filter(r => f === 'todas' || r.status === 'abierta').sort((a, b) => a.created < b.created ? 1 : -1);

  const publish = () => openDialog({ title: 'Nuevo comunicado', submit: 'Publicar',
    body: <><Field label="Título"><input type="text" name="title" required maxLength={120} /></Field>
      <Field label="Texto"><textarea name="text" required maxLength={1200} style={{ minHeight: 120 }} /></Field>
      <Field label="Audiencia"><select name="aud">{AUDIENCES.map(a => <option key={a}>{a}</option>)}</select></Field>
      <p className="meta">Se publica en el Portal del propietario. El envío por WhatsApp o correo requiere los canales activos.</p></>,
    onSubmit: fd => {
      const title = val(fd, 'title'), text = val(fd, 'text');
      if (title.length < 5) return 'Escribí un título de al menos 5 caracteres.'; if (text.length < 10) return 'El texto es demasiado corto.';
      const id = 'COM-' + String(st().comms.length + 1).padStart(3, '0');
      log('Publicación de comunicado', 'Comunicado', id, title, val(fd, 'aud'));
      commit(S => S.comms.unshift({ id, date: S.T, title, text, audience: val(fd, 'aud'), by: me().user }));
      toast(`Comunicado ${id} publicado en el portal.`);
    } });

  return <>
    <Head title="Propietarios" lede={staff ? 'Solicitudes que llegan desde el portal y comunicados que se publican para los propietarios.' : 'Comunicados publicados por la administración del desarrollo.'}
      actions={staff && <Btn kind="primary" icon="plus" onClick={publish}>Nuevo comunicado</Btn>} />
    {staff && <Tabs value={t} onChange={setT} items={[['sol', 'Solicitudes', open], ['com', 'Comunicados', S.comms.length]]} />}
    {staff && t === 'sol' ? <>
      <div className="tbl-tools"><Seg label="Filtro" value={f} onChange={setF} items={[['abiertas', 'Abiertas'], ['todas', 'Todas']]} /><span className="meta">{reqs.length} solicitudes</span></div>
      {reqs.length ? <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Solicitud</th><th>Propietario</th><th>Tipo y detalle</th><th>Estado</th><th /></tr></thead><tbody>
        {reqs.map(r => { const c = getContract(r.contractId); const last = r.updates[r.updates.length - 1]; const age = D.diff(S.T, r.created); return <tr key={r.id}>
          <td className="mono">{r.id}<span className="sub">{D.fmtS(r.created)} · hace {age} d</span></td>
          <td>{getBuyer(r.buyerId).name}<span className="sub"><L kind="acct" id={c.id} /> · {c.lotId}</span></td>
          <td><b>{r.type}</b> · {r.text}{r.updates.length > 1 && <span className="sub">Respuesta: {last.text} — {last.by}</span>}</td>
          <td><Pill cls={r.status === 'abierta' ? (age > 5 ? 'crit' : 'warn') : 'ok'}>{r.status === 'abierta' ? 'Abierta' : 'Respondida'}</Pill></td>
          <td className="num">{r.status === 'abierta' && <Btn sm kind="primary" onClick={() => openReqAnswer(r.id)}>Responder</Btn>}</td></tr>; })}
      </tbody></table></div> : <Empty>No hay solicitudes {f === 'abiertas' ? 'abiertas' : ''}.</Empty>}
    </> : <>
      {S.comms.length ? <Timeline items={S.comms.map(m => [D.fmtS(m.date), <><b>{m.title}</b> <span className="tag">{m.audience}</span><br /><span className="muted">{m.text}</span><span className="sub meta">Publicado por {m.by}</span></>])} /> : <Empty>Todavía no hay comunicados.</Empty>}
    </>}
  </>;
}
