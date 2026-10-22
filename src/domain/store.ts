import type { Perm, RoleKey, State } from './types';
import { ROLES } from './catalog';
import { seedDemo } from './seed';
import { D } from './util';

/* Estado del dominio: un único objeto mutable que se persiste en localStorage.
   Cada mutación pasa por commit(), que incrementa la versión y avisa a los suscriptores. */

const LS_KEY = 'vlc-os-v2';
const LS_ROLE = 'vlc-os-role';

function load(): State | null {
  try { const s = localStorage.getItem(LS_KEY); if (s) { const o = JSON.parse(s); if (o && o.v === 2 && o.lots) return o; } } catch { /* almacenamiento no disponible */ }
  return null;
}
function loadRole(): RoleKey { try { const r = localStorage.getItem(LS_ROLE) as RoleKey; if (r && ROLES[r]) return r; } catch { /* idem */ } return 'direccion'; }

let ST: State = (typeof localStorage !== 'undefined' && load()) || seedDemo(D.today());
let ROLE: RoleKey = typeof localStorage !== 'undefined' ? loadRole() : 'direccion';
let version = 0;
const subs = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;

export const st = () => ST;
export const role = () => ROLE;
export const me = () => ROLES[ROLE];
export const can = (p: Perm) => { const r = ROLES[ROLE]; return r.perms === '*' || r.perms.includes(p); };
export const getVersion = () => version;
export const subscribe = (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn); }; };

function emit() { version++; subs.forEach(f => f()); }
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(ST)); localStorage.setItem(LS_ROLE, ROLE); } catch { /* cuota excedida o modo privado */ } }, 150);
}

/** Aplica una mutación sobre el estado y notifica. */
export function commit(fn?: (s: State) => void) { if (fn) fn(ST); save(); emit(); }
export function setRole(r: RoleKey) { ROLE = r; save(); emit(); }
export function resetDemo() { ST = seedDemo(D.today()); save(); emit(); }
/** Solo para pruebas: reemplaza el estado sin persistir. */
export function _setState(s: State) { ST = s; emit(); }

export function nowTs() { const n = new Date(); return `${ST.T}T${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}:${String(n.getSeconds()).padStart(2, '0')}`; }
export function log(action: string, entity: string, entityId: string, detail = '', reason = '') { ST.audit.unshift({ ts: nowTs(), user: me().user, role: me().label, action, entity, entityId, detail, reason }); }
export function autoRun(rule: string, detail: string, result: 'ok' | 'error' = 'ok') { ST.autoRuns.unshift({ ts: nowTs(), rule, result, detail }); }

export const getBuyer = (id?: string) => ST.buyers.find(b => b.id === id)!;
export const getLot = (id?: string | null) => ST.lots.find(l => l.id === id)!;
export const getContract = (id?: string | null) => ST.contracts.find(c => c.id === id)!;
export const getProspect = (id?: string | null) => ST.prospects.find(p => p.id === id);
export const getRes = (id?: string | null) => ST.reservations.find(r => r.id === id)!;
