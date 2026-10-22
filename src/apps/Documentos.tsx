import { useState } from 'react';
import type { AppProps } from './registry';
import { CTR_ST, RES_ST, advName, catLabel } from '../domain/catalog';
import { can, commit, getBuyer, getLot, getProspect, log, me, role } from '../domain/store';
import { D, usd } from '../domain/util';
import { useDomain } from '../os/hooks';
import { Icon } from '../os/icons';
import { openInsp } from '../os/nav';
import { openDialog, toast } from '../os/overlay';
import { Btn, DL, Empty, Field, Head, Pill, val } from '../ui/kit';

/* Expedientes: explorador de documentos por contrato y por reserva vigente. */

type Sel = { kind: 'ctr' | 'res'; id: string };

function addDoc(cid: string) {
  openDialog({
    title: `Agregar documento · ${cid}`, submit: 'Agregar',
    body: <div className="grid2"><Field label="Nombre del documento"><input type="text" name="name" required maxLength={100} placeholder="Por ejemplo: Plano de mensura firmado" /></Field><Field label="Versión"><input type="number" name="v" min={1} defaultValue={1} required /></Field></div>,
    onSubmit: f => {
      const name = val(f, 'name'); const v = Math.round(+val(f, 'v'));
      if (name.length < 3) return 'Ingresá el nombre del documento.';
      if (!(v >= 1)) return 'La versión debe ser 1 o mayor.';
      log('Carga de documento', 'Contrato', cid, `${name} · v${v}`);
      commit(S => { S.contracts.find(c => c.id === cid)!.docs.push({ name, v, date: S.T }); });
      toast(`Documento agregado al expediente ${cid}.`);
    },
  });
}

export default function Documentos(_: AppProps) {
  const { S } = useDomain();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Sel | null>(null);
  const mine = (x: { advisorId: string }) => role() !== 'asesor' || x.advisorId === me().advisorId;
  const s = q.trim().toLowerCase();
  const hit = (...t: string[]) => !s || t.some(x => x.toLowerCase().includes(s));
  const ctrs = S.contracts.filter(c => mine(c) && hit(c.id, c.lotId, can('holder') ? getBuyer(c.buyerId).name : ''));
  const res = S.reservations.filter(r => ['vigente', 'pendiente_aprobacion'].includes(r.status) && mine(r) && hit(r.id, r.lotId, getProspect(r.prospectId)?.name ?? ''));
  const groups: [string, Sel[]][] = [
    ['Firmados', ctrs.filter(c => c.status === 'firmado').map(c => ({ kind: 'ctr', id: c.id }))],
    ['Pendientes de firma', ctrs.filter(c => c.status === 'pendiente_firma').map(c => ({ kind: 'ctr', id: c.id }))],
    ['Reservas vigentes', res.map(r => ({ kind: 'res', id: r.id }))],
  ];
  const cur = sel ?? groups.find(g => g[1].length)?.[1][0] ?? null;
  const label = (x: Sel) => { if (x.kind === 'ctr') { const c = S.contracts.find(c => c.id === x.id)!; return [c.id, `${c.lotId}${can('holder') ? ' · ' + getBuyer(c.buyerId).name : ''}`]; } const r = S.reservations.find(r => r.id === x.id)!; return [r.id, `${r.lotId} · ${getProspect(r.prospectId)?.name ?? ''}`]; };

  let detail = <Empty>Elegí un expediente.</Empty>;
  if (cur?.kind === 'ctr') {
    const c = S.contracts.find(x => x.id === cur.id)!; const l = getLot(c.lotId);
    detail = <>
      <div className="docs-h"><div><h2>{c.id}</h2><Pill cls={CTR_ST[c.status][1]}>{CTR_ST[c.status][0]}</Pill></div>
        <div className="vh-actions"><Btn sm icon="plus" perm="contracts_edit" onClick={() => addDoc(c.id)}>Agregar documento</Btn><Btn sm icon="ext" onClick={() => openInsp(c.status === 'firmado' ? 'acct' : 'ctr', c.id)}>Abrir ficha</Btn></div></div>
      <DL items={[['Lote', `${c.lotId} · ${catLabel(l.category)}`], ['Titular', can('holder') ? getBuyer(c.buyerId).name : 'Visible para perfiles autorizados'], ['Asesor', advName(c.advisorId)], ['Precio', usd(c.priceC)]]} />
      <ul className="files">{c.docs.map((d, i) => <li key={i}><Icon n="file" size={22} /><span><b>{d.name}</b><small>Versión {d.v} · {D.fmt(d.date)}</small></span></li>)}</ul>
    </>;
  } else if (cur?.kind === 'res') {
    const r = S.reservations.find(x => x.id === cur.id)!; const l = getLot(r.lotId); const p = getProspect(r.prospectId);
    detail = <>
      <div className="docs-h"><div><h2>{r.id}</h2><Pill cls={RES_ST[r.status][1]}>{RES_ST[r.status][0]}</Pill></div>
        <div className="vh-actions">{p && <Btn sm icon="ext" onClick={() => openInsp('prospect', p.id)}>Abrir prospecto</Btn>}<Btn sm icon="ext" onClick={() => openInsp('lot', r.lotId)}>Abrir lote</Btn></div></div>
      <DL items={[['Lote', `${r.lotId} · ${catLabel(l.category)}`], ['Prospecto', p?.name ?? '—'], ['Asesor', advName(r.advisorId)], ['Vence', D.fmt(r.expires)]]} />
      <ul className="files">{r.docs.map(d => <li key={d.k} className={d.ok ? '' : 'missing'}><Icon n={d.ok ? 'file' : 'alert'} size={22} /><span><b>{d.label}</b><small>{d.ok ? 'Recibido' : 'Falta'}</small></span></li>)}</ul>
      <p className="meta">La documentación de la reserva se marca desde Reservas y contratos.</p>
    </>;
  }

  return <>
    <Head title="Expedientes" lede="Documentos de cada contrato y de las reservas vigentes, con versión y fecha. Cada carga queda en la auditoría." />
    <div className="docs">
      <aside className="docs-side">
        <input type="search" placeholder="Contrato, lote o nombre" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar expediente" />
        {groups.map(([g, items]) => items.length > 0 && <div key={g} className="docs-grp"><h3>{g} <span className="meta">{items.length}</span></h3>
          {items.map(x => { const [a, b] = label(x); return <button key={x.id} type="button" className="docs-it" aria-pressed={cur?.id === x.id} onClick={() => setSel(x)}><Icon n={x.kind === 'ctr' ? 'docs' : 'res'} size={16} /><span><b className="mono">{a}</b><small>{b}</small></span></button>; })}</div>)}
        {groups.every(g => !g[1].length) && <p className="meta">Sin expedientes que coincidan.</p>}
      </aside>
      <section className="docs-main">{detail}</section>
    </div>
  </>;
}
