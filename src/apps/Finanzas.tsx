import { useState } from 'react';
import type { AppProps } from './registry';
import { MV_T } from '../domain/catalog';
import { collQueue, matchBank } from '../domain/derive';
import { autoRun, can, commit, getBuyer, log, st } from '../domain/store';
import { D, downloadCSV, pct, uid, usd, usd2, usdK } from '../domain/util';
import { useDomain } from '../os/hooks';
import { openInsp } from '../os/nav';
import { openDialog, toast } from '../os/overlay';
import { Box, Btn, Fig, Field, Head, L, Note, Pill, RiskPill, Sec, Seg, TR, Tabs, useTab, val } from '../ui/kit';
import { PlanFields } from '../ui/plan';
import { bankAssign, bankConfirm, bankCreate, bankDiscard, openPayNew, openPayReject } from './dialogs/finance';

type Tab = 'cartera' | 'libro' | 'conc' | 'cobr' | 'sim';

export default function Finanzas({ win }: AppProps) {
  const { S } = useDomain();
  const [t, setT] = useTab<Tab>(win, 'cartera');
  const [q, setQ] = useState('');
  const pendBank = S.bank.filter(b => b.status === 'pendiente').length;
  return <>
    <Head title="Cartera y cobros" lede="Cada cuota nace de un contrato firmado y cada pago queda en el libro de movimientos. Nada se edita ni se borra: se corrige con reversiones y ajustes aprobados."
      actions={<Btn kind="primary" icon="plus" perm="fin_edit" onClick={() => openPayNew()}>Registrar pago</Btn>} />
    <Tabs value={t} onChange={k => { setT(k); setQ(''); }} items={[['cartera', 'Cartera y mora'], ['libro', 'Libro de movimientos'], ['conc', 'Conciliación bancaria', pendBank], ['cobr', 'Cobranza'], ['sim', 'Simulador de plan']]} />
    {t === 'cartera' ? <Cartera q={q} setQ={setQ} /> : t === 'libro' ? <Libro q={q} setQ={setQ} /> : t === 'conc' ? <Conc /> : t === 'cobr' ? <Cobr /> : <Sim />}
  </>;
}

/* ---- Cartera y mora ---- */
function Cartera({ q, setQ }: { q: string; setQ: (s: string) => void }) {
  const { S, DV } = useDomain();
  const [f, setF] = useState<'todas' | 'mora' | 'aldia' | 'disp' | 'prom'>('todas');
  const accts = [...DV.accts.values()]; const ar = DV.ar;
  const bk = ([[1, 30, '1–30 días', 'var(--warn)'], [31, 60, '31–60 días', 'var(--crit)'], [61, 90, '61–90 días', 'var(--crit)'], [91, 99999, 'Más de 90 días', 'var(--crit)']] as const).map(([a, b, l, c]) => { let s = 0; accts.forEach(x => { if (!x.disputed) x.overdueRows.forEach(r => { const d = D.diff(S.T, r.due); if (d >= a && d <= b) s += r.left; }); }); return { l, s, c }; });
  const all = [{ l: 'A vencer', s: ar.outstandingC - ar.overdueC - ar.disputedOverdueC, c: 'var(--ok)' }, ...bk]; const mx = Math.max(...all.map(x => x.s), 1);
  const ql = q.toLowerCase();
  const rows = accts.filter(a => f === 'mora' ? a.overdueC > 0 && !a.disputed : f === 'aldia' ? a.overdueC === 0 : f === 'disp' ? a.disputed : f === 'prom' ? a.promise?.status === 'vigente' : true)
    .filter(a => !ql || a.c.id.toLowerCase().includes(ql) || a.c.lotId.toLowerCase().includes(ql) || getBuyer(a.c.buyerId).name.toLowerCase().includes(ql))
    .sort((a, b) => b.daysLate - a.daysLate || b.overdueC - a.overdueC || (a.next && b.next ? (a.next.due < b.next.due ? -1 : 1) : 0));
  const prom = S.promises.filter(p => p.status === 'vigente');
  const rev = S.payments.filter(p => p.status === 'en_revision');
  return <>
    <div className="ledger">
      <Fig l="Cartera por cobrar" v={usdK(ar.outstandingC)} s={`${ar.N} cuentas`} d="Cuotas impagas de contratos firmados." />
      <Fig l="Vencido" v={usdK(ar.overdueC)} s={`${ar.lateN} cuentas · ${pct(ar.index)}`} d="Cuotas con vencimiento anterior a hoy y saldo pendiente." />
      <Fig l="En disputa" v={usdK(ar.disputedOverdueC)} s="no se trata como mora confirmada" d="Deuda objetada por el comprador, en revisión." />
      <Fig l="Promesas vigentes" v={String(prom.length)} s={usd(prom.reduce((s, p) => s + p.amountC, 0))} d="Compromisos de pago registrados con fecha." />
      <Fig l="Pagos en revisión" v={usdK(rev.reduce((s, p) => s + p.amountC, 0))} s={`${rev.length} pagos`} d="Informados o recibidos, sin conciliar. No reducen saldo todavía." />
    </div>
    <Sec title="Antigüedad de la deuda" meta="Saldo por días de atraso de cada cuota · excluye deuda en disputa">
      <div className="aging">{all.map(x => <div key={x.l}><div className="l">{x.l}</div><div className="v">{usdK(x.s)}</div><div className="bar"><i style={{ width: `${Math.round(x.s / mx * 100)}%`, background: x.c }} /></div></div>)}</div>
    </Sec>
    <Sec title="Cuentas" meta={`Categorías de riesgo configurables: atención desde ${S.riskCfg.atencion} día, riesgo desde ${S.riskCfg.riesgo}, crítico desde ${S.riskCfg.critico}`}>
      <div className="tbl-tools">
        <Seg label="Filtro" value={f} onChange={setF} items={[['todas', 'Todas'], ['mora', 'En mora'], ['aldia', 'Al día'], ['disp', 'En disputa'], ['prom', 'Con promesa']]} />
        <input type="search" placeholder="Contrato, lote o titular" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar cuenta" />
      </div>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Contrato</th><th>Titular</th><th className="num">Cuotas pagas</th><th className="num">Vencido</th><th className="num">Atraso</th><th className="num">Saldo total</th><th>Próximo venc.</th><th>Riesgo</th><th>Responsable</th></tr></thead><tbody>
        {rows.map(a => <TR key={a.c.id} onOpen={() => openInsp('acct', a.c.id)}>
          <td className="mono">{a.c.id}<span className="sub">{a.c.lotId}</span></td>
          <td>{getBuyer(a.c.buyerId).name}{a.promise?.status === 'vigente' && <span className="sub">Promesa {D.fmtS(a.promise.date)}</span>}{a.pendingRevC > 0 && <span className="sub">{usd(a.pendingRevC)} en revisión</span>}</td>
          <td className="num">{a.paidN}/{a.c.plan.n}</td>
          <td className={'num' + (a.overdueC ? ' st-vencida' : '')}>{a.overdueC ? usd(a.overdueC) : '—'}</td>
          <td className="num">{a.daysLate ? a.daysLate + ' d' : '—'}</td>
          <td className="num">{usd(a.outstandingC)}</td>
          <td>{a.next ? <>{D.fmtS(a.next.due)}<span className="sub">{usd(a.next.left)}</span></> : '—'}</td>
          <td><RiskPill a={a} /></td><td>{a.c.followUp}</td>
        </TR>)}
        {!rows.length && <tr><td colSpan={9} className="empty">Ninguna cuenta coincide con el filtro.</td></tr>}
      </tbody></table></div>
    </Sec>
  </>;
}

/* ---- Libro de movimientos ---- */
function Libro({ q, setQ }: { q: string; setQ: (s: string) => void }) {
  const { S } = useDomain();
  const [lt, setLt] = useState('');
  const ql = q.toLowerCase();
  const rows = [...S.ledger].sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : (a.id < b.id ? 1 : -1))
    .filter(e => (!lt || e.type === lt) && (!ql || e.contractId.toLowerCase().includes(ql) || String(e.ref).toLowerCase().includes(ql)));
  const tot = rows.reduce((s, e) => s + e.amountC, 0);
  const csv = () => downloadCSV(`libro-movimientos-${S.T}.csv`, [['movimiento', 'fecha', 'contrato', 'tipo', 'importe', 'referencia', 'registro', 'aprobo'],
    ...[...S.ledger].sort((a, b) => a.date < b.date ? -1 : 1).map(e => [e.id, e.date, e.contractId, MV_T[e.type], (e.amountC / 100).toFixed(2), e.ref, e.by, e.approvedBy || ''])]);
  return <>
    <Note><b>Regla del libro:</b> los movimientos no se editan ni se eliminan. Un pago mal aplicado se corrige con una reversión y un nuevo registro; un ajuste requiere aprobación y motivo.</Note>
    <div className="tbl-tools" style={{ marginTop: 14 }}>
      <select value={lt} onChange={e => setLt(e.target.value)} aria-label="Tipo"><option value="">Todos los tipos</option>{Object.entries(MV_T).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <input type="search" placeholder="Contrato o referencia" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar movimiento" />
      <span className="meta">{rows.length} movimientos · neto {usd2(tot)}</span><span style={{ flex: 1 }} />
      <Btn sm icon="down" onClick={csv}>Descargar CSV</Btn>
    </div>
    <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Movimiento</th><th>Fecha</th><th>Contrato</th><th>Tipo</th><th className="num">Importe</th><th>Referencia</th><th>Registró</th><th>Aprobó</th></tr></thead><tbody>
      {rows.slice(0, 150).map(e => <tr key={e.id}><td className="mono">{e.id}</td><td>{D.fmt(e.date)}</td><td><L kind="acct" id={e.contractId} /></td>
        <td>{MV_T[e.type]}{e.type !== 'pago' && e.note && <span className="sub">{e.note}</span>}</td>
        <td className={'num' + (e.amountC < 0 ? ' amt-neg' : '')}>{usd2(e.amountC)}</td><td className="mono" style={{ fontSize: 12 }}>{e.ref}</td><td>{e.by}</td><td>{e.approvedBy || '—'}</td></tr>)}
    </tbody></table></div>
    {rows.length > 150 && <p className="meta" style={{ marginTop: 6 }}>Mostrando 150 de {rows.length}. Usá el filtro o la búsqueda.</p>}
  </>;
}

/* ---- Conciliación bancaria ---- */
const EX = 'fecha;descripcion;referencia;importe\n2026-10-15;TRANSF. RECIBIDA;VLC-0012 CTA 18;1.166,67\n15/10/2026;DEPOSITO;VLC-0031;850,00';

/** Importa un extracto CSV (créditos). Devuelve cuántas líneas entraron y cuáles fallaron. */
export function parseBank(text: string) {
  const out: { date: string; desc: string; ref: string; amountC: number }[] = []; const errs: number[] = [];
  text.split(/\r?\n/).map(s => s.trim()).filter(Boolean).forEach((ln, i) => {
    if (i === 0 && /fecha/i.test(ln)) return;
    const sep = ln.includes(';') ? ';' : ','; const c = ln.split(sep).map(s => s.trim().replace(/^"|"$/g, ''));
    if (c.length < 4) { errs.push(i + 1); return; }
    let d = c[0]; const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) d = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) { errs.push(i + 1); return; }
    let a = c[3].replace(/[^\d,.-]/g, ''); if (a.includes(',') && a.lastIndexOf(',') > a.lastIndexOf('.')) a = a.replace(/\./g, '').replace(',', '.'); else a = a.replace(/,/g, '');
    const v = Math.round(parseFloat(a) * 100); if (!(v > 0)) { errs.push(i + 1); return; }
    out.push({ date: d, desc: c[1] || 'MOVIMIENTO', ref: c[2] || '', amountC: v });
  });
  return { rows: out, errs };
}

function importBank(text: string, name: string) {
  const { rows, errs } = parseBank(text);
  if (rows.length) {
    log('Importación de extracto bancario', 'Extracto', name, `${rows.length} movimientos`, errs.length ? `Líneas con error: ${errs.join(', ')}` : '');
    commit(S => rows.forEach(r => S.bank.unshift({ id: 'BK-' + String(S.seq.b++).padStart(4, '0'), ...r, status: 'pendiente', source: 'Importado: ' + name })));
  }
  toast(rows.length ? `${rows.length} movimientos importados${errs.length ? `; ${errs.length} línea(s) con error: ${errs.slice(0, 6).join(', ')}` : ''}.` : 'No se importó ningún movimiento. Revisá el formato.', !rows.length || errs.length > 0);
}

function Conc() {
  const { S } = useDomain();
  const fe = can('fin_edit');
  const pend = S.bank.filter(b => b.status === 'pendiente');
  const ms = pend.map(b => ({ b, m: matchBank(b) }));
  const noBank = S.payments.filter(p => p.status === 'en_revision' && !ms.some(x => x.m.payment === p));
  const done = S.bank.filter(b => b.status !== 'pendiente').slice(0, 12);
  const sim = () => {
    const p = noBank.slice().sort((a, b) => a.id < b.id ? 1 : -1)[0];
    if (!p) return toast('No hay pagos en revisión sin movimiento bancario. Registrá uno primero.', true);
    log('Movimiento bancario simulado', 'Extracto', p.id, usd2(p.amountC), 'Demostración de conciliación');
    commit(S => S.bank.unshift({ id: 'BK-' + String(S.seq.b++).padStart(4, '0'), date: p.date, desc: 'TRANSF. RECIBIDA', ref: p.ref.replace(' CUOTA', ' CTA'), amountC: p.amountC, status: 'pendiente', source: 'generado para la demo' }));
    toast(`Acreditación simulada para ${p.id}. Aparece arriba con su sugerencia.`);
  };
  const file = (el: HTMLInputElement) => { const f = el.files?.[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => importBank(String(rd.result), f.name); rd.onerror = () => toast('No se pudo leer el archivo.', true); rd.readAsText(f); el.value = ''; };
  return <>
    <div className="ledger" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
      <Fig l="Movimientos sin conciliar" v={String(pend.length)} s={usd(pend.reduce((s, b) => s + b.amountC, 0))} d="Créditos del extracto aún no aplicados a una cuenta." />
      <Fig l="Coincidencia alta" v={String(ms.filter(x => x.m.conf === 'alta').length)} s="importe, referencia y fecha" d="Se sugieren; una persona confirma." />
      <Fig l="Sin correspondencia" v={String(ms.filter(x => x.m.conf === 'nula').length)} s="requieren identificación" d="No coinciden con pagos ni contratos." />
      <Fig l="Posibles duplicados" v={String(ms.filter(x => x.m.dup).length)} s="mismo importe, ref. y fecha" d="Confirmar con el banco antes de aplicar." />
    </div>
    <div className="tbl-tools" style={{ marginTop: 16 }}>
      <label className={'btn sm' + (fe ? '' : ' disabled')} style={fe ? undefined : { opacity: .45, pointerEvents: 'none' }}>Importar extracto (CSV)<input type="file" accept=".csv,.txt" className="sr" disabled={!fe} onChange={e => file(e.currentTarget)} /></label>
      <Btn sm kind="ghost" onClick={() => openDialog({ title: 'Formato del extracto', submit: null, body: <><p className="meta">Archivo CSV con encabezado. Separador punto y coma o coma. Fecha AAAA-MM-DD o DD/MM/AAAA. Importe en dólares con coma o punto decimal. Solo se importan créditos (importes positivos).</p><textarea readOnly className="mono" style={{ minHeight: 110 }} defaultValue={EX} /></>,
        foot: <button type="button" className="btn" onClick={() => navigator.clipboard?.writeText(EX).then(() => toast('Ejemplo copiado al portapapeles.'), () => toast('Tu navegador no permitió copiar.', true))}>Copiar ejemplo</button> })}>Ver formato</Btn>
      <Btn sm kind="ghost" perm="fin_edit" onClick={sim}>Simular acreditación de un pago en revisión</Btn>
    </div>
    <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Fecha</th><th>Movimiento bancario</th><th className="num">Importe</th><th>Sugerencia</th><th /></tr></thead><tbody>
      {ms.map(({ b, m }) => <tr key={b.id}>
        <td>{D.fmtS(b.date)}<span className="sub mono">{b.id}</span></td>
        <td>{b.desc}<span className="sub mono">{b.ref || 'sin referencia'}{b.source ? ' · ' + b.source : ''}</span></td>
        <td className="num">{usd2(b.amountC)}</td>
        <td>{m.dup && <><span className="conf dup">posible duplicado</span> </>}<span className={'conf ' + m.conf}>{m.conf === 'nula' ? 'sin coincidencia' : m.conf}</span>{' '}
          {m.payment ? <><span className="mono">{m.payment.id}</span> → <L kind="acct" id={m.payment.contractId} /></> : m.create ? <>crear pago en <L kind="acct" id={m.contractId!} /></> : null}
          <div className="why">{m.why.join(' · ')}</div></td>
        <td><div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {m.payment ? <Btn sm kind="primary" perm="fin_edit" onClick={() => bankConfirm(b.id)}>Confirmar</Btn> : m.create && !m.dup ? <Btn sm kind="primary" perm="fin_edit" onClick={() => bankCreate(b.id)}>Crear y aplicar</Btn> : null}
          <Btn sm perm="fin_edit" onClick={() => bankAssign(b.id)}>Asignar</Btn>
          <Btn sm kind="ghost" perm="fin_edit" onClick={() => bankDiscard(b.id)}>Descartar</Btn>
        </div></td>
      </tr>)}
      {!ms.length && <tr><td colSpan={5} className="empty">No hay movimientos pendientes. Importá un extracto para conciliar.</td></tr>}
    </tbody></table></div>
    <Sec title="Pagos informados sin acreditación bancaria" meta={String(noBank.length)}>
      <Note>Un comprobante o captura enviada por el comprador no confirma el pago. Queda en revisión hasta que aparezca el movimiento en el extracto.</Note>
      {noBank.length > 0 && <div className="tbl-wrap" style={{ marginTop: 10 }}><table className="tbl"><thead><tr><th>Pago</th><th>Contrato</th><th>Fecha informada</th><th className="num">Importe</th><th>Origen</th><th /></tr></thead><tbody>
        {noBank.map(p => <tr key={p.id}><td className="mono">{p.id}</td><td><L kind="acct" id={p.contractId} /></td><td>{D.fmt(p.date)}</td><td className="num">{usd2(p.amountC)}</td><td>{p.source}<span className="sub">{p.method}</span></td>
          <td className="num"><Btn sm kind="ghost" perm="fin_edit" onClick={() => openPayReject(p.id)}>Rechazar</Btn></td></tr>)}
      </tbody></table></div>}
    </Sec>
    <Sec title="Conciliados y descartados recientes" meta="Quién aprobó cada uno">
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Movimiento</th><th>Fecha</th><th className="num">Importe</th><th>Resultado</th><th>Aprobó</th></tr></thead><tbody>
        {done.map(b => <tr key={b.id}><td className="mono">{b.id}<span className="sub">{b.ref}</span></td><td>{D.fmtS(b.date)}</td><td className="num">{usd2(b.amountC)}</td>
          <td>{b.status === 'conciliada' ? <><Pill cls="ok">Conciliado</Pill> <span className="mono">{b.paymentId}</span></> : <><Pill cls="neutral">Descartado</Pill><span className="sub">{b.discardReason}</span></>}</td>
          <td>{b.approvedBy || '—'}<span className="sub">{(b.approvedAt || '').replace('T', ' ').slice(0, 16)}</span></td></tr>)}
      </tbody></table></div>
    </Sec>
  </>;
}

/* ---- Cobranza ---- */
function Cobr() {
  const { S } = useDomain();
  const fe = can('fin_edit');
  const q = collQueue(); const pend = q.filter(x => x.status === 'pendiente');
  const toggle = (k: string, on: boolean) => { const s = st().collSeq.find(x => x.k === k)!; log((on ? 'Activación' : 'Desactivación') + ' de paso de cobranza', 'Cobranza', s.label, ''); commit(() => { s.on = on; }); };
  const tpl = (k: string) => { const s = st().collSeq.find(x => x.k === k)!; openDialog({
    title: `Plantilla · ${s.label}`, submit: fe ? 'Guardar plantilla' : null,
    body: <Field label="Mensaje" hint="Variables: {nombre} {lote} {n} {vence} {importe} {vencido} {ref} {responsable}"><textarea name="tpl" style={{ minHeight: 120 }} readOnly={!fe} defaultValue={s.tpl} /></Field>,
    onSubmit: fe ? f => { const t = val(f, 'tpl'); if (t.length < 10) return 'El mensaje es demasiado corto.'; log('Cambio de plantilla de cobranza', 'Cobranza', s.label, ''); commit(() => { s.tpl = t; }); toast('Plantilla guardada.'); } : undefined,
  }); };
  const run = () => {
    if (!pend.length) return toast('No hay acciones pendientes para hoy.');
    autoRun('AUT-04', `${pend.length} tareas de cobranza generadas`);
    log('Generación de tareas de cobranza', 'Cobranza', `${pend.length} cuentas`, 'Secuencia diaria', 'Ejecución manual');
    commit(S => pend.forEach(x => S.tasks.unshift({ id: uid('TK'), contractId: x.a.c.id, step: x.step, text: `${x.label} por ${x.channel}`, owner: x.a.c.followUp, date: S.T, done: false, msg: x.msg })));
    toast(`${pend.length} tareas creadas. No se envió ningún mensaje: los canales externos no están activos.`);
  };
  const done = (id: string) => { const t = st().tasks.find(x => x.id === id)!; log('Tarea de cobranza completada', 'Cobranza', t.contractId, t.text); commit(() => { t.done = true; }); };
  return <>
    <div className="split" style={{ marginTop: 0 }}>
      <Box><h2 className="h3">Secuencia de cobranza</h2><span className="meta">Configurable por paso. Día relativo al vencimiento.</span>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Paso</th><th className="num">Día</th><th>Canal</th><th>Activo</th><th /></tr></thead><tbody>
          {S.collSeq.map(s => <tr key={s.k}><td>{s.label}</td><td className="num mono">{s.off > 0 ? '+' : ''}{s.off}</td><td>{['pre', 'd0'].includes(s.k) ? 'Preferido del titular' : s.channel}</td>
            <td><input type="checkbox" checked={s.on} disabled={!fe} onChange={e => toggle(s.k, e.target.checked)} aria-label={`Activar ${s.label}`} /></td>
            <td className="num"><Btn sm kind="ghost" onClick={() => tpl(s.k)}>Plantilla</Btn></td></tr>)}
        </tbody></table></div></Box>
      <Box><h2 className="h3">Canales y reglas</h2><span className="meta">Estado real de cada integración</span>
        <div className="proj-row" style={{ gridTemplateColumns: '1fr auto' }}><span>WhatsApp Business Platform</span><Pill cls="warn">Preparado · no activo</Pill></div>
        <div className="proj-row" style={{ gridTemplateColumns: '1fr auto' }}><span>Correo transaccional</span><Pill cls="warn">Preparado · no activo</Pill></div>
        <div className="proj-row" style={{ gridTemplateColumns: '1fr auto' }}><span>Tareas internas y llamadas</span><Pill cls="ok">Activo</Pill></div>
        <p className="meta" style={{ marginTop: 8 }}>Máximo un contacto cada 3 días por cuenta. Se respeta el canal preferido, las bajas y las cuentas en disputa. Ningún mensaje se envía sin canal activo y autorizado.</p></Box>
    </div>
    <Sec title="Acciones de hoy" meta={`${pend.length} por generar · ${q.filter(x => x.status === 'tarea creada').length} con tarea · ${q.filter(x => x.status === 'omitido').length} omitidas`}>
      <div className="tbl-tools"><Btn kind="primary" perm="fin_edit" onClick={run}>{`Generar ${pend.length} tarea${pend.length === 1 ? '' : 's'}`}</Btn><span className="meta">Crea tareas para el responsable y deja el mensaje listo. No envía nada mientras los canales no estén activos.</span></div>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Cuenta</th><th>Paso</th><th>Canal</th><th>Mensaje</th><th>Estado</th></tr></thead><tbody>
        {q.map(x => <tr key={x.a.c.id}><td><L kind="acct" id={x.a.c.id} /><span className="sub">{x.b.name}</span></td>
          <td>{x.label}<span className="sub">{x.a.daysLate ? x.a.daysLate + ' d de atraso' : 'vence ' + D.fmtS(x.a.next?.due)}</span></td><td>{x.channel}</td>
          <td><div className="msg-prev">{x.msg}</div></td>
          <td>{x.status === 'pendiente' ? <Pill cls="neutral">Pendiente</Pill> : x.status === 'tarea creada' ? <Pill cls="ok">Tarea creada</Pill> : <><Pill cls="warn">Omitido</Pill><span className="sub">{x.why}</span></>}</td></tr>)}
        {!q.length && <tr><td colSpan={5} className="empty">Sin acciones de cobranza para hoy.</td></tr>}
      </tbody></table></div>
    </Sec>
    {S.tasks.length > 0 && <Sec title="Tareas de cobranza" meta={`${S.tasks.filter(t => !t.done).length} abiertas`}>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Tarea</th><th>Cuenta</th><th>Responsable</th><th>Fecha</th><th /></tr></thead><tbody>
        {S.tasks.map(t => <tr key={t.id}><td>{t.text}</td><td><L kind="acct" id={t.contractId} /></td><td>{t.owner}</td><td>{D.fmtS(t.date)}</td>
          <td className="num">{t.done ? <Pill cls="ok">Hecha</Pill> : <Btn sm perm="fin_edit" onClick={() => done(t.id)}>Marcar hecha</Btn>}</td></tr>)}
      </tbody></table></div>
    </Sec>}
  </>;
}

/* ---- Simulador de plan ---- */
function Sim() {
  const T = st().T;
  return <Box><h2 className="h3">Simulador de plan de financiación</h2><span className="meta">Mismo motor que usa el contrato. No crea registros.</span>
    <PlanFields init={{ price: 85000, down: 30, n: 60, rate: 0, first: D.addM(T, 1, 10), round: 'centavo' }} /></Box>;
}

