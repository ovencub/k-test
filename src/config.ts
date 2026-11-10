/** partial(일부 과거값 재확인 필요) 문제 노출 방식.
 *  show  : 그대로 출제
 *  badge : 출제하되 결과 화면에 "재확인 중" 배지
 *  hide  : 출제하지 않음 (출시 전 데이터 점검이 끝나지 않았을 때)
 *  URL ?partial=hide 처럼 덮어쓸 수 있다. */
export type PartialMode = 'show' | 'badge' | 'hide';

const DEFAULT_PARTIAL_MODE: PartialMode = 'badge';

/** 응시 방식. per = 교시(영역)마다 문제 수, maxNumber = 한 판 숫자 찍기 최대 개수 */
export interface Mode {
  id: 'q' | 'f';
  label: string;
  per: number;
  minutes: number;
  maxNumber: number;
}
export const MODES: Mode[] = [
  { id: 'q', label: '빠른 응시', per: 2, minutes: 6, maxNumber: 2 },
  { id: 'f', label: '실전 응시', per: 5, minutes: 15, maxNumber: 4 },
];
export const modeById = (id: string): Mode | undefined => MODES.find((m) => m.id === id);

export const GAME_NAME = '대한민국 통계고사';

export const REPO_URL = 'https://github.com/ovencub/k-test';

/** 문제별 수치·출처 오류 제보 (GitHub 이슈, 문제 번호만 미리 채움) */
export function reportUrl(q: { id: string; title: string }): string {
  const title = `[${q.id}] ${q.title} — 수치·출처 오류 제보`;
  const body = [
    `문제: ${q.id} ${q.title}`,
    '',
    '### 어떤 부분이 틀렸나요?',
    '',
    '### 근거 자료 (링크)',
    '',
  ].join('\n');
  return `${REPO_URL}/issues/new?labels=data&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

export function partialMode(): PartialMode {
  const v = new URLSearchParams(location.search).get('partial');
  return v === 'show' || v === 'badge' || v === 'hide' ? v : DEFAULT_PARTIAL_MODE;
}
