import { GAME_NAME } from './config';
import { rankTitle, scoreEmoji } from './scoring';
import { SUBJECTS, gradeOf, subjectOf } from './subjects';
import type { Played } from './types';

export interface SubjectResult {
  period: number;
  name: string;
  color: string;
  /** 교시 평균 점수 (0~100) */
  avg: number;
  grade: number;
  played: Played[];
}

/** 소수 첫째 자리까지 (정수면 정수로) */
export function fmtScore(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export function averageOf(played: Played[]): number {
  return played.length ? played.reduce((a, p) => a + p.score, 0) / played.length : 0;
}

/** 교시별 평균 점수·등급 (문제가 없는 교시는 빠진다) */
export function subjectResults(played: Played[]): SubjectResult[] {
  return SUBJECTS.map((s) => {
    const mine = played.filter((p) => subjectOf(p.question.category).id === s.id);
    const avg = averageOf(mine);
    return { period: s.period, name: s.name, color: s.color, avg, grade: gradeOf(avg, 100), played: mine };
  }).filter((r) => r.played.length > 0);
}

export function shareText(played: Played[], url: string): string {
  const avg = averageOf(played);
  const lines = [
    `${GAME_NAME} 성적통지표`,
    `평균 ${fmtScore(avg)}점 · ${gradeOf(avg, 100)}등급 · ${rankTitle(avg, 100)}`,
    '',
    ...subjectResults(played).map(
      (r) => `${r.period}교시 ${r.name} ${fmtScore(r.avg)}점 ${r.grade}등급 ${r.played.map((p) => scoreEmoji(p.score)).join('')}`,
    ),
    '',
    '대한민국, 얼마나 잘 아세요?',
    url,
  ];
  return lines.join('\n');
}

/** 모바일은 공유 시트, 아니면 클립보드. 결과 문구를 돌려준다. */
export async function share(text: string): Promise<'shared' | 'copied' | 'failed'> {
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'failed';
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
