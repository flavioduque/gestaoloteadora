import type { Category, LotStatus, Role, RoleKey, Stage, Sector } from './types';

export const CAT: Record<Category, { label: string; front: [number, number]; depth: [number, number]; ppm: number }> = {
  ribera: { label: 'Ribera', front: [22, 28], depth: [52, 60], ppm: 92 },
  vista: { label: 'Vista al lago', front: [20, 24], depth: [42, 46], ppm: 58 },
  parque: { label: 'Frente parque', front: [22, 26], depth: [45, 50], ppm: 50 },
  interno: { label: 'Interno', front: [18, 22], depth: [42, 46], ppm: 40 },
};
export const catLabel = (k?: Category | null) => (k ? CAT[k].label : '—');

export const SECTOR: Record<Sector, string> = { A: 'Sector Ribera', B: 'Sector Los Sauces', C: 'Sector Parque' };

export const LOT_ST: Record<LotStatus, { label: string; cls: string }> = {
  disponible: { label: 'Disponible', cls: 'disp' },
  reservado: { label: 'Reservado', cls: 'res' },
  vendido: { label: 'Vendido', cls: 'vend' },
  bloqueado: { label: 'Bloqueado', cls: 'bloq' },
  regularizacion: { label: 'En regularización', cls: 'reg' },
};

export const ADVISORS = [
  { id: 'ADV1', name: 'Camila Duarte', ini: 'CD' },
  { id: 'ADV2', name: 'Rodrigo Areco', ini: 'RA' },
  { id: 'ADV3', name: 'Sofía Villalba', ini: 'SV' },
  { id: 'ADV4', name: 'Matías Ferreira', ini: 'MF' },
];
export const advName = (id?: string | null) => ADVISORS.find(a => a.id === id)?.name ?? '—';
export const advIni = (id?: string | null) => ADVISORS.find(a => a.id === id)?.ini ?? '—';

export const FIN_OWNERS = ['Laura Méndez', 'Diego Ocampo'];

export const STAGES: { k: Stage; label: string }[] = [
  { k: 'nuevo', label: 'Nuevo' },
  { k: 'contactado', label: 'Contactado' },
  { k: 'calificado', label: 'Calificado' },
  { k: 'visita_prog', label: 'Visita programada' },
  { k: 'visita_real', label: 'Visita realizada' },
  { k: 'negociacion', label: 'Negociación' },
  { k: 'reserva', label: 'Reserva' },
  { k: 'contrato', label: 'Contrato' },
  { k: 'ganado', label: 'Ganado' },
  { k: 'perdido', label: 'Perdido' },
];
export const STAGE_IX = Object.fromEntries(STAGES.map((s, i) => [s.k, i])) as Record<Stage, number>;
export const stageLabel = (k: Stage) => STAGES[STAGE_IX[k]].label;
export const isClosed = (s: Stage) => s === 'ganado' || s === 'perdido';

export const SOURCES = ['Sitio web', 'WhatsApp', 'Instagram', 'Referido', 'Evento', 'Campaña', 'Ingreso manual'];
export const HORIZON = ['0–3 meses', '3–6 meses', '6–12 meses', 'Más de 12 meses'];
export const LOST_REASONS = ['Presupuesto insuficiente', 'Eligió otro desarrollo', 'Ubicación no convence', 'Financiación no adecuada', 'Sin respuesta', 'Postergó la compra'];

export const ROLES: Record<RoleKey, Role> = {
  direccion: { label: 'Dirección', user: 'Dirección General', perms: '*' },
  finanzas: { label: 'Administración financiera', user: 'Laura Méndez', perms: ['exec', 'plan', 'res', 'fin', 'fin_view', 'fin_edit', 'contracts_edit', 'ask', 'sys', 'holder', 'portal', 'comms'] },
  comercial: { label: 'Gerencia comercial', user: 'Gerencia comercial', perms: ['exec', 'plan', 'crm', 'crm_all', 'crm_edit', 'res', 'reserve', 'approve_res', 'contracts_edit', 'ask', 'sys', 'holder', 'comms'] },
  asesor: { label: 'Asesora comercial', user: 'Camila Duarte', advisorId: 'ADV1', perms: ['plan', 'crm', 'crm_edit', 'res', 'reserve', 'ask'] },
  auditoria: { label: 'Auditoría', user: 'Auditoría interna', perms: ['exec', 'plan', 'crm', 'crm_all', 'res', 'fin', 'fin_view', 'ask', 'audit', 'sys', 'holder'] },
  propietario: { label: 'Propietario', user: 'Propietario', perms: ['portal'] },
};

export const RISK: Record<string, [string, string]> = { al_dia: ['Al día', 'ok'], atencion: ['Atención', 'warn'], riesgo: ['Riesgo', 'crit'], critico: ['Crítico', 'crit'] };
export const RES_ST: Record<string, [string, string]> = { vigente: ['Vigente', 'ok'], pendiente_aprobacion: ['Pendiente de aprobación', 'warn'], convertida: ['Convertida en contrato', 'info'], cancelada: ['Cancelada', 'neutral'], vencida: ['Vencida', 'crit'] };
export const CTR_ST: Record<string, [string, string]> = { borrador: ['Borrador', 'neutral'], pendiente_firma: ['Pendiente de firma', 'warn'], firmado: ['Firmado', 'ok'], rescindido: ['Rescindido', 'crit'] };
export const PAY_ST: Record<string, [string, string]> = { confirmado: ['Confirmado', 'ok'], en_revision: ['En revisión', 'warn'], rechazado: ['Rechazado', 'crit'], revertido: ['Revertido', 'neutral'] };
export const MV_T: Record<string, string> = { entrada: 'Entrada', pago: 'Pago de cuota', reversion: 'Reversión', ajuste: 'Ajuste aprobado', nota_credito: 'Nota de crédito' };
