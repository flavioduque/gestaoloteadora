import { useState } from 'react';
import type { AppProps } from './registry';
import { CAT, LOT_ST, isClosed } from '../domain/catalog';
import { cashIn, duesIn, idleDays, periodWin, salesIn, visibleProspects, type Alert } from '../domain/derive';
import { commit, log, me, nowTs, role } from '../domain/store';
import type { Category } from '../domain/types';
import { D, downloadCSV, fmtMin, pct, usd, usdK } from '../domain/util';
import { useDomain } from '../os/hooks';
import { go } from '../os/nav';
import { openDialog, toast } from '../os/overlay';
import { CashChart, SimPanel } from '../ui/charts';
import { Funnel } from '../ui/funnel';
import { Box, Btn, Delta, Fig, Head, REASON_ERR, ReasonField, Sec, Seg, Tag, reasonOf } from '../ui/kit';

const ORDER = ['vendido', 'reservado', 'disponible', 'bloqueado', 'regularizacion'] as const;

export function resolveAlert(a: Alert) {
  openDialog({ title: 'Marcar alerta como resuelta', submit: 'Marcar resuelta',
    body: <><p><b>{a.title}</b></p><p className="meta">{a.cause}</p><ReasonField label="Cómo se resolvió" ph="Por ejemplo: el titular pagó por ventanilla, se registró la promesa…" /><p className="meta">Si la causa persiste, la alerta vuelve a aparecer cuando cambie la situación (por ejemplo, una nueva cuota vencida).</p></>,
    onSubmit: f => { const r = reasonOf(f); if (!r) return REASON_ERR; log('Alerta resuelta', 'Alerta', a.key.split(':').slice(0, 2).join(':'), a.title, r); commit(S => { S.resolved.unshift({ key: a.key, title: a.title, by: me().user, ts: nowTs(), note: r }); }); toast('Alerta marcada como resuelta.'); } });
}

export function AlertCard({ a }: { a: Alert }) {
  return <article className={'alert ' + a.sev}>
    <div><p className="a-area">{a.area} · {a.sev === 'critica' ? 'Crítica' : a.sev === 'alta' ? 'Alta' : 'Media'}</p><h3>{a.title}</h3><p className="a-cause">{a.cause}</p></div>
    <div><dl><dt>Responsable</dt><dd>{a.owner}</dd><dt>Fecha límite</dt><dd>{D.fmt(a.due)}</dd><dt>Acción</dt><dd>{a.action}</dd></dl></div>
    <div className="a-btns"><Btn sm onClick={() => go(a.go)}>Abrir</Btn>{role() === 'auditoria' ? <Btn sm kind="ghost" disabled why="Auditoría tiene acceso de solo lectura">Marcar resuelta</Btn> : <Btn sm kind="ghost" onClick={() => resolveAlert(a)}>Marcar resuelta</Btn>}</div>
  </article>;
}

export default function Direccion(_: AppProps) {
  const { S, DV } = useDomain();
  const [period, setPeriod] = useState('30');
  const [all, setAll] = useState(false);
  const w = periodWin(period);
  const s = salesIn(w.from, w.to), sp = w.pFrom ? salesIn(w.pFrom, w.pTo!) : null;
  const cb = cashIn(w.from, w.to), cbp = w.pFrom ? cashIn(w.pFrom, w.pTo!) : null;
  const dv = duesIn(w.from, w.to);
  const { inv, ar, alerts: al } = DV;
  const crit = al.filter(a => a.sev === 'critica').length;
  const resClosed = S.reservations.filter(r => ['cancelada', 'vencida'].includes(r.status) && D.diff(S.T, r.created) <= 90).length;
  const vp = visibleProspects().filter(p => !isClosed(p.stage));
  const stale = vp.filter(p => idleDays(p) > 7).length;
  const resp = S.prospects.filter(p => D.diff(S.T, p.created) <= 90); const respAvg = resp.length ? resp.reduce((a, p) => a + p.firstResponseMin, 0) / resp.length : 0;
  const cats = Object.keys(CAT) as Category[];
  const exportInv = () => downloadCSV(`inventario-${S.T}.csv`, [['lote', 'sector', 'categoria', 'estado', 'superficie_m2', 'precio_usd', 'usd_m2'], ...S.lots.map(l => [l.id, l.sector, CAT[l.category].label, LOT_ST[l.status].label, l.area.toFixed(2).replace('.', ','), (l.priceC / 100).toFixed(0), l.area ? (l.priceC / 100 / l.area).toFixed(2).replace('.', ',') : ''])]);

  return <>
    <Head title="Estado del negocio" actions={<Seg label="Período" value={period} onChange={setPeriod} items={[['30', '30 días'], ['90', '90 días'], ['365', '12 meses'], ['todo', 'Histórico']]} />}
      lede={<span className="summary">Al {D.fmt(S.T)} hay <b>{inv.byStatus.disponible} lotes disponibles</b> por {usdK(inv.availValueC)}. En {w.label.toLowerCase()} se firmaron <b>{s.n} contrato{s.n === 1 ? '' : 's'}</b> por {usdK(s.sumC)} y se cobraron <b>{usdK(cb)}</b>. La cartera tiene {usdK(ar.overdueC)} vencidos ({pct(ar.index)} de morosidad) y hay <b>{al.length} alertas abiertas</b>{crit ? `, ${crit} crítica${crit > 1 ? 's' : ''}` : ''}.</span>} />

    <Sec title="Alertas que requieren intervención" meta={`${al.length} abiertas · ${S.resolved.length} resueltas`}>
      <div className="alerts">{al.length ? (all ? al : al.slice(0, 4)).map(a => <AlertCard key={a.key} a={a} />) : <div className="empty box">No hay alertas abiertas. Las nuevas aparecen acá apenas se cumple una condición.</div>}</div>
      {al.length > 4 && <div style={{ marginTop: 10 }}><Btn sm onClick={() => setAll(x => !x)}>{all ? 'Mostrar solo las 4 más urgentes' : `Ver las ${al.length - 4} alertas restantes`}</Btn></div>}
      {S.resolved.length > 0 && <details className="resolved"><summary>Ver alertas resueltas ({S.resolved.length})</summary><ul>{S.resolved.map(r => <li key={r.key + r.ts}><b>{r.title}</b> — resuelta por {r.by} el {r.ts.replace('T', ' ').slice(0, 16)}. Nota: {r.note}</li>)}</ul></details>}
    </Sec>

    <Sec title="Inventario" meta={`${inv.total} lotes · valor disponible ${usd(inv.availValueC)}`} actions={<Btn sm kind="ghost" icon="down" onClick={exportInv}>CSV</Btn>}>
      <div className="stack" role="img" aria-label="Lotes por estado">{ORDER.filter(k => inv.byStatus[k]).map(k => <div key={k} className={LOT_ST[k].cls} style={{ flex: `${inv.byStatus[k]} 1 0` }} title={`${LOT_ST[k].label}: ${inv.byStatus[k]}`}>{inv.byStatus[k]}</div>)}</div>
      <div className="legend">{ORDER.map(k => <span key={k}><i style={{ background: `var(--m-${LOT_ST[k].cls})` }} />{LOT_ST[k].label} · {inv.byStatus[k]}</span>)}</div>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Categoría</th><th className="num">Lotes</th><th className="num">Disponibles</th><th className="num">Reservados</th><th className="num">Vendidos</th><th className="num">Bloq. / regul.</th><th className="num">Valor disponible</th><th className="num">USD / m² disp.</th></tr></thead>
        <tbody>{cats.map(k => { const b = inv.byCat[k]; return <tr key={k}><td>{CAT[k].label}</td><td className="num">{b.total}</td><td className="num">{b.disponible}</td><td className="num">{b.reservado}</td><td className="num">{b.vendido}</td><td className="num">{b.otros}</td><td className="num">{usd(b.availC)}</td><td className="num">{b.areaAvail ? usd(b.availC / b.areaAvail) : '—'}</td></tr>; })}</tbody>
        <tfoot><tr><td>Total</td><td className="num">{inv.total}</td><td className="num">{inv.byStatus.disponible}</td><td className="num">{inv.byStatus.reservado}</td><td className="num">{inv.byStatus.vendido}</td><td className="num">{inv.byStatus.bloqueado + inv.byStatus.regularizacion}</td><td className="num">{usd(inv.availValueC)}</td><td className="num" /></tr></tfoot></table></div>
    </Sec>

    <Sec title="Ventas, cobros y cartera" meta={`${w.label}${w.pFrom ? ' · comparado con el período anterior' : ''}`}>
      <div className="ledger">
        <Fig l="Ventas firmadas" v={usdK(s.sumC)} s={<>{s.n} contrato{s.n === 1 ? '' : 's'} <Delta cur={s.sumC} prev={sp?.sumC} /></>} d="Importe contractual de contratos firmados. No es dinero cobrado." />
        <Fig l="Cobrado (caja)" v={usdK(cb)} s={<Delta cur={cb} prev={cbp} />} d="Entradas y cuotas conciliadas con el banco, neto de reversiones. Excluye pagos en revisión." />
        <Fig l="Vencimientos del período" v={usdK(dv.dueC)} s={dv.dueC ? `${pct(dv.paidC / dv.dueC, 0)} ya cobrado` : 'sin vencimientos'} d="Cuotas exigibles con vencimiento en el período, cobradas o no." />
        <Fig l="Cuentas por cobrar" v={usdK(ar.outstandingC)} s={`vencido ${usdK(ar.overdueC + ar.disputedOverdueC)}`} d="Saldo de cuotas impagas de contratos firmados, vencidas y a vencer, al corte." />
        <Fig l="Índice de morosidad" v={pct(ar.index)} s={`${ar.lateN} de ${ar.N} cuentas con atraso`} d={`Saldo vencido impago ÷ cartera por cobrar.${ar.disputedOverdueC ? ` Excluye ${usd(ar.disputedOverdueC)} en disputa.` : ''}`} />
      </div>
      <div className="split">
        <Box><h3>Caja mensual: cobrado y vencimientos</h3><span className="meta">Seis meses atrás y seis adelante. Los meses futuros muestran cuotas programadas aún impagas.</span><CashChart /></Box>
        <Box><h3>Recaudación esperada</h3><span className="meta">Cuotas programadas impagas desde hoy</span>
          {([['30 d', DV.proj.d30], ['60 d', DV.proj.d60], ['90 d', DV.proj.d90]] as [string, number][]).map(([h, v]) => <div key={h} className="proj-row"><span className="h">{h}</span><span className="bar"><i style={{ width: `${DV.proj.d90 ? Math.round(v / DV.proj.d90 * 100) : 0}%` }} /></span><span className="v">{usd(v)}<small>est. {usd(v * (1 - ar.index))}</small></span></div>)}
          <p className="meta" style={{ marginTop: 10 }}><Tag est>Estimación</Tag> Ajustada por la morosidad actual ({pct(ar.index)}). Los importes programados son datos; el ajuste es una estimación.</p>
          <div className="proj-row"><span className="h">Venc.</span><span className="ink2" style={{ fontSize: 12.5 }}>Vencido sin cobrar</span><span className="v">{usd(ar.overdueC + ar.disputedOverdueC)}</span></div>
          <div className="proj-row"><span className="h">Res.</span><span className="ink2" style={{ fontSize: 12.5 }}>{DV.pendingForm.res} reservas y {DV.pendingForm.ctr} contratos por formalizar</span><span className="v">{usd(DV.pendingForm.sumC)}</span></div>
        </Box>
      </div>
    </Sec>

    <Sec title="Embudo comercial" meta="Datos observados de prospectos registrados">
      <div className="split" style={{ marginTop: 0 }}><Box><Funnel list={S.prospects} /></Box>
        <Box><h3>Ritmo comercial</h3><span className="meta">Últimos 90 días</span>
          {([['Respuesta media al primer contacto', fmtMin(respAvg)], ['Oportunidades activas sin actividad > 7 días', `${stale} de ${vp.length}`], ['Reservas canceladas o vencidas', resClosed], ['Reservas y contratos por formalizar', DV.pendingForm.n]] as [string, string | number][]).map(([l, v]) => <div key={l} className="proj-row" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}><span className="ink2">{l}</span><span className="v">{v}</span></div>)}
        </Box></div>
    </Sec>

    <Sec title="Análisis de escenarios" meta={<span className="sim-badge">SIMULACIÓN · NO MODIFICA REGISTROS</span>}><SimPanel /></Sec>
  </>;
}
