import { fmt } from '../format';
import type { DonutQ, PieQ } from '../types';
import { PALETTE, changeEmitter, compareTable, drag, h, s, svgPoint, tween, type Widget } from './common';

const SIZE = 320;
const C = SIZE / 2;
const R = 128;
const MIN_SHARE = 1;

/** 0~100(%)을 12시 방향부터 시계방향 좌표로 */
function polar(p: number, r: number) {
  const a = (p / 100) * Math.PI * 2 - Math.PI / 2;
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
}

function arc(p0: number, p1: number, r0: number, r1: number): string {
  if (p1 - p0 >= 99.999) {
    // 한 바퀴 전체는 반으로 나눠 그린다
    return arc(p0, p0 + 50, r0, r1) + arc(p0 + 50, p1, r0, r1);
  }
  const large = p1 - p0 > 50 ? 1 : 0;
  const a = polar(p0, r1);
  const b = polar(p1, r1);
  if (r0 <= 0) return `M${C},${C}L${a.x},${a.y}A${r1},${r1} 0 ${large} 1 ${b.x},${b.y}Z`;
  const c = polar(p1, r0);
  const d = polar(p0, r0);
  return `M${a.x},${a.y}A${r1},${r1} 0 ${large} 1 ${b.x},${b.y}L${c.x},${c.y}A${r0},${r0} 0 ${large} 0 ${d.x},${d.y}Z`;
}

/** 경계(누적 %) → 조각 비율 */
const sharesOf = (b: number[]) => b.map((v, i) => (i + 1 < b.length ? b[i + 1] : 100) - v);
const boundsOf = (shares: number[]) => {
  const out: number[] = [];
  let acc = 0;
  for (const v of shares) {
    out.push(acc);
    acc += v;
  }
  return out;
};

export function ringWidget(q: DonutQ | PieQ): Widget {
  const n = q.slices.length;
  const donut = q.type === 'donut';
  const r0 = donut ? R * 0.56 : 0;
  // 균등 분할에서 시작 (정수 %)
  let bounds = Array.from({ length: n }, (_, i) => Math.round((100 * i) / n));
  let locked = false;
  let revealed = false;
  const changed = changeEmitter();
  const actual = q.slices.map((x) => x.value);
  let guessShares: number[] = [];

  const svg = s('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, class: `chart chart-ring ${donut ? 'donut' : 'pie'}` });
  const guessRing = s('g', { class: 'guess-ring' }, svg);
  const slicesG = s('g', {}, svg);
  const paths = q.slices.map((_, i) => s('path', { fill: PALETTE[i % PALETTE.length], class: 'slice' }, slicesG));
  const pctLabels = q.slices.map(() => s('text', { 'text-anchor': 'middle', class: 'slice-pct' }, svg));
  const handles = bounds.map((_, k) => {
    const g = s('g', { class: k === 0 ? 'ring-handle fixed' : 'ring-handle' }, svg);
    s('circle', { r: k === 0 ? 5 : 13 }, g);
    return g;
  });
  const center = s('text', { x: C, y: C + 4, 'text-anchor': 'middle', class: 'ring-center' }, svg);
  const centerSub = s('text', { x: C, y: C + 30, 'text-anchor': 'middle', class: 'ring-center-sub' }, svg);

  const legend = h('ul', { class: 'legend' });
  const legendVals = q.slices.map((sl, i) => {
    const v = h('strong', {});
    legend.append(h('li', {}, h('span', { class: 'swatch', style: `background:${PALETTE[i % PALETTE.length]}` }), h('span', { class: 'lg-label' }, sl.label), v));
    return v;
  });

  function render(b: number[]) {
    const sh = sharesOf(b);
    sh.forEach((v, i) => {
      paths[i].setAttribute('d', v > 0 ? arc(b[i], b[i] + v, r0, R) : '');
      const mid = b[i] + v / 2;
      const p = polar(mid, donut ? (R + r0) / 2 : R * 0.64);
      pctLabels[i].setAttribute('x', String(p.x));
      pctLabels[i].setAttribute('y', String(p.y + 5));
      pctLabels[i].textContent = v >= 5 ? `${fmt(v, revealed ? 1 : 0)}%` : '';
      legendVals[i].textContent = `${fmt(v, revealed ? 1 : 0)}%`;
    });
    b.forEach((v, k) => {
      const p = polar(v, R);
      handles[k].setAttribute('transform', `translate(${p.x},${p.y})`);
    });
    if (donut && n === 2) {
      center.textContent = `${fmt(sh[0], revealed ? 1 : 0)}%`;
      centerSub.textContent = q.slices[0].label;
    }
  }
  render(bounds);

  // 링 위 아무 곳이나 누르면 가장 가까운 움직일 수 있는 경계를 잡는다
  let grabbed = -1;
  const angleAt = (e: PointerEvent) => {
    const p = svgPoint(svg, e);
    let a = (Math.atan2(p.y - C, p.x - C) + Math.PI / 2) / (Math.PI * 2);
    if (a < 0) a += 1;
    return { pct: a * 100, dist: Math.hypot(p.x - C, p.y - C) };
  };
  drag(
    svg,
    {
      start: (e) => {
        const { pct, dist } = angleAt(e);
        if (dist < R * 0.2) return false; // 중심 근처는 각도가 불안정
        let best = -1;
        let bestD = Infinity;
        for (let k = 1; k < n; k++) {
          let d = Math.abs(bounds[k] - pct);
          d = Math.min(d, 100 - d);
          if (d < bestD) {
            bestD = d;
            best = k;
          }
        }
        if (best < 0 || bestD > 12) return false;
        grabbed = best;
        svg.classList.add('dragging');
      },
      move: (e) => {
        if (grabbed < 1) return;
        const { pct } = angleAt(e);
        const loB = bounds[grabbed - 1] + MIN_SHARE;
        const hiB = (grabbed + 1 < n ? bounds[grabbed + 1] : 100) - MIN_SHARE;
        // 반대쪽 끝으로 튀지 않도록 현재 위치 기준 가까운 쪽 각도로 해석
        let p = pct;
        if (p - bounds[grabbed] > 50) p -= 100;
        if (bounds[grabbed] - p > 50) p += 100;
        const v = Math.round(Math.min(hiB, Math.max(loB, p)));
        if (v !== bounds[grabbed]) {
          bounds = bounds.slice();
          bounds[grabbed] = v;
          render(bounds);
          changed.emit();
        }
      },
      end: () => {
        grabbed = -1;
        svg.classList.remove('dragging');
      },
    },
    () => locked,
  );

  const el = h('div', { class: 'widget' }, svg, legend);

  return {
    el,
    ready: () => true,
    readyHint: () => '',
    onChange: changed.on,
    answer: () => ({ type: q.type, shares: revealed ? guessShares : sharesOf(bounds) }),
    async reveal() {
      locked = true;
      revealed = true;
      guessShares = sharesOf(bounds);
      svg.classList.add('revealed');
      handles.forEach((g) => g.remove());
      // 범례는 결과 표와 겹치므로 설명 한 줄로 바꾼다
      legend.replaceWith(h('p', { class: 'widget-tip center' }, '안쪽 = 실제 · 바깥 얇은 테 = 내 답'));
      // 바깥 얇은 링에 내 답을 남긴다
      const gb = bounds.slice();
      sharesOf(gb).forEach((v, i) => {
        if (v > 0) s('path', { d: arc(gb[i], gb[i] + v, R + 6, R + 14), fill: PALETTE[i % PALETTE.length], class: 'guess-arc' }, guessRing);
      });
      const target = boundsOf(actual);
      const from = bounds.slice();
      await tween(1000, (t) => {
        render(from.map((v, i) => v + (target[i] - v) * t));
      });
      bounds = target;
      render(bounds);
    },
    comparison: () =>
      compareTable(
        q.slices.map((sl, i) => ({
          label: sl.label,
          mine: `${fmt(guessShares[i] ?? 0, 0)}%`,
          actual: `${fmt(sl.value, 1)}%`,
          color: PALETTE[i % PALETTE.length],
        })),
      ),
  };
}
