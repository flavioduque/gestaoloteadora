import { useState } from 'react';
import type { AppProps } from './registry';
import { CAT, LOT_ST, SECTOR, catLabel } from '../domain/catalog';
import { can, getLot } from '../domain/store';
import { shoreX } from '../domain/seed';
import type { Category, Lot, LotStatus } from '../domain/types';
import { m2, mulberry32, nf0, nf1, usd, usdK } from '../domain/util';
import { useDomain } from '../os/hooks';
import { Icon } from '../os/icons';
import { openInsp } from '../os/nav';
import { closeDialog, openDialog, toast } from '../os/overlay';
import { focused, useWins } from '../os/wm';
import { Box, Btn, Field, Head } from '../ui/kit';
import { planUI, setPlanUI, usePlanUI } from './planState';

const STATUSES = Object.keys(LOT_ST) as LotStatus[];
interface Filt { st: Record<LotStatus, boolean>; cat: '' | Category; maxPrice: string; minArea: string; mora: boolean }

function water() { let d = 'M0,0 L' + shoreX(0).toFixed(1) + ',0'; for (let y = 8; y <= 680; y += 8) d += ' L' + shoreX(y).toFixed(1) + ',' + y; return d + ' L0,680 Z'; }
const WATER = water();
const contour = (off: number) => { let s = ''; for (let y = 0; y <= 680; y += 10) s += (s ? ' ' : '') + (shoreX(y) + off).toFixed(1) + ',' + y; return s; };
const TREES = (() => { const tr = mulberry32(7); return Array.from({ length: 34 }, () => [822 + tr() * 130, 352 + tr() * 215, 4 + tr() * 5]); })();
const PS = shoreX(470);

/** Plano demostrativo del desarrollo. Cada polígono es un lote vinculado a su ficha. */
function MapSVG({ match, f, comm, sel }: { match: (l: Lot) => boolean; f: Filt; comm: boolean; sel?: string }) {
  const { S, DV } = useDomain();
  const showMora = f.mora && !comm && can('fin_view');
  return <svg className="map" viewBox="0 0 1000 680" role="group" aria-label="Plano demostrativo de Viva Lago Country">
    <defs><pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" style={{ fill: 'var(--m-bloq)' }} /><line x1="0" y1="0" x2="0" y2="7" style={{ stroke: 'var(--m-stroke)' }} strokeWidth="2.4" /></pattern></defs>
    <rect width="1000" height="680" style={{ fill: 'var(--m-land)' }} />
    <path className="water" d={WATER} />{[-20, -46, -80].map(o => <polyline key={o} className="wline" points={contour(o)} />)}
    <text className="lake-lbl" x="70" y="250" transform="rotate(-90 70 250)" textAnchor="middle">LAGO</text>
    <rect className="pier" x={PS - 74} y="466" width="76" height="7" /><rect className="pier" x={PS - 60} y="452" width="6" height="35" /><rect className="pier" x={PS - 36} y="452" width="6" height="35" />
    <text className="road-lbl" x={PS - 74} y="503">Muelle</text>
    <g><circle cx="44" cy="612" r="15" style={{ fill: 'none', stroke: 'var(--m-water-line)' }} /><path d="M44 599 l5 13 h-10 z" style={{ fill: 'var(--m-water-line)' }} /><text className="wm" x="44" y="644" textAnchor="middle">N</text></g>
    {[[355, 14, 625, 18], [355, 648, 625, 18], [355, 14, 38, 652], [558, 14, 36, 652], [758, 14, 36, 652], [392, 301, 402, 32], [794, 596, 206, 30]].map(([x, y, w, h], i) => <rect key={i} className="road" x={x} y={y} width={w} height={h} />)}
    <text className="road-lbl" x="374" y="170" transform="rotate(-90 374 170)" textAnchor="middle">Av. del Lago</text><text className="road-lbl" x="374" y="500" transform="rotate(-90 374 500)" textAnchor="middle">Av. del Lago</text>
    <text className="road-lbl" x="576" y="170" transform="rotate(-90 576 170)" textAnchor="middle">Calle Los Lapachos</text><text className="road-lbl" x="776" y="470" transform="rotate(-90 776 470)" textAnchor="middle">Calle Los Ceibos</text>
    <text className="road-lbl" x="476" y="321" textAnchor="middle">Calle Los Sauces</text><text className="road-lbl" x="676" y="321" textAnchor="middle">Calle Los Sauces</text>
    <text className="road-lbl" x="250" y="27" textAnchor="middle" style={{ fill: 'var(--m-water-line)' }}>Sector Ribera</text><text className="road-lbl" x="476" y="27" textAnchor="middle">Sector Los Sauces</text><text className="road-lbl" x="676" y="27" textAnchor="middle">Sector Parque</text>
    <rect className="bld" x="812" y="48" width="150" height="118" rx="4" /><text className="area-lbl" x="887" y="112" textAnchor="middle">CLUB HOUSE</text>
    <rect className="park" x="812" y="182" width="150" height="104" rx="4" />{[[824, 194], [892, 194]].map(([x, y]) => <rect key={x} x={x} y={y} width="58" height="80" style={{ fill: 'none', stroke: 'var(--m-stroke)' }} strokeWidth="1.5" />)}
    <line x1="824" x2="882" y1="234" y2="234" style={{ stroke: 'var(--m-stroke)' }} /><line x1="892" x2="950" y1="234" y2="234" style={{ stroke: 'var(--m-stroke)' }} />
    <text className="road-lbl" x="887" y="300" textAnchor="middle">Canchas</text>
    <rect className="park" x="812" y="342" width="150" height="236" rx="18" />{TREES.map(([x, y, r], i) => <circle key={i} className="tree" cx={x.toFixed(1)} cy={y.toFixed(1)} r={r.toFixed(1)} />)}<text className="area-lbl" x="887" y="466" textAnchor="middle">PARQUE</text>
    <rect className="bld" x="880" y="600" width="40" height="22" rx="2" /><text className="road-lbl" x="900" y="643" textAnchor="middle">Portería · acceso</text>
    {S.lots.map(l => {
      const m = match(l);
      const cls = comm ? (l.status === 'disponible' ? 'f-disp' : 'f-off') : 'f-' + LOT_ST[l.status].cls;
      const label = comm && l.status !== 'disponible' ? 'No disponible' : LOT_ST[l.status].label;
      const a = showMora && l.contractId ? DV.accts.get(l.contractId) : undefined; const late = a && a.overdueC > 0;
      return <g key={l.id}>
        <polygon className={`lot ${cls}${m ? '' : ' dim'}${sel === l.id ? ' sel' : ''}`} points={l.poly} tabIndex={0} role="button" aria-label={`Lote ${l.id}, ${catLabel(l.category)}, ${label}`}
          onClick={() => openInsp('lot', l.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openInsp('lot', l.id); } }}>
          <title>{`${l.id} · ${catLabel(l.category)} · ${label}${comm && l.status !== 'disponible' ? '' : ' · ' + usd(l.priceC)}`}</title></polygon>
        <text className={'lbl' + (m ? '' : ' dim')} x={l.cx.toFixed(1)} y={l.cy.toFixed(1)} textAnchor="middle">{l.id}</text>
        {late && <circle className="mora" cx={(l.cx + 30).toFixed(1)} cy={(l.cy - 9).toFixed(1)} r="4"><title>Indicador financiero: {usd(a!.overdueC)} vencidos</title></circle>}
      </g>;
    })}
    <text className="wm" x="12" y="672">PLANO DEMOSTRATIVO · FICTICIO · NO REPRESENTA LA MENSURA OFICIAL</text>
  </svg>;
}

export function openCompare() {
  const ids = planUI().compare; const ls = ids.map(getLot); const comm = planUI().commercial;
  const row = (label: string, fn: (l: Lot) => React.ReactNode) => <tr><td>{label}</td>{ls.map(l => <td key={l.id}>{fn(l)}</td>)}</tr>;
  const hide = (l: Lot) => comm && l.status !== 'disponible';
  openDialog({ title: 'Comparación de lotes', wide: true,
    body: <div className="tbl-wrap"><table className="tbl"><thead><tr><th />{ls.map(l => <th key={l.id} className="mono">{l.id}</th>)}</tr></thead><tbody>
      {row('Categoría', l => catLabel(l.category))}{row('Sector', l => SECTOR[l.sector])}{row('Superficie', l => m2(l.area))}
      {row('Frente × fondo', l => l.front != null ? `${nf1.format(l.front)} × ${nf1.format(l.depth!)} m` : '—')}
      {row('Precio', l => hide(l) ? '—' : usd(l.priceC))}{row('Precio por m²', l => hide(l) ? '—' : l.area ? usd(l.priceC / l.area) : '—')}
      {row('Características', l => l.features.map(f => <div key={f}>{f}</div>))}{row('Disponibilidad', l => comm ? (l.status === 'disponible' ? 'Disponible' : 'No disponible') : LOT_ST[l.status].label)}
    </tbody></table></div>,
    foot: <><Btn kind="ghost" onClick={() => { setPlanUI({ compare: [] }); closeDialog(); }}>Vaciar comparación</Btn>
      <Btn icon="copy" onClick={() => { const t = ls.map(l => `Lote ${l.id} · ${catLabel(l.category)} · ${m2(l.area)} · ${l.status === 'disponible' ? usd(l.priceC) : 'No disponible'}`).join('\n'); navigator.clipboard?.writeText('Viva Lago Country — comparación de lotes\n' + t).then(() => toast('Resumen copiado al portapapeles.'), () => toast('Tu navegador no permitió copiar.', true)); }}>Copiar resumen</Btn>
      <Btn kind="primary" onClick={closeDialog}>Listo</Btn></> });
}

export default function Masterplan(_: AppProps) {
  const { S, DV } = useDomain();
  const ui = usePlanUI(); const comm = ui.commercial;
  useWins();
  const fw = focused(); const sel = fw?.app === 'insp' && fw.params.kind === 'lot' ? fw.params.id : undefined;
  const [f, setF] = useState<Filt>({ st: { disponible: true, reservado: true, vendido: true, bloqueado: true, regularizacion: true }, cat: '', maxPrice: '', minArea: '', mora: true });
  const match = (l: Lot) => {
    if (comm) { if (l.status !== 'disponible') return false; } else if (!f.st[l.status]) return false;
    if (f.cat && l.category !== f.cat) return false;
    if (f.maxPrice && l.priceC > +f.maxPrice * 100) return false;
    if (f.minArea && (l.area || 0) < +f.minArea) return false;
    return true;
  };
  const matches = S.lots.filter(match); const inv = DV.inv;
  const lg: [string, string, number][] = comm ? [['disp', 'Disponible', inv.byStatus.disponible], ['off', 'No disponible', inv.total - inv.byStatus.disponible]] : STATUSES.map(k => [LOT_ST[k].cls, LOT_ST[k].label, inv.byStatus[k]]);
  return <>
    <Head title={comm ? 'Lotes disponibles' : 'Plano interactivo del desarrollo'}
      lede={comm ? 'Vista para presentar a un interesado: solo lotes disponibles, sin datos financieros, titulares ni notas internas.' : 'Cada lote está conectado con su ficha, reserva, contrato y cuenta. Abrí varios lotes a la vez: cada ficha queda en su propia ventana.'}
      actions={<><label className="toggle"><input type="checkbox" checked={comm} onChange={e => setPlanUI({ commercial: e.target.checked })} /> Modo comercial</label>
        {!comm && can('fin_view') && <label className="toggle"><input type="checkbox" checked={f.mora} onChange={e => setF({ ...f, mora: e.target.checked })} /> Indicador de mora</label>}</>} />
    {comm && <div className="commercial-banner">Modo comercial activo. Datos internos ocultos. <Btn sm onClick={() => setPlanUI({ commercial: false })}>Salir</Btn></div>}
    {!comm && <div className="filters"><div className="field" style={{ width: 'auto' }}><span>Estado</span><div className="chips">{STATUSES.map(k =>
      <button key={k} type="button" className="chip" aria-pressed={f.st[k]} onClick={() => setF({ ...f, st: { ...f.st, [k]: !f.st[k] } })}><i style={{ background: `var(--m-${LOT_ST[k].cls})` }} />{LOT_ST[k].label}</button>)}</div></div></div>}
    <div className="filters">
      <Field label="Categoría"><select value={f.cat} onChange={e => setF({ ...f, cat: e.target.value as Filt['cat'] })}><option value="">Todas</option>{(Object.keys(CAT) as Category[]).map(k => <option key={k} value={k}>{CAT[k].label}</option>)}</select></Field>
      <Field label="Precio máximo"><select value={f.maxPrice} onChange={e => setF({ ...f, maxPrice: e.target.value })}><option value="">Sin límite</option>{[40000, 60000, 80000, 100000, 130000].map(v => <option key={v} value={v}>USD {nf0.format(v)}</option>)}</select></Field>
      <Field label="Superficie mínima"><select value={f.minArea} onChange={e => setF({ ...f, minArea: e.target.value })}><option value="">Cualquiera</option>{[800, 1000, 1200, 1400].map(v => <option key={v} value={v}>{nf0.format(v)} m²</option>)}</select></Field>
      <span className="meta" style={{ paddingBottom: 9 }}>{matches.length} lote{matches.length === 1 ? '' : 's'} coinciden{comm ? '' : ` · ${usd(matches.filter(l => l.status === 'disponible').reduce((s, l) => s + l.priceC, 0))} disponibles`}</span>
    </div>
    <div className="plan-layout">
      <div className="map-wrap"><MapSVG match={match} f={f} comm={comm} sel={sel} /></div>
      <div className="side">
        <Box><h2 className="h3" style={{ marginBottom: 8 }}>{comm ? 'Disponibilidad' : 'Estado del inventario'}</h2>
          {lg.map(([c, l, n]) => <div key={c} className="lg-row"><i style={{ background: c === 'bloq' ? 'repeating-linear-gradient(45deg,var(--m-bloq) 0 4px,var(--m-stroke) 4px 6px)' : `var(--m-${c})` }} />{l}<span className="c">{n}</span></div>)}
          {!comm && can('fin_view') && f.mora && <div className="lg-row"><i style={{ background: 'var(--crit)', borderRadius: '50%', width: 9, height: 9, margin: '0 1.5px' }} />Cuota vencida (indicador financiero)<span className="c">{[...DV.accts.values()].filter(a => a.overdueC > 0).length}</span></div>}
        </Box>
        <Box><h2 className="h3" style={{ marginBottom: 8 }}>Comparar lotes</h2>
          {ui.compare.length ? <><div className="cmp-list">{ui.compare.map(id => { const l = getLot(id); return <div key={id}><span><b className="mono">{id}</b> · {catLabel(l.category)} · {usdK(l.priceC)}</span><button type="button" className="iconbtn" onClick={() => setPlanUI({ compare: ui.compare.filter(x => x !== id) })} aria-label={`Quitar ${id}`}><Icon n="x" size={14} /></button></div>; })}</div>
            <div style={{ marginTop: 10 }}><Btn sm kind="primary" onClick={openCompare}>Comparar {ui.compare.length}</Btn></div></>
            : <p className="meta">Abrí un lote y usá “Agregar a comparación”. Hasta 3 lotes.</p>}
        </Box>
        <Box><p className="meta">Geometría demostrativa. En producción el plano se importa desde la mensura oficial (DWG o GeoJSON) y cada polígono queda vinculado al registro maestro del lote.</p></Box>
      </div>
    </div>
  </>;
}
