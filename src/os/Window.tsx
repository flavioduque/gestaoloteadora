import { Suspense, useRef, useState, type PointerEvent as RPE } from 'react';
import { appDef } from '../apps/registry';
import { getProspect } from '../domain/store';
import { Icon } from './icons';
import { DOCK_H, MENU_H, close, focus, minimize, setGeom, snap, toggleMax, type Win } from './wm';

const MIN_W = 380, MIN_H = 260;

export function winTitle(w: Win) {
  if (w.app !== 'insp') return appDef(w.app).title;
  const { kind, id } = w.params;
  return kind === 'lot' ? `Lote ${id}` : kind === 'prospect' ? (getProspect(id)?.name ?? id) : kind === 'acct' ? `Cuenta ${id}` : `Contrato ${id}`;
}

type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export function Window({ w, active, mobile }: { w: Win; active: boolean; mobile: boolean }) {
  const def = appDef(w.app);
  const ref = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<null | 'left' | 'right' | 'max'>(null);
  const C = def.C;
  const fill = w.max || mobile;

  // Arrastre por la barra de título; al soltar contra un borde la ventana se acomoda (mitad o maximizada).
  const onDrag = (e: RPE<HTMLElement>) => {
    if (e.button !== 0 || mobile || (e.target as HTMLElement).closest('button')) return;
    const el = ref.current!; focus(w.id);
    const sx = e.clientX, sy = e.clientY;
    const rect = el.getBoundingClientRect();
    let x = w.x, y = w.y, moved = false, pv: typeof preview = null;
    // Si estaba maximizada o encajada, se restaura bajo el cursor manteniendo la proporción.
    const startX = fill || w.snap ? e.clientX - w.w * ((e.clientX - rect.left) / rect.width) : w.x;
    const startY = fill || w.snap ? 0 : w.y;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      if (!moved) { moved = true; if (fill || w.snap) setGeom(w.id, { max: false, snap: null, x: startX, y: startY }); el.classList.add('dragging'); }
      x = startX + dx; y = Math.max(0, startY + dy);
      el.style.left = x + 'px'; el.style.top = y + 'px';
      pv = ev.clientY <= MENU_H + 2 ? 'max' : ev.clientX <= 3 ? 'left' : ev.clientX >= window.innerWidth - 3 ? 'right' : null;
      setPreview(pv);
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      el.classList.remove('dragging'); setPreview(null);
      if (!moved) return;
      if (pv) snap(w.id, pv); else setGeom(w.id, { x, y }, true);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  const onResize = (edge: Edge) => (e: RPE<HTMLElement>) => {
    if (e.button !== 0) return; e.stopPropagation(); e.preventDefault();
    const el = ref.current!; focus(w.id);
    const r = el.getBoundingClientRect();
    const g0 = { x: r.left, y: r.top - MENU_H, w: r.width, h: r.height }; const g = { ...g0 };
    const sx = e.clientX, sy = e.clientY;
    if (w.snap || w.max) setGeom(w.id, { ...g0, snap: null, max: false });
    el.classList.add('dragging');
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (edge.includes('e')) g.w = Math.max(MIN_W, g0.w + dx);
      if (edge.includes('s')) g.h = Math.max(MIN_H, Math.min(g0.h + dy, window.innerHeight - MENU_H - g0.y - 4));
      if (edge.includes('w')) { g.w = Math.max(MIN_W, g0.w - dx); g.x = g0.x + g0.w - g.w; }
      if (edge.includes('n')) { g.h = Math.max(MIN_H, g0.h - dy); g.y = Math.max(0, g0.y + g0.h - g.h); }
      Object.assign(el.style, { left: g.x + 'px', top: g.y + 'px', width: g.w + 'px', height: g.h + 'px' });
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); el.classList.remove('dragging'); setGeom(w.id, g, true); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  const H = `calc(100dvh - ${MENU_H + DOCK_H}px)`;
  const style = fill ? { left: 0, top: 0, width: '100%', height: H, zIndex: w.z }
    : w.snap ? { left: w.snap === 'left' ? 0 : '50%', top: 0, width: '50%', height: H, zIndex: w.z }
    : { left: w.x, top: w.y, width: w.w, height: w.h, zIndex: w.z };
  const title = winTitle(w);

  return <>
    <section ref={ref} className={`win${active ? ' active' : ''}${fill ? ' max' : ''}${w.snap ? ' snapped' : ''}${w.min ? ' min' : ''}`} style={style}
      onPointerDownCapture={() => { if (!active) focus(w.id); }} role="dialog" aria-label={title} aria-hidden={w.min || undefined}>
      <header className="win-h" onPointerDown={onDrag} onDoubleClick={e => { if (!(e.target as HTMLElement).closest('button') && !mobile) toggleMax(w.id); }}>
        <div className="win-ctl">
          <button type="button" className="tl close" onClick={() => close(w.id)} aria-label={`Cerrar ${title}`}><Icon n="x" size={10} /></button>
          {!mobile && <button type="button" className="tl min" onClick={() => minimize(w.id)} aria-label="Minimizar"><Icon n="min" size={10} /></button>}
          {!mobile && <button type="button" className="tl max" onClick={() => toggleMax(w.id)} aria-label={w.max ? 'Restaurar' : 'Maximizar'}><Icon n={w.max ? 'restore' : 'max'} size={10} /></button>}
        </div>
        <div className="win-t"><span className={`app-dot t-${def.tint}`}><Icon n={def.icon} size={12} /></span>{title}</div>
      </header>
      <div className={'win-body' + (def.flush ? ' flush' : '')}>
        <Suspense fallback={<div className="win-loading">Abriendo {title}…</div>}><C win={w} /></Suspense>
      </div>
      {!fill && !mobile && (['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as Edge[]).map(e => <span key={e} className={'rz rz-' + e} onPointerDown={onResize(e)} />)}
    </section>
    {preview && <div className={'snap-preview ' + preview} />}
  </>;
}
