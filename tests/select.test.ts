import { describe, expect, it } from 'vitest';
import bank from '../questions.json';
import { pickGame } from '../src/select';
import { SUBJECTS, gradeOf, isMapped, subjectOf } from '../src/subjects';
import type { QuestionBank } from '../src/types';

const questions = (bank as unknown as QuestionBank).questions;
const PER = 2;

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe('영역(교시) 매핑', () => {
  it('모든 문제의 분야가 어느 교시에 속함', () => {
    const missing = [...new Set(questions.map((q) => q.category))].filter((c) => !isMapped(c));
    expect(missing).toEqual([]);
  });
  it('교시마다 문제가 충분함', () => {
    for (const s of SUBJECTS) {
      expect(questions.filter((q) => subjectOf(q.category).id === s.id).length).toBeGreaterThanOrEqual(30);
    }
  });
  it('등급 경계', () => {
    expect(gradeOf(1000, 1000)).toBe(1);
    expect(gradeOf(900, 1000)).toBe(1);
    expect(gradeOf(899, 1000)).toBe(2);
    expect(gradeOf(500, 1000)).toBe(5);
    expect(gradeOf(199, 1000)).toBe(9);
    expect(gradeOf(0, 0)).toBe(9);
  });
});

describe('pickGame', () => {
  it.each([
    [2, 2],
    [5, 4],
  ])('교시당 %i문항: 300판 모두 교시 순서대로, 교시 안 형식 다양, 숫자 %i개 이하, 중복 없음', (per, maxNumber) => {
    for (let s = 1; s <= 300; s++) {
      const { questions: qs } = pickGame(questions, { perSubject: per, maxNumber, seen: new Set(), excludePartial: false, rng: seeded(s) });
      expect(qs).toHaveLength(SUBJECTS.length * per);
      expect(qs.map((q) => subjectOf(q.category).period)).toEqual(SUBJECTS.flatMap((x) => Array(per).fill(x.period)));
      for (let k = 0; k < qs.length; k += per) {
        const group = qs.slice(k, k + per);
        // 형식은 교시 안에서 최대한 겹치지 않게 (2문항이면 반드시 다름, 5문항이면 3종 이상)
        expect(new Set(group.map((q) => q.type)).size).toBeGreaterThanOrEqual(per === 2 ? 2 : 3);
        if (per === 2) expect(new Set(group.map((q) => q.category)).size).toBe(2);
      }
      expect(qs.filter((q) => q.type === 'number').length).toBeLessThanOrEqual(maxNumber);
      expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length);
    }
  });

  it('이미 푼 문제는 다시 나오지 않음', () => {
    const seen = new Set<string>();
    const rng = seeded(7);
    for (let round = 0; round < 12; round++) {
      const { questions: qs, resetSeen } = pickGame(questions, { perSubject: PER, seen, excludePartial: false, rng });
      expect(resetSeen).toBe(false);
      for (const q of qs) {
        expect(seen.has(q.id)).toBe(false);
        seen.add(q.id);
      }
    }
  });

  it('어느 교시든 남은 문제가 모자라면 기록을 비우고 다시 뽑음', () => {
    const life = questions.filter((q) => subjectOf(q.category).id === 'life');
    const seen = new Set(life.slice(0, life.length - 1).map((q) => q.id));
    const { questions: qs, resetSeen } = pickGame(questions, { perSubject: PER, seen, excludePartial: false, rng: seeded(3) });
    expect(resetSeen).toBe(true);
    expect(qs).toHaveLength(SUBJECTS.length * PER);
  });

  it('partial 제외 설정', () => {
    for (let s = 1; s <= 50; s++) {
      const { questions: qs } = pickGame(questions, { perSubject: PER, seen: new Set(), excludePartial: true, rng: seeded(s) });
      expect(qs.every((q) => q.verification !== 'partial')).toBe(true);
      expect(qs).toHaveLength(SUBJECTS.length * PER);
    }
  });
});
