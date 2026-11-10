/** 모의고사 교시(영역). 문제의 category를 다섯 영역으로 묶는다.
 *  새 category를 만들면 여기 categories에도 넣어야 한다 (tests/select.test.ts가 검사). */
export interface Subject {
  id: string;
  period: number;
  name: string;
  /** 영역 색 (교시 표지·성적표 강조) */
  color: string;
  categories: string[];
}

export const SUBJECTS: Subject[] = [
  { id: 'econ', period: 1, name: '경제', color: '#0f9b6e', categories: ['경제·재정', '노동·일자리', '부동산'] },
  { id: 'society', period: 2, name: '사회', color: '#7357e8', categories: ['인구·가족', '세대', '젠더', '외국인·이민'] },
  { id: 'politics', period: 3, name: '정치·안전', color: '#e0590f', categories: ['범죄·안전', '정치·선거·여론', '국방·의료', '사법·인권'] },
  { id: 'health', period: 4, name: '건강·교육', color: '#1c7ed6', categories: ['보건·복지', '교육'] },
  { id: 'life', period: 5, name: '생활·환경', color: '#c2255c', categories: ['생활·문화', '환경·에너지', '과학·디지털', '식품·농업'] },
];

const byCategory = new Map(SUBJECTS.flatMap((s) => s.categories.map((c) => [c, s] as const)));

/** 모르는 category는 마지막 영역으로 (테스트에서 누락을 잡는다) */
export function subjectOf(category: string): Subject {
  return byCategory.get(category) ?? SUBJECTS[SUBJECTS.length - 1];
}

export function isMapped(category: string): boolean {
  return byCategory.has(category);
}

/** 원점수 비율 → 1~9등급 (절대평가) */
export function gradeOf(score: number, max: number): number {
  const r = max > 0 ? score / max : 0;
  const cuts = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2];
  const i = cuts.findIndex((c) => r >= c);
  return i === -1 ? 9 : i + 1;
}
