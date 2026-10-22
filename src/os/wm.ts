import { useSyncExternalStore } from 'react';

/* Gestor de ventanas: posición, tamaño, orden z, minimizado y maximizado.
   La geometría de cada app se recuerda entre sesiones. */

export interface Win {
  id: string; app: string; params: Record<string, string>; nonce: number;
  x: number; y: number; w: number; h: number; z: number; min: boolean; max: boolean;
  snap?: 'left' | 'right' | null;
}

export const MENU_H = 34;
export const DOCK_H = 78;
const LS = 'vlc-os-wm';

type Geo = Pick<Win, 'x' | 'y' | 'w' | 'h' | 'max'>;
let geo: Record<string, Geo> = {};
try { geo = JSON.parse(localStorage.getItem(LS) || '{}'); } catch { /* sin almacenamiento */ }

let wins: Win[] = [];
let zTop = 10;
let ver = 0;
const subs = new Set<() => void>();
const emit = () => { ver++; wins = [...wins]; subs.forEach(f => f()); };
const persist = (w: Win) => { geo[w.app === 'insp' ? 'insp' : w.app] = { x: w.x, y: w.y, w: w.w, h: w.h, max: w.max }; try { localStorage.setItem(LS, JSON.stringify(geo)); } catch { /* idem */ } };

export const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 760;
const area = () => ({ W: window.innerWidth, H: window.innerHeight - MENU_H - DOCK_H });

export function useWins() { return useSyncExternalStore(cb => { subs.add(cb); return () => { subs.delete(cb); }; }, () => wins); }
export const getWins = () => wins;
export const focused = () => wins.filter(w => !w.min).sort((a, b) => b.z - a.z)[0];

export function open(app: string, params: Record<string, string> = {}, size: [number, number] = [980, 640]) {
  const id = app === 'insp' ? `insp:${params.kind}:${params.id}` : app;
  const ex = wins.find(w => w.id === id);
  if (ex) { ex.min = false; ex.z = ++zTop; ex.params = { ...ex.params, ...params }; ex.nonce++; emit(); return; }
  const { W, H } = area();
  const g = geo[app === 'insp' ? 'insp' : app];
  const w = Math.min(g?.w ?? size[0], W - 24), h = Math.min(g?.h ?? size[1], H - 16);
  const n = wins.filter(x => !x.min).length;
  // Las ventanas nuevas se escalonan para que la anterior siga visible.
  const x = app === 'insp' ? Math.max(12, W - w - 24 - (n % 4) * 28) : (g ? g.x : Math.max(12, (W - w) / 2 + (n % 5) * 26 - 52));
  const y = app === 'insp' ? 18 + (n % 4) * 28 : (g ? g.y : Math.max(8, (H - h) / 2 + (n % 5) * 22 - 40));
  wins.push({ id, app, params, nonce: 0, x: clampX(x, w), y: clampY(y), w, h, z: ++zTop, min: false, max: g?.max ?? false });
  emit();
}
const clampX = (x: number, w: number) => Math.max(-w + 120, Math.min(x, window.innerWidth - 120));
const clampY = (y: number) => Math.max(0, Math.min(y, area().H - 40));

export function close(id: string) { wins = wins.filter(w => w.id !== id); emit(); }
export function focus(id: string) { const w = wins.find(x => x.id === id); if (w && w.z !== zTop) { w.z = ++zTop; w.min = false; emit(); } }
export function minimize(id: string) { const w = wins.find(x => x.id === id); if (w) { w.min = true; emit(); } }
export function toggleMax(id: string) { const w = wins.find(x => x.id === id); if (w) { w.max = !w.max; w.snap = null; w.z = ++zTop; persist(w); emit(); } }
/** Clic en el dock: abre, trae al frente o minimiza si ya está al frente. */
export function dockClick(app: string, size?: [number, number]) {
  const w = wins.find(x => x.id === app);
  if (!w) return open(app, {}, size);
  if (w.min) { w.min = false; w.z = ++zTop; emit(); return; }
  if (focused()?.id === app) { w.min = true; emit(); return; }
  focus(app);
}
export function setGeom(id: string, g: Partial<Win>, save = false) {
  const w = wins.find(x => x.id === id); if (!w) return;
  Object.assign(w, g); if (save) persist(w); emit();
}
export function snap(id: string, side: 'left' | 'right' | 'max') {
  const w = wins.find(x => x.id === id); if (!w) return;
  if (side === 'max') { w.max = true; w.snap = null; } else { w.max = false; w.snap = side; }
  persist(w); emit();
}
export function closeAll() { wins = []; emit(); }
export function minimizeAll() { wins.forEach(w => { w.min = true; }); emit(); }
export const wmVersion = () => ver;
