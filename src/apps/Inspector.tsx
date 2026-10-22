import { lazy, Suspense } from 'react';
import type { AppProps } from './registry';
import { useDomain } from '../os/hooks';

const Lot = lazy(() => import('./insp/LotInsp'));
const Prospect = lazy(() => import('./insp/ProspectInsp'));
const Ctr = lazy(() => import('./insp/CtrInsp'));
const Acct = lazy(() => import('./insp/AcctInsp'));

/** Ventana de ficha: despacha según el tipo de registro. */
export default function Inspector({ win }: AppProps) {
  useDomain(); // re-render ante cualquier cambio del estado
  const { kind, id } = win.params;
  const C = kind === 'lot' ? Lot : kind === 'prospect' ? Prospect : kind === 'acct' ? Acct : Ctr;
  return <Suspense fallback={null}><C id={id} /></Suspense>;
}
