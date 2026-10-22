import { useState } from 'react';
import type { AppProps } from './registry';
import type { Perm, RoleKey } from '../domain/types';
import { ROLES, isClosed } from '../domain/catalog';
import { idleDays, visibleProspects } from '../domain/derive';
import { TESTS, type TestResult } from '../domain/tests';
import { nf0, pct } from '../domain/util';
import { useDomain } from '../os/hooks';
import { toast } from '../os/overlay';
import { Btn, Head, Note, Pill, Sec } from '../ui/kit';

const AUTOS = [
  { id: 'AUT-01', ev: 'Reserva solicitada', cond: 'Lote disponible y versión vigente', act: 'Bloquea el lote en la misma transacción', who: 'Sistema', retry: 'Sin reintento: si falla, la reserva no existe', err: 'Se informa al asesor el estado actual del lote' },
  { id: 'AUT-02', ev: 'Reserva vencida', cond: 'Vigente y fecha de vencimiento superada', act: 'Alerta crítica y propuesta de liberación', who: 'Gerencia comercial', retry: 'Diario 00:05', err: 'Si el lote cambió, se registra y no se modifica' },
  { id: 'AUT-03', ev: 'Contrato firmado', cond: 'Plan de financiación válido (Σ capital = financiado)', act: 'Activa el calendario de cuotas y marca el lote como vendido', who: 'Administración financiera', retry: 'Idempotente por contrato', err: 'Se revierte la firma si el calendario no se genera' },
  { id: 'AUT-04', ev: 'Cuota próxima o vencida', cond: 'Secuencia de cobranza activa, sin disputa ni baja', act: 'Genera tarea y mensaje listo para enviar', who: 'Responsable de la cuenta', retry: 'Diario 07:00; una tarea por cuenta cada 3 días', err: 'Se omite y se registra el motivo' },
  { id: 'AUT-05', ev: 'Pago conciliado', cond: 'Movimiento bancario confirmado por una persona', act: 'Aplica el pago a cuotas por antigüedad y recalcula saldos', who: 'Administración financiera', retry: 'Clave de idempotencia por pago', err: 'Un reintento devuelve el pago existente, no duplica' },
  { id: 'AUT-06', ev: 'Oportunidad sin actividad', cond: 'Etapa visita realizada o posterior y > 7 días', act: 'Alerta al asesor y a Gerencia comercial', who: 'Asesor asignado', retry: 'Diario 07:00', err: '—' },
];
const INTEGR: [string, number, string][] = [
  ['Importación de extractos bancarios (CSV)', 4, 'Funciona en esta demo con archivos.'],
  ['Exportación de reportes (CSV)', 4, 'Funciona en esta demo: auditoría, consultas, cartera y libro.'],
  ['Formularios web y sitio', 1, 'Endpoint de ingreso definido; requiere el sitio de Viva Lago.'],
  ['WhatsApp Business Platform', 1, 'Requiere cuenta verificada y proveedor oficial (BSP).'],
  ['Correo transaccional', 1, 'Requiere dominio verificado y proveedor (SPF/DKIM).'],
  ['Instagram (mensajes)', 0, 'Requiere cuenta profesional y permisos de Meta.'],
  ['Firma digital', 0, 'Requiere proveedor habilitado en Paraguay.'],
  ['Banco por API', 0, 'Depende de la entidad bancaria.'],
  ['Facturación electrónica (SIFEN)', 0, 'Requiere validación tributaria y proveedor habilitado.'],
];
const PERMS: [string, Perm][] = [['Ver centro de dirección', 'exec'], ['Ver masterplan', 'plan'], ['Ver datos de titulares', 'holder'], ['Gestionar todos los prospectos', 'crm_all'], ['Editar prospectos', 'crm_edit'], ['Solicitar reservas', 'reserve'], ['Aprobar reservas', 'approve_res'], ['Generar y firmar contratos', 'contracts_edit'], ['Ver finanzas', 'fin_view'], ['Registrar pagos y conciliar', 'fin_edit'], ['Cambiar precios y bloquear lotes', 'lot_admin'], ['Publicar comunicados', 'comms'], ['Ver auditoría', 'audit']];

export default function Sistema(_: AppProps) {
  const { S, DV } = useDomain();
  const [res, setRes] = useState<Record<string, TestResult>>({});
  const run1 = (k: string): TestResult => { const t = TESTS.find(x => x.k === k)!; try { return t.run(); } catch (e) { return { ok: false, out: 'Error: ' + (e as Error).message }; } };
  const runAll = () => { const r = Object.fromEntries(TESTS.map(t => [t.k, run1(t.k)])); setRes(r); const ok = Object.values(r).filter(x => x.ok).length; toast(`${ok} de ${TESTS.length} pruebas pasan.`, ok < TESTS.length); };
  const roles = (Object.keys(ROLES) as RoleKey[]).filter(k => k !== 'propietario');
  const has = (r: RoleKey, p: Perm) => ROLES[r].perms === '*' || (ROLES[r].perms as Perm[]).includes(p);
  const vp = visibleProspects().filter(p => !isClosed(p.stage));
  const value: string[][] = [
    ['Tiempo de respuesta a prospectos', 'Minutos entre ingreso y primer contacto registrado', 'A medir', nf0.format(S.prospects.reduce((s, p) => s + p.firstResponseMin, 0) / S.prospects.length) + ' min'],
    ['Oportunidades con seguimiento al día', '% de activas con actividad en los últimos 7 días', 'A medir', pct(vp.filter(p => idleDays(p) <= 7).length / Math.max(1, vp.length), 0)],
    ['Conversión de visitas a reservas', 'Reservas ÷ visitas realizadas', 'A medir', 'Ver Comercial'],
    ['Cuotas vencidas', 'Saldo vencido ÷ cartera', 'A medir', pct(DV.ar.index)],
    ['Tiempo de conciliación', 'Horas entre acreditación y confirmación', 'A medir', '—'],
    ['Horas administrativas manuales', 'Registro de tiempo por tarea, 4 semanas antes y después', 'A medir', '—'],
  ];
  return <>
    <Head title="Sistema" lede="Qué funciona en esta demo, qué requiere integración externa y cómo se controla cada operación crítica." actions={<Btn kind="primary" onClick={runAll}>Ejecutar todas las pruebas</Btn>} />
    <Sec title="Pruebas de integridad" meta="Se ejecutan sobre una copia de los datos; no modifican registros">
      {TESTS.map(t => { const r = res[t.k]; return <div key={t.k} className="test-row"><div><b>{t.name}</b><p className="meta">{t.what}</p>{r && <div className="test-out">{r.ok ? '✓ PASA' : '✗ FALLA'} · {r.out}</div>}</div><Btn sm onClick={() => setRes(o => ({ ...o, [t.k]: run1(t.k) }))}>Ejecutar</Btn></div>; })}
    </Sec>
    <Sec title="Integraciones" meta="Preparada · configurada · probada · activa">
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Integración</th><th style={{ width: 160 }}>Estado</th><th>Qué falta</th></tr></thead>
        <tbody>{INTEGR.map(([n, lv, w]) => <tr key={n}><td>{n}</td><td><div className="int-grid">{[0, 1, 2, 3].map(i => <i key={i} className={i < lv ? 'on' : ''} />)}</div><span className="sub">{['No iniciada', 'Preparada', 'Configurada', 'Probada', 'Activa'][lv]}</span></td><td>{w}</td></tr>)}</tbody></table></div>
    </Sec>
    <Sec title="Automatizaciones" meta="Evento → condición → acción, con responsable, reintentos y registro">
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Regla</th><th>Evento</th><th>Condición</th><th>Acción</th><th>Responsable</th><th>Reintentos</th><th>Errores</th><th className="num">Ejecuciones</th></tr></thead>
        <tbody>{AUTOS.map(a => <tr key={a.id}><td className="mono">{a.id}</td><td>{a.ev}</td><td>{a.cond}</td><td>{a.act}</td><td>{a.who}</td><td>{a.retry}</td><td>{a.err}</td><td className="num">{S.autoRuns.filter(r => r.rule === a.id).length}</td></tr>)}</tbody></table></div>
      {S.autoRuns.length > 0 && <details className="resolved"><summary>Últimas ejecuciones ({S.autoRuns.length})</summary><ul>{S.autoRuns.slice(0, 15).map((r, i) => <li key={i}><span className="mono">{r.ts.replace('T', ' ').slice(0, 16)} · {r.rule}</span> — {r.detail}</li>)}</ul></details>}
    </Sec>
    <Sec title="Roles y permisos" meta="Aplicados en el servidor; la interfaz solo refleja lo permitido">
      <div className="tbl-wrap"><table className="tbl matrix"><thead><tr><th>Permiso</th>{roles.map(r => <th key={r} style={{ textAlign: 'center' }}>{ROLES[r].label}</th>)}</tr></thead>
        <tbody>{PERMS.map(([l, p]) => <tr key={p}><td>{l}</td>{roles.map(r => has(r, p) ? <td key={r} className="y">●</td> : <td key={r} className="n">—</td>)}</tr>)}
          <tr><td>Ver solo sus propios datos (portal)</td>{roles.map(r => <td key={r} className="n">—</td>)}</tr></tbody></table></div>
      <p className="meta" style={{ marginTop: 8 }}>Propietario: accede únicamente a su lote, contrato, cuotas, pagos y solicitudes. Asesor: solo sus prospectos y reservas; no ve titulares ni saldos.</p>
    </Sec>
    <Sec title="Hoja de ruta" meta="Lo que muestra esta demo y lo que se construye después">
      <div className="phase">
        <div><Pill cls="ok" dot={false}>Fase 1 · núcleo operativo</Pill><ul><li>Autenticación, roles y auditoría</li><li>Registro maestro de lotes y masterplan sobre el plano oficial</li><li>CRM y reservas con control de concurrencia</li><li>Contratos, plan de financiación y registro de pagos</li><li>Centro de dirección</li><li><b>Entregado:</b> escritorio multiventana con buscador global</li></ul></div>
        <div><Pill cls="info" dot={false}>Fase 2 · automatización</Pill><ul><li>Alertas y recordatorios</li><li>Importación bancaria y conciliación asistida</li><li><b>Entregado:</b> exportación CSV de reportes (Excel y PDF después)</li><li><b>Entregado:</b> agenda unificada de visitas, vencimientos y promesas</li><li><b>Entregado:</b> expedientes digitales por contrato y lote</li><li><b>Entregado:</b> comunicados a propietarios</li><li>WhatsApp y correo vía proveedores oficiales</li><li>Portal del propietario</li></ul></div>
        <div><Pill cls="neutral" dot={false}>Fase 3 · operación integral</Pill><ul><li>Expensas y aportes (con reglamento aprobado)</li><li>Mantenimiento preventivo e incidencias</li><li>Proveedores y órdenes de trabajo</li><li>Reservas de instalaciones</li><li>Analítica avanzada</li></ul></div>
      </div>
    </Sec>
    <Sec title="Cómo se medirá el valor" meta="Línea base antes de implementar; sin porcentajes prometidos">
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Indicador</th><th>Cómo se mide</th><th>Línea base</th><th>En esta demo</th></tr></thead>
        <tbody>{value.map(r => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody></table></div>
      <div style={{ marginTop: 10 }}><Note><b>Modelo económico:</b> beneficio estimado = ahorro operativo + costos evitados + mejora de margen atribuible + otros beneficios verificables. Cada componente se separa en medido, estimado u objetivo, sin contar dos veces el mismo efecto.</Note></div>
    </Sec>
  </>;
}
