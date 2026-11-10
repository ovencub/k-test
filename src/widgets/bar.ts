import { clamp, decimalsOf, fmt, snap, snapStep, ticks, withUnit } from '../format';
import type { BarQ } from '../types';
import { changeEmitter, compareLine, compareTable, drag, easeOutBack, h, s, svgPoint, tween, type Widget } from './common';
import { wrappedText } from './svgtext';

const W = 360;
const H = 320;
const M = { l: 52, r: 12, t: 28, b: 46 };

export function barWidget(q: BarQ): Widget {
  const [lo, hi] = q.yRange;
  const step = snapStep(hi - lo);
  const dec = Math.max(decimalsOf(q.bars.map((b) => b.value)), decimalsOf([step]));
  const show = (v: number) => withUnit(fmt(v, dec), q.unit);
  const baseV = clamp(0, lo, hi);

  const plotW = W - M.l - M.r;
  const plotH = H - M.t - M.b;
  const y = (v: number) => M.t + ((hi - v) / (hi - lo)) * plotH;
  const vOf = (py: number) => hi - ((py - M.t) / plotH) * (hi - lo);
  const band = plotW / q.bars.length;
  const barW = Math.min(64, band * 0.62);
  const cx = (i: number) => M.l + band * (i + 0.5);

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart chart-bar', role: 'img' });
  // 눈금
  const grid = s('g', { class: 'grid' }, svg);
  for (const t of ticks(lo, hi, 5)) {
    s('line', { x1: M.l, x2: W - M.r, y1: y(t), y2: y(t) }, grid);
    const tx = s('text', { x: M.l - 6, y: y(t) + 4, 'text-anchor': 'end', class: 'tick' }, grid);
    tx.textContent = fmt(t);
  }
  s('line', { x1: M.l, x2: W - M.r, y1: y(baseV), y2: y(baseV), class: 'baseline' }, svg);
  if (q.unit) {
    const u = s('text', { x: M.l - 6, y: M.t - 12, 'text-anchor': 'end', class: 'tick' }, svg);
    u.textContent = `(${q.unit})`;
  }

  const hiddenIdx = q.bars.map((b, i) => (b.hidden ? i : -1)).filter((i) => i >= 0);
  const guesses = new Map<number, number>(hiddenIdx.map((i) => [i, baseV]));
  const touched = new Set<number>();
  let locked = false;
  const changed = changeEmitter();

  const rectFor = (el: SVGRectElement, i: number, v: number) => {
    const y0 = y(baseV);
    const y1 = y(v);
    el.setAttribute('x', String(cx(i) - barW / 2));
    el.setAttribute('y', String(Math.min(y0, y1)));
    el.setAttribute('width', String(barW));
    el.setAttribute('height', String(Math.max(Math.abs(y1 - y0), 0.5)));
  };
  const placeLabel = (el: SVGTextElement, v: number, text: string) => {
    const above = v >= baseV;
    el.setAttribute('y', String(above ? y(v) - 7 : y(v) + 16));
    el.textContent = text;
  };

  const guessEls = new Map<number, { rect: SVGRectElement; label: SVGTextElement; handle: SVGGElement; prompt: SVGTextElement }>();
  const actualEls = new Map<number, { rect: SVGRectElement; label: SVGTextElement }>();

  q.bars.forEach((b, i) => {
    const g = s('g', {}, svg);
    wrappedText(g, b.label, cx(i), H - M.b + 18, Math.max(4, Math.floor(band / 10)), { class: 'xlabel' });
    if (!b.hidden) {
      const r = s('rect', { class: 'bar anchor', rx: 3 }, g);
      rectFor(r, i, b.value);
      const t = s('text', { x: cx(i), 'text-anchor': 'middle', class: 'vlabel' }, g);
      placeLabel(t, b.value, show(b.value));
      return;
    }
    // 가린 막대: 드래그 영역 + 점선 막대 + 핸들
    const zone = s('rect', { x: cx(i) - band / 2, y: M.t - 20, width: band, height: plotH + 20, class: 'dragzone' }, g);
    const ar = s('rect', { class: 'bar actual', rx: 3, opacity: 0 }, g);
    rectFor(ar, i, baseV);
    const al = s('text', { x: cx(i), 'text-anchor': 'middle', class: 'vlabel act', opacity: 0 }, g);
    actualEls.set(i, { rect: ar, label: al });
    const r = s('rect', { class: 'bar guess', rx: 3 }, g);
    const t = s('text', { x: cx(i), 'text-anchor': 'middle', class: 'vlabel mine' }, g);
    const handle = s('g', { class: 'handle' }, g);
    s('rect', { x: -22, y: -11, width: 44, height: 22, rx: 11 }, handle);
    const ht = s('text', { x: 0, y: 4, 'text-anchor': 'middle' }, handle);
    ht.textContent = '↕';
    const prompt = s('text', { x: cx(i), y: M.t + plotH / 2, 'text-anchor': 'middle', class: 'zone-prompt' }, g);
    const p1 = s('tspan', { x: cx(i), dy: 0, class: 'zone-q' }, prompt);
    p1.textContent = '?';
    const p2 = s('tspan', { x: cx(i), dy: '1.9em' }, prompt);
    p2.textContent = band >= 90 ? '↕ 끌어서 맞추기' : '↕ 끌기';
    guessEls.set(i, { rect: r, label: t, handle, prompt });

    drag(
      zone,
      {
        move: (e) => {
          const p = svgPoint(svg, e);
          const v = clamp(snap(vOf(p.y), step), lo, hi);
          guesses.set(i, v);
          touched.add(i);
          render();
          changed.emit();
        },
      },
      () => locked,
    );
    zone.setAttribute('tabindex', '0');
    zone.setAttribute('aria-label', `${b.label} 막대 높이. 위아래 화살표로 조정`);
    zone.addEventListener('keydown', (ev) => {
      if (locked) return;
      const k = (ev as KeyboardEvent).key;
      const d = k === 'ArrowUp' ? 1 : k === 'ArrowDown' ? -1 : 0;
      if (!d) return;
      ev.preventDefault();
      const big = (ev as KeyboardEvent).shiftKey ? 10 : 1;
      guesses.set(i, clamp(snap((guesses.get(i) ?? baseV) + d * step * big, step), lo, hi));
      touched.add(i);
      render();
      changed.emit();
    });
  });

  function render() {
    for (const [i, els] of guessEls) {
      const v = guesses.get(i)!;
      const on = touched.has(i);
      rectFor(els.rect, i, v);
      placeLabel(els.label, v, on ? show(v) : '');
      // 핸들은 막대 끝에 두되 x축 라벨과 겹치지 않게
      const hy = Math.min(y(v), H - M.b - 12);
      els.handle.setAttribute('transform', `translate(${cx(i)},${hy})`);
      els.handle.setAttribute('opacity', on ? '1' : '0');
      els.prompt.setAttribute('opacity', on ? '0' : '1');
      // 내 답 라벨을 핸들과 겹치지 않게 조금 더 띄운다
      if (on) els.label.setAttribute('y', String(v >= baseV ? y(v) - 16 : y(v) + 26));
    }
  }
  render();

  const el = h('div', { class: 'widget' }, svg);

  return {
    el,
    ready: () => touched.size === hiddenIdx.length,
    readyHint: () => (hiddenIdx.length > 1 ? '점선 막대를 모두 움직여 주세요' : '점선 막대를 위아래로 움직여 주세요'),
    onChange: changed.on,
    answer: () => ({ type: 'bar', values: hiddenIdx.map((i) => guesses.get(i)!) }),
    async reveal() {
      locked = true;
      svg.classList.add('revealed');
      for (const els of guessEls.values()) els.handle.remove();
      await tween(
        900,
        (t) => {
          for (const [i, els] of actualEls) {
            const v = baseV + (q.bars[i].value - baseV) * t;
            rectFor(els.rect, i, v);
            els.rect.setAttribute('opacity', '1');
            els.label.setAttribute('opacity', String(Math.min(1, t * 1.5)));
            placeLabel(els.label, q.bars[i].value, show(q.bars[i].value));
          }
        },
        easeOutBack,
      );
      // 내 답 라벨이 실제 라벨과 겹치면 내 답 라벨을 막대 옆으로
      for (const [i, els] of guessEls) {
        const a = actualEls.get(i)!;
        const dy = Math.abs(Number(els.label.getAttribute('y')) - Number(a.label.getAttribute('y')));
        if (dy < 16) {
          els.label.setAttribute('x', String(cx(i) + barW / 2 + 4));
          els.label.setAttribute('text-anchor', 'start');
        }
      }
    },
    comparison() {
      if (hiddenIdx.length === 1) {
        const i = hiddenIdx[0];
        return compareLine(show(guesses.get(i)!), show(q.bars[i].value));
      }
      return compareTable(hiddenIdx.map((i) => ({ label: q.bars[i].label, mine: show(guesses.get(i)!), actual: show(q.bars[i].value) })));
    },
  };
}
