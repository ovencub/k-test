import { describe, expect, it } from 'vitest';
import bank from '../questions.json';
import {
  score,
  scoreBars,
  scoreBubbles,
  scoreDistribution,
  scoreLine,
  scoreNumber,
  scoreShares,
  splitSeries,
} from '../src/scoring';
import type { Answer, Question, QuestionBank } from '../src/types';

const questions = (bank as unknown as QuestionBank).questions;

function perfect(q: Question): Answer {
  switch (q.type) {
    case 'number':
      return { type: 'number', value: q.answer };
    case 'bar':
      return { type: 'bar', values: q.bars.filter((b) => b.hidden).map((b) => b.value) };
    case 'bubble':
      return { type: 'bubble', values: q.items.filter((b) => b.hidden).map((b) => b.value) };
    case 'donut':
    case 'pie':
      return { type: q.type, shares: q.slices.map((s) => s.value) };
    case 'distribution':
      return { type: 'distribution', shares: q.bins.map((s) => s.value) };
    case 'line':
      return { type: 'line', ys: splitSeries(q).after.map((p) => p.y) };
  }
}

describe('정답이면 100점', () => {
  it.each(questions.map((q) => [q.id, q] as const))('%s', (_, q) => {
    expect(score(q, perfect(q))).toBe(100);
  });
});

describe('숫자', () => {
  it('허용오차 안이면 90점 이상', () => {
    expect(scoreNumber(1700, 1558, 200, 6000)).toBeGreaterThanOrEqual(90);
  });
  it('2배 틀리면 낮은 점수', () => {
    expect(scoreNumber(3116, 1558, 200, 6000)).toBeLessThan(20);
  });
  it('음수·0 근처 정답도 슬라이더 폭 기준으로 완화', () => {
    // 정답 -1, 슬라이더 -10~10: 1 차이는 꽤 가까운 답
    expect(scoreNumber(-2, -1, null, 20)).toBeGreaterThan(40);
  });
});

describe('막대', () => {
  it('범위의 5% 오차는 80점', () => {
    expect(scoreBars([55], [50], [0, 100])).toBeCloseTo(80);
  });
  it('범위의 25% 이상이면 0점', () => {
    expect(scoreBars([80], [50], [0, 100])).toBe(0);
  });
});

describe('버블 (면적 로그 비율)', () => {
  it('2배 크게와 2배 작게는 같은 점수, 50점', () => {
    expect(scoreBubbles([200], [100])).toBeCloseTo(50);
    expect(scoreBubbles([50], [100])).toBeCloseTo(50);
  });
});

describe('파이·도넛·분포도', () => {
  it('도넛 10%p 차이는 약 67점', () => {
    expect(scoreShares([60, 40], [50, 50])).toBeCloseTo(66.67, 1);
  });
  it('분포도: 최빈 구간을 맞히면 가산점', () => {
    // 두 답의 오차 합은 같고, 최빈 구간만 다름
    const actual = [10, 46, 44];
    const hit = scoreDistribution([10, 48, 42], actual);
    const miss = scoreDistribution([10, 44, 46], actual);
    expect(hit - miss).toBeCloseTo(10);
  });
});

describe('추세선', () => {
  it('방향을 맞히면 가산점', () => {
    const actual = [90, 80, 70];
    const right = scoreLine([95, 95, 95 - 1], actual, 100, [0, 200]);
    const wrong = scoreLine([105, 105, 105], actual, 100, [0, 200]);
    expect(right).toBeGreaterThan(wrong);
  });
});
