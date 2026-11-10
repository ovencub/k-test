import { clamp, decimalsOf, fmt, ticks, withUnit } from '../format';
import { splitSeries } from '../scoring';
import type { LineQ } from '../types';
import { changeEmitter, compareTable, drag, h, linear, s, svgPoint, tween, type Widget } from './common';

const W = 360;
const H = 300;
const M = { l: 50, r: 16, t: 26, b: 32 };

export function lineWidget(q: LineQ): Widget {
  const [lo, hi] = q.yRange;
  const { before, after } = splitSeries(q);
  const anchor = before[before.length - 1];
  const x0 = q.series[0].x;
  const x1 = q.series[q.series.length - 1].x;
  const plotW = W - M.l - M.r;
  const plotH = H - M.t - M.b;
  const px = (x: number) => M.l + ((x - x0) / (x1 - x0)) * plotW;
  const py = (y: number) => M.t + ((hi - y) / (hi - lo)) * plotH;
  const yOf = (p: number) => hi - ((p - M.t) / plotH) * (hi - lo);
  const xOf = (p: number) => x0 + ((p - M.l) / plotW) * (x1 - x0);
  const dec = decimalsOf(q.series.map((p) => p.y));
  const show = (v: number) => withUnit(fmt(v, Math.max(dec, Math.abs(hi - lo) < 20 ? 1 : 0)), q.unit);

  const ys: (number | null)[] = after.map(() => null);
  let locked = false;
  const changed = changeEmitter();

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart chart-line' });
  const grid = s('g', { class: 'grid' }, svg);
  for (const t of ticks(lo, hi, 5)) {
    s('line', { x1: M.l, x2: W - M.r, y1: py(t), y2: py(t) }, grid);
    const tx = s('text', { x: M.l - 6, y: py(t) + 4, 'text-anchor': 'end', class: 'tick' }, grid);
    tx.textContent = fmt(t);
  }
  for (const t of ticks(x0, x1, 5)) {
    if (!Number.isInteger(t)) continue;
    const tx = s('text', { x: px(t), y: H - M.b + 18, 'text-anchor': 'middle', class: 'tick' }, grid);
    tx.textContent = String(t);
  }
  if (q.unit) {
    const u = s('text', { x: M.l - 6, y: M.t - 12, 'text-anchor': 'end', class: 'tick' }, svg);
    u.textContent = `(${q.unit})`;
  }

  // 그릴 영역
  const zoneX = px(anchor.x);
  const zone = s('rect', { x: zoneX, y: M.t, width: W - M.r - zoneX, height: plotH, class: 'draw-zone' }, svg);
  // 안내 문구는 마지막 실제 점과 먼 쪽(위/아래)에 둔다
  const hintY = py(anchor.y) < M.t + plotH / 2 ? M.t + plotH * 0.82 : M.t + plotH * 0.18;
  const zoneText = s('text', { x: (zoneX + W - M.r) / 2, y: hintY, 'text-anchor': 'middle', class: 'draw-hint' }, svg);
  zoneText.textContent = '여기에 그려보세요 ✍️';
  // 가이드: 그려야 할 x 위치
  for (const p of after) s('line', { x1: px(p.x), x2: px(p.x), y1: M.t, y2: M.t + plotH, class: 'draw-guide' }, svg);

  s('polyline', { class: 'line known', points: before.map((p) => `${px(p.x)},${py(p.y)}`).join(' ') }, svg);
  s('circle', { cx: px(anchor.x), cy: py(anchor.y), r: 4.5, class: 'dot known' }, svg);
  const anchorLabel = s('text', { x: px(anchor.x), y: py(anchor.y) - 10, 'text-anchor': 'middle', class: 'vlabel' }, svg);
  anchorLabel.textContent = show(anchor.y);

  const actualPath = s('polyline', {
    class: 'line actual',
    points: [anchor, ...after].map((p) => `${px(p.x)},${py(p.y)}`).join(' '),
    opacity: 0,
  }, svg);
  const actualDots = s('g', { opacity: 0 }, svg);
  for (const p of after) s('circle', { cx: px(p.x), cy: py(p.y), r: 3, class: 'dot actual' }, actualDots);
  const actualEnd = s('text', { 'text-anchor': 'end', class: 'vlabel act', opacity: 0 }, svg);

  const userPath = s('polyline', { class: 'line mine' }, svg);
  const userEnd = s('text', { 'text-anchor': 'end', class: 'vlabel mine' }, svg);

  function render() {
    const pts = [`${px(anchor.x)},${py(anchor.y)}`];
    let lastIdx = -1;
    ys.forEach((y, i) => {
      if (y !== null) {
        pts.push(`${px(after[i].x)},${py(y)}`);
        lastIdx = i;
      }
    });
    userPath.setAttribute('points', pts.join(' '));
    if (lastIdx >= 0) {
      const y = ys[lastIdx]!;
      userEnd.setAttribute('x', String(Math.min(px(after[lastIdx].x) + 4, W - 2)));
      userEnd.setAttribute('y', String(py(y) - 10));
      userEnd.textContent = show(y);
    } else userEnd.textContent = '';
    zoneText.setAttribute('opacity', ys.some((y) => y !== null) ? '0' : '1');
  }

  // 사이 빈칸은 앞뒤 값으로 보간
  function fillGaps() {
    let prevX = anchor.x;
    let prevY = anchor.y;
    for (let i = 0; i < ys.length; i++) {
      if (ys[i] !== null) {
        prevX = after[i].x;
        prevY = ys[i]!;
        continue;
      }
      const j = ys.findIndex((y, k) => k > i && y !== null);
      if (j < 0) break;
      const t = (after[i].x - prevX) / (after[j].x - prevX);
      ys[i] = prevY + (ys[j]! - prevY) * t;
    }
  }

  let last: { x: number; y: number } | null = null;
  drag(
    svg,
    {
      start: (e) => {
        const p = svgPoint(svg, e);
        if (p.x < zoneX - 20) return false;
        last = null;
      },
      move: (e) => {
        const p = svgPoint(svg, e);
        const cur = { x: clamp(xOf(p.x), anchor.x, x1), y: clamp(yOf(p.y), lo, hi) };
        // 오른쪽 끝 근처까지 오면 마지막 점까지 그린 것으로 본다 (손가락이 가장자리를 벗어나기 쉬움)
        const lastGap = after[after.length - 1].x - (after.length > 1 ? after[after.length - 2].x : anchor.x);
        if (cur.x >= x1 - lastGap * 0.6) cur.x = x1;
        const prev = last ?? cur;
        const a = Math.min(prev.x, cur.x);
        const b = Math.max(prev.x, cur.x);
        after.forEach((pt, i) => {
          const gap = pt.x - (i > 0 ? after[i - 1].x : anchor.x);
          const inSweep = pt.x >= a && pt.x <= b;
          const near = Math.abs(pt.x - cur.x) <= gap / 2;
          if (inSweep || near) {
            const t = b === a ? 1 : (pt.x - prev.x) / (cur.x - prev.x);
            ys[i] = inSweep && b !== a ? prev.y + (cur.y - prev.y) * t : cur.y;
          }
        });
        last = cur;
        render();
      },
      end: () => {
        last = null;
        fillGaps();
        render();
        changed.emit();
      },
    },
    () => locked,
  );

  const el = h('div', { class: 'widget' }, svg);
  render();

  return {
    el,
    ready: () => ys.every((y) => y !== null),
    readyHint: () => `${after[after.length - 1].x}년까지 끝까지 그려 주세요`,
    onChange: changed.on,
    answer: () => ({ type: 'line', ys: ys.map((y) => y ?? anchor.y) }),
    async reveal() {
      locked = true;
      svg.classList.add('revealed');
      zone.classList.add('done');
      const len = actualPath.getTotalLength?.() ?? 1000;
      actualPath.setAttribute('opacity', '1');
      actualPath.style.strokeDasharray = `${len}`;
      actualPath.style.strokeDashoffset = `${len}`;
      await tween(1400, (t) => {
        actualPath.style.strokeDashoffset = `${len * (1 - t)}`;
      }, linear);
      actualPath.style.strokeDasharray = '';
      actualDots.setAttribute('opacity', '1');
      const end = after[after.length - 1];
      actualEnd.setAttribute('x', String(px(end.x) + 4 > W - 2 ? W - 2 : px(end.x) + 4));
      const uy = ys[ys.length - 1]!;
      // 두 끝값 라벨이 겹치지 않게 위아래로 벌린다
      const up = end.y >= uy;
      actualEnd.setAttribute('y', String(py(end.y) + (up ? -10 : 18)));
      userEnd.setAttribute('y', String(py(uy) + (up ? 18 : -10)));
      actualEnd.textContent = `실제 ${show(end.y)}`;
      actualEnd.setAttribute('opacity', '1');
    },
    comparison: () => {
      // 대표 지점 3개(처음·중간·끝)만 표로
      const idx = [...new Set([0, Math.floor((after.length - 1) / 2), after.length - 1])];
      return compareTable(idx.map((i) => ({ label: `${after[i].x}`, mine: show(ys[i] ?? anchor.y), actual: show(after[i].y) })));
    },
  };
}
