import questionsUrl from '../questions.json?url';
import type { QuestionBank } from './types';

/** questions.json은 번들에 넣지 않고 별도 파일로 둔다.
 *  build_questions.py로 JSON을 다시 만들면 코드 수정 없이 반영된다. */
export async function loadBank(): Promise<QuestionBank> {
  const res = await fetch(questionsUrl, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`문제은행을 불러오지 못했습니다 (${res.status})`);
  return (await res.json()) as QuestionBank;
}
