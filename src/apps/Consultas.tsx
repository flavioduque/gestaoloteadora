import { useState } from 'react';
import type { AppProps } from './registry';
import { QUERIES, cellText, matchQuery, runQuery, type QResult } from '../domain/queries';
import { can, st } from '../domain/store';
import { downloadCSV } from '../domain/util';
import { useDomain } from '../os/hooks';
import { go } from '../os/nav';
import { Btn, Empty, Head, Lnk } from '../ui/kit';

interface QA { id: number; q: string; k?: string; r?: QResult; err?: string }
let seq = 0;

export default function Consultas(_: AppProps) {
  useDomain();
  const [qa, setQa] = useState<QA[]>([]);
  const [text, setText] = useState('');
  const avail = QUERIES.filter(q => can(q.perm));
  const ask = (k: string, q: string) => setQa(l => [{ id: ++seq, k, q, r: runQuery(k) }, ...l]);
  const submit = () => {
    const q = text.trim(); if (q.length < 4) return;
    const hit = matchQuery(q);
    if (!hit) setQa(l => [{ id: ++seq, q, err: 'Todavía no hay una consulta definida para esa pregunta. Probá con alguna de las sugeridas; las nuevas consultas se agregan como reportes verificables, no como respuestas libres.' }, ...l]);
    else if (!can(hit.perm)) setQa(l => [{ id: ++seq, q, err: 'Tu rol no tiene acceso a los datos que requiere esta consulta.' }, ...l]);
    else ask(hit.k, q);
    setText('');
  };
  return <>
    <Head title="Preguntale a los datos" lede="Cada respuesta se calcula con una consulta definida sobre los registros del sistema y muestra período, definición y fecha de los datos. No hay cifras estimadas por un modelo de lenguaje. Solo ves lo que tu rol permite." />
    <form className="ask-bar" onSubmit={e => { e.preventDefault(); submit(); }}>
      <input type="text" value={text} onChange={e => setText(e.target.value)} placeholder="Escribí tu pregunta, por ejemplo: ¿qué lotes de ribera quedan?" autoComplete="off" aria-label="Pregunta" />
      <Btn type="submit" kind="primary">Consultar</Btn>
    </form>
    <div className="chips">{avail.map(q => <button key={q.k} type="button" className="chip" onClick={() => ask(q.k, q.q)}>{q.q}</button>)}</div>
    <div className="qa">{qa.length ? qa.map(x => <div key={x.id} className="qa-card">
      <div className="qa-q">{x.q}</div>
      <div className="qa-a">{x.err ? <p>{x.err}</p> : x.r && <>
        <div className="big">{x.r.big}</div>
        <p className="ink2">{x.r.text}</p>
        {x.r.table && <>
          <div className="tbl-wrap"><table className="tbl"><thead><tr>{x.r.table.h.map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{x.r.table.r.length ? x.r.table.r.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j}>{typeof c === 'string' ? c : <Lnk onClick={() => go(c.open)}>{c.text}</Lnk>}</td>)}</tr>)
              : <tr><td colSpan={x.r.table.h.length} className="empty">Sin resultados.</td></tr>}</tbody></table></div>
          {x.r.table.r.length > 0 && <div><Btn sm icon="down" onClick={() => downloadCSV(`consulta-${x.k}-${st().T}.csv`, [x.r!.table!.h, ...x.r!.table!.r.map(r => r.map(cellText))])}>Descargar CSV</Btn></div>}
        </>}
        <div className="qa-meta"><span><b>Período:</b> {x.r.period}</span><span><b>Definición:</b> {x.r.def}</span><span><b>Fuente:</b> {x.r.src}</span><span><b>Datos al:</b> {x.r.ts}</span></div>
      </>}</div>
    </div>) : <div className="box"><Empty>Elegí una pregunta sugerida o escribí la tuya.</Empty></div>}</div>
  </>;
}
