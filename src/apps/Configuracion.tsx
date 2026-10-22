import { useState } from 'react';
import type { AppProps } from './registry';
import { can, commit, log, me, resetDemo, st } from '../domain/store';
import { D } from '../domain/util';
import { useDomain } from '../os/hooks';
import { openDialog, toast } from '../os/overlay';
import { closeAll } from '../os/wm';
import { Btn, DL, Field, Head, Sec, Seg, Meta } from '../ui/kit';

type Theme = 'auto' | 'light' | 'dark';
const LS = 'vlc-os-theme';
const getTheme = (): Theme => { try { return (localStorage.getItem(LS) as Theme) || 'auto'; } catch { return 'auto'; } };
/** Aplica el tema guardado; “auto” sigue la preferencia del sistema operativo. */
export function applyTheme(t: Theme = getTheme()) {
  const r = document.documentElement;
  if (t === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', t);
  try { localStorage.setItem(LS, t); } catch { /* sin almacenamiento */ }
}

export default function Configuracion(_: AppProps) {
  const { S } = useDomain();
  const [theme, setTheme] = useState<Theme>(getTheme);
  const [risk, setRisk] = useState(S.riskCfg);
  const editRisk = can('fin_edit') || can('lot_admin');
  const saveRisk = () => {
    if (!(risk.atencion >= 1 && risk.riesgo > risk.atencion && risk.critico > risk.riesgo)) return toast('Los umbrales deben ser crecientes: atención < riesgo < crítico.', true);
    log('Cambio de categorías de riesgo', 'Configuración', 'riesgo', `atención ${risk.atencion} · riesgo ${risk.riesgo} · crítico ${risk.critico} días`);
    commit(s => { s.riskCfg = { ...risk }; }); toast('Categorías de riesgo actualizadas. La cartera se recalculó.');
  };
  return <>
    <Head title="Configuración" lede="Preferencias de esta estación de trabajo y reglas generales del sistema." />
    <Sec title="Apariencia" meta="Se guarda en este navegador">
      <Seg label="Tema" value={theme} onChange={t => { setTheme(t); applyTheme(t); }} items={[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']]} />
      <Meta>“Automático” sigue la configuración del sistema operativo de este equipo.</Meta>
    </Sec>
    <Sec title="Categorías de riesgo de cartera" meta="Días de atraso de la cuota más antigua">
      <div className="grid3">
        {(['atencion', 'riesgo', 'critico'] as const).map(k => <Field key={k} label={{ atencion: 'Atención desde', riesgo: 'Riesgo desde', critico: 'Crítico desde' }[k]}>
          <input type="number" min={1} max={365} value={risk[k]} disabled={!editRisk} onChange={e => setRisk(r => ({ ...r, [k]: +e.target.value }))} /></Field>)}
      </div>
      <div style={{ marginTop: 12 }}><Btn kind="primary" onClick={saveRisk} disabled={!editRisk} why="Solo Dirección o Administración financiera">Guardar categorías</Btn></div>
    </Sec>
    <Sec title="Sesión" meta="Entorno de demostración">
      <DL items={[['Usuario', me().user], ['Rol', me().label], ['Fecha de corte', D.fmt(S.T)], ['Datos generados', S.generatedAt.slice(0, 16).replace('T', ' ')], ['Lotes · contratos · prospectos', `${S.lots.length} · ${S.contracts.length} · ${S.prospects.length}`], ['Eventos de auditoría', String(S.audit.length)]]} />
      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Btn kind="danger" icon="reset" onClick={() => openDialog({ title: 'Reiniciar la demo', body: <p>Se descartan todos los cambios y se regeneran los datos ficticios con fecha de corte de hoy.</p>, submit: 'Reiniciar', danger: true, onSubmit: () => { resetDemo(); closeAll(); toast('Demo reiniciada.'); } })}>Reiniciar la demo</Btn>
        <Btn icon="down" onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(st(), null, 1)], { type: 'application/json' })); a.download = `viva-lago-respaldo-${st().T}.json`; a.click(); }}>Descargar respaldo (JSON)</Btn>
      </div>
    </Sec>
    <Sec title="Atajos de teclado" meta="Escritorio">
      <DL items={[['Ctrl / ⌘ + K', 'Buscar apps, lotes, prospectos y contratos'], ['Doble clic en la barra', 'Maximizar o restaurar la ventana'], ['Arrastrar al borde', 'Acomodar la ventana a media pantalla o maximizar'], ['Esc', 'Cerrar diálogo, buscador o alertas']]} />
    </Sec>
  </>;
}
