import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { Perm } from '../domain/types';
import type { Win } from '../os/wm';
import { can } from '../domain/store';

export interface AppProps { win: Win }
export interface AppDef {
  id: string; title: string; icon: string; tint: string;
  /** Permiso requerido; `any` habilita la app si el rol tiene alguno de la lista. */
  perm?: Perm; any?: Perm[];
  size: [number, number]; dock?: boolean; flush?: boolean;
  C: LazyExoticComponent<ComponentType<AppProps>>;
}

export const APPS: AppDef[] = [
  { id: 'dir', title: 'Dirección', icon: 'dir', tint: 'lake', perm: 'exec', size: [1180, 760], dock: true, C: lazy(() => import('./Direccion')) },
  { id: 'plan', title: 'Masterplan', icon: 'plan', tint: 'green', perm: 'plan', size: [1180, 780], dock: true, C: lazy(() => import('./Masterplan')) },
  { id: 'crm', title: 'Comercial', icon: 'crm', tint: 'brass', perm: 'crm', size: [1180, 740], dock: true, C: lazy(() => import('./Comercial')) },
  { id: 'res', title: 'Reservas y contratos', icon: 'res', tint: 'sand', perm: 'res', size: [1120, 720], dock: true, C: lazy(() => import('./Reservas')) },
  { id: 'fin', title: 'Finanzas y cobranza', icon: 'fin', tint: 'lake2', perm: 'fin', size: [1200, 760], dock: true, C: lazy(() => import('./Finanzas')) },
  { id: 'agenda', title: 'Agenda', icon: 'agenda', tint: 'crit', any: ['crm', 'fin_view', 'exec'], size: [1060, 700], dock: true, C: lazy(() => import('./Agenda')) },
  { id: 'docs', title: 'Expedientes', icon: 'docs', tint: 'sand', any: ['res', 'fin_view'], size: [980, 640], dock: true, C: lazy(() => import('./Documentos')) },
  { id: 'comms', title: 'Propietarios', icon: 'comms', tint: 'green', any: ['comms', 'portal'], size: [980, 680], dock: true, C: lazy(() => import('./Propietarios')) },
  { id: 'portal', title: 'Portal del propietario', icon: 'portal', tint: 'brass', perm: 'portal', size: [1080, 760], dock: true, C: lazy(() => import('./Portal')) },
  { id: 'ask', title: 'Consultas', icon: 'ask', tint: 'lake', perm: 'ask', size: [960, 700], dock: true, C: lazy(() => import('./Consultas')) },
  { id: 'audit', title: 'Auditoría', icon: 'audit', tint: 'ink', perm: 'audit', size: [1100, 680], dock: true, C: lazy(() => import('./Auditoria')) },
  { id: 'sys', title: 'Sistema', icon: 'sys', tint: 'ink', perm: 'sys', size: [1120, 760], dock: true, C: lazy(() => import('./Sistema')) },
  { id: 'settings', title: 'Configuración', icon: 'settings', tint: 'ink', size: [760, 640], dock: false, C: lazy(() => import('./Configuracion')) },
  { id: 'tour', title: 'Recorrido ejecutivo', icon: 'tour', tint: 'brass', size: [420, 600], dock: false, C: lazy(() => import('./Recorrido')) },
  { id: 'insp', title: 'Ficha', icon: 'insp', tint: 'ink', size: [600, 700], flush: true, C: lazy(() => import('./Inspector')) },
];

export const allowed = (a: AppDef) => a.any ? a.any.some(can) : !a.perm || can(a.perm);
export const appDef = (id: string) => APPS.find(a => a.id === id)!;
