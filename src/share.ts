import { rankTitle, scoreEmoji } from './scoring';
import type { Played } from './types';

export function shareText(played: Played[], url: string): string {
  const total = played.reduce((a, p) => a + p.score, 0);
  const max = played.length * 100;
  const lines = [
    `찍신 ZZIK SIN ${total}/${max} · ${rankTitle(total, max)}`,
    played.map((p) => scoreEmoji(p.score)).join(''),
    ...played.map((p) => `${scoreEmoji(p.score)} ${p.question.title} ${p.score}`),
    '',
    '통계로 찍어보는 사회 이슈',
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
