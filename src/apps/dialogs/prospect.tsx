import type { Category, Prospect } from '../../domain/types';
import { ADVISORS, CAT, HORIZON, LOST_REASONS, SECTOR, SOURCES, STAGES, STAGE_IX, advName, catLabel } from '../../domain/catalog';
import { stageGate } from '../../domain/derive';
import { can, commit, getProspect, log, me, st } from '../../domain/store';
import { D, m2, usd, usdK } from '../../domain/util';
import { openInsp } from '../../os/nav';
import { openDialog, toast } from '../../os/overlay';
import { Field, val } from '../../ui/kit';

/* Diálogos del ciclo del prospecto (alta, actividad, calificación, visita, lotes, avance y pérdida). */

export function openNewProspect() {
  openDialog({
    title: 'Nuevo prospecto', submit: 'Crear prospecto',
    body: <>
      <div className="grid2">
        <Field label="Nombre y apellido"><input type="text" name="name" required maxLength={80} /></Field>
        <Field label="Teléfono"><input type="tel" name="phone" placeholder="+595 9…" maxLength={24} /></Field>
        <Field label="Fuente"><select name="source">{SOURCES.map(s => <option key={s}>{s}</option>)}</select></Field>
        {can('crm_all')
          ? <Field label="Asesor responsable"><select name="adv"><option value="auto">Asignación automática (menor carga)</option>{ADVISORS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
          : <input type="hidden" name="adv" value="self" />}
        <Field label="Categoría de interés"><select name="cat"><option value="">Sin definir</option>{(Object.keys(CAT) as Category[]).map(k => <option key={k} value={k}>{CAT[k].label}</option>)}</select></Field>
        <Field label="Interés declarado"><input type="text" name="interest" maxLength={140} placeholder="Qué busca, en sus palabras" /></Field>
      </div>
      <p className="meta">Solo pedimos los datos necesarios para el seguimiento comercial.</p>
    </>,
    onSubmit: f => {
      const S = st(); const T = S.T;
      const name = val(f, 'name'); if (name.length < 3) return 'Ingresá nombre y apellido.';
      const phone = val(f, 'phone'); if (phone && !/^[+\d\s()-]{6,}$/.test(phone)) return 'El teléfono solo admite números, espacios y +.';
      let adv = val(f, 'adv');
      if (adv === 'self') adv = me().advisorId || 'ADV1';
      if (adv === 'auto') adv = ADVISORS.map(a => ({ a, n: S.prospects.filter(p => p.advisorId === a.id && !['ganado', 'perdido'].includes(p.stage)).length })).sort((x, y) => x.n - y.n)[0].a.id;
      const cat = val(f, 'cat') as Category | '';
      const src = val(f, 'source');
      const p: Prospect = { id: 'P-' + (S.seq.q++), name, phone: phone || '—', email: '', source: src, advisorId: adv, created: T, firstResponseMin: 0, interest: val(f, 'interest') || 'Sin detalle', budgetC: null, category: cat || null, location: '', horizon: null, stage: 'nuevo', lastActivity: T, nextAction: { text: 'Primer contacto', date: T }, visitDate: null, lotIds: [], lostReason: null, history: [{ date: T, type: 'Ingreso', text: `Ingresó por ${src} (carga manual).`, by: me().user }], reached: 'nuevo' };
      log('Alta de prospecto', 'Prospecto', p.id, `${name} · asignado a ${advName(adv)}`);
      commit(s => { s.prospects.push(p); });
      toast(`Prospecto creado y asignado a ${advName(adv)}.`);
      setTimeout(() => openInsp('prospect', p.id));
    },
  });
}

export function openActivity(id: string) {
  const T = st().T;
  openDialog({
    title: 'Registrar actividad', submit: 'Registrar',
    body: <>
      <div className="grid2">
        <Field label="Tipo"><select name="type">{['Llamada', 'WhatsApp', 'Correo', 'Reunión', 'Nota'].map(t => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Fecha"><input type="date" name="date" defaultValue={T} max={T} /></Field>
      </div>
      <Field label="Qué pasó"><textarea name="text" required /></Field>
      <div className="grid2">
        <Field label="Próxima acción"><input type="text" name="next" placeholder="Por ejemplo: enviar plan de pagos" /></Field>
        <Field label="Para el"><input type="date" name="nextDate" defaultValue={D.add(T, 2)} min={T} /></Field>
      </div>
    </>,
    onSubmit: f => {
      const text = val(f, 'text'); if (text.length < 3) return 'Describí la actividad.';
      const d = val(f, 'date') || T; if (d > T) return 'La fecha no puede ser futura.';
      commit(() => { const p = getProspect(id)!; p.history.push({ date: d, type: val(f, 'type'), text, by: me().user }); if (d > p.lastActivity) p.lastActivity = d; const nx = val(f, 'next'); if (nx) p.nextAction = { text: nx, date: val(f, 'nextDate') || D.add(T, 2) }; });
      toast('Actividad registrada.');
    },
  });
}

export function openQualify(id: string) {
  const p = getProspect(id)!;
  openDialog({
    title: 'Calificar prospecto', submit: 'Guardar calificación',
    body: <div className="grid2">
      <Field label="Presupuesto estimado (USD)"><input type="number" name="budget" min={5000} step={1000} defaultValue={p.budgetC ? p.budgetC / 100 : ''} required /></Field>
      <Field label="Categoría buscada"><select name="cat" defaultValue={p.category ?? undefined}>{(Object.keys(CAT) as Category[]).map(k => <option key={k} value={k}>{CAT[k].label}</option>)}</select></Field>
      <Field label="Horizonte de compra"><select name="hor" defaultValue={p.horizon ?? undefined}>{HORIZON.map(h => <option key={h}>{h}</option>)}</select></Field>
      <Field label="Ubicación preferida"><select name="loc" defaultValue={p.location || undefined}>{Object.values(SECTOR).map(s => <option key={s}>{s}</option>)}</select></Field>
    </div>,
    onSubmit: f => {
      const b = +val(f, 'budget'); if (!(b >= 5000)) return 'Ingresá un presupuesto en USD (mínimo 5.000).';
      commit(s => { const p = getProspect(id)!; p.budgetC = Math.round(b) * 100; p.category = val(f, 'cat') as Category; p.horizon = val(f, 'hor'); p.location = val(f, 'loc'); p.lastActivity = s.T; p.history.push({ date: s.T, type: 'Calificación', text: `Presupuesto ${usd(p.budgetC)}, busca ${catLabel(p.category)}, horizonte ${p.horizon}.`, by: me().user }); });
      toast('Calificación guardada.');
    },
  });
}

export function openVisit(id: string) {
  openDialog({
    title: 'Programar o registrar visita', submit: 'Guardar',
    body: <><Field label="Fecha de la visita"><input type="date" name="date" defaultValue={D.add(st().T, 2)} required /></Field><p className="meta">Una fecha futura agenda la visita; una fecha de hoy o anterior la registra como realizada.</p></>,
    onSubmit: f => {
      const d = val(f, 'date'); if (!d) return 'Elegí una fecha.';
      const past = d <= st().T;
      commit(s => { const p = getProspect(id)!; p.visitDate = d; p.lastActivity = s.T; p.history.push({ date: s.T, type: 'Visita', text: past ? `Visita realizada el ${D.fmt(d)}.` : `Visita agendada para el ${D.fmt(d)}.`, by: me().user }); p.nextAction = past ? { text: 'Enviar opciones de lotes', date: D.add(s.T, 1) } : { text: 'Confirmar visita', date: D.add(d, -1) < s.T ? s.T : D.add(d, -1) }; });
      toast(past ? 'Visita registrada.' : 'Visita agendada.');
    },
  });
}

export function openLots(id: string) {
  const p = getProspect(id)!;
  const ls = st().lots.filter(l => l.status === 'disponible' && (!p.category || l.category === p.category));
  openDialog({
    title: 'Lotes de interés', submit: 'Guardar', wide: true,
    body: <><p className="meta">Disponibles{p.category ? ' en ' + catLabel(p.category) : ''}. Elegí hasta 3.</p>
      <div className="grid3">{ls.map(l => <label key={l.id} className="chk"><input type="checkbox" name="lot" value={l.id} defaultChecked={p.lotIds.includes(l.id)} /><span><b className="mono">{l.id}</b> · {usdK(l.priceC)}<br /><span className="meta">{m2(l.area)}</span></span></label>)}</div></>,
    onSubmit: f => {
      const ids = f.getAll('lot').map(String); if (ids.length > 3) return 'Elegí hasta 3 lotes.';
      commit(s => { const p = getProspect(id)!; p.lotIds = ids; p.lastActivity = s.T; p.history.push({ date: s.T, type: 'Lotes', text: ids.length ? `Interesado en ${ids.join(', ')}.` : 'Sin lotes de interés.', by: me().user }); });
    },
  });
}

export function advance(id: string) {
  const p = getProspect(id)!; const g = stageGate(p);
  if (!g.ok || !g.next) return toast('Falta: ' + g.miss.join(', '), true);
  const from = STAGES[STAGE_IX[p.stage]].label, to = g.next;
  log('Cambio de etapa', 'Prospecto', p.id, `${from} → ${to.label}`);
  commit(s => { p.stage = to.k; p.lastActivity = s.T; p.history.push({ date: s.T, type: 'Etapa', text: `Avanzó de ${from} a ${to.label}.`, by: me().user }); });
  toast(`${p.name} pasó a ${to.label}.`);
}

export function openLost(id: string) {
  openDialog({
    title: 'Marcar como perdido', submit: 'Marcar perdido', danger: true,
    body: <><Field label="Motivo de pérdida"><select name="why">{LOST_REASONS.map(r => <option key={r}>{r}</option>)}</select></Field><Field label="Detalle (opcional)"><textarea name="note" /></Field></>,
    onSubmit: f => {
      const p = getProspect(id)!; const why = val(f, 'why'), note = val(f, 'note');
      log('Prospecto perdido', 'Prospecto', p.id, why, note);
      commit(s => { p.reached = p.stage; p.stage = 'perdido'; p.lostReason = why; p.lastActivity = s.T; p.nextAction = null; p.history.push({ date: s.T, type: 'Cierre', text: `Perdido: ${why}. ${note}`, by: me().user }); });
      toast('Prospecto marcado como perdido.');
    },
  });
}
