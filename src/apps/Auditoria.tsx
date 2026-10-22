import { useState } from 'react';
import type { AppProps } from './registry';
import { downloadCSV } from '../domain/util';
import { useDomain } from '../os/hooks';
import { Btn, Head } from '../ui/kit';

export default function Auditoria(_: AppProps) {
  const { S } = useDomain();
  const [q, setQ] = useState(''); const [ent, setEnt] = useState('');
  let rows = S.audit;
  if (ent) rows = rows.filter(e => e.entity === ent);
  if (q) { const s = q.toLowerCase(); rows = rows.filter(e => [e.user, e.action, e.entityId, e.detail, e.reason].join(' ').toLowerCase().includes(s)); }
  const ents = [...new Set(S.audit.map(e => e.entity))];
  const csv = () => downloadCSV(`auditoria-${S.T}.csv`, [['fecha_hora', 'usuario', 'rol', 'accion', 'entidad', 'registro', 'detalle', 'motivo'], ...rows.map(e => [e.ts.replace('T', ' '), e.user, e.role, e.action, e.entity, e.entityId, e.detail, e.reason])]);
  return <>
    <Head title="Registro de auditoría" lede="Toda acción sensible queda registrada con quién la hizo, cuándo, sobre qué registro y por qué. El registro no se puede editar desde la aplicación." />
    <div className="tbl-tools">
      <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar usuario, acción o registro" aria-label="Buscar en auditoría" />
      <select value={ent} onChange={e => setEnt(e.target.value)} aria-label="Entidad"><option value="">Todas las entidades</option>{ents.map(e => <option key={e}>{e}</option>)}</select>
      <span className="meta">{rows.length} eventos</span>
      <span style={{ flex: 1 }} />
      <Btn sm icon="down" onClick={csv} disabled={!rows.length}>Descargar CSV</Btn>
    </div>
    <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Acción</th><th>Registro</th><th>Detalle</th><th>Motivo</th></tr></thead>
      <tbody>{rows.slice(0, 200).map((e, i) => <tr key={i}>
        <td className="mono nowrap" style={{ fontSize: 12 }}>{e.ts.replace('T', ' ').slice(0, 16)}</td>
        <td>{e.user}<span className="sub">{e.role}</span></td><td>{e.action}</td>
        <td>{e.entity}<span className="sub mono">{e.entityId}</span></td><td>{e.detail}</td><td>{e.reason || <span className="muted">—</span>}</td>
      </tr>)}{!rows.length && <tr><td colSpan={6} className="empty">Sin eventos.</td></tr>}</tbody></table></div>
    {rows.length > 200 && <p className="meta" style={{ marginTop: 6 }}>Mostrando 200 de {rows.length}. El CSV incluye todos.</p>}
  </>;
}
