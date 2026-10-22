/* Iconografía propia: trazo 1.6 px sobre retícula de 24, extremos redondeados. */
const P: Record<string, string> = {
  // apps
  dir: 'M4 19h16M6 16V11M10 16V7M14 16v-6M18 16V5',
  plan: 'M3 6.5 8.5 4l7 2.5L21 4v13.5L15.5 20l-7-2.5L3 20zM8.5 4v13.5M15.5 6.5V20',
  crm: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.8c1.6.8 2.7 2.6 3 5.2',
  res: 'M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8zM14 3v5h5M8.5 13h7M8.5 16.5h4',
  fin: 'M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5zM3 10h18M7 14.5h3',
  portal: 'M4 10.5 12 4l8 6.5V20H4zM9.5 20v-5.5h5V20',
  ask: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.3 15.3 20 20M8 9.2a2.5 2.5 0 1 1 3.3 2.4c-.5.2-.8.6-.8 1.1M10.5 14.6v.01',
  audit: 'M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6zM8.8 12l2.2 2.2 4.3-4.4',
  sys: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 9.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4zM9 19.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z',
  agenda: 'M4.5 6.5A1.5 1.5 0 0 1 6 5h12a1.5 1.5 0 0 1 1.5 1.5V19A1.5 1.5 0 0 1 18 20.5H6A1.5 1.5 0 0 1 4.5 19zM4.5 10h15M8.5 3v4M15.5 3v4M8 13.5h2M14 13.5h2M8 17h2',
  docs: 'M3.5 7A1.5 1.5 0 0 1 5 5.5h4.5l2 2.2H19a1.5 1.5 0 0 1 1.5 1.5V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18z',
  comms: 'M4 10v4a1 1 0 0 0 1 1h2.5l6 4V5l-6 4H5a1 1 0 0 0-1 1zM17 9a4 4 0 0 1 0 6M19.5 6.5a7.5 7.5 0 0 1 0 11',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.6 7.6 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.7 7.7 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4 1 2-3.4z',
  tour: 'M5 20V4.5M5 5h11.5l-2 3.5 2 3.5H5',
  insp: 'M5 4.5h14v15H5zM8.5 8.5h7M8.5 12h7M8.5 15.5h4',
  // interfaz
  x: 'M6 6l12 12M18 6 6 18',
  min: 'M6 12h12',
  max: 'M6 6h12v12H6z',
  restore: 'M8.5 8.5h9.5V18H8.5zM6 15.5V6h9.5',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.3 15.3 20 20',
  bell: 'M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  alert: 'M12 4 2.8 19.5h18.4zM12 10v4.5M12 17v.01',
  plus: 'M12 5v14M5 12h14',
  down: 'M12 4v12M7 11l5 5 5-5M5 20h14',
  copy: 'M8.5 8.5h11v11h-11zM15.5 8.5V4.5h-11v11h4',
  chev: 'M9 6l6 6-6 6',
  chevL: 'M15 6l-6 6 6 6',
  chevD: 'M6 9l6 6 6-6',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v5.5H4.5V6H10',
  filter: 'M4 5h16l-6.2 7.5V19l-3.6-1.8v-4.7z',
  file: 'M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8zM14 3v5h5',
  pin: 'M12 21s7-6.2 7-11.5a7 7 0 1 0-14 0C5 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  user: 'M12 11.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c.8-3.8 3.8-6 7.5-6s6.7 2.2 7.5 6',
  grid: 'M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z',
  moon: 'M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 2.5V4M12 20v1.5M2.5 12H4M20 12h1.5M5.3 5.3l1 1M17.7 17.7l1 1M5.3 18.7l1-1M17.7 6.3l1-1',
  reset: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4.5H9',
  layers: 'M12 4 3 9l9 5 9-5zM3 14l9 5 9-5',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z',
  clock: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 7.5V12l3 2',
};

export function Icon({ n, size = 18, className }: { n: string; size?: number; className?: string }) {
  return <svg className={'ic ' + (className ?? '')} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[n] ?? P.file} /></svg>;
}

/** Monograma de Viva Lago: colina, horizonte y ondas del lago. */
export function Mono({ size = 36 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="17" fill="none" stroke="currentColor" strokeOpacity=".45" /><path d="M11 19l7-9 7 9" fill="none" stroke="currentColor" strokeWidth="1.2" /><path d="M5 19.5h26" stroke="var(--sand)" strokeWidth="1.2" /><path d="M8 23.5c3.3-2 6.7 2 10 0s6.7 2 10 0M10.5 27.5c2.5-1.5 5 1.5 7.5 0s5 1.5 7.5 0" fill="none" stroke="currentColor" strokeWidth="1.1" /></svg>;
}
