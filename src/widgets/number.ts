import { clamp, decimalsOf, fmt, snap, withUnit } from '../format';
import type { NumberQ } from '../types';
import { changeEmitter, compareLine, h, tween, type Widget } from './common';

export function numberWidget(q: NumberQ): Widget {
  const { min, max, step } = q.slider;
  const dec = Math.max(decimalsOf([step]), decimalsOf([q.answer]));
  const show = (v: number) => withUnit(fmt(v, dec), q.unit);
  let value = snap((min + max) / 2, step);
  let touched = false;
  let locked = false;
  const changed = changeEmitter();

  const big = h('div', { class: 'num-big' });
  const range = h('input', {
    type: 'range',
    min: String(min),
    max: String(max),
    step: String(step),
    value: String(value),
    'aria-label': '값 선택',
  });
  const input = h('input', {
    type: 'number',
    inputmode: 'decimal',
    min: String(min),
    max: String(max),
    step: String(step),
    value: String(value),
    'aria-label': '직접 입력',
  });
  const minus = h('button', { type: 'button', class: 'nudge', 'aria-label': '줄이기' }, '−');
  const plus = h('button', { type: 'button', class: 'nudge', 'aria-label': '늘리기' }, '+');
  const marker = h('div', { class: 'num-marker', hidden: '' });
  const track = h(
    'div',
    { class: 'num-track' },
    range,
    marker,
    h('div', { class: 'num-ends' }, h('span', {}, fmt(min)), h('span', {}, fmt(max))),
  );

  const set = (v: number, from?: 'range' | 'input') => {
    if (locked || Number.isNaN(v)) return;
    value = clamp(snap(v, step), min, max);
    touched = true;
    if (from !== 'range') range.value = String(value);
    if (from !== 'input') input.value = String(value);
    render();
    changed.emit();
  };
  const render = () => {
    big.textContent = show(value);
    big.classList.toggle('untouched', !touched);
    // 슬라이더 채움 표시
    const pct = ((value - min) / (max - min)) * 100;
    range.style.setProperty('--pct', `${pct}%`);
  };

  range.addEventListener('input', () => set(Number(range.value), 'range'));
  input.addEventListener('change', () => set(Number(input.value), 'input'));
  minus.addEventListener('click', () => set(value - step));
  plus.addEventListener('click', () => set(value + step));
  render();

  const el = h(
    'div',
    { class: 'widget widget-number' },
    big,
    track,
    h('div', { class: 'num-row' }, minus, h('label', { class: 'num-input' }, input, h('span', {}, q.unit)), plus),
  );

  return {
    el,
    ready: () => touched,
    readyHint: () => '슬라이더를 움직이거나 숫자를 입력해 주세요',
    onChange: changed.on,
    answer: () => ({ type: 'number', value }),
    async reveal() {
      locked = true;
      range.disabled = true;
      input.disabled = true;
      minus.disabled = true;
      plus.disabled = true;
      el.classList.add('revealed');
      marker.hidden = false;
      const pct = ((q.answer - min) / (max - min)) * 100;
      marker.style.left = `${pct}%`;
      const mine = value;
      await tween(800, (t) => {
        big.textContent = show(mine + (q.answer - mine) * t);
      });
      big.textContent = show(q.answer);
      big.classList.add('act');
    },
    comparison: () => compareLine(show(value), show(q.answer)),
  };
}
