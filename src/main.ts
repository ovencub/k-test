import './style.css';
import { canvasBlob, renderCard, saveImage, type CardData } from './card';
import { GAME_NAME, MODES, REPO_URL, modeById, partialMode, reportUrl, type Mode } from './config';
import { loadBank } from './data';
import { rankTitle, score, scoreEmoji } from './scoring';
import { loadSeen, pickGame, saveSeen } from './select';
import { averageOf, decodeResult, fmtScore, resultUrl, share, shareText, subjectResults, toShared, type SharedResult } from './share';
import { SUBJECTS, gradeOf, subjectOf, type Subject } from './subjects';
import type { Played, Question } from './types';
import { h, tween } from './widgets/common';
import { TYPE_LABEL, createWidget } from './widgets';

const app = document.getElementById('app')!;
let bank: Question[] = [];
const EXAM_YEAR = `${new Date().getFullYear()}학년도`;

function mount(...nodes: (Node | null)[]) {
  app.replaceChildren(...nodes.filter((n): n is Node => !!n));
  window.scrollTo({ top: 0 });
}

function logo() {
  return h('div', { class: 'logo' }, h('span', { class: 'logo-ko' }, GAME_NAME), h('span', { class: 'logo-en' }, '전 영역'));
}

/** 시험지 맨 위 줄: "2026학년도 대한민국 통계고사 문제지   [홀수형]" */
function paperTop(left: string, right: string) {
  return h('div', { class: 'paper-top' }, h('span', {}, left), h('span', { class: 'paper-tag' }, right));
}

/** "범죄·안전 · 정치·선거·여론" — 분야 이름 중간에서 줄이 바뀌지 않게 */
function catList(cats: string[]): (Node | string)[] {
  return cats.flatMap((c, i) => (i ? [' · ', h('span', { class: 'nowrap' }, c)] : [h('span', { class: 'nowrap' }, c)]));
}

// ───────── 시작 화면 (문제지 표지) ─────────
function intro() {
  const [quick, full] = MODES;
  const modeBtn = (m: Mode, primary: boolean) => {
    const b = h(
      'button',
      { class: `btn big mode-btn${primary ? ' primary' : ''}`, type: 'button' },
      h('b', {}, m.label),
      h('small', {}, `교시당 ${m.per}문항 · 총 ${SUBJECTS.length * m.per}문항 · 약 ${m.minutes}분`),
    );
    b.addEventListener('click', () => startGame(m));
    return b;
  };
  const start = h('div', { class: 'mode-pick' }, modeBtn(quick, true), modeBtn(full, false));
  const table = h(
    'table',
    { class: 'timetable' },
    h('thead', {}, h('tr', {}, h('th', {}, '교시'), h('th', {}, '영역'), h('th', {}, `문항`, h('small', {}, `${quick.label.slice(0, 2)}/${full.label.slice(0, 2)}`)))),
    h(
      'tbody',
      {},
      ...SUBJECTS.map((sub) =>
        h(
          'tr',
          { style: `--subj:${sub.color}` },
          h('td', { class: 'tt-period' }, `${sub.period}교시`),
          h('td', { class: 'tt-name' }, h('b', {}, sub.name), h('small', {}, ...catList(sub.categories))),
          h('td', { class: 'tt-count' }, `${quick.per}/${full.per}`),
        ),
      ),
    ),
  );
  mount(
    h(
      'main',
      { class: 'screen intro' },
      paperTop(`${EXAM_YEAR} ${GAME_NAME} 문제지`, '홀수형'),
      h(
        'div',
        { class: 'cover' },
        h('h1', { class: 'cover-title' }, '대한민국', h('br'), '통계고사'),
        h('p', { class: 'cover-sub' }, '전 영역'),
      ),
      h('p', { class: 'tagline' }, '대한민국, 얼마나 잘 아세요?', h('br'), h('span', {}, '감으로 찍고 공식 통계로 채점합니다.')),
      table,
      h(
        'div',
        { class: 'notice' },
        h('h2', {}, '수험생 유의사항'),
        h(
          'ol',
          {},
          h('li', {}, `${SUBJECTS.length}교시. 막대를 올리고, 선을 긋고, 파이를 나눠 답하세요.`),
          h('li', {}, '점수는 ', h('strong', {}, '모든 교시가 끝난 뒤'), ' 한꺼번에 공개합니다.'),
          h('li', {}, '모든 문제에 공식 통계 출처와 ', h('strong', {}, '이 숫자만으로 말할 수 없는 것'), '이 붙어 있습니다.'),
        ),
      ),
      start,
      h(
        'footer',
        { class: 'intro-foot' },
        `문제 ${bank.length}개 · 모든 수치는 공식 통계·공개 자료 기준 · `,
        h('a', { href: REPO_URL, target: '_blank', rel: 'noopener noreferrer' }, '소스·오류 제보'),
      ),
    ),
  );
}

// ───────── 게임 ─────────
/** ?q=Q001,Q060 처럼 지정하면 그 문제들만 출제 (문제 검수용) */
function forcedQuestions(): Question[] | null {
  const ids = new URLSearchParams(location.search).get('q');
  if (!ids) return null;
  const qs = ids
    .split(',')
    .map((id) => bank.find((q) => q.id === id.trim().toUpperCase()))
    .filter((q): q is Question => !!q);
  return qs.length ? qs : null;
}

interface Block {
  subject: Subject;
  start: number;
  end: number;
}

/** 이어지는 같은 영역 문제를 한 교시로 묶는다 */
function blocksOf(list: Question[]): Block[] {
  const blocks: Block[] = [];
  list.forEach((q, i) => {
    const sub = subjectOf(q.category);
    const last = blocks[blocks.length - 1];
    if (last && last.subject.id === sub.id) last.end = i + 1;
    else blocks.push({ subject: sub, start: i, end: i + 1 });
  });
  return blocks;
}

let currentMode: Mode = MODES[0];

function startGame(mode: Mode = currentMode) {
  currentMode = mode;
  // 공유받은 결과 링크(?r=)로 들어왔다면 응시를 시작할 때 주소에서 지운다
  if (new URLSearchParams(location.search).has('r')) history.replaceState(null, '', location.pathname);
  let questions = forcedQuestions();
  if (!questions) {
    const seen = loadSeen();
    const picked = pickGame(bank, {
      perSubject: mode.per,
      maxNumber: mode.maxNumber,
      seen,
      excludePartial: partialMode() === 'hide',
    });
    questions = picked.questions;
    if (picked.resetSeen) seen.clear();
    for (const q of questions) seen.add(q.id);
    saveSeen(seen);
  }
  const played: Played[] = [];
  const list = questions;
  const blocks = blocksOf(list);
  const ask = (i: number) =>
    playQuestion(list[i], i, list, blocks, (p) => {
      played.push(p);
      next(i + 1);
    });
  const next = (i: number) => {
    if (i >= list.length) return final(played);
    const b = blocks.findIndex((x) => x.start === i);
    if (b === -1) return ask(i);
    const prev = b > 0 ? blocks[b - 1] : null;
    periodScreen(blocks[b], prev, list.length, () => ask(i));
  };
  next(0);
}

function progress(i: number, n: number, blocks: Block[]) {
  const wrap = h('div', { class: 'progress', 'aria-label': `${n}문항 중 ${i + 1}번째` });
  // 문항이 많으면(실전 응시) 교시마다 짧은 막대 하나로
  if (n > 15) {
    wrap.classList.add('dense');
    for (const b of blocks) {
      const done = Math.max(0, Math.min(b.end, i) - b.start);
      const cur = i >= b.start && i < b.end;
      const fill = h('i', { style: `width:${((done + (cur ? 0.5 : 0)) / (b.end - b.start)) * 100}%` });
      wrap.append(h('span', { class: `gbar${cur ? ' cur' : ''}`, style: `--subj:${b.subject.color}` }, fill));
    }
    return wrap;
  }
  for (const b of blocks) {
    const grp = h('span', { class: 'grp', style: `--subj:${b.subject.color}` });
    for (let k = b.start; k < b.end; k++) grp.append(h('span', { class: k < i ? 'done' : k === i ? 'cur' : '' }));
    wrap.append(grp);
  }
  return wrap;
}

// ───────── 교시 표지 ─────────
function periodScreen(block: Block, prev: Block | null, total: number, onStart: () => void) {
  const sub = block.subject;
  const n = block.end - block.start;
  const go = h('button', { class: 'btn primary big', type: 'button' }, `${sub.period}교시 시작`);
  go.addEventListener('click', onStart);

  // 점수는 시험이 끝난 뒤 공개 — 여기서는 제출 사실만
  const prevBox = prev
    ? h(
        'div',
        { class: 'period-prev', style: `--subj:${prev.subject.color}` },
        h('span', {}, `${prev.subject.period}교시 ${prev.subject.name} 영역`),
        h('strong', {}, '답안지 제출 완료'),
      )
    : null;

  mount(
    h(
      'main',
      { class: 'screen period', style: `--subj:${sub.color}` },
      paperTop(`${EXAM_YEAR} ${GAME_NAME}`, `${sub.period} / ${SUBJECTS.length}교시`),
      prevBox,
      h(
        'section',
        { class: 'period-card' },
        h('p', { class: 'period-no' }, `제${sub.period}교시`),
        h('h1', { class: 'period-name' }, `${sub.name} 영역`),
        h('p', { class: 'period-cats' }, ...catList(sub.categories)),
        h(
          'dl',
          { class: 'period-info' },
          h('div', {}, h('dt', {}, '문항 수'), h('dd', {}, `${n}문항`)),
          h('div', {}, h('dt', {}, '배점'), h('dd', {}, '문항당 100점')),
          h('div', {}, h('dt', {}, '문항 번호'), h('dd', {}, n > 1 ? `${block.start + 1}~${block.end}번` : `${block.end}번`, h('small', {}, ` / ${total}`))),
        ),
      ),
      go,
    ),
  );
}

function playQuestion(q: Question, i: number, list: Question[], blocks: Block[], done: (p: Played) => void) {
  const n = list.length;
  const sub = subjectOf(q.category);
  const widget = createWidget(q);
  const submit = h('button', { class: 'btn primary', type: 'button' }, '답안 제출');
  const hint = h('p', { class: 'submit-hint' });
  const syncReady = () => {
    const ok = widget.ready();
    submit.disabled = !ok;
    hint.textContent = ok ? '' : widget.readyHint();
  };
  widget.onChange(syncReady);
  syncReady();

  const actions = h('div', { class: 'actions' }, hint, submit);
  const result = h('section', { class: 'result', hidden: '' });

  submit.addEventListener('click', async () => {
    if (!widget.ready()) return;
    const answer = widget.answer();
    const sc = score(q, answer);
    actions.remove();
    await widget.reveal();
    renderResult(result, q, widget.comparison(), sc, i === n - 1, () => done({ question: q, answer, score: sc }));
  });

  mount(
    h(
      'main',
      { class: 'screen play', style: `--subj:${sub.color}` },
      h(
        'header',
        { class: 'play-head' },
        h('div', { class: 'period-tag' }, h('b', {}, `제${sub.period}교시`), ` ${sub.name}`),
        h('div', { class: 'prog-wrap' }, h('span', { class: 'qcount' }, `${i + 1} / ${n}`), progress(i, n, blocks)),
      ),
      h(
        'div',
        { class: 'q-meta' },
        h('span', { class: 'chip' }, q.category),
        h('span', { class: 'chip ghost' }, TYPE_LABEL[q.type]),
      ),
      h('h1', { class: 'q-title' }, h('span', { class: 'q-no' }, `${i + 1}.`), ' ', q.title, h('span', { class: 'q-points' }, '[100점]')),
      h('p', { class: 'q-text' }, q.question),
      widget.el,
      actions,
      result,
    ),
  );
}

function renderResult(
  box: HTMLElement,
  q: Question,
  comparison: HTMLElement,
  sc: number,
  last: boolean,
  onNext: () => void,
) {
  // 점수(sc)는 여기서 보여주지 않는다. 시험이 끝난 뒤 성적 발표에서 공개
  void sc;
  const next = h('button', { class: 'btn primary', type: 'button' }, last ? '시험 종료 · 채점하기' : '다음 문제');
  next.addEventListener('click', onNext);

  const showBadge = partialMode() === 'badge' && q.verification === 'partial';
  const verifyLabel = q.verification === 'computed' ? '원자료로 계산' : q.verification === 'partial' ? '일부 수치 재확인 중' : '출처 원문 확인';

  box.replaceChildren(
    h('div', { class: 'result-top' }, comparison),
    block('myth', '흔한 통념', q.myth),
    block('expl', '해설', q.explanation),
    block('caveat', '이 숫자만으로 말할 수 없는 것', q.caveat),
    h(
      'div',
      { class: 'source' },
      h('span', { class: 'source-k' }, '출처'),
      h('a', { href: q.source.url, target: '_blank', rel: 'noopener noreferrer' }, q.source.name),
      h(
        'div',
        { class: 'source-meta' },
        `${q.dataYear}년 기준 · `,
        h('span', { class: `verify ${q.verification}${showBadge ? ' warn' : ''}` }, verifyLabel),
        ' · ',
        h('a', { href: reportUrl(q), target: '_blank', rel: 'noopener noreferrer', class: 'report' }, '오류 제보'),
      ),
    ),
    next,
  );
  box.hidden = false;
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function block(kind: string, title: string, body: string) {
  return h('div', { class: `rblock ${kind}` }, h('h2', {}, title), h('p', {}, body));
}

// ───────── 채점 → 성적 발표 ─────────
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** 연출 진행 상태. skip이 켜지면 남은 대기·애니메이션을 즉시 끝낸다 */
class Show {
  skipped = reduceMotion();
  wait(ms: number): Promise<void> {
    return this.skipped ? Promise.resolve() : new Promise((r) => setTimeout(r, ms));
  }
  anim(ms: number, fn: (t: number) => void): Promise<void> {
    if (this.skipped) {
      fn(1);
      return Promise.resolve();
    }
    return tween(ms, (t) => fn(this.skipped ? 1 : t));
  }
}

function final(played: Played[]) {
  const show = new Show();
  grading(played, show).then(() => reportCard(played, show));
}

/** 1단계: 답안지를 채점하는 화면 */
async function grading(played: Played[], show: Show) {
  const results = subjectResults(played);
  const items = results.map((r) =>
    h(
      'li',
      { style: `--subj:${r.color}` },
      h('span', { class: 'gr-name' }, `${r.period}교시 ${r.name}`),
      h('span', { class: 'gr-state' }, '대기'),
    ),
  );
  const skip = h('button', { class: 'btn ghost-btn', type: 'button' }, '바로 결과 보기');
  skip.addEventListener('click', () => (show.skipped = true));
  mount(
    h(
      'main',
      { class: 'screen grading' },
      paperTop(`${EXAM_YEAR} ${GAME_NAME}`, '채점 중'),
      h('div', { class: 'gr-pen', 'aria-hidden': 'true' }),
      h('h1', { class: 'gr-title' }, '답안지를 채점하고 있습니다'),
      h('p', { class: 'gr-sub' }, `${played.length}문항 · ${results.length}개 영역`),
      h('ol', { class: 'gr-list' }, ...items),
      skip,
    ),
  );
  await show.wait(500);
  for (const li of items) {
    li.classList.add('on');
    li.querySelector('.gr-state')!.textContent = '채점 중…';
    await show.wait(420);
    li.classList.add('done');
    li.querySelector('.gr-state')!.textContent = '채점 완료';
  }
  await show.wait(600);
}

/** 2단계: 성적통지표 — 교시별로 하나씩, 마지막에 평균과 등급 */
async function reportCard(played: Played[], show: Show) {
  const avg = averageOf(played);
  const grade = gradeOf(avg, 100);
  const results = subjectResults(played);

  const skip = h('button', { class: 'btn ghost-btn skip-btn', type: 'button' }, '바로 결과 보기');
  skip.addEventListener('click', () => {
    show.skipped = true;
    skip.remove();
  });

  const rows = results.map((r) => {
    const num = h('span', {}, '0');
    const bar = h('i', {});
    const g = h('span', { class: 'g' }, String(r.grade));
    const tr = h(
      'tr',
      { class: 'reveal', style: `--subj:${r.color}` },
      h('th', { scope: 'row' }, h('span', { class: 'rp-period' }, `${r.period}교시`), r.name),
      h('td', { class: 'rp-score' }, h('span', { class: 'rp-val' }, num, h('small', {}, '점')), h('span', { class: 'rp-bar' }, bar)),
      h('td', { class: 'rp-grade' }, g),
    );
    return { r, tr, num, bar, g };
  });

  const avgNum = h('span', { class: 'rt-num' }, '0');
  const avgG = h('span', { class: 'g' }, String(grade));
  const footRow = h(
    'tr',
    { class: 'reveal' },
    h('th', { scope: 'row' }, '평균'),
    h('td', { class: 'rp-score' }, h('span', { class: 'rp-val' }, fmtScore(avg), h('small', {}, '점'))),
    h('td', { class: 'rp-grade' }, avgG),
  );
  const report = h(
    'table',
    { class: 'report' },
    h('caption', {}, '영역별 성적'),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, '영역'), h('th', { scope: 'col' }, '점수 (100점 만점)'), h('th', { scope: 'col' }, '등급'))),
    h('tbody', {}, ...rows.map((x) => x.tr)),
    h('tfoot', {}, footRow),
  );

  const totalBox = h(
    'section',
    { class: 'report-total reveal' },
    h(
      'div',
      {},
      h('p', { class: 'rt-label' }, '최종 평균 점수'),
      h('p', { class: 'rt-score' }, avgNum, h('span', { class: 'rt-max' }, ' / 100')),
      h('p', { class: 'final-rank' }, rankTitle(avg, 100)),
    ),
    h('div', { class: 'stamp', 'aria-label': `종합 ${grade}등급` }, h('b', {}, String(grade)), h('span', {}, '등급')),
  );

  const mode = currentMode;
  const shared = toShared(played, mode.id);
  const link = resultUrl(location.origin + location.pathname, shared);
  const text = shareText(played, link);
  const shareMsg = h('p', { class: 'share-msg', role: 'status' });
  const preview = h('pre', { class: 'share-preview', hidden: '' }, text);

  // 성적표 이미지: 미리 그려 두고 저장 버튼으로 내려받기·공유
  const img = h('img', { class: 'card-img', alt: '성적통지표 요약 이미지', hidden: '' });
  const saveBtn = h('button', { class: 'btn primary', type: 'button' }, '성적표 이미지 저장');
  let cardBlob: Blob | null = null;
  const cardReady = renderCard(cardData(shared, mode.label, played.length))
    .then(canvasBlob)
    .then((b) => {
      cardBlob = b;
      if (b) {
        img.setAttribute('src', URL.createObjectURL(b));
        img.hidden = false;
      }
    })
    .catch(() => undefined);
  saveBtn.addEventListener('click', async () => {
    await cardReady;
    if (!cardBlob) {
      shareMsg.textContent = '이미지를 만들지 못했어요. 화면을 캡처해 공유해 주세요.';
      return;
    }
    const r = await saveImage(cardBlob, `대한민국통계고사_성적표_${fmtScore(shared.avg)}점.png`, text);
    shareMsg.textContent = r === 'downloaded' ? '성적표 이미지를 저장했어요.' : r === 'shared' ? '' : '저장하지 못했어요. 이미지를 길게 눌러 저장해 주세요.';
  });

  const linkBtn = h('button', { class: 'btn', type: 'button' }, '결과 링크 공유하기');
  linkBtn.addEventListener('click', async () => {
    const r = await share(text);
    shareMsg.textContent = r === 'copied' ? '결과 링크를 복사했어요. 받은 사람은 내 성적표를 보고 바로 응시할 수 있어요!' : r === 'shared' ? '' : '공유하지 못했어요. 아래 문구를 직접 복사해 주세요.';
    if (r === 'failed') preview.hidden = false;
  });
  const again = h('button', { class: 'btn', type: 'button' }, '다시 응시하기');
  again.addEventListener('click', () => intro());

  const list = h('ol', { class: 'final-list' });
  for (const r of results) {
    list.append(h('li', { class: 'fl-head', style: `--subj:${r.color}` }, `${r.period}교시 ${r.name} 영역`));
    for (const p of r.played) {
      list.append(
        h(
          'li',
          {},
          h('span', { class: 'fl-emoji' }, scoreEmoji(p.score)),
          h('span', { class: 'fl-title' }, p.question.title, h('small', {}, `${p.question.category} · ${TYPE_LABEL[p.question.type]}`)),
          h('strong', { class: 'fl-score' }, String(p.score)),
        ),
      );
    }
  }
  const after = h(
    'div',
    { class: 'after reveal' },
    h('p', { class: 'grade-note' }, '※ 등급은 임시 기준입니다(평균 90점 이상 1등급, 10점마다 한 등급). 응시 기록이 쌓이면 실제 응시자 분포로 바꿀 예정이에요.'),
    h('div', { class: 'final-actions' }, saveBtn, linkBtn),
    shareMsg,
    preview,
    img,
    h('h2', { class: 'fl-caption' }, '문항별 채점'),
    list,
    again,
  );

  mount(
    h(
      'main',
      { class: 'screen final' },
      paperTop(`${EXAM_YEAR} ${GAME_NAME}`, '성적통지표'),
      h('h1', { class: 'final-head' }, '성적 발표'),
      report,
      totalBox,
      after,
      skip,
    ),
  );

  // 교시별로 하나씩
  await show.wait(400);
  for (const x of rows) {
    x.tr.classList.add('in');
    x.tr.scrollIntoView({ block: 'nearest', behavior: show.skipped ? 'auto' : 'smooth' });
    await show.anim(900, (t) => {
      x.num.textContent = fmtScore(x.r.avg * t);
      x.bar.style.width = `${(x.r.avg * t).toFixed(1)}%`;
    });
    x.g.classList.add('stamped');
    await show.wait(450);
  }

  // 마지막: 평균과 등급
  await show.wait(500);
  footRow.classList.add('in');
  totalBox.classList.add('in');
  totalBox.scrollIntoView({ block: 'center', behavior: show.skipped ? 'auto' : 'smooth' });
  await show.wait(300);
  await show.anim(1600, (t) => {
    avgNum.textContent = fmtScore(avg * t);
  });
  avgNum.textContent = fmtScore(avg);
  avgG.classList.add('stamped');
  totalBox.classList.add('stamped');
  await show.wait(900);
  after.classList.add('in');
  skip.remove();
}

function cardData(r: SharedResult, modeLabel: string, count: number): CardData {
  const grade = gradeOf(r.avg, 100);
  return {
    year: EXAM_YEAR,
    title: GAME_NAME,
    modeLabel,
    count,
    rows: SUBJECTS.map((s, i) => {
      const v = r.scores[i];
      return { period: s.period, name: s.name, color: s.color, avg: v, grade: v === null ? null : gradeOf(v, 100) };
    }),
    avg: r.avg,
    grade,
    rank: rankTitle(r.avg, 100),
    site: location.host + location.pathname.replace(/\/$/, ''),
  };
}

// ───────── 공유받은 성적표 (?r=) ─────────
function sharedLanding(r: SharedResult) {
  const mode = modeById(r.mode);
  const grade = gradeOf(r.avg, 100);
  const rows = SUBJECTS.map((s, i) => {
    const v = r.scores[i];
    return h(
      'tr',
      { style: `--subj:${s.color}` },
      h('th', { scope: 'row' }, h('span', { class: 'rp-period' }, `${s.period}교시`), s.name),
      h(
        'td',
        { class: 'rp-score' },
        v === null
          ? h('span', { class: 'rp-val muted' }, '미응시')
          : h('span', { class: 'rp-val' }, fmtScore(v), h('small', {}, '점')),
        v === null ? null : h('span', { class: 'rp-bar' }, h('i', { style: `width:${v}%` })),
      ),
      h('td', { class: 'rp-grade' }, v === null ? '' : h('span', { class: 'g stamped' }, String(gradeOf(v, 100)))),
    );
  });
  const [quick, full] = MODES;
  const go = (m: Mode, primary: boolean) => {
    const b = h('button', { class: `btn big mode-btn${primary ? ' primary' : ''}`, type: 'button' }, h('b', {}, `나도 ${m.label}`), h('small', {}, `${SUBJECTS.length * m.per}문항 · 약 ${m.minutes}분`));
    b.addEventListener('click', () => startGame(m));
    return b;
  };
  const home = h('button', { class: 'btn ghost-btn', type: 'button' }, '시험 안내 보기');
  home.addEventListener('click', () => {
    history.replaceState(null, '', location.pathname);
    intro();
  });
  mount(
    h(
      'main',
      { class: 'screen final shared' },
      paperTop(`${EXAM_YEAR} ${GAME_NAME}`, '성적통지표'),
      h('h1', { class: 'final-head' }, '친구의 성적표가 도착했어요'),
      h('p', { class: 'shared-sub' }, `${mode ? mode.label : '응시'} 결과 · 대한민국, 얼마나 잘 아세요?`),
      h(
        'section',
        { class: 'report-total in stamped' },
        h(
          'div',
          {},
          h('p', { class: 'rt-label' }, '최종 평균 점수'),
          h('p', { class: 'rt-score' }, fmtScore(r.avg), h('span', { class: 'rt-max' }, ' / 100')),
          h('p', { class: 'final-rank' }, rankTitle(r.avg, 100)),
        ),
        h('div', { class: 'stamp', 'aria-label': `종합 ${grade}등급` }, h('b', {}, String(grade)), h('span', {}, '등급')),
      ),
      h(
        'table',
        { class: 'report' },
        h('caption', {}, '영역별 성적'),
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, '영역'), h('th', { scope: 'col' }, '점수 (100점 만점)'), h('th', { scope: 'col' }, '등급'))),
        h('tbody', {}, ...rows),
      ),
      h('p', { class: 'shared-cta' }, '나는 몇 점일까? 공식 통계로 채점하는 대한민국 상식 시험'),
      h('div', { class: 'mode-pick' }, go(quick, true), go(full, false)),
      home,
    ),
  );
}

// ───────── 시작 ─────────
async function boot() {
  app.replaceChildren(h('main', { class: 'screen loading' }, logo(), h('p', {}, '문제지를 나눠주는 중…')));
  try {
    bank = (await loadBank()).questions;
    const shared = decodeResult(new URLSearchParams(location.search).get('r'));
    if (shared) sharedLanding(shared);
    else intro();
  } catch (e) {
    app.replaceChildren(h('main', { class: 'screen loading' }, logo(), h('p', { class: 'error' }, String((e as Error).message))));
  }
}
void boot();
