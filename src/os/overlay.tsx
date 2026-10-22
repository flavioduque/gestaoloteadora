import { useEffect, useRef, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import { Icon } from './icons';

/* Diálogos del sistema y notificaciones efímeras (toasts). */

export interface DialogSpec {
  title: string; wide?: boolean;
  body: ReactNode;
  /** Si se define, el cuerpo va dentro de un <form>; devolver un texto muestra el error y deja el diálogo abierto. */
  onSubmit?: (f: FormData, form: HTMLFormElement) => string | void;
  submit?: string | null; danger?: boolean;
  foot?: ReactNode;
}
type Stored = DialogSpec & { id: number };
let dialogs: Stored[] = []; let did = 0;
const dsubs = new Set<() => void>();
const demit = () => { dialogs = [...dialogs]; dsubs.forEach(f => f()); };
export function openDialog(d: DialogSpec) { dialogs.push({ ...d, id: ++did }); demit(); }
export function closeDialog() { dialogs.pop(); demit(); }

interface Toast { id: number; msg: string; err?: boolean }
let toasts: Toast[] = []; let tid = 0;
const tsubs = new Set<() => void>();
const temit = () => { toasts = [...toasts]; tsubs.forEach(f => f()); };
export function toast(msg: string, err?: boolean) {
  const t = { id: ++tid, msg, err }; toasts.push(t); temit();
  setTimeout(() => { toasts = toasts.filter(x => x !== t); temit(); }, err ? 6500 : 4500);
}

const useStoreArr = <T,>(subs: Set<() => void>, get: () => T) => useSyncExternalStore(cb => { subs.add(cb); return () => { subs.delete(cb); }; }, get);

function DialogView({ d }: { d: Stored }) {
  const ref = useRef<HTMLFormElement>(null);
  const err = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('.dlg-b input:not([type=hidden]):not([readonly]),.dlg-b select,.dlg-b textarea,button[type=submit]');
    el?.focus();
  }, []);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!d.onSubmit) return closeDialog();
    const msg = d.onSubmit(new FormData(e.currentTarget), e.currentTarget);
    if (msg) { if (err.current) err.current.textContent = msg; return; }
    closeDialog();
  };
  return (
    <div className="dlg-wrap" onMouseDown={e => { if (e.target === e.currentTarget) closeDialog(); }}>
      <form ref={ref} className={'dlg' + (d.wide ? ' wide' : '')} onSubmit={submit} noValidate role="dialog" aria-modal="true" aria-labelledby={`dh${d.id}`}>
        <header className="dlg-h"><h2 id={`dh${d.id}`}>{d.title}</h2><button type="button" className="iconbtn" onClick={closeDialog} aria-label="Cerrar"><Icon n="x" /></button></header>
        <div className="dlg-b">{d.body}<p className="f-err" ref={err} role="alert" /></div>
        <footer className="dlg-f">
          {d.foot ?? <>
            <button type="button" className="btn ghost" onClick={closeDialog}>{d.submit === null ? 'Cerrar' : 'Cancelar'}</button>
            {d.submit !== null && d.onSubmit && <button type="submit" className={'btn ' + (d.danger ? 'danger' : 'primary')}>{d.submit ?? 'Guardar'}</button>}
          </>}
        </footer>
      </form>
    </div>
  );
}

export function OverlayHost() {
  const ds = useStoreArr(dsubs, () => dialogs);
  const ts = useStoreArr(tsubs, () => toasts);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && dialogs.length) { e.stopPropagation(); closeDialog(); } };
    window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true);
  }, []);
  return <>
    {ds.length > 0 && <div className="scrim" />}
    {ds.map(d => <DialogView key={d.id} d={d} />)}
    <div className="toasts" aria-live="polite">{ts.map(t => <div key={t.id} role="status" className={'toast' + (t.err ? ' err' : '')}><Icon n={t.err ? 'alert' : 'check'} />{t.msg}</div>)}</div>
  </>;
}

export const hasDialog = () => dialogs.length > 0;
