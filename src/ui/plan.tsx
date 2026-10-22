import { useState } from 'react';
import type { Installment } from '../domain/types';
import type { Row } from '../domain/derive';
import { makePlan, planMethod } from '../domain/finance';
import { D, usd2 } from '../domain/util';
import { DL, Field } from './kit';

/** Calendario de cuotas; con `limit` resume el medio con “…”. */
export function ScheduleTable({ rows, limit }: { rows: (Installment | Row)[]; limit?: number }) {
  const r: ((Installment | Row) | null)[] = limit && rows.length > limit ? [...rows.slice(0, limit - 1), null, rows[rows.length - 1]] : rows;
  const withSt = rows[0] && 'st' in rows[0];
  const cls = (st: string) => st === 'parcial vencida' ? 'st-vencida' : st.startsWith('parcial') ? 'st-parcial' : 'st-' + st;
  return <div className="tbl-wrap"><table className="tbl"><thead><tr><th className="num">N.º</th><th>Vencimiento</th><th className="num">Cuota</th><th className="num">Capital</th><th className="num">Interés</th>{withSt && <><th className="num">Pagado</th><th>Estado</th></>}</tr></thead>
    <tbody>{r.map((x, i) => x ? <tr key={x.n}><td className="num">{x.n}</td><td>{D.fmt(x.due)}</td><td className="num">{usd2(x.amountC)}</td><td className="num">{usd2(x.principalC)}</td><td className="num">{usd2(x.interestC)}</td>
      {'st' in x && <><td className="num">{usd2(x.paid)}</td><td className={cls(x.st)}>{x.st}</td></>}</tr>
      : <tr key={'gap' + i}><td colSpan={7} className="meta" style={{ textAlign: 'center' }}>…</td></tr>)}</tbody></table></div>;
}

export interface PlanVals { price: number; down: number; n: number; rate: number; first: string; round: 'centavo' | 'dolar' }
export const readPlan = (f: FormData): PlanVals => ({ price: +(f.get('price') ?? 0), down: +(f.get('down') ?? 30), n: +(f.get('n') ?? 60), rate: +(f.get('rate') ?? 0) || 0, first: String(f.get('first') ?? ''), round: (f.get('round') as 'centavo' | 'dolar') || 'centavo' });

/** Parámetros del plan con vista previa en vivo calculada por el mismo motor que usa el contrato. */
export function PlanFields({ init }: { init: PlanVals }) {
  const [v, setV] = useState(init);
  const set = (k: keyof PlanVals) => (e: { target: { value: string } }) => setV(o => ({ ...o, [k]: k === 'first' || k === 'round' ? e.target.value : +e.target.value }));
  return <>
    <div className="grid3">
      <Field label="Precio contractual (USD)"><input type="number" name="price" min={1000} step={100} value={v.price || ''} onChange={set('price')} required /></Field>
      <Field label="Entrada"><select name="down" value={v.down} onChange={set('down')}>{[10, 15, 20, 25, 30, 35, 40, 50].map(x => <option key={x} value={x}>{x} %</option>)}</select></Field>
      <Field label="Cantidad de cuotas"><select name="n" value={v.n} onChange={set('n')}>{[12, 24, 36, 48, 60, 72, 84, 96].map(x => <option key={x}>{x}</option>)}</select></Field>
      <Field label="Interés nominal anual (%)"><input type="number" name="rate" min={0} max={30} step={0.5} value={v.rate} onChange={set('rate')} /></Field>
      <Field label="Primer vencimiento"><input type="date" name="first" value={v.first} onChange={set('first')} required /></Field>
      <Field label="Redondeo"><select name="round" value={v.round} onChange={set('round')}><option value="centavo">Al centavo</option><option value="dolar">Al dólar</option></select></Field>
    </div>
    <PlanPreview v={v} />
  </>;
}

export function PlanPreview({ v }: { v: PlanVals }) {
  if (!v.price || v.price < 1000) return <p className="f-err">Ingresá un precio válido (mínimo USD 1.000).</p>;
  if (v.rate < 0 || v.rate > 30) return <p className="f-err">La tasa debe estar entre 0 y 30 %.</p>;
  if (!v.first) return <p className="f-err">Elegí la fecha del primer vencimiento.</p>;
  const pl = makePlan({ priceC: Math.round(v.price * 100), downPct: v.down, n: v.n, rate: v.rate / 100, firstDue: v.first, rounding: v.round });
  const sumP = pl.installments.reduce((s, i) => s + i.principalC, 0), totI = pl.installments.reduce((s, i) => s + i.interestC, 0);
  const ok = sumP === pl.financedC;
  const first = pl.installments[0].amountC, last = pl.installments[pl.n - 1].amountC;
  return <div className="plan-prev">
    <DL items={[['Entrada', usd2(pl.downC)], ['Importe financiado', usd2(pl.financedC)], ['Cuota', `${usd2(first)}${last !== first ? ` · última ${usd2(last)}` : ''}`], ['Total a pagar', usd2(pl.downC + pl.financedC + totI)]]} />
    <p className="meta"><b className={ok ? 'st-pagada' : 'st-vencida'}>{ok ? '✓' : '✗'} Suma de capital de las cuotas = importe financiado ({usd2(sumP)})</b></p>
    <div className="note"><b>Método:</b> {planMethod(pl)}</div>
    <ScheduleTable rows={pl.installments} limit={5} />
  </div>;
}
