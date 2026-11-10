import { clamp, fmt, ticks } from '../format';
import type { DistributionQ } from '../types';
import { changeEmitter, compareTable, drag, easeOutBack, h, s, svgPoint, tween, type Widget } from './common';
import { wrappedText } from './svgtext';

const W = 360;
const H = 320;
const M = { l: 40, r: 10, t: 24, b: 46 };
const MAX = 100;

/** bin i를 v로 바꾸고 나머지를 비례해서 줄이거나 늘려 합계 100 유지 */
export function rebalance(values: number[], i: number, v: number): number[] {
  v = clamp(v, 0, 100);
  const othersSum = values.reduce((a, x, j) => (j === i ? a : a + x), 0);
  const rest = 100 - v;
  return values.map((x, j) => {
    if (j === i) return v;
    if (othersSum <= 1e-9) return rest / (values.length - 1);
    return (x * rest) / othersSum;
  });
}

/** 표시용 정수 반올림: 합계가 정확히 100이 되도록 (최대 나머지 방식) */
export function roundTo100(values: number[]): number[] {
  const floors = values.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = values.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    floors[i]++;
    left--;
  }
  return floors;
}

export function distributionWidget(q: DistributionQ): Widget {
  const n = q.bins.length;
  let values = q.bins.map(() => 100 / n);
  let locked = false;
  let revealed = false;
  let guessSnapshot: number[] = [];
  const changed = changeEmitter();

  const plotW = W - M.l - M.r;
  const plotH = H - M.t - M.b;
  const y = (v: number) => M.t + (1 - v / MAX) * plotH;
  const band = plotW / n;
  const barW = band * 0.74;
  const cx = (i: number) => M.l + band * (i + 0.5);

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart chart-dist' });
  const grid = s('g', { class: 'grid' }, svg);
  for (const t of ticks(0, MAX, 5)) {
    s('line', { x1: M.l, x2: W - M.r, y1: y(t), y2: y(t) }, grid);
    const tx = s('text', { x: M.l - 6, y: y(t) + 4, 'text-anchor': 'end', class: 'tick' }, grid);
    tx.textContent = `${t}%`;
  }
  s('line', { x1: M.l, x2: W - M.r, y1: y(0), y2: y(0), class: 'baseline' }, svg);

  const els = q.bins.map((b, i) => {
    const g = s('g', {}, svg);
    wrappedText(g, b.label, cx(i), H - M.b + 18, Math.max(3, Math.floor(band / 10)), { class: 'xlabel' });
    const zone = s('rect', { x: cx(i) - band / 2, y: M.t - 16, width: band, height: plotH + 16, class: 'dragzone soft' }, g);
    const actual = s('rect', { class: 'bar actual', rx: 2, opacity: 0, x: cx(i) - barW / 2, width: barW }, g);
    const rect = s('rect', { class: 'bar guess solid', rx: 2, x: cx(i) - barW / 2, width: barW }, g);
    const label = s('text', { x: cx(i), 'text-anchor': 'middle', class: 'vlabel mine' }, g);
    const aLabel = s('text', { x: cx(i), 'text-anchor': 'middle', class: 'vlabel act', opacity: 0 }, g);
    drag(
      zone,
      {
        move: (e) => {
          const p = svgPoint(svg, e);
          const v = Math.round(clamp(((y(0) - p.y) / plotH) * MAX, 0, 100));
          values = rebalance(values, i, v);
          render();
          changed.emit();
        },
      },
      () => locked,
    );
    return { rect, label, actual, aLabel };
  });

  const total = h('div', { class: 'dist-total' }, '합계 100% — 한 구간을 올리면 나머지가 비례해서 줄어요');

  function setBar(r: SVGRectElement, v: number) {
    r.setAttribute('y', String(y(v)));
    r.setAttribute('height', String(Math.max(0.5, y(0) - y(v))));
  }
  function render() {
    const shown = roundTo100(values);
    values.forEach((v, i) => {
      setBar(els[i].rect, v);
      els[i].label.setAttribute('y', String(y(v) - 6));
      els[i].label.textContent = `${shown[i]}%`;
    });
  }
  render();

  const el = h('div', { class: 'widget' }, svg, total);

  return {
    el,
    ready: () => true,
    readyHint: () => '',
    onChange: changed.on,
    answer: () => ({ type: 'distribution', shares: revealed ? guessSnapshot : values.slice() }),
    async reveal() {
      locked = true;
      revealed = true;
      guessSnapshot = values.slice();
      svg.classList.add('revealed');
      total.remove();
      await tween(
        900,
        (t) => {
          q.bins.forEach((b, i) => {
            setBar(els[i].actual, b.value * t);
            els[i].actual.setAttribute('opacity', '1');
            els[i].aLabel.setAttribute('opacity', String(Math.min(1, t * 1.5)));
          });
        },
        easeOutBack,
      );
      q.bins.forEach((b, i) => {
        const g = guessSnapshot[i];
        // 실제 값 라벨은 막대 위, 내 답 라벨은 겹치면 숨김(표에서 확인)
        els[i].aLabel.setAttribute('y', String(y(b.value) - 6));
        els[i].aLabel.textContent = `${fmt(b.value, 1)}%`;
        if (Math.abs(y(g) - y(b.value)) < 16) els[i].label.setAttribute('opacity', '0');
      });
    },
    comparison: () =>
      compareTable(q.bins.map((b, i) => ({ label: b.label, mine: `${roundTo100(revealed ? guessSnapshot : values)[i]}%`, actual: `${fmt(b.value, 1)}%` }))),
  };
}
