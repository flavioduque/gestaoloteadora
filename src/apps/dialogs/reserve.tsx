import { toast } from '../../os/overlay';

/** Diálogo “Solicitar reserva” (con control de concurrencia en el servidor simulado). */
export function openReserve(_: { lotId?: string; prospectId?: string }) { toast('Pendiente', true); }
