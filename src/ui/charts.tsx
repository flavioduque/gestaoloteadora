import { useMemo, useState } from 'react';
import { simBase, simulate, type SimParams } from '../domain/derive';
import { useDomain } from '../os/hooks';
import { D, MES, nf0, nf1, usd, usdK } from '../domain/util';

export function niceMax(v: number) { if (v <= 0) return 1; const e = Math.pow(10, Math.floor(Math.log10(v))); const f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; }
const k = (v: number) => usdK(v).replace('USD ', '');

/** Caja mensual: seis meses de vencimientos vs. cobrado y seis de cuotas programadas. */
export function CashChart() {
  const { S, DV } = useDomain();
  const T = S.T, cur = D.monthStart(T);
  const months = Array.from({ length: 12 }, (_, i) => ({ ym: D.ym(D.addM(cur, i - 6, 1)), k: i - 6, venc: 0, cob: 0, prog: 0 }));
  const by = Object.fromEntries(months.map(m => [m.ym, m]));
  DV.accts.forEach(a => a.rows.forEach(r => { const m = by[D.ym(r.due)]; if (!m) return; if (m.k <= 0) m.venc += r.amountC; else m.prog += r.left; }));
  S.ledger.forEach(e => { if (!['entrada', 'pago', 'reversion'].includes(e.type)) return; const m = by[D.ym(e.date)]; if (m && m.k <= 0) m.cob += e.amountC; });
  const W = 640, H = 230, L = 58, R = 8, Tp = 12, B = 30, iw = W - L - R, ih = H - Tp - B;
  const mx = niceMax(Math.max(...months.map(m => Math.max(m.venc, m.cob, m.prog))));
  const y = (v: number) => Tp + ih - (v / mx) * ih; const slot = iw / months.length; const bw = slot * .32;
  const xt = L + 7 * slot;
  return <>
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Cobrado y vencimientos por mes">
      {[0, 1, 2, 3, 4].map(i => { const v = mx * i / 4; return <g key={i}><line className="grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} /><text x={L - 6} y={y(v) + 4} textAnchor="end">{k(v)}</text></g>; })}
      {months.map((m, i) => { const cx = L + i * slot + slot / 2; const lbl = MES[+m.ym.slice(5) - 1]; return <g key={m.ym}>
        {m.k <= 0 ? <>
          <rect x={cx - bw - 1} y={y(m.venc)} width={bw} height={Tp + ih - y(m.venc)} style={{ fill: 'var(--chart-b)' }} rx={2}><title>{lbl}: vencimientos {usd(m.venc)}</title></rect>
          <rect x={cx + 1} y={y(Math.max(0, m.cob))} width={bw} height={Math.max(0, Tp + ih - y(Math.max(0, m.cob)))} style={{ fill: 'var(--chart-a)' }} rx={2}><title>{lbl}: cobrado {usd(m.cob)}</title></rect>
        </> : <rect x={cx - bw / 2} y={y(m.prog)} width={bw} height={Tp + ih - y(m.prog)} style={{ fill: 'var(--chart-c)' }} rx={2}><title>{lbl}: programado {usd(m.prog)}</title></rect>}
        <text x={cx} y={H - 10} textAnchor="middle" style={m.k === 0 ? { fill: 'var(--ink)', fontWeight: 600 } : undefined}>{lbl}</text></g>; })}
      <line className="today" x1={xt} x2={xt} y1={Tp} y2={Tp + ih} /><text x={xt + 4} y={Tp + 10} style={{ fill: 'var(--brass)' }}>hoy</text>
      <line className="axis" x1={L} x2={W - R} y1={Tp + ih} y2={Tp + ih} />
    </svg>
    <div className="legend" style={{ marginBottom: 0 }}><span><i style={{ background: 'var(--chart-b)' }} />Vencimientos (exigible)</span><span><i style={{ background: 'var(--chart-a)' }} />Cobrado (caja)</span><span><i style={{ background: 'var(--chart-c)' }} />Programado a cobrar</span></div>
  </>;
}

const FMT: Record<keyof SimParams, (v: number) => string> = { rate: v => nf1.format(v) + ' lotes/mes', adj: v => (v > 0 ? '+' : '') + v + ' %', down: v => v + ' %', n: v => v + ' cuotas', mor: v => nf1.format(v) + ' %' };
const RANGES: [keyof SimParams, string, number, number, number][] = [['rate', 'Ritmo de venta', .5, 8, .5], ['adj', 'Ajuste de precio de lista', -15, 20, 1], ['down', 'Entrada', 10, 60, 5], ['n', 'Plazo de financiación', 12, 96, 6], ['mor', 'Morosidad esperada', 0, 30, .5]];

/** Simulador de escenarios: cartera existente + ventas simuladas a 24 meses. No modifica registros. */
export function SimPanel() {
  const { ver, S } = useDomain();
  const base = useMemo(() => simBase(), [ver]); // eslint-disable-line react-hooks/exhaustive-deps
  const [p, setP] = useState<SimParams>(base);
  const b = useMemo(() => simulate(base), [base]);
  const s = useMemo(() => simulate(p), [p, ver]); // eslint-disable-line react-hooks/exhaustive-deps
  const d = (x: number, y: number) => { const r = y ? (x - y) / Math.abs(y) : 0; return <span className={`delta ${Math.abs(r) < .005 ? 'flat' : r > 0 ? 'up' : 'down'}`}>{r > 0 ? '+' : ''}{nf0.format(r * 100)} %</span>; };
  const W = 600, H = 170, L = 50, R = 6, Tp = 10, B = 22, iw = W - L - R, ih = H - Tp - B;
  const mx = niceMax(Math.max(...s.m.map(x => x.base + x.neu), ...b.m.map(x => x.base + x.neu)));
  const sl = iw / 24, bw = sl * .62;
  return <div className="sim">
    <div className="sim-in box">
      {RANGES.map(([key, label, min, max, step]) => <div className="range" key={key}><div className="top"><label htmlFor={'sim-' + key}>{label}</label><b>{FMT[key](p[key])}</b></div>
        <input type="range" id={'sim-' + key} min={min} max={max} step={step} value={p[key]} onChange={e => setP(o => ({ ...o, [key]: +e.target.value }))} /></div>)}
      <button type="button" className="btn sm ghost" onClick={() => setP(base)}>Volver al escenario base</button>
      <p className="meta">Escenario base calculado con datos reales: ventas de los últimos 12 meses, entrada y plazo promedio de contratos firmados y morosidad actual.</p>
    </div>
    <div className="box">
      <h3>Caja proyectada a 24 meses</h3><span className="meta">Cartera existente + ventas simuladas. La línea punteada es el escenario base.</span>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Caja simulada por mes">
        {[0, 1, 2, 3].map(i => { const v = mx * i / 3, yy = Tp + ih - (v / mx) * ih; return <g key={i}><line className="grid" x1={L} x2={W - R} y1={yy} y2={yy} /><text x={L - 6} y={yy + 4} textAnchor="end">{k(v)}</text></g>; })}
        {s.m.map((x, i) => { const hb = x.base / mx * ih, hn = x.neu / mx * ih, x0 = L + i * sl + (sl - bw) / 2; return <g key={i}>
          <rect x={x0} y={Tp + ih - hb} width={bw} height={hb} style={{ fill: 'var(--chart-c)' }} /><rect x={x0} y={Tp + ih - hb - hn} width={bw} height={hn} style={{ fill: 'var(--chart-a)' }} />
          {i % 3 === 0 && <text x={x0 + bw / 2} y={H - 6} textAnchor="middle">{MES[+D.addM(D.monthStart(S.T), i, 1).slice(5, 7) - 1]}</text>}</g>; })}
        <polyline points={b.m.map((x, i) => `${L + i * sl + sl / 2},${Tp + ih - (x.base + x.neu) / mx * ih}`).join(' ')} fill="none" style={{ stroke: 'var(--brass)' }} strokeWidth={1.5} strokeDasharray="4 3" />
      </svg>
      <div className="legend" style={{ marginBottom: 0 }}><span><i style={{ background: 'var(--chart-c)' }} />Cartera existente</span><span><i style={{ background: 'var(--chart-a)' }} />Ventas simuladas</span><span><i style={{ background: 'var(--brass)' }} />Base</span></div>
      <div className="cmp">
        <div><div className="l">Caja 12 meses</div><div className="v">{usdK(s.cash12)}</div><div className="s">{d(s.cash12, b.cash12)} vs base {usdK(b.cash12)}</div></div>
        <div><div className="l">Ventas contratadas 24 meses</div><div className="v">{usdK(s.salesC)}</div><div className="s">{s.sold} lotes · {d(s.salesC, b.salesC)}</div></div>
        <div><div className="l">Inventario disponible agotado</div><div className="v">{s.soldOut ? `mes ${s.soldOut}` : '> 24 meses'}</div><div className="s">base: {b.soldOut ? `mes ${b.soldOut}` : '> 24 meses'} · {s.stock} lotes hoy</div></div>
      </div>
    </div>
  </div>;
}
