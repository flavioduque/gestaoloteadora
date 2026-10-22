// Montos siempre en centavos (enteros). Fechas en ISO 'AAAA-MM-DD'.

export type LotStatus = 'disponible' | 'reservado' | 'vendido' | 'bloqueado' | 'regularizacion';
export type Category = 'ribera' | 'vista' | 'parque' | 'interno';
export type Sector = 'A' | 'B' | 'C';

export interface PriceEntry { date: string; priceC: number; by: string; reason: string }

export interface Lot {
  id: string; sector: Sector; category: Category;
  front: number | null; depth: number | null; area: number;
  priceC: number; currency: 'USD';
  status: LotStatus; statusReason: string; version: number;
  poly: string; cx: number; cy: number;
  priceHistory: PriceEntry[]; notes: string; features: string[];
  holderId?: string; contractId?: string; reservationId?: string | null;
}

export interface Buyer {
  id: string; name: string; email: string; phone: string;
  pref: 'WhatsApp' | 'Correo'; optOut: boolean; fromProspect?: string;
  pendingChange?: { date: string; email: string; phone: string };
}

export interface Installment { n: number; due: string; amountC: number; principalC: number; interestC: number }

export interface Plan {
  priceC: number; downPct: number; downC: number; financedC: number;
  n: number; rate: number; freq: 'Mensual'; firstDue: string;
  rounding: 'centavo' | 'dolar'; currency: 'USD'; installments: Installment[];
}

export type ContractStatus = 'borrador' | 'pendiente_firma' | 'firmado' | 'rescindido';
export interface Doc { name: string; v: number; date: string }

export interface Contract {
  id: string; lotId: string; buyerId: string; priceC: number; status: ContractStatus;
  created: string; signedDate: string | null; signMode: string | null; advisorId: string;
  plan: Plan; behavior: string; reservationId?: string; docs: Doc[];
  followUp: string; disputed: { since: string; reason: string } | null;
}

export type PaymentStatus = 'confirmado' | 'en_revision' | 'rechazado' | 'revertido';
export interface Payment {
  id: string; contractId: string; date: string; amountC: number; method: string; ref: string;
  status: PaymentStatus; source: string; kind: 'entrada' | 'cuota'; by: string; approvedBy: string | null;
}

export type LedgerType = 'entrada' | 'pago' | 'reversion' | 'ajuste' | 'nota_credito';
export interface LedgerEntry {
  id: string; contractId: string; date: string; type: LedgerType; amountC: number; ref: string;
  paymentId?: string; by: string; approvedBy: string; note: string;
}

export interface BankEntry {
  id: string; date: string; desc: string; ref: string; amountC: number;
  status: 'pendiente' | 'conciliada' | 'descartada';
  paymentId?: string; approvedBy?: string; approvedAt?: string; source?: string; discardReason?: string;
}

export type Stage = 'nuevo' | 'contactado' | 'calificado' | 'visita_prog' | 'visita_real' | 'negociacion' | 'reserva' | 'contrato' | 'ganado' | 'perdido';
export interface HistoryItem { date: string; type: string; text: string; by: string }

export interface Prospect {
  id: string; name: string; phone: string; email: string; source: string; advisorId: string;
  created: string; firstResponseMin: number; interest: string;
  budgetC: number | null; category: Category | null; location: string; horizon: string | null;
  stage: Stage; lastActivity: string; nextAction: { text: string; date: string } | null;
  visitDate: string | null; lotIds: string[]; lostReason: string | null;
  history: HistoryItem[]; reached: Stage;
}

export type ResStatus = 'vigente' | 'pendiente_aprobacion' | 'convertida' | 'cancelada' | 'vencida';
export interface ResDoc { k: string; label: string; ok: boolean }
export interface Reservation {
  id: string; lotId: string; prospectId: string | null; prospectName?: string;
  priceC: number; amountC: number; created: string; expires: string; advisorId: string;
  status: ResStatus; renewals: number; approvedBy: string | null; conditions: string;
  docs: ResDoc[]; closeReason?: string; contractId?: string;
}

export interface PromiseToPay {
  id: string; contractId: string; date: string; amountC: number; note: string; by: string; created: string;
  status: 'vigente' | 'incumplida' | 'reemplazada';
}

export interface OwnerRequest {
  id: string; contractId: string; buyerId: string; type: string; text: string; created: string;
  status: 'abierta' | 'respondida'; updates: { date: string; text: string; by: string }[];
}

export interface Comm { id: string; date: string; title: string; text: string; audience: string; by: string }

export interface AuditEntry { ts: string; user: string; role: string; action: string; entity: string; entityId: string; detail: string; reason: string }
export interface AutoRun { ts: string; rule: string; result: 'ok' | 'error'; detail: string }

export interface CollTask { id: string; contractId: string; step: string; text: string; owner: string; date: string; done: boolean; msg: string }
export interface CollStep { k: string; off: number; label: string; channel: string; on: boolean; tpl: string }

export interface Resolved { key: string; title: string; by: string; ts: string; note: string }

export interface AgendaEvent { id: string; date: string; time: string; title: string; kind: 'visita' | 'reunion' | 'obra' | 'otro'; owner: string; note: string }

export interface State {
  v: 2; T: string; generatedAt: string;
  lots: Lot[]; buyers: Buyer[]; contracts: Contract[]; payments: Payment[]; ledger: LedgerEntry[];
  bank: BankEntry[]; prospects: Prospect[]; reservations: Reservation[]; promises: PromiseToPay[];
  requests: OwnerRequest[]; comms: Comm[]; audit: AuditEntry[]; autoRuns: AutoRun[];
  tasks: CollTask[]; resolved: Resolved[]; idem: Record<string, string>; events: AgendaEvent[];
  seq: { c: number; p: number; l: number; b: number; r: number; q: number };
  collSeq: CollStep[];
  riskCfg: { atencion: number; riesgo: number; critico: number };
}

export type RoleKey = 'direccion' | 'finanzas' | 'comercial' | 'asesor' | 'auditoria' | 'propietario';
export type Perm = 'exec' | 'plan' | 'crm' | 'crm_all' | 'crm_edit' | 'res' | 'reserve' | 'approve_res' | 'contracts_edit'
  | 'fin' | 'fin_view' | 'fin_edit' | 'ask' | 'audit' | 'sys' | 'holder' | 'portal' | 'lot_admin' | 'comms';
export interface Role { label: string; user: string; advisorId?: string; perms: '*' | Perm[] }
