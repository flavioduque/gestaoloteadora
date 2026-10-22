import { useState } from 'react';
import type { AppProps } from './registry';
import type { RoleKey } from '../domain/types';
import { allowed, appDef } from './registry';
import { ROLES } from '../domain/catalog';
import { dv } from '../domain/derive';
import { role, setRole, st } from '../domain/store';
import { useDomain } from '../os/hooks';
import { openApp, openInsp } from '../os/nav';
import { toast } from '../os/overlay';
import { close, getWins } from '../os/wm';

/** Cambia de rol sin cerrar el recorrido; cierra fichas y apps que el nuevo rol no puede ver. */
function as(r: RoleKey) {
  if (role() === r) return;
  setRole(r);
  getWins().filter(w => w.app === 'insp' || (w.app !== 'tour' && !allowed(appDef(w.app)))).forEach(w => close(w.id));
  toast(`Viendo como ${ROLES[r].label}.`);
}

const TOUR: { t: string; d: string; go(): void }[] = [
  { t: 'Situación del inventario', d: 'Disponibilidad real por estado y categoría, y valor del inventario disponible.', go() { as('direccion'); openApp('dir'); } },
  { t: 'Un lote en el masterplan', d: 'Ficha integral: superficie, precio, historial, titular, saldo y documentos.', go() { as('direccion'); openApp('plan'); const l = st().lots.find(x => x.category === 'ribera' && x.status === 'disponible'); if (l) openInsp('lot', l.id); } },
  { t: 'De prospecto a reserva', d: 'Etapas con condiciones, próxima acción y reserva que bloquea el lote en el servidor.', go() { as('comercial'); openApp('crm'); const p = st().prospects.find(x => x.stage === 'negociacion'); if (p) openInsp('prospect', p.id); } },
  { t: 'Plan de financiación', d: 'Contrato con calendario calculado por reglas explícitas y método visible.', go() { as('direccion'); openApp('res'); } },
  { t: 'Pago de prueba y conciliación', d: 'El pago queda en revisión hasta coincidir con el extracto; una persona confirma.', go() { as('finanzas'); openApp('fin', 'conc'); } },
  { t: 'Cuenta con vencimientos', d: 'Días de atraso, saldo vencido, promesa de pago y responsable.', go() { as('finanzas'); const a = [...dv().accts.values()].filter(x => x.overdueC > 0 && !x.disputed).sort((x, y) => y.daysLate - x.daysLate)[0]; if (a) openInsp('acct', a.c.id); } },
  { t: 'Alerta de cobranza', d: 'Secuencia configurable que genera tareas sin enviar mensajes no autorizados.', go() { as('finanzas'); openApp('fin', 'cobr'); } },
  { t: 'Experiencia del propietario', d: 'El propietario ve su lote, cuotas, pagos y solicitudes, y nada ajeno.', go() { as('propietario'); openApp('portal'); } },
  { t: 'Consulta ejecutiva', d: 'Respuesta calculada con período, definición y fecha de los datos.', go() { as('direccion'); openApp('ask'); } },
];

export default function Recorrido(_: AppProps) {
  useDomain();
  const [cur, setCur] = useState<number | null>(null);
  return <div className="tour-list" style={{ maxHeight: 'none', margin: '-4px -6px' }}>
    <p className="meta" style={{ padding: '0 14px 10px' }}>Nueve pasos por el ciclo completo. Cada paso cambia el rol si hace falta y abre las ventanas correspondientes.</p>
    {TOUR.map((s, i) => <button key={s.t} type="button" className={'tstep' + (cur === i ? ' on' : '')} aria-current={cur === i || undefined} onClick={() => { setCur(i); s.go(); }}>
      <span className="no">{String(i + 1).padStart(2, '0')}</span><span><b>{s.t}</b><span>{s.d}</span></span>
    </button>)}
  </div>;
}
