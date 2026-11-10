import type { Answer, Question } from './types';

/** 모든 형식을 0~100점으로. 공식 근거는 spec.md 5장. 플레이 테스트로 아래 상수를 조정한다. */
export const TUNING = {
  barZeroAt: 0.25, // 막대: yRange 폭의 25% 빗나가면 0점
  bubbleZeroAt: Math.log(4), // 버블: 면적 4배 빗나가면 0점
  shareZeroAt: 60, // 파이·도넛·분포도: 절대오차 합 60%p면 0점
  lineZeroAt: 0.25, // 추세선: yRange 폭의 25% 빗나가면 0점
  numberFloorFrac: 0.1, // 숫자: 0 근처 정답은 슬라이더 폭의 10%를 기준 크기로
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function scoreNumber(guess: number, answer: number, tol: number | null, sliderSpan: number): number {
  const e = Math.abs(guess - answer);
  const t = tol ?? 0;
  if (t > 0 && e <= t) return 100 - (10 * e) / t;
  const d = Math.max(Math.abs(answer), TUNING.numberFloorFrac * sliderSpan);
  return 90 * clamp01(1 - (e - t) / d);
}

export function scoreBars(guesses: number[], actual: number[], yRange: [number, number]): number {
  const span = yRange[1] - yRange[0];
  const m = mean(actual.map((a, i) => Math.abs(guesses[i] - a) / span));
  return 100 * clamp01(1 - m / TUNING.barZeroAt);
}

export function scoreBubbles(guesses: number[], actual: number[]): number {
  const r = mean(actual.map((a, i) => Math.abs(Math.log(Math.max(guesses[i], 1e-9) / a))));
  return 100 * clamp01(1 - r / TUNING.bubbleZeroAt);
}

export function shareError(guess: number[], actual: number[]): number {
  return actual.reduce((s, a, i) => s + Math.abs((guess[i] ?? 0) - a), 0);
}

export function scoreShares(guess: number[], actual: number[]): number {
  return 100 * clamp01(1 - shareError(guess, actual) / TUNING.shareZeroAt);
}

const argmax = (xs: number[]) => xs.reduce((best, v, i) => (v > xs[best] ? i : best), 0);

export function scoreDistribution(guess: number[], actual: number[]): number {
  const base = 90 * clamp01(1 - shareError(guess, actual) / TUNING.shareZeroAt);
  return base + (argmax(guess) === argmax(actual) ? 10 : 0);
}

/** ys: cutoff 이후 실제 점마다 사용자 y. anchorY: cutoff 지점의 실제 y */
export function scoreLine(ys: number[], actual: number[], anchorY: number, yRange: [number, number]): number {
  const span = yRange[1] - yRange[0];
  const m = mean(actual.map((a, i) => Math.abs(ys[i] - a) / span));
  const base = 90 * clamp01(1 - m / TUNING.lineZeroAt);
  const dir = (v: number) => Math.sign(Math.round(((v - anchorY) / span) * 100)); // 폭의 0.5% 미만은 '변화 없음'
  const bonus = dir(ys[ys.length - 1]) === dir(actual[actual.length - 1]) ? 10 : 0;
  return base + bonus;
}

export function score(q: Question, a: Answer): number {
  let s: number;
  switch (q.type) {
    case 'number':
      s = scoreNumber((a as { value: number }).value, q.answer, q.tolerance, q.slider.max - q.slider.min);
      break;
    case 'bar':
      s = scoreBars(
        (a as { values: number[] }).values,
        q.bars.filter((b) => b.hidden).map((b) => b.value),
        q.yRange,
      );
      break;
    case 'bubble':
      s = scoreBubbles(
        (a as { values: number[] }).values,
        q.items.filter((b) => b.hidden).map((b) => b.value),
      );
      break;
    case 'donut':
    case 'pie':
      s = scoreShares((a as { shares: number[] }).shares, q.slices.map((x) => x.value));
      break;
    case 'distribution':
      s = scoreDistribution((a as { shares: number[] }).shares, q.bins.map((x) => x.value));
      break;
    case 'line': {
      const { before, after } = splitSeries(q);
      s = scoreLine(
        (a as { ys: number[] }).ys,
        after.map((p) => p.y),
        before[before.length - 1].y,
        q.yRange,
      );
      break;
    }
  }
  return Math.round(Math.max(0, Math.min(100, s)));
}

export function splitSeries(q: { series: { x: number; y: number }[]; cutoffX: number }) {
  return {
    before: q.series.filter((p) => p.x <= q.cutoffX),
    after: q.series.filter((p) => p.x > q.cutoffX),
  };
}

export function scoreEmoji(s: number): string {
  return s >= 80 ? '🟩' : s >= 50 ? '🟨' : '🟥';
}

export function rankTitle(total: number, max: number): string {
  const r = total / max;
  if (r >= 0.9) return '찍신';
  if (r >= 0.8) return '대한민국 박사';
  if (r >= 0.7) return '우등생';
  if (r >= 0.55) return '평균은 한다';
  if (r >= 0.4) return '감으로 사는 사람';
  return '통념 수집가';
}
