/* Autoverificación sin navegador: genera la demo, calcula derivados y corre las pruebas de integridad. */
import { derive } from './derive';
import { QUERIES, runQuery } from './queries';
import { getVersion, st } from './store';
import { TESTS } from './tests';

derive(getVersion());
let fail = 0;
for (const t of TESTS) {
  let r; try { r = t.run(); } catch (e) { r = { ok: false, out: 'Error: ' + (e as Error).message }; }
  if (!r.ok) fail++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${t.name}${r.ok ? '' : '\n      ' + r.out.replace(/\n/g, '\n      ')}`);
}
for (const q of QUERIES) { try { const r = runQuery(q.k); if (!r.big) throw new Error('sin resultado'); console.log(`PASS  Consulta ${q.k}: ${r.big}`); } catch (e) { fail++; console.log(`FAIL  Consulta ${q.k}: ${(e as Error).message}`); } }
console.log(`\n${st().lots.length} lotes · ${TESTS.length + QUERIES.length - fail}/${TESTS.length + QUERIES.length} verificaciones correctas`);
if (fail) throw new Error(`${fail} verificaciones fallaron`);
