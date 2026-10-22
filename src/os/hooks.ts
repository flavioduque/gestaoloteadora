import { useSyncExternalStore } from 'react';
import { derive } from '../domain/derive';
import { getVersion, role, st, subscribe } from '../domain/store';

/** Suscribe el componente al estado del dominio y devuelve estado + derivados de la versión vigente. */
export function useDomain() {
  const ver = useSyncExternalStore(subscribe, getVersion);
  const DV = derive(ver);
  return { S: st(), DV, ver, role: role() };
}
