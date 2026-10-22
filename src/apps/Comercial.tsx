import { useState } from 'react';
import type { AppProps } from './registry';
import type { Prospect, Stage } from '../domain/types';
import { ADVISORS, SOURCES, STAGES, STAGE_IX, advName, catLabel, isClosed, stageLabel } from '../domain/catalog';
import { idleDays, reachedIx, score, visibleProspects } from '../domain/derive';
import { can, getLot, role } from '../domain/store';
import { D, downloadCSV, fmtMin, pct, usd, usdK } from '../domain/util';
import { useDomain } from '../os/hooks';
import { openInsp } from '../os/nav';
import { Av, Box, Btn, Head, L, Sec, StPill, Tabs, Tag, TR, useTab } from '../ui/kit';
import { openNewProspect } from './dialogs/prospect';
import { Funnel } from '../ui/funnel';

function KCard({ p }: { p: Prospect }) {
  const idle = idleDays(p);
  return <button type="button" className="kcard" onClick={() => openInsp('prospect', p.id)}>
    <span className="nm">{p.name}</span>
    <span className="ln"><span>{p.category ? catLabel(p.category) : p.source}{p.lotIds.length ? ' · ' + p.lotIds[0] : ''}</span><span className="score" title="Probabilidad estimada">{score(p)} %</span></span>
    <span className="ln"><span>{p.budgetC ? usdK(p.budgetC) : 'Sin calificar'}</span><span className={idle > 7 ? 'stale' : ''}>{idle === 0 ? 'hoy' : idle + ' d sin actividad'}</span></span>
    <span className="ln"><Av id={p.advisorId} /><span>{p.nextAction?.text ?? ''}</span></span>
  </button>;
}

function Perf({ list }: { list: Prospect[] }) {
  const reached = (p: Prospect, k: Stage) => reachedIx(p) >= STAGE_IX[k];
  const active = list.filter(p => !isClosed(p.stage));
  const bySrc = SOURCES.map(s => { const l = list.filter(p => p.source === s); return { s, n: l.length, vis: l.filter(p => reached(p, 'visita_real')).length, res: l.filter(p => reached(p, 'reserva')).length, won: l.filter(p => p.stage === 'ganado').length }; }).filter(x => x.n);
  const byAdv = ADVISORS.map(a => { const l = list.filter(p => p.advisorId === a.id); const act = l.filter(p => !isClosed(p.stage)); return { a, act: act.length, stale: act.filter(p => idleDays(p) > 7).length, resp: l.length ? l.reduce((s, p) => s + p.firstResponseMin, 0) / l.length : 0, res: l.filter(p => reached(p, 'reserva')).length, won: l.filter(p => p.stage === 'ganado').length }; }).filter(x => x.act || x.won);
  const interest: Record<string, number> = {}; active.forEach(p => p.lotIds.forEach(id => interest[id] = (interest[id] || 0) + 1));
  const topLots = Object.entries(interest).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const top = [...active].sort((a, b) => score(b) - score(a)).slice(0, 6);
  return <>
    <div className="split" style={{ marginTop: 0 }}>
      <Box><Funnel list={list} /></Box>
      <Box><h3>Mayor probabilidad de cierre</h3><span className="meta"><Tag est>Estimación</Tag> por reglas explícitas, no es un dato observado</span>
        {top.map(p => <div key={p.id} className="proj-row" style={{ gridTemplateColumns: '1fr auto' }}><span><L kind="prospect" id={p.id} mono={false}>{p.name}</L><span className="meta"> · {stageLabel(p.stage)}</span></span><span className="score">{score(p)} %</span></div>)}</Box>
    </div>
    <Sec title="Por canal de captación" meta="Observado">
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Canal</th><th className="num">Prospectos</th><th className="num">Llegaron a visita</th><th className="num">Reserva o más</th><th className="num">Ganados</th><th className="num">Conv. a reserva</th></tr></thead>
        <tbody>{bySrc.map(x => <tr key={x.s}><td>{x.s}</td><td className="num">{x.n}</td><td className="num">{x.vis}</td><td className="num">{x.res}</td><td className="num">{x.won}</td><td className="num">{pct(x.res / x.n, 0)}</td></tr>)}</tbody></table></div>
    </Sec>
    {can('crm_all') && <Sec title="Por asesor" meta="Quién necesita apoyo">
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Asesor</th><th className="num">Activos</th><th className="num">Sin seguimiento &gt; 7 d</th><th className="num">Respuesta media</th><th className="num">Reserva o más</th><th className="num">Ganados</th></tr></thead>
        <tbody>{byAdv.map(x => <tr key={x.a.id}><td>{x.a.name}</td><td className="num">{x.act}</td><td className={'num ' + (x.stale ? 'st-vencida' : '')}>{x.stale}</td><td className="num">{fmtMin(x.resp)}</td><td className="num">{x.res}</td><td className="num">{x.won}</td></tr>)}</tbody></table></div>
    </Sec>}
    <Sec title="Lotes con más interés" meta="Prospectos activos que los mencionan">
      {topLots.length ? <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Lote</th><th>Categoría</th><th>Estado</th><th className="num">Precio</th><th className="num">Interesados</th></tr></thead>
        <tbody>{topLots.map(([id, n]) => { const l = getLot(id); return <TR key={id} onOpen={() => openInsp('lot', id)}><td className="mono">{id}</td><td>{catLabel(l.category)}</td><td><StPill st={l.status} /></td><td className="num">{usd(l.priceC)}</td><td className="num">{n}</td></TR>; })}</tbody></table></div>
        : <p className="meta">Sin lotes marcados por prospectos activos.</p>}
    </Sec>
  </>;
}

export default function Comercial({ win }: AppProps) {
  useDomain();
  const [tab, setTab] = useTab<'pipe' | 'list' | 'perf'>(win, 'pipe');
  const [q, setQ] = useState(''); const [adv, setAdv] = useState(''); const [src, setSrc] = useState('');
  let list = visibleProspects();
  if (adv) list = list.filter(p => p.advisorId === adv);
  if (src) list = list.filter(p => p.source === src);
  if (q) { const s = q.toLowerCase(); list = list.filter(p => p.name.toLowerCase().includes(s) || p.id.toLowerCase().includes(s)); }
  const active = list.filter(p => !isClosed(p.stage));
  const won = list.filter(p => p.stage === 'ganado').length, lost = list.filter(p => p.stage === 'perdido').length;
  const rows = [...list].sort((a, b) => STAGE_IX[b.stage] - STAGE_IX[a.stage] || idleDays(b) - idleDays(a));
  const exportCSV = () => downloadCSV(`prospectos-${D.today()}.csv`, [['id', 'nombre', 'etapa', 'fuente', 'asesor', 'presupuesto_usd', 'categoria', 'dias_sin_actividad', 'proxima_accion', 'fecha_proxima', 'probabilidad_est'],
    ...rows.map(p => [p.id, p.name, stageLabel(p.stage), p.source, advName(p.advisorId), p.budgetC ? p.budgetC / 100 : '', catLabel(p.category), idleDays(p), p.nextAction?.text ?? '', p.nextAction?.date ?? '', isClosed(p.stage) ? '' : score(p)])]);
  return <>
    <Head title="Prospectos y oportunidades" lede={role() === 'asesor' ? 'Ves solo tus prospectos. Las reservas que crees quedan pendientes de aprobación de Gerencia comercial.' : 'Cada prospecto tiene responsable, próxima acción y condiciones para avanzar de etapa.'}
      actions={<Btn kind="primary" icon="plus" perm="crm_edit" onClick={openNewProspect}>Nuevo prospecto</Btn>} />
    <div className="tbl-tools">
      <input type="search" placeholder="Buscar por nombre" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar prospecto" />
      {can('crm_all') && <select value={adv} onChange={e => setAdv(e.target.value)} aria-label="Asesor"><option value="">Todos los asesores</option>{ADVISORS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}
      <select value={src} onChange={e => setSrc(e.target.value)} aria-label="Fuente"><option value="">Todas las fuentes</option>{SOURCES.map(s => <option key={s}>{s}</option>)}</select>
    </div>
    <Tabs value={tab} onChange={setTab} items={[['pipe', 'Embudo', active.length], ['list', 'Prospectos', list.length], ['perf', 'Rendimiento']]} />
    {tab === 'pipe' && <>
      <div className="kanban">{STAGES.slice(0, 8).map(s => { const items = active.filter(p => p.stage === s.k).sort((a, b) => score(b) - score(a)); return <div key={s.k} className="kcol"><div className="kcol-h"><span>{s.label}</span><span className="c">{items.length}</span></div>
        {items.length ? items.map(p => <KCard key={p.id} p={p} />) : <p className="meta" style={{ padding: '6px 2px' }}>Sin prospectos</p>}</div>; })}</div>
      <p className="meta" style={{ marginTop: 8 }}>{won} ganados · {lost} perdidos (ver pestaña Prospectos). La probabilidad en cada tarjeta es una <Tag est>estimación</Tag> por reglas: etapa, días sin actividad y presupuesto frente al lote más barato disponible de la categoría.</p>
    </>}
    {tab === 'list' && <>
      <div className="tbl-tools"><span className="meta">{rows.length} prospectos</span><span style={{ flex: 1 }} /><Btn sm icon="down" onClick={exportCSV}>Exportar CSV</Btn></div>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Prospecto</th><th>Etapa</th><th>Fuente</th><th>Asesor</th><th className="num">Presupuesto</th><th>Busca</th><th className="num">Sin actividad</th><th>Próxima acción</th><th className="num">Prob. est.</th></tr></thead>
        <tbody>{rows.map(p => <TR key={p.id} onOpen={() => openInsp('prospect', p.id)}>
          <td><b>{p.name}</b><span className="sub mono">{p.id}</span></td>
          <td>{stageLabel(p.stage)}{p.lostReason && <span className="sub">{p.lostReason}</span>}</td>
          <td>{p.source}</td><td><Av id={p.advisorId} /></td>
          <td className="num">{p.budgetC ? usd(p.budgetC) : '—'}</td><td>{catLabel(p.category)}</td>
          <td className={'num ' + (idleDays(p) > 7 && !isClosed(p.stage) ? 'st-vencida' : '')}>{idleDays(p)} d</td>
          <td>{p.nextAction ? <>{p.nextAction.text}<span className="sub">{D.fmt(p.nextAction.date)}</span></> : '—'}</td>
          <td className="num">{isClosed(p.stage) ? '—' : score(p) + ' %'}</td>
        </TR>)}{!rows.length && <tr><td colSpan={9} className="empty">Ningún prospecto coincide con los filtros.</td></tr>}</tbody></table></div>
    </>}
    {tab === 'perf' && <Perf list={list} />}
  </>;
}
