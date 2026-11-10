import type { Answer } from '../types';

export interface Widget {
  /** 화면에 붙일 요소 */
  el: HTMLElement;
  /** 제출 가능 여부 (조작 필수 형식은 조작 후 true) */
  ready(): boolean;
  /** 제출 전 안내 문구 (ready()가 false일 때 버튼 옆에 표시) */
  readyHint(): string;
  /** 값이 바뀌면 호출 */
  onChange(cb: () => void): void;
  answer(): Answer;
  /** 정답 공개 애니메이션. 입력은 잠긴다. */
  reveal(): Promise<void>;
  /** 결과 화면의 "내 답 vs 실제" 블록 */
  comparison(): HTMLElement;
}

const NS = 'http://www.w3.org/2000/svg';

export function s<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  parent?: Element,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  parent?.appendChild(el);
  return el;
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else el.setAttribute(k, v);
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

/** SVG 좌표계 기준 포인터 위치 */
export function svgPoint(svg: SVGSVGElement, e: PointerEvent): { x: number; y: number } {
  const m = svg.getScreenCTM();
  if (!m) return { x: 0, y: 0 };
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
  return { x: p.x, y: p.y };
}

/** 포인터 드래그 헬퍼. 터치 스크롤을 막고 캡처를 잡는다. */
export function drag(
  target: Element,
  handlers: {
    start?: (e: PointerEvent) => boolean | void; // false를 반환하면 드래그하지 않음
    move: (e: PointerEvent) => void;
    end?: (e: PointerEvent) => void;
  },
  isLocked: () => boolean,
): void {
  let active: number | null = null;
  target.addEventListener('pointerdown', (ev) => {
    const e = ev as PointerEvent;
    if (isLocked() || active !== null) return;
    if (handlers.start?.(e) === false) return;
    active = e.pointerId;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      /* 이미 떨어진 포인터 등: 캡처 없이 진행 */
    }
    e.preventDefault();
    handlers.move(e);
  });
  target.addEventListener('pointermove', (ev) => {
    const e = ev as PointerEvent;
    if (e.pointerId !== active) return;
    e.preventDefault();
    handlers.move(e);
  });
  const stop = (ev: Event) => {
    const e = ev as PointerEvent;
    if (e.pointerId !== active) return;
    active = null;
    handlers.end?.(e);
  };
  target.addEventListener('pointerup', stop);
  target.addEventListener('pointercancel', stop);
}

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** 0→1 진행률로 콜백을 부르는 애니메이션 */
export function tween(ms: number, fn: (t: number) => void, ease: (t: number) => number = easeOutCubic): Promise<void> {
  if (prefersReducedMotion()) {
    fn(1);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const t0 = performance.now();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      fn(1);
      resolve();
    };
    const step = (now: number) => {
      if (done) return;
      const t = Math.min(1, (now - t0) / ms);
      if (t >= 1) return finish();
      fn(ease(t));
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    // 백그라운드 탭 등에서 rAF가 멈춰도 결과 화면이 막히지 않도록
    setTimeout(finish, ms + 250);
  });
}

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const linear = (t: number) => t;

// 주황(내 답 색)은 조각 색으로 쓰지 않는다
export const PALETTE = ['#3b6cf6', '#16a37f', '#e8b100', '#a55eea', '#e8508a', '#26b5c9', '#5f7d95', '#7cb342'];

/** 막대·구간 비교용 표: 라벨 | 내 답 | 실제 */
export function compareTable(rows: { label: string; mine: string; actual: string; color?: string }[]): HTMLElement {
  const table = h('table', { class: 'cmp' });
  table.append(h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, '내 답'), h('th', {}, '실제'))));
  const tb = h('tbody');
  for (const r of rows) {
    const sw = r.color ? h('span', { class: 'swatch', style: `background:${r.color}` }) : null;
    tb.append(h('tr', {}, h('td', {}, sw, r.label), h('td', { class: 'mine' }, r.mine), h('td', { class: 'act' }, r.actual)));
  }
  table.append(tb);
  return table;
}

/** 내 답 vs 실제 한 줄 */
export function compareLine(mine: string, actual: string): HTMLElement {
  return h(
    'div',
    { class: 'cmp-line' },
    h('div', { class: 'cmp-cell' }, h('span', { class: 'cmp-k' }, '내 답'), h('strong', { class: 'mine' }, mine)),
    h('div', { class: 'cmp-cell' }, h('span', { class: 'cmp-k' }, '실제'), h('strong', { class: 'act' }, actual)),
  );
}

export function changeEmitter() {
  const cbs: (() => void)[] = [];
  return {
    on: (cb: () => void) => cbs.push(cb),
    emit: () => cbs.forEach((cb) => cb()),
  };
}
