import type { InspKind, Target } from '../domain/derive';
import { can, getProspect, me } from '../domain/store';
import { APPS } from '../apps/registry';
import { toast } from './overlay';
import { open } from './wm';

/** Abre una app como ventana (o la trae al frente). `tab` selecciona una pestaña interna. */
export function openApp(app: string, tab?: string) {
  const a = APPS.find(x => x.id === app);
  if (!a) return;
  if (a.perm && !can(a.perm)) return toast('Tu rol no tiene acceso a esta aplicación.', true);
  open(app, tab ? { tab } : {}, a.size);
}

/** Abre una ficha (lote, prospecto, cuenta o contrato) en su propia ventana, respetando permisos. */
export function openInsp(kind: InspKind, id: string) {
  if (kind === 'prospect') {
    if (!can('crm')) return toast('Tu rol no accede al CRM.', true);
    const p = getProspect(id);
    if (me().advisorId && p && p.advisorId !== me().advisorId && !can('crm_all')) return toast('Este prospecto pertenece a otro asesor.', true);
  }
  if (kind === 'acct' && !can('fin_view')) kind = 'ctr';
  if (kind === 'ctr' && !can('res') && !can('fin_view')) return toast('Tu rol no accede a contratos.', true);
  open('insp', { kind, id }, kind === 'lot' ? [520, 680] : [600, 700]);
}

export function go(t: Target) { if (t.kind === 'app') openApp(t.app, t.tab); else openInsp(t.insp, t.id); }
