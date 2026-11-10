import { SUBJECTS, subjectOf } from './subjects';
import type { Question } from './types';

export interface SelectOptions {
  /** 교시(영역)마다 낼 문제 수 */
  perSubject: number;
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

/** 한 판 문제를 뽑는다. 1교시부터 5교시까지 영역 순서대로 perSubject개씩.
 *  같은 교시 안에서는 세부 분야와 형식이 겹치지 않게 고르고, 안 되면 조건을 푼다.
 *  숫자 찍기는 한 판 maxNumber개까지.
 *  반환값의 resetSeen=true면 어느 영역의 미출제 문제가 모자라 세션 기록을 비우고 뽑은 것 */
export function pickGame(all: Question[], opts: SelectOptions): { questions: Question[]; resetSeen: boolean } {
  const rng = opts.rng ?? Math.random;
  const maxNumber = opts.maxNumber ?? 2;
  const per = opts.perSubject;
  const eligible = all.filter((q) => !(opts.excludePartial && q.verification === 'partial'));
  const bySubject = SUBJECTS.map((s) => eligible.filter((q) => subjectOf(q.category).id === s.id));
  const resetSeen = bySubject.some((list) => list.filter((q) => !opts.seen.has(q.id)).length < per);

  const picked: Question[] = [];
  let numbers = 0;
  for (const list of bySubject) {
    const pool = shuffle(resetSeen ? list : list.filter((q) => !opts.seen.has(q.id)), rng);
    const mine: Question[] = [];
    const take = (q: Question) => {
      mine.push(q);
      if (q.type === 'number') numbers++;
    };
    for (const strict of [true, false]) {
      for (const q of pool) {
        if (mine.length >= per) break;
        if (mine.includes(q)) continue;
        if (q.type === 'number' && numbers >= maxNumber) continue;
        if (strict && mine.some((m) => m.category === q.category || m.type === q.type)) continue;
        take(q);
      }
    }
    for (const q of pool) {
      if (mine.length >= per) break;
      if (!mine.includes(q)) take(q);
    }
    picked.push(...mine);
  }
  return { questions: picked, resetSeen };
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
