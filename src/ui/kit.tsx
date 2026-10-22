import { useEffect, useState } from 'react';
import type { Win } from '../os/wm';
import type { ReactNode } from 'react';
import type { Perm } from '../domain/types';
import type { Acct, InspKind } from '../domain/derive';
import { LOT_ST, RISK, advIni, advName } from '../domain/catalog';
import { can } from '../domain/store';
import { openInsp } from '../os/nav';
import { Icon } from '../os/icons';

/* Piezas compartidas por todas las apps. Controles estándar; el mundo aporta tipografía, paleta y densidad. */

export function Btn({ children, onClick, kind = '', perm, why, sm, type = 'button', icon, disabled }: {
  children?: ReactNode; onClick?: () => void; kind?: '' | 'primary' | 'ghost' | 'danger' | 'ghost danger'; perm?: Perm | null; why?: string; sm?: boolean; type?: 'button' | 'submit'; icon?: string; disabled?: boolean;
}) {
  const ok = !perm || can(perm);
  return <button type={type} className={`btn ${kind}${sm ? ' sm' : ''}`} onClick={onClick} disabled={!ok || disabled} title={ok ? undefined : (why || 'Tu rol no tiene permiso para esta acción')}>
    {icon && <Icon n={icon} size={15} />}{children}
  </button>;
}

export const Pill = ({ cls, children, dot = true }: { cls: string; children: ReactNode; dot?: boolean }) => <span className={`pill ${cls}${dot ? '' : ' nodot'}`}>{children}</span>;
export const StPill = ({ st }: { st: keyof typeof LOT_ST }) => <Pill cls={LOT_ST[st].cls}>{LOT_ST[st].label}</Pill>;
export const RiskPill = ({ a }: { a: Acct }) => a.disputed ? <Pill cls="reg">En disputa</Pill> : <Pill cls={RISK[a.risk][1]}>{RISK[a.risk][0]}</Pill>;
export const Tag = ({ children, est }: { children: ReactNode; est?: boolean }) => <span className={'tag' + (est ? ' est' : '')}>{children}</span>;

/** Enlace a una ficha. */
export function L({ kind, id, children, mono = true }: { kind: InspKind; id: string; children?: ReactNode; mono?: boolean }) {
  return <button type="button" className={'lnk' + (mono ? ' mono' : '')} onClick={e => { e.stopPropagation(); openInsp(kind, id); }}>{children ?? id}</button>;
}
export const Lnk = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => <button type="button" className="lnk" onClick={e => { e.stopPropagation(); onClick(); }}>{children}</button>;

export const Av = ({ id }: { id: string }) => <span className="av" title={advName(id)}>{advIni(id)}</span>;

/** Cifra clave con definición: valor, contexto y qué mide. */
export const Fig = ({ l, v, s, d }: { l: string; v: ReactNode; s?: ReactNode; d: string }) =>
  <div className="fig"><span className="l">{l}</span><span className="v">{v}</span><span className="s">{s ?? ' '}</span><span className="d">{d}</span></div>;

export function Delta({ cur, prev }: { cur: number; prev: number | null | undefined }) {
  if (prev == null) return null;
  if (prev === 0) return cur > 0 ? <span className="delta up">nuevo</span> : <span className="delta flat">=</span>;
  const r = (cur - prev) / Math.abs(prev); const cls = Math.abs(r) < .005 ? 'flat' : r > 0 ? 'up' : 'down';
  return <span className={`delta ${cls}`}>{r > 0 ? '+' : ''}{Math.round(r * 100)} %</span>;
}

export function Sec({ title, meta, children, actions }: { title: string; meta?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return <section className="sec"><div className="sec-h"><h2>{title}</h2>{meta && <span className="meta">{meta}</span>}{actions && <span className="sec-a">{actions}</span>}</div>{children}</section>;
}

/** Cabecera de app: título, frase de estado y acciones. Sin rótulos sobre el título. */
export function Head({ title, lede, actions }: { title: string; lede?: ReactNode; actions?: ReactNode }) {
  return <header className="vh"><div><h1>{title}</h1>{lede && <p className="lede">{lede}</p>}</div>{actions && <div className="vh-actions">{actions}</div>}</header>;
}

export const Box = ({ children, className = '' }: { children: ReactNode; className?: string }) => <div className={'box ' + className}>{children}</div>;
export const Note = ({ children }: { children: ReactNode }) => <div className="note">{children}</div>;
export const Meta = ({ children }: { children: ReactNode }) => <p className="meta">{children}</p>;
export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>;

export function DL({ items }: { items: [string, ReactNode][] }) {
  return <dl className="dl">{items.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

export function Tabs<K extends string>({ value, onChange, items }: { value: K; onChange: (k: K) => void; items: [K, string, (number | null)?][] }) {
  return <div className="tabs" role="tablist">{items.map(([k, l, n]) =>
    <button key={k} type="button" role="tab" aria-selected={value === k} onClick={() => onChange(k)}>{l}{n != null && n > 0 && <span className="n">{n}</span>}</button>)}</div>;
}

export function Seg<K extends string>({ value, onChange, items, label }: { value: K; onChange: (k: K) => void; items: [K, string][]; label: string }) {
  return <div className="seg" role="group" aria-label={label}>{items.map(([k, l]) =>
    <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}>{l}</button>)}</div>;
}

export function Field({ label, children, hint, wide }: { label: string; children: ReactNode; hint?: string; wide?: boolean }) {
  return <label className={'field' + (wide ? ' wide' : '')}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

/** Campo de motivo obligatorio para acciones sensibles (queda en auditoría). */
export const ReasonField = ({ label = 'Motivo', ph = 'Explicá brevemente el motivo' }: { label?: string; ph?: string }) =>
  <Field label={label} hint="Queda registrado en la auditoría."><textarea name="reason" required placeholder={ph} /></Field>;
export const reasonOf = (f: FormData) => { const r = String(f.get('reason') ?? '').trim(); return r.length < 5 ? null : r; };
export const REASON_ERR = 'Escribí un motivo de al menos 5 caracteres.';
export const val = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

/** Fila clicable de tabla accesible con teclado. */
export function TR({ onOpen, children, className = '' }: { onOpen: () => void; children: ReactNode; className?: string }) {
  return <tr className={'click ' + className} tabIndex={0} onClick={onOpen} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}>{children}</tr>;
}

export const Bar = ({ v, max, color }: { v: number; max: number; color?: string }) => <span className="bar"><i style={{ width: `${max ? Math.round(v / max * 100) : 0}%`, background: color }} /></span>;

/** Pestaña interna de una app; se puede fijar desde fuera al abrir la ventana con `tab`. */
export function useTab<K extends string>(win: Win, def: K) {
  const [t, setT] = useState<K>((win.params.tab as K) || def);
  useEffect(() => { if (win.params.tab) setT(win.params.tab as K); }, [win.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  return [t, setT] as const;
}

/** Marco de una ficha: cabecera fija, cuerpo con scroll y barra de acciones. */
export function InspFrame({ title, sub, foot, children }: { title: ReactNode; sub?: ReactNode; foot?: ReactNode; children: ReactNode }) {
  return <div className="insp">
    <header className="insp-h"><h2>{title}</h2>{sub && <div className="insp-sub">{sub}</div>}</header>
    <div className="insp-b">{children}</div>
    {foot && <footer className="insp-f">{foot}</footer>}
  </div>;
}

export const DSec = ({ title, children }: { title: string; children: ReactNode }) => <div className="dsec"><h3>{title}</h3>{children}</div>;
export const Timeline = ({ items }: { items: [ReactNode, ReactNode][] }) => <ul className="timeline">{items.map(([t, c], i) => <li key={i}><span className="t">{t}</span><span>{c}</span></li>)}</ul>;
