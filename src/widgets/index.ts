import type { Question } from '../types';
import { barWidget } from './bar';
import { bubbleWidget } from './bubble';
import type { Widget } from './common';
import { distributionWidget } from './distribution';
import { lineWidget } from './line';
import { numberWidget } from './number';
import { ringWidget } from './ring';

export type { Widget };

export function createWidget(q: Question): Widget {
  switch (q.type) {
    case 'number':
      return numberWidget(q);
    case 'bar':
      return barWidget(q);
    case 'bubble':
      return bubbleWidget(q);
    case 'donut':
    case 'pie':
      return ringWidget(q);
    case 'distribution':
      return distributionWidget(q);
    case 'line':
      return lineWidget(q);
  }
}

export const TYPE_LABEL: Record<Question['type'], string> = {
  number: '숫자 찍기',
  line: '추세선 그리기',
  bar: '막대 맞추기',
  bubble: '버블 크기 맞추기',
  donut: '도넛 나누기',
  pie: '파이 나누기',
  distribution: '분포도 그리기',
};
