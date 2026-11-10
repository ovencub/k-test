import { describe, expect, it } from 'vitest';
import bank from '../questions.json';
import { pickGame } from '../src/select';
import type { QuestionBank } from '../src/types';

const questions = (bank as unknown as QuestionBank).questions;

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe('pickGame', () => {
  it('500판 모두: 5문제, 분야 중복 없음, 형식 2종 이상, 숫자 1개 이하', () => {
    for (let s = 1; s <= 500; s++) {
      const { questions: qs } = pickGame(questions, { count: 5, seen: new Set(), excludePartial: false, rng: seeded(s) });
      expect(qs).toHaveLength(5);
      expect(new Set(qs.map((q) => q.category)).size).toBe(5);
      expect(new Set(qs.map((q) => q.type)).size).toBeGreaterThanOrEqual(2);
      expect(qs.filter((q) => q.type === 'number').length).toBeLessThanOrEqual(1);
    }
  });

  it('이미 푼 문제는 다시 나오지 않음', () => {
    const seen = new Set<string>();
    const rng = seeded(7);
    for (let round = 0; round < 30; round++) {
      const { questions: qs, resetSeen } = pickGame(questions, { count: 5, seen, excludePartial: false, rng });
      expect(resetSeen).toBe(false);
      for (const q of qs) {
        expect(seen.has(q.id)).toBe(false);
        seen.add(q.id);
      }
    }
  });

  it('풀이 모자라면 기록을 비우고 다시 뽑음', () => {
    const seen = new Set(questions.slice(0, questions.length - 2).map((q) => q.id));
    const { questions: qs, resetSeen } = pickGame(questions, { count: 5, seen, excludePartial: false, rng: seeded(3) });
    expect(resetSeen).toBe(true);
    expect(qs).toHaveLength(5);
  });

  it('partial 제외 설정', () => {
    for (let s = 1; s <= 50; s++) {
      const { questions: qs } = pickGame(questions, { count: 5, seen: new Set(), excludePartial: true, rng: seeded(s) });
      expect(qs.every((q) => q.verification !== 'partial')).toBe(true);
    }
  });
});
