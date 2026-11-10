import { clamp, decimalsOf, fmt, withUnit } from '../format';
import type { BubbleQ } from '../types';
import { changeEmitter, compareLine, compareTable, drag, h, s, svgPoint, tween, type Widget } from './common';
import { wrap, wrappedText } from './svgtext';

const W = 360;
const H = 316;
const BASE_Y = 222;
const MAX_D = 200;
const GAP = 14;
const LOG_MIN = -3.5;
const LOG_MAX = 2;

/** 유효숫자 2~3자리로 반올림 */
function roundSig(v: number): number {
  if (v === 0) return 0;
  const digits = v >= 100 ? 3 : 2;
  const p = Math.pow(10, digits - 1 - Math.floor(Math.log10(Math.abs(v))));
  return Math.round(v * p) / p;
}

export function bubbleWidget(q: BubbleQ): Widget {
  const items = q.items;
  const visible = items.filter((x) => !x.hidden);
  const ref = Math.max(...visible.map((x) => x.value));
  const refItem = visible.find((x) => x.value === ref)!;
  const hiddenIdx = items.map((x, i) => (x.hidden ? i : -1)).filter((i) => i >= 0);
  const logs = new Map<number, number>(hiddenIdx.map((i) => [i, 0])); // log10(추정/기준)
  const dec = decimalsOf(items.map((x) => x.value));
  const num = (v: number) => fmt(v, Math.max(dec, v < 10 ? 1 : 0));
  const show = (v: number) => withUnit(num(v), q.unit);
  // 항목이 많으면 원마다 단위를 붙이지 않고 왼쪽 위에 한 번만 표시
  const crowded = items.length > 3;
  const showIn = crowded ? num : show;
  const guessOf = (i: number) => roundSig(ref * Math.pow(10, logs.get(i)!));
  let touched = false;
  let locked = false;
  let revealT = 0; // 0~1, 정답 원 등장 진행률
  const changed = changeEmitter();

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart chart-bubble' });
  s('line', { x1: 8, x2: W - 8, y1: BASE_Y, y2: BASE_Y, class: 'baseline faint' }, svg);
  if (crowded && q.unit) {
    const u = s('text', { x: 8, y: 14, class: 'tick' }, svg);
    u.textContent = `(단위: ${q.unit})`;
  }
  const els = items.map((it) => {
    const g = s('g', {}, svg);
    const actual = it.hidden ? s('circle', { class: 'bubble actual', opacity: 0 }, g) : null;
    const circle = s('circle', { class: it.hidden ? 'bubble guess' : 'bubble anchor' }, g);
    const value = s('text', { 'text-anchor': 'middle', class: it.hidden ? 'vlabel mine' : 'vlabel' }, g);
    const label = s('g', {}, g);
    const aValue = it.hidden ? s('text', { 'text-anchor': 'middle', class: 'vlabel act', opacity: 0 }, g) : null;
    return { g, circle, actual, value, label, aValue };
  });

  // 표시 반지름 목록 (정답 공개 중이면 정답 원도 자리 계산에 포함)
  function layout() {
    const raw = items.map((it, i) => {
      if (!it.hidden) return Math.sqrt(it.value);
      const g = Math.sqrt(guessOf(i));
      const a = Math.sqrt(it.value) * revealT;
      return Math.max(g, a);
    });
    const maxR = Math.max(...raw);
    const sumD = raw.reduce((a, r) => a + 2 * r, 0);
    const k = Math.min(MAX_D / (2 * maxR), (W - 16 - GAP * (items.length - 1)) / sumD);
    // 가운데 정렬
    const ds = raw.map((r) => 2 * r * k);
    const total = ds.reduce((a, d) => a + d, 0) + GAP * (items.length - 1);
    let x = (W - total) / 2;
    const xs = ds.map((d) => {
      const c = x + d / 2;
      x += d + GAP;
      return c;
    });
    return { k, xs, raw };
  }

  function render() {
    const { k, xs, raw } = layout();
    items.forEach((it, i) => {
      const e = els[i];
      const slotR = raw[i] * k;
      const cy = BASE_Y - slotR;
      const r = it.hidden ? Math.sqrt(guessOf(i)) * k : slotR;
      e.circle.setAttribute('cx', String(xs[i]));
      e.circle.setAttribute('cy', String(cy));
      e.circle.setAttribute('r', String(Math.max(1.5, r)));
      if (e.actual) {
        e.actual.setAttribute('cx', String(xs[i]));
        e.actual.setAttribute('cy', String(cy));
        e.actual.setAttribute('r', String(Math.max(0, Math.sqrt(it.value) * k * revealT)));
      }
      // 값 라벨: 원 안에 들어가면 안에, 아니면 위에
      const v = it.hidden ? guessOf(i) : it.value;
      const txt = it.hidden && !touched ? '?' : showIn(v);
      // 이름은 기준선 아래. 원이 작아 값이 안에 안 들어가면 값도 이름 아래에 둔다 (작은 원끼리 라벨 겹침 방지)
      const maxChars = Math.max(5, Math.floor(W / items.length / 12));
      e.label.replaceChildren();
      wrappedText(e.label, it.label, xs[i], BASE_Y + 20, maxChars, { class: 'xlabel' });
      const belowY = BASE_Y + 20 + wrap(it.label, maxChars).length * 14 + 2;
      const inside = slotR > 30;
      e.value.setAttribute('x', String(xs[i]));
      e.value.setAttribute('y', String(inside ? cy + 5 : belowY));
      e.value.textContent = txt;
      if (e.aValue) {
        e.aValue.setAttribute('x', String(xs[i]));
        e.aValue.setAttribute('y', String(inside ? cy + 22 : belowY + 16));
        e.aValue.textContent = `실제 ${showIn(it.value)}`;
      }
    });
  }

  const slider = h('input', {
    type: 'range',
    min: String(LOG_MIN),
    max: String(LOG_MAX),
    step: '0.01',
    value: '0',
    'aria-label': '원 크기',
  });
  const ratio = h('div', { class: 'bubble-ratio' });
  const setLog = (v: number) => {
    if (locked) return;
    for (const i of hiddenIdx) logs.set(i, clamp(v, LOG_MIN, LOG_MAX));
    touched = true;
    slider.value = String(logs.get(hiddenIdx[0]));
    update();
  };
  const update = () => {
    render();
    const r = Math.pow(10, logs.get(hiddenIdx[0])!);
    ratio.textContent = touched ? `${refItem.label}의 ${r >= 10 ? fmt(r, 0) : r >= 1 ? fmt(r, 1) : fmt(r, r < 0.01 ? 3 : 2)}배` : '';
    changed.emit();
  };
  slider.addEventListener('input', () => setLog(Number(slider.value)));

  // 위·오른쪽으로 끌면 커지고 아래·왼쪽이면 작아진다 (상대 드래그라 줌아웃에도 안정적)
  let last: { x: number; y: number } | null = null;
  drag(
    svg,
    {
      start: (e) => {
        last = svgPoint(svg, e);
      },
      move: (e) => {
        const p = svgPoint(svg, e);
        if (!last) return;
        const d = p.x - last.x - (p.y - last.y);
        last = p;
        if (d !== 0) setLog(logs.get(hiddenIdx[0])! + d * 0.006);
      },
      end: () => {
        last = null;
      },
    },
    () => locked,
  );

  update();
  const el = h(
    'div',
    { class: 'widget widget-bubble' },
    h('p', { class: 'widget-tip' }, '원의 넓이가 값에 비례해요 (지름 2배 = 값 4배). 원 위에서 위·오른쪽으로 끌면 커져요.'),
    svg,
    ratio,
    h('div', { class: 'bubble-slider' }, h('span', {}, '작게'), slider, h('span', {}, '크게')),
  );

  return {
    el,
    ready: () => touched,
    readyHint: () => '원을 끌거나 슬라이더로 크기를 정해 주세요',
    onChange: changed.on,
    answer: () => ({ type: 'bubble', values: hiddenIdx.map(guessOf) }),
    async reveal() {
      locked = true;
      slider.disabled = true;
      svg.classList.add('revealed');
      el.querySelector('.widget-tip')?.remove();
      for (const i of hiddenIdx) {
        els[i].actual!.setAttribute('opacity', '1');
        els[i].aValue!.setAttribute('opacity', '1');
      }
      await tween(1000, (t) => {
        revealT = t;
        render();
      });
    },
    comparison() {
      if (hiddenIdx.length === 1) return compareLine(show(guessOf(hiddenIdx[0])), show(items[hiddenIdx[0]].value));
      return compareTable(hiddenIdx.map((i) => ({ label: items[i].label, mine: show(guessOf(i)), actual: show(items[i].value) })));
    },
  };
}
