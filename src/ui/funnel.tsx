import type { Prospect } from '../domain/types';
import { STAGES, STAGE_IX } from '../domain/catalog';
import { reachedIx } from '../domain/derive';
import { pct } from '../domain/util';

/** Cuántos prospectos llegaron al menos a cada etapa (los perdidos cuentan hasta donde llegaron). */
export function Funnel({ list }: { list: Prospect[] }) {
  const st = STAGES.slice(0, 9);
  const counts = st.map((_, i) => list.filter(p => reachedIx(p) >= i).length);
  const max = counts[0] || 1;
  return <>
    <h3>Avance de prospectos por etapa</h3><span className="meta">Cuántos llegaron al menos a cada etapa · {list.length} prospectos</span>
    <div className="funnel" style={{ marginTop: 12 }}>{st.map((s, i) => <div key={s.k} className="fn-row"><span>{s.label}</span><span className="b"><i style={{ width: `${Math.round(counts[i] / max * 100)}%` }} /></span><span className="c">{counts[i]}{i ? ` · ${pct(counts[i] / (counts[i - 1] || 1), 0)}` : ''}</span></div>)}</div>
    <p className="meta" style={{ marginTop: 10 }}>Visitas que terminaron en reserva: {pct((counts[STAGE_IX.reserva] || 0) / (counts[STAGE_IX.visita_real] || 1), 0)} ({counts[STAGE_IX.reserva]} de {counts[STAGE_IX.visita_real]}).</p>
  </>;
}
