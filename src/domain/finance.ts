import type { Installment, Plan } from './types';
import { D, nf1 } from './util';

interface ScheduleIn { financedC: number; n: number; rate: number; firstDue: string; rounding?: 'centavo' | 'dolar' }

/** Devuelve cuotas cuya suma de capital = financiado exacto. */
export function buildSchedule({ financedC, n, rate, firstDue, rounding = 'centavo' }: ScheduleIn): Installment[] {
  const out: Installment[] = []; const step = rounding === 'dolar' ? 100 : 1;
  const rnd = (v: number) => Math.round(v / step) * step;
  const day = D.parse(firstDue).getUTCDate();
  if (!rate) {
    const base = Math.floor(financedC / n / step) * step;
    for (let k = 1; k <= n; k++) {
      const amt = k < n ? base : financedC - base * (n - 1);
      out.push({ n: k, due: D.addM(firstDue, k - 1, day), amountC: amt, principalC: amt, interestC: 0 });
    }
  } else {
    const i = rate / 12;
    const cuota = rnd(financedC * i / (1 - Math.pow(1 + i, -n)));
    let bal = financedC;
    for (let k = 1; k <= n; k++) {
      const int = Math.round(bal * i);
      let prin = cuota - int;
      if (k === n) prin = bal;
      bal -= prin;
      out.push({ n: k, due: D.addM(firstDue, k - 1, day), amountC: prin + int, principalC: prin, interestC: int });
    }
  }
  return out;
}

export function planMethod(plan: Pick<Plan, 'rate' | 'n' | 'rounding'>) {
  const r = plan.rounding === 'dolar' ? 'al dólar' : 'al centavo';
  if (!plan.rate) return `Cuota fija sin interés: financiado ÷ ${plan.n}, redondeo ${r} hacia abajo; la diferencia de redondeo se ajusta en la última cuota para que la suma de cuotas sea exactamente el importe financiado.`;
  return `Sistema francés, tasa nominal anual ${nf1.format(plan.rate * 100)} % (mensual = anual ÷ 12). Cuota = F·i ÷ (1 − (1+i)^−n), redondeo ${r}. Interés de cada cuota sobre saldo de capital; la última cuota cancela el saldo exacto.`;
}

export function makePlan({ priceC, downPct, n, rate, firstDue, rounding = 'centavo' }: { priceC: number; downPct: number; n: number; rate: number; firstDue: string; rounding?: 'centavo' | 'dolar' }): Plan {
  const downC = Math.round(priceC * downPct / 100 / 100) * 100; // entrada redondeada al dólar
  const financedC = priceC - downC;
  const installments = buildSchedule({ financedC, n, rate, firstDue, rounding });
  return { priceC, downPct, downC, financedC, n, rate, freq: 'Mensual', firstDue, rounding, currency: 'USD', installments };
}
