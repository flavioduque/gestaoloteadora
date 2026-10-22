import { useSyncExternalStore } from 'react';

/* Estado compartido entre el Masterplan y las fichas de lote: modo comercial y lotes en comparación. */
let state = { commercial: false, compare: [] as string[] };
const subs = new Set<() => void>();
export const usePlanUI = () => useSyncExternalStore(cb => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);
export const planUI = () => state;
export function setPlanUI(p: Partial<typeof state>) { state = { ...state, ...p }; subs.forEach(f => f()); }
