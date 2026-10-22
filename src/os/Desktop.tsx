import { useEffect, useMemo, useRef, useState } from 'react';
import { APPS, allowed, appDef } from '../apps/registry';
import { CAT, LOT_ST, ROLES, catLabel, stageLabel } from '../domain/catalog';
import { agendaItems, type Alert, type Target } from '../domain/derive';
import { can, commit, getBuyer, me, nowTs, resetDemo, log, role, setRole, st } from '../domain/store';
import type { RoleKey } from '../domain/types';
import { D, DOW, MESL, pct, usd, usdK } from '../domain/util';
import { useDomain } from './hooks';
import { Icon, LotiaMark } from './icons';
import { go, openApp, openInsp } from './nav';
import { OverlayHost, openDialog, toast } from './overlay';
import { Window } from './Window';
import { closeAll, dockClick, focused, isMobile, minimizeAll, open, useWins } from './wm';
import { ReasonField, reasonOf, REASON_ERR } from '../ui/kit';

/* ——— Reloj (bandeja del sistema) ——— */
function Clock() {
  const [n, setN] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setN(new Date()), 15000); return () => clearInterval(t); }, []);
  return <span className="tb-clock" aria-label="Hora"><span>{String(n.getHours()).padStart(2, '0')}:{String(n.getMinutes()).padStart(2, '0')}</span><span>{String(n.getDate()).padStart(2, '0')}/{String(n.getMonth() + 1).padStart(2, '0')}/{n.getFullYear()}</span></span>;
}

function askReset() {
  openDialog({ title: 'Reiniciar la demo', body: <p>Se descartan todos los cambios hechos en esta demo y se regeneran los datos ficticios con fecha de corte de hoy. No afecta información real.</p>, submit: 'Reiniciar', danger: true, onSubmit: () => { resetDemo(); closeAll(); toast('Demo reiniciada con datos ficticios nuevos.'); } });
}

function changeRole(r: RoleKey) {
  setRole(r); closeAll();
  toast(`Viendo como ${ROLES[r].label}.`);
  const a = r === 'propietario' ? 'portal' : r === 'asesor' ? 'crm' : r === 'finanzas' ? 'fin' : 'dir';
  open(a, {}, appDef(a).size);
}

/* ——— Menú Inicio: apps ancladas, recomendados y sesión ——— */
function StartMenu({ onClose, onSearch }: { onClose: () => void; onSearch: () => void }) {
  const { S } = useDomain();
  const [power, setPower] = useState(false);
  const apps = APPS.filter(a => a.id !== 'insp' && allowed(a));
  const rec = agendaItems(S.T, D.add(S.T, 2)).filter(i => i.go).slice(0, 6);
  const run = (fn: () => void) => { onClose(); fn(); };
  return <div className="start" role="dialog" aria-label="Inicio" onPointerDown={e => e.stopPropagation()}>
    <div className="start-b">
      <button type="button" className="start-search" onClick={() => run(onSearch)}><Icon n="search" size={16} />Buscar apps, lotes, prospectos y contratos</button>
      <section><h2>Anclado</h2><div className="start-grid" style={{ marginTop: 8 }}>
        {apps.map(a => <button key={a.id} type="button" className="start-app" onClick={() => run(() => openApp(a.id))}><span className={`tile t-${a.tint}`}><Icon n={a.icon} size={18} /></span>{a.title}</button>)}
      </div></section>
      {rec.length > 0 && <section><h2>Recomendado</h2><div className="start-rec" style={{ marginTop: 8 }}>
        {rec.map(i => <button key={i.id} type="button" onClick={() => run(() => go(i.go!))}><span className={'k k-' + i.kind} /><span>{i.title}<small>{D.fmtS(i.date)}{i.time ? ' · ' + i.time : ''} · {i.sub}</small></span></button>)}
      </div></section>}
    </div>
    <footer className="start-f">
      <div className="start-user"><span className="av">{me().user.split(' ').map(x => x[0]).slice(0, 2).join('')}</span><span>{me().user}<small>{me().label} · Viva Lago Country (demo)</small></span></div>
      <div className="power">
        <button type="button" className="tb-it" aria-label="Opciones de sesión" aria-expanded={power} onClick={() => setPower(p => !p)}><Icon n="power" /></button>
        {power && <div className="menu" role="menu">
          <button role="menuitem" onClick={() => run(() => openApp('tour'))}><Icon n="tour" />Recorrido ejecutivo</button>
          <button role="menuitem" onClick={() => run(() => openApp('settings'))}><Icon n="settings" />Configuración</button>
          <hr />
          <button role="menuitem" onClick={() => run(minimizeAll)}><Icon n="grid" />Mostrar escritorio</button>
          <button role="menuitem" onClick={() => run(closeAll)}><Icon n="x" />Cerrar todas las ventanas</button>
          <hr />
          <button role="menuitem" onClick={() => run(askReset)}><Icon n="reset" />Reiniciar la demo…</button>
        </div>}
      </div>
    </footer>
  </div>;
}

/* ——— Barra de tareas: Inicio, búsqueda, apps ancladas y abiertas, bandeja ——— */
function Taskbar({ start, onStart, onSearch, onBell, alerts }: { start: boolean; onStart: () => void; onSearch: () => void; onBell: () => void; alerts: Alert[] }) {
  const wins = useWins();
  const { S, DV } = useDomain();
  const f = focused();
  const apps = APPS.filter(a => a.dock && allowed(a));
  const hot = alerts.filter(a => a.sev !== 'media').length;
  const badge = (id: string) => {
    if (id === 'dir') return DV.alerts.filter(a => a.sev !== 'media').length;
    if (id === 'fin' && can('fin_view')) return S.bank.filter(b => b.status === 'pendiente').length;
    if (id === 'res') return S.reservations.filter(r => ['vigente', 'pendiente_aprobacion'].includes(r.status)).length;
    if (id === 'comms' && can('comms')) return S.requests.filter(r => r.status === 'abierta').length;
    return 0;
  };
  const insp = wins.filter(w => w.app === 'insp');
  return <nav className="taskbar" aria-label="Barra de tareas">
    <div className="tb-left" />
    <div className="tb-center">
      <button type="button" className="tb-it" aria-label="Inicio" aria-expanded={start} onPointerDown={e => e.stopPropagation()} onClick={onStart}><LotiaMark size={24} /><span className="tb-tip">Inicio</span></button>
      <button type="button" className="tb-it" aria-label="Buscar (Ctrl+K)" onClick={onSearch}><Icon n="search" size={20} /><span className="tb-tip">Buscar · Ctrl+K</span></button>
      <span className="tb-sep" />
      {apps.map(a => { const w = wins.find(x => x.id === a.id); const n = badge(a.id); return (
        <button key={a.id} type="button" className={`tb-it${w ? ' open' : ''}${f?.id === a.id ? ' front' : ''}`} onClick={() => dockClick(a.id, a.size)} aria-label={a.title + (n ? `, ${n} pendientes` : '')}>
          <span className={`tile t-${a.tint}`}><Icon n={a.icon} size={16} /></span>
          {n > 0 && <span className="tb-badge">{n}</span>}
          <span className="tb-tip">{a.title}</span>
        </button>); })}
      {insp.slice(-4).map(w => <button key={w.id} type="button" className={`tb-it open${f?.id === w.id ? ' front' : ''}`} onClick={() => dockClick(w.id)} aria-label={`Ficha ${w.params.id}`}>
        <span className="tile t-paper"><span className="mono">{w.params.id.replace('VLC-', '')}</span></span><span className="tb-tip">Ficha {w.params.id}</span></button>)}
    </div>
    <div className="tb-right">
      <label className="tb-role"><Icon n="user" size={15} /><span className="sr">Ver como</span>
        <select value={role()} onChange={e => changeRole(e.target.value as RoleKey)} aria-label="Ver como">{(Object.keys(ROLES) as RoleKey[]).map(k => <option key={k} value={k}>{ROLES[k].label}</option>)}</select>
      </label>
      {can('exec') && <button type="button" className="tb-it" onClick={onBell} aria-label={`Alertas: ${alerts.length}`}><Icon n="bell" size={18} />{hot > 0 && <span className="tb-badge">{hot}</span>}<span className="tb-tip">Alertas</span></button>}
      <Clock />
    </div>
  </nav>;
}

/* ——— Spotlight ——— */
interface Hit { key: string; label: string; sub: string; icon: string; run: () => void }
function Spotlight({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState(''); const [ix, setIx] = useState(0);
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => { inp.current?.focus(); }, []);
  const hits = useMemo<Hit[]>(() => {
    const S = st(); const s = q.trim().toLowerCase(); const out: Hit[] = [];
    const m = (t: string) => !s || t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(s.normalize('NFD').replace(/[̀-ͯ]/g, ''));
    APPS.filter(a => a.id !== 'insp' && allowed(a) && m(a.title)).forEach(a => out.push({ key: 'a' + a.id, label: a.title, sub: 'Aplicación', icon: a.icon, run: () => openApp(a.id) }));
    if (!s) return out;
    if (can('plan')) S.lots.filter(l => m(l.id) || m(catLabel(l.category))).slice(0, 6).forEach(l => out.push({ key: 'l' + l.id, label: `Lote ${l.id}`, sub: `${catLabel(l.category)} · ${LOT_ST[l.status].label}${l.status === 'disponible' ? ' · ' + usd(l.priceC) : ''}`, icon: 'plan', run: () => go({ kind: 'insp', insp: 'lot', id: l.id }) }));
    if (can('crm')) S.prospects.filter(p => (can('crm_all') || p.advisorId === me().advisorId) && (m(p.name) || m(p.id))).slice(0, 6).forEach(p => out.push({ key: 'p' + p.id, label: p.name, sub: `Prospecto · ${stageLabel(p.stage)}`, icon: 'crm', run: () => go({ kind: 'insp', insp: 'prospect', id: p.id }) }));
    if (can('res') || can('fin_view')) S.contracts.filter(c => (can('holder') || !me().advisorId || c.advisorId === me().advisorId) && (m(c.id) || m(c.lotId) || (can('holder') && m(getBuyer(c.buyerId).name)))).slice(0, 6).forEach(c => out.push({ key: 'c' + c.id, label: `${c.id} · ${c.lotId}`, sub: can('holder') ? getBuyer(c.buyerId).name : 'Contrato', icon: can('fin_view') ? 'fin' : 'res', run: () => go({ kind: 'insp', insp: can('fin_view') && c.status === 'firmado' ? 'acct' : 'ctr', id: c.id }) }));
    return out.slice(0, 14);
  }, [q]);
  const run = (h?: Hit) => { if (!h) return; onClose(); h.run(); };
  return <div className="spot-wrap" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="spot" role="dialog" aria-label="Buscar">
      <div className="spot-in"><Icon n="search" size={20} /><input ref={inp} value={q} placeholder="Buscar apps, lotes, prospectos, contratos…" aria-label="Buscar" role="combobox" aria-expanded="true" aria-controls="spot-list"
        onChange={e => { setQ(e.target.value); setIx(0); }}
        onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setIx(i => Math.min(i + 1, hits.length - 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setIx(i => Math.max(i - 1, 0)); } else if (e.key === 'Enter') run(hits[ix]); else if (e.key === 'Escape') onClose(); }} /></div>
      <ul className="spot-list" id="spot-list" role="listbox">{hits.map((h, i) => <li key={h.key} role="option" aria-selected={i === ix}><button type="button" onPointerEnter={() => setIx(i)} onClick={() => run(h)}><Icon n={h.icon} /><span><b>{h.label}</b><small>{h.sub}</small></span>{i === ix && <kbd>↵</kbd>}</button></li>)}
        {!hits.length && <li className="spot-empty">Sin resultados para “{q}”. Probá con un número de lote (A-05), un nombre o un contrato (VLC-0012).</li>}</ul>
    </div>
  </div>;
}

/* ——— Centro de notificaciones (alertas ejecutivas) ——— */
function NotifCenter({ alerts, onClose }: { alerts: Alert[]; onClose: () => void }) {
  const resolve = (a: Alert) => openDialog({ title: 'Marcar alerta como resuelta', body: <><p><b>{a.title}</b></p><p className="meta">{a.cause}</p><ReasonField label="Cómo se resolvió" ph="Por ejemplo: el titular pagó por ventanilla, se registró la promesa…" /><p className="meta">Si la causa persiste, la alerta vuelve a aparecer cuando cambie la situación.</p></>, submit: 'Marcar resuelta',
    onSubmit: f => { const r = reasonOf(f); if (!r) return REASON_ERR; log('Alerta resuelta', 'Alerta', a.key.split(':').slice(0, 2).join(':'), a.title, r); commit(S => { S.resolved.unshift({ key: a.key, title: a.title, by: me().user, ts: nowTs(), note: r }); }); toast('Alerta marcada como resuelta.'); } });
  return <aside className="notif" aria-label="Alertas">
    <header><h2>Alertas</h2><span className="meta">{alerts.length} abiertas</span><button type="button" className="iconbtn" onClick={onClose} aria-label="Cerrar"><Icon n="x" /></button></header>
    <div className="notif-list">{alerts.map(a => <article key={a.key} className={'ncard ' + a.sev}>
      <p className="n-area"><i />{a.area} · {a.sev === 'critica' ? 'Crítica' : a.sev === 'alta' ? 'Alta' : 'Media'}</p>
      <h3>{a.title}</h3><p className="n-cause">{a.cause}</p>
      <p className="n-meta">{a.owner} · límite {D.fmtS(a.due)}</p>
      <div className="n-btns"><button type="button" className="btn sm" onClick={() => { onClose(); go(a.go); }}>Abrir</button>{role() !== 'auditoria' && <button type="button" className="btn sm ghost" onClick={() => resolve(a)}>Marcar resuelta</button>}</div>
    </article>)}{!alerts.length && <p className="empty">No hay alertas abiertas.</p>}</div>
  </aside>;
}

/* ——— Widgets de escritorio ——— */
function Widgets() {
  const { S, DV } = useDomain();
  const T = S.T, d = D.parse(T);
  const today = agendaItems(T, D.add(T, 2)).slice(0, 5);
  const inv = DV.inv;
  const order = ['vendido', 'reservado', 'disponible', 'bloqueado', 'regularizacion'] as const;
  const crit = DV.alerts.filter(a => a.sev === 'critica').length;
  const W = (p: { title: string; app?: string; tab?: string; children: React.ReactNode; cls?: string }) =>
    <section className={'widget ' + (p.cls ?? '')}><header><h2>{p.title}</h2>{p.app && <button type="button" className="w-open" onClick={() => go({ kind: 'app', app: p.app!, tab: p.tab } as Target)} aria-label={`Abrir ${p.title}`}><Icon n="ext" size={14} /></button>}</header>{p.children}</section>;
  if (role() === 'propietario') return <div className="widgets"><W title="Portal del propietario" app="portal" cls="w-hello"><p className="w-big">Bienvenido</p><p className="w-sub">Consultá tus cuotas, pagos y solicitudes desde el Portal.</p></W></div>;
  return <div className="widgets">
    <W title="Hoy" cls="w-hello"><p className="w-date"><span>{DOW[d.getUTCDay()]}</span>{d.getUTCDate()} de {MESL[d.getUTCMonth()]}</p>
      <p className="w-sub">{me().user}{crit > 0 && can('exec') ? <> · <button type="button" className="lnk" onClick={() => go({ kind: 'app', app: 'dir' })}>{crit} alerta{crit > 1 ? 's' : ''} crítica{crit > 1 ? 's' : ''}</button></> : ''}</p></W>
    {(can('crm') || can('fin_view') || can('exec')) && <W title="Próximos 3 días" app="agenda">{today.length ? <ul className="w-list">{today.map(i => <li key={i.id}><button type="button" onClick={() => i.go && go(i.go)} disabled={!i.go}><span className={'k k-' + i.kind} /><span className="w-l">{i.title}<small>{D.fmtS(i.date)}{i.time ? ' · ' + i.time : ''} · {i.sub}</small></span></button></li>)}</ul> : <p className="w-sub">Sin compromisos.</p>}</W>}
    {can('plan') && <W title="Inventario" app="plan"><div className="stack w-stack">{order.filter(k => inv.byStatus[k]).map(k => <div key={k} className={LOT_ST[k].cls} style={{ flex: `${inv.byStatus[k]} 1 0` }} title={`${LOT_ST[k].label}: ${inv.byStatus[k]}`}>{inv.byStatus[k]}</div>)}</div>
      <p className="w-sub">{inv.byStatus.disponible} disponibles · {usdK(inv.availValueC)}</p>
      <div className="w-cats">{(Object.keys(CAT) as (keyof typeof CAT)[]).map(k => <span key={k}><b>{inv.byCat[k].disponible}</b>{CAT[k].label}</span>)}</div></W>}
    {can('fin_view') && <W title="Cartera" app="fin"><p className="w-big">{usdK(DV.ar.outstandingC)}</p><p className="w-sub">por cobrar · {usdK(DV.ar.overdueC)} vencido ({pct(DV.ar.index)})</p>
      <div className="w-row"><span>Próximos 30 días</span><b>{usd(DV.proj.d30)}</b></div><div className="w-row"><span>Conciliación pendiente</span><b>{S.bank.filter(b => b.status === 'pendiente').length} mov.</b></div></W>}
  </div>;
}

/* ——— Fondo: curvas de nivel del lago ——— */
function Wallpaper() {
  const lines = Array.from({ length: 22 }, (_, i) => { const y0 = 40 + i * 46; let dd = `M-40 ${y0}`; for (let x = 0; x <= 1640; x += 80) { const y = y0 + 18 * Math.sin(x / 210 + i * .55) + 9 * Math.sin(x / 90 + i); dd += ` L${x} ${y.toFixed(1)}`; } return <path key={i} d={dd} />; });
  return <svg className="wall" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="none" strokeWidth="1">{lines}</g></svg>;
}

export function Desktop() {
  const wins = useWins();
  const { DV } = useDomain();
  const [spot, setSpot] = useState(false);
  const [bell, setBell] = useState(false);
  const [start, setStart] = useState(false);
  const [mobile, setMobile] = useState(isMobile());
  useEffect(() => { const r = () => setMobile(isMobile()); window.addEventListener('resize', r); return () => window.removeEventListener('resize', r); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSpot(s => !s); } else if (e.key === 'Escape') { setSpot(false); setBell(false); setStart(false); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  // Primera apertura: la app principal del rol.
  useEffect(() => { if (!wins.length && !location.hash) { const r = role(); const a = r === 'propietario' ? 'portal' : r === 'asesor' ? 'crm' : r === 'finanzas' ? 'fin' : 'dir'; open(a, {}, appDef(a).size); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Enlace directo: #fin, #fin.conc o #lote.A-05 abre esa app o ficha (también con /).
  useEffect(() => {
    const h = () => { const [a, b] = decodeURIComponent(location.hash.slice(1)).split(/[/.]/); if (!a) return;
      if (a === 'lote' && b) openInsp('lot', b); else if (APPS.some(x => x.id === a)) openApp(a, b); };
    h(); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h);
  }, []);
  useEffect(() => { if (!start) return; const c = () => setStart(false); window.addEventListener('pointerdown', c); return () => window.removeEventListener('pointerdown', c); }, [start]);
  const vis = wins.filter(w => !w.min);
  const top = vis.sort((a, b) => b.z - a.z)[0];
  return <div className="os">
    <Wallpaper />
    <main className="workspace" onPointerDown={() => setStart(false)}>
      <div className="watermark"><b>LotIA · demo</b>Viva Lago Country · datos ficticios · corte {D.fmt(st().T)}</div>
      <Widgets />
      {wins.map(w => <Window key={w.id} w={w} active={w.id === top?.id} mobile={mobile} />)}
    </main>
    <Taskbar start={start} onStart={() => { setStart(v => !v); setBell(false); }} onSearch={() => { setStart(false); setSpot(true); }} onBell={() => { setStart(false); setBell(b => !b); }} alerts={DV.alerts} />
    {start && <StartMenu onClose={() => setStart(false)} onSearch={() => setSpot(true)} />}
    {bell && <NotifCenter alerts={DV.alerts} onClose={() => setBell(false)} />}
    {spot && <Spotlight onClose={() => setSpot(false)} />}
    <OverlayHost />
  </div>;
}

