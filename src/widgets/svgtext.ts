import { s } from './common';

/** 라벨을 최대 2줄로 나눠 SVG text로 그린다 (띄어쓰기 기준, 없으면 글자 수 기준) */
export function wrappedText(
  parent: Element,
  text: string,
  x: number,
  y: number,
  maxChars: number,
  attrs: Record<string, string | number> = {},
): SVGTextElement {
  const lines = wrap(text, maxChars);
  const t = s('text', { x, y, 'text-anchor': 'middle', ...attrs }, parent);
  lines.forEach((line, i) => {
    const ts = s('tspan', { x, dy: i === 0 ? 0 : '1.15em' }, t);
    ts.textContent = line;
  });
  return t;
}

export function wrap(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  // 띄어쓰기로 안 나뉘는 긴 단어는 글자 수로 자른다
  const out: string[] = [];
  for (const l of lines) {
    if (l.length <= maxChars) out.push(l);
    else for (let i = 0; i < l.length; i += maxChars) out.push(l.slice(i, i + maxChars));
  }
  if (out.length > 2) return [out[0], out.slice(1).join(' ').slice(0, maxChars - 1) + '…'];
  return out;
}
