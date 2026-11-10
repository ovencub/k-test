/** 값의 크기에 맞춰 소수 자릿수를 정해 한국어 형식으로 표시 */
export function fmt(v: number, decimals?: number): string {
  const d = decimals ?? autoDecimals(v);
  return v.toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: d });
}

export function autoDecimals(v: number): number {
  const a = Math.abs(v);
  if (a === 0) return 0;
  if (a < 1) return 2;
  if (a < 100) return 1;
  return 0;
}

/** 데이터에 쓰인 값들의 최대 소수 자릿수 */
export function decimalsOf(values: number[]): number {
  let d = 0;
  for (const v of values) {
    const s = String(v);
    const i = s.indexOf('.');
    if (i >= 0) d = Math.max(d, s.length - i - 1);
  }
  return Math.min(d, 3);
}

export function withUnit(v: string, unit?: string): string {
  if (!unit) return v;
  return unit === '%' || unit === '%p' ? `${v}${unit}` : `${v}${unit.startsWith(' ') ? unit : ' ' + unit}`;
}

/** 보기 좋은 눈금 간격 (1, 2, 2.5, 5 × 10^n) */
export function niceStep(span: number, targetTicks = 5): number {
  const raw = span / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const m = n < 1.5 ? 1 : n < 2.25 ? 2 : n < 3.5 ? 2.5 : n < 7.5 ? 5 : 10;
  return m * mag;
}

export function ticks(lo: number, hi: number, target = 5): number[] {
  const step = niceStep(hi - lo, target);
  const out: number[] = [];
  const start = Math.ceil(lo / step - 1e-9) * step;
  for (let v = start; v <= hi + step * 1e-6; v += step) out.push(Number(v.toPrecision(12)));
  return out;
}

/** 드래그 값 스냅 간격: 범위의 약 1/200을 보기 좋은 수로 */
export function snapStep(span: number): number {
  return niceStep(span, 200);
}

export function snap(v: number, step: number): number {
  return Number((Math.round(v / step) * step).toPrecision(12));
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
