import { GAME_NAME } from './config';
import { rankTitle, scoreEmoji } from './scoring';
import { SUBJECTS, gradeOf, subjectOf } from './subjects';
import type { Played } from './types';

export interface SubjectResult {
  period: number;
  name: string;
  color: string;
  score: number;
  max: number;
  grade: number;
  played: Played[];
}

/** 교시별 원점수·등급 (문제가 없는 교시는 빠진다) */
export function subjectResults(played: Played[]): SubjectResult[] {
  return SUBJECTS.map((s) => {
    const mine = played.filter((p) => subjectOf(p.question.category).id === s.id);
    const score = mine.reduce((a, p) => a + p.score, 0);
    const max = mine.length * 100;
    return { period: s.period, name: s.name, color: s.color, score, max, grade: gradeOf(score, max), played: mine };
  }).filter((r) => r.played.length > 0);
}

export function shareText(played: Played[], url: string): string {
  const total = played.reduce((a, p) => a + p.score, 0);
  const max = played.length * 100;
  const lines = [
    `${GAME_NAME} 성적통지표`,
    `총점 ${total}/${max} · ${gradeOf(total, max)}등급 · ${rankTitle(total, max)}`,
    '',
    ...subjectResults(played).map(
      (r) => `${r.period}교시 ${r.name} ${r.grade}등급 ${r.played.map((p) => scoreEmoji(p.score)).join('')}`,
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
