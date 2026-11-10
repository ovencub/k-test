/** partial(일부 과거값 재확인 필요) 문제 노출 방식.
 *  show  : 그대로 출제
 *  badge : 출제하되 결과 화면에 "재확인 중" 배지
 *  hide  : 출제하지 않음 (출시 전 데이터 점검이 끝나지 않았을 때)
 *  URL ?partial=hide 처럼 덮어쓸 수 있다. */
export type PartialMode = 'show' | 'badge' | 'hide';

const DEFAULT_PARTIAL_MODE: PartialMode = 'badge';

export const QUESTIONS_PER_GAME = 5;

export const REPO_URL = 'https://github.com/ovencub/zziksin';

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
