import { describe, expect, it } from 'vitest';
import { decodeResult, encodeResult, resultUrl } from '../src/share';
import { SUBJECTS } from '../src/subjects';

describe('결과 링크', () => {
  it('인코딩 → 디코딩이 그대로', () => {
    const r = { mode: 'f', scores: [82.4, 75, 60, 90, null, 66.6], avg: 74.3 };
    const s = encodeResult(r);
    expect(s).toBe('f-824-750-600-900-x-666-743');
    expect(decodeResult(s)).toEqual(r);
  });

  it('교시 수가 SUBJECTS와 맞음', () => {
    const s = encodeResult({ mode: 'q', scores: SUBJECTS.map(() => 50), avg: 50 });
    expect(s.split('-')).toHaveLength(SUBJECTS.length + 2);
  });

  it('범위 밖 값은 0~100으로 자름', () => {
    expect(encodeResult({ mode: 'q', scores: [120, -5, 0, 0, 0, 0], avg: 101 })).toBe('q-1000-0-0-0-0-0-1000');
  });

  it('망가진 링크는 무시', () => {
    for (const bad of [null, '', 'f', 'f-1-2-3', 'f-824-750-600-900-700-660', 'F-1-1-1-1-1-1-1', 'f-a-1-1-1-1-1-1', 'f-1001-1-1-1-1-1-1', 'f-x-x-x-x-x-x-500']) {
      expect(decodeResult(bad)).toBeNull();
    }
  });

  it('URL 형식', () => {
    expect(resultUrl('https://ovencub.github.io/k-test/', { mode: 'q', scores: [10, 20, 30, 40, 50, 60], avg: 35 })).toBe(
      'https://ovencub.github.io/k-test/?r=q-100-200-300-400-500-600-350',
    );
  });
});
