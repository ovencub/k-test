import type { Question } from './types';

export interface SelectOptions {
  count: number;
  /** 이번 세션에 이미 푼 문제 id */
  seen: ReadonlySet<string>;
  /** partial 문제 제외 여부 */
  excludePartial: boolean;
  /** 숫자 찍기 문제 한 판 최대 개수 */
  maxNumber?: number;
  rng?: () => number;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 한 판 문제를 뽑는다.
 *  1) 분야가 겹치지 않게, 숫자 찍기는 maxNumber개까지
 *  2) 형식이 1종뿐이면 마지막 문제를 다른 형식으로 교체
 *  3) 조건을 만족 못 하면 조건을 풀어 채운다
 *  반환값의 resetSeen=true면 미출제 문제가 모자라 세션 기록을 비우고 뽑은 것 */
export function pickGame(all: Question[], opts: SelectOptions): { questions: Question[]; resetSeen: boolean } {
  const rng = opts.rng ?? Math.random;
  const maxNumber = opts.maxNumber ?? 1;
  const eligible = all.filter((q) => !(opts.excludePartial && q.verification === 'partial'));

  let pool = eligible.filter((q) => !opts.seen.has(q.id));
  let resetSeen = false;
  if (pool.length < opts.count) {
    pool = eligible;
    resetSeen = true;
  }
  const order = shuffle(pool, rng);

  const picked: Question[] = [];
  const cats = new Set<string>();
  let numbers = 0;
  const take = (q: Question) => {
    picked.push(q);
    cats.add(q.category);
    if (q.type === 'number') numbers++;
  };

  // 1차: 분야 중복 없음 + 숫자 제한
  for (const q of order) {
    if (picked.length >= opts.count) break;
    if (cats.has(q.category)) continue;
    if (q.type === 'number' && numbers >= maxNumber) continue;
    take(q);
  }
  // 2차: 모자라면 분야 제한을 풀고 채움 (숫자 제한은 유지)
  for (const q of order) {
    if (picked.length >= opts.count) break;
    if (picked.includes(q)) continue;
    if (q.type === 'number' && numbers >= maxNumber) continue;
    take(q);
  }
  // 3차: 그래도 모자라면 아무거나
  for (const q of order) {
    if (picked.length >= opts.count) break;
    if (!picked.includes(q)) take(q);
  }

  // 형식 최소 2종
  if (picked.length > 1 && new Set(picked.map((q) => q.type)).size < 2) {
    const onlyType = picked[0].type;
    const usedCats = new Set(picked.slice(0, -1).map((q) => q.category));
    const alt =
      order.find((q) => q.type !== onlyType && !picked.includes(q) && !usedCats.has(q.category)) ??
      order.find((q) => q.type !== onlyType && !picked.includes(q));
    if (alt) picked[picked.length - 1] = alt;
  }

  return { questions: shuffle(picked, rng), resetSeen };
}

const SEEN_KEY = 'zziksin.seen';

export function loadSeen(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

export function saveSeen(seen: Set<string>): void {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    /* 저장 불가(사생활 보호 모드 등)면 중복 방지 없이 진행 */
  }
}
