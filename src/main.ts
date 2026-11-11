import './style.css';
import { canvasBlob, renderCard, saveImage, type CardData } from './card';
import { GAME_NAME, MODES, REPO_URL, TAGLINE, modeById, partialMode, reportUrl, type Mode } from './config';
import { loadBank } from './data';
import { rankTitle, score, scoreEmoji } from './scoring';
import { loadSeen, pickGame, saveSeen } from './select';
import {
  decodeResult,
  fmtScore,
  hardestTopic,
  resultUrl,
  share,
  shareText,
  subjectResults,
  toShared,
  type SharedResult,
} from './share';
import { SUBJECTS, gradeOf, subjectOf } from './subjects';
import type { Played, Question } from './types';
import { h, tween } from './widgets/common';
import { TYPE_LABEL, createWidget } from './widgets';

const app = document.getElementById('app')!;
let bank: Question[] = [];

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const wait = (ms: number) => (reduceMotion() ? Promise.resolve() : new Promise<void>((r) => setTimeout(r, ms)));

/** 화면 교체. 스크린리더가 새 화면을 읽도록 첫 제목으로 초점을 옮긴다 */
function mount(...nodes: (Node | null)[]) {
  app.replaceChildren(...nodes.filter((n): n is Node => !!n));
  window.scrollTo({ top: 0 });
  const title = app.querySelector<HTMLElement>('h1');
  if (title) {
    title.setAttribute('tabindex', '-1');
    title.focus({ preventScroll: true });
  }
}

/** 타이포 로고: "그 정도라고" + 라임 물음표 */
function logo(tag: 'h1' | 'p' = 'p') {
  return h(tag, { class: 'logo', 'aria-label': GAME_NAME }, '그 정도라고', h('span', { class: 'logo-q', 'aria-hidden': 'true' }, '?'));
}

/** 12문제(기본)·30문제 시작 버튼 */
function modeButtons(primaryPrefix = '') {
  const [quick, full] = MODES;
  const btn = (m: Mode, primary: boolean) => {
    const b = h(
      'button',
      { class: `btn big mode-btn${primary ? ' primary' : ''}`, type: 'button' },
      h('b', {}, `${primary ? primaryPrefix : ''}${m.label}`),
      h('small', {}, `약 ${m.minutes}분`),
    );
    b.addEventListener('click', () => startGame(m));
    return b;
  };
  return h('div', { class: 'mode-pick' }, btn(quick, true), btn(full, false));
}

// ───────── 첫 화면 ─────────
function intro() {
  const [quick, full] = MODES;
  const topics = h(
    'ul',
    { class: 'topic-list' },
    ...SUBJECTS.map((s) =>
      h('li', { style: `--subj:${s.color}` }, h('b', {}, s.name), h('small', {}, s.categories.join(' · '))),
    ),
  );
  mount(
    h(
      'main',
      { class: 'screen landing' },
      h('div', { class: 'hero' }, logo('h1'), h('p', { class: 'tagline' }, TAGLINE)),
      modeButtons(),
      h(
        'details',
        { class: 'about' },
        h('summary', {}, '어떤 문제가 나오나요?'),
        h('p', {}, `${SUBJECTS.length}개 주제에서 ${quick.per}문제씩(12문제) 또는 ${full.per}문제씩(30문제) 나와요.`),
        topics,
        h(
          'ul',
          { class: 'notes' },
          h('li', {}, '막대를 올리고, 선을 긋고, 파이를 나눠서 답해요.'),
          h('li', {}, '답을 내면 실제 숫자와 해설을 바로 보여줘요. 점수는 끝까지 풀고 나서 한 번에 공개해요.'),
          h('li', {}, '모든 숫자는 공식 통계·공개 자료 기준이고, 문제마다 출처와 ', h('strong', {}, '이 숫자만으로 말할 수 없는 것'), '이 붙어 있어요.'),
        ),
      ),
      h(
        'footer',
        { class: 'foot' },
        `문제 ${bank.length}개 · `,
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

let currentMode: Mode = MODES[0];

/** 모드를 고르면 바로 첫 문제를 연다 (별도 시작 화면 없음) */
function startGame(mode: Mode = currentMode) {
  currentMode = mode;
  // 공유받은 결과 링크(?r=)로 들어왔다면 플레이를 시작할 때 주소에서 지운다
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
  const next = (i: number) => {
    if (i >= list.length) return final(played);
    playQuestion(list[i], i, list, (p) => {
      played.push(p);
      next(i + 1);
    });
  };
  next(0);
}

function playQuestion(q: Question, i: number, list: Question[], done: (p: Played) => void) {
  const n = list.length;
  const sub = subjectOf(q.category);
  const newTopic = i > 0 && subjectOf(list[i - 1].category).id !== sub.id;
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
  const result = h('section', { class: 'result', hidden: '', 'aria-live': 'polite' });

  submit.addEventListener('click', async () => {
    if (!widget.ready()) return;
    const answer = widget.answer();
    const sc = score(q, answer);
    actions.remove();
    await widget.reveal();
    renderResult(result, q, widget.comparison(), i === n - 1, () => done({ question: q, answer, score: sc }));
  });

  const fill = h('i', { style: `width:${((i + 1) / n) * 100}%` });
  mount(
    h(
      'main',
      { class: 'screen play', style: `--subj:${sub.color}` },
      h(
        'header',
        { class: 'play-head' },
        h('div', { class: 'pbar', role: 'progressbar', 'aria-valuemin': '1', 'aria-valuemax': String(n), 'aria-valuenow': String(i + 1), 'aria-label': '진행률' }, fill),
        h(
          'p',
          { class: 'play-status' },
          h('b', { class: 'qcount' }, `${i + 1} / ${n}`),
          h('span', { class: 'dot', 'aria-hidden': 'true' }, '·'),
          h('span', { class: 'topic' }, sub.name),
          newTopic ? h('span', { class: 'new-topic' }, '새 주제') : null,
        ),
      ),
      h('div', { class: 'q-meta' }, h('span', { class: 'chip' }, q.category), h('span', { class: 'chip ghost' }, TYPE_LABEL[q.type])),
      h('h1', { class: 'q-title' }, q.title),
      h('p', { class: 'q-text' }, q.question),
      widget.el,
      actions,
      result,
    ),
  );
}

function renderResult(box: HTMLElement, q: Question, comparison: HTMLElement, last: boolean, onNext: () => void) {
  // 문제별 점수는 여기서 보여주지 않는다. 끝까지 푼 뒤 결과에서 공개
  const next = h('button', { class: 'btn primary', type: 'button' }, last ? '결과 보기' : '다음 문제');
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
  box.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
}

function block(kind: string, title: string, body: string) {
  return h('div', { class: `rblock ${kind}` }, h('h2', {}, title), h('p', {}, body));
}

// ───────── 결과 ─────────
/** 주제별 점수·등급 표 (내 결과·친구 결과 공용) */
function topicTable(scores: (number | null)[], avg: number, caption: string) {
  const rows = SUBJECTS.map((s, i) => {
    const v = scores[i];
    return h(
      'tr',
      { style: `--subj:${s.color}` },
      h('th', { scope: 'row' }, s.name),
      h(
        'td',
        { class: 'tt-score' },
        v === null ? h('span', { class: 'muted' }, '안 풂') : h('span', { class: 'num' }, fmtScore(v), h('small', {}, '점')),
        v === null ? null : h('span', { class: 'tbar' }, h('i', { style: `width:${v}%` })),
      ),
      h('td', { class: 'tt-grade' }, v === null ? '–' : `${gradeOf(v, 100)}등급`),
    );
  });
  return h(
    'table',
    { class: 'topic-table' },
    h('caption', {}, caption),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, '주제'), h('th', { scope: 'col' }, '점수'), h('th', { scope: 'col' }, '등급'))),
    h('tbody', {}, ...rows),
    h(
      'tfoot',
      {},
      h(
        'tr',
        {},
        h('th', { scope: 'row' }, '평균'),
        h('td', { class: 'tt-score' }, h('span', { class: 'num' }, fmtScore(avg), h('small', {}, '점'))),
        h('td', { class: 'tt-grade' }, `${gradeOf(avg, 100)}등급`),
      ),
    ),
  );
}

const GRADE_NOTE = '등급은 임시 기준이에요(평균 90점 이상 1등급, 10점마다 한 등급). 플레이 기록이 쌓이면 실제 분포로 바꿀 예정이에요.';

/** 해설의 첫 문장 */
function firstSentence(text: string) {
  const m = text.match(/^.*?[.!?](?=\s|$)/);
  return m ? m[0] : text;
}

/** 짧은 채점 전환 후 결과 */
async function final(played: Played[]) {
  mount(
    h(
      'main',
      { class: 'screen grading' },
      h('div', { class: 'spinner', 'aria-hidden': 'true' }),
      h('h1', { class: 'grading-title' }, '채점하는 중…'),
      h('p', { class: 'muted' }, `${played.length}문제를 공식 통계와 맞춰보고 있어요.`),
    ),
  );
  await wait(900);
  resultScreen(played);
}

function resultScreen(played: Played[]) {
  const mode = currentMode;
  const shared = toShared(played, mode.id);
  const avg = shared.avg;
  const nick = rankTitle(avg, 100);
  const link = resultUrl(location.origin + location.pathname, shared);
  const text = shareText(played, link);

  // 히어로: 별명 → 평균 점수
  const avgNum = h('span', { class: 'num' }, reduceMotion() ? fmtScore(avg) : '0');
  const hero = h(
    'section',
    { class: 'score-card' },
    h('p', { class: 'kicker' }, `내 결과 · ${mode.short}`),
    h('h1', { class: 'nick' }, nick),
    h('p', { class: 'big-score' }, avgNum, h('small', {}, '점')),
    h('p', { class: 'score-sub' }, '평균 점수 · 100점 만점'),
  );

  // 가장 빗나간 숫자: 문제별 점수(같은 0~100 척도)가 가장 낮은 문제. 단위가 다른 차이는 비교하지 않는다
  const worst = played.reduce<Played | null>((w, p) => (w === null || p.score < w.score ? p : w), null);
  const miss = worst
    ? h(
        'section',
        { class: 'miss-card' },
        h('h2', {}, '가장 빗나간 숫자'),
        h('p', { class: 'miss-title' }, worst.question.title),
        h('p', { class: 'miss-meta' }, `${subjectOf(worst.question.category).name} · ${worst.score}점`),
        h('p', { class: 'miss-expl' }, firstSentence(worst.question.explanation)),
      )
    : null;

  // 공유
  const shareMsg = h('p', { class: 'share-msg', role: 'status' });
  const preview = h('pre', { class: 'share-preview', hidden: '' }, text);
  const sendBtn = h('button', { class: 'btn primary', type: 'button' }, '친구한테 보내기');
  sendBtn.addEventListener('click', async () => {
    const r = await share(text);
    shareMsg.textContent = r === 'copied' ? '결과 링크를 복사했어요. 원하는 곳에 붙여넣어 보내세요.' : r === 'shared' ? '' : '자동으로 복사하지 못했어요. 아래 문구를 직접 복사해 주세요.';
    preview.hidden = r !== 'failed';
  });

  const img = h('img', { class: 'card-img', alt: `${GAME_NAME} 결과 이미지: ${nick}, 평균 ${fmtScore(avg)}점`, hidden: '' });
  const saveBtn = h('button', { class: 'btn', type: 'button' }, '결과 이미지 저장');
  let cardBlob: Blob | null = null;
  const cardReady = renderCard(cardData(shared, mode.short, played.length))
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
      shareMsg.textContent = '이미지를 만들지 못했어요. 화면을 캡처해 주세요.';
      return;
    }
    const r = await saveImage(cardBlob, `그정도라고_${fmtScore(avg)}점.png`, text);
    shareMsg.textContent = r === 'downloaded' ? '결과 이미지를 저장했어요.' : r === 'shared' ? '' : '저장하지 못했어요. 이미지를 길게 눌러 저장해 주세요.';
  });

  // 주제별 상세
  const list = h('ol', { class: 'final-list' });
  for (const r of subjectResults(played)) {
    list.append(h('li', { class: 'fl-head', style: `--subj:${r.color}` }, r.name));
    for (const p of r.played) {
      list.append(
        h(
          'li',
          {},
          h('span', { class: 'fl-emoji', 'aria-hidden': 'true' }, scoreEmoji(p.score)),
          h('span', { class: 'fl-title' }, p.question.title, h('small', {}, `${p.question.category} · ${TYPE_LABEL[p.question.type]}`)),
          h('strong', { class: 'fl-score' }, `${p.score}점`),
        ),
      );
    }
  }
  const details = h(
    'details',
    { class: 'topics' },
    h('summary', {}, '주제별 결과 보기'),
    topicTable(shared.scores, avg, '주제별 결과'),
    h('p', { class: 'grade-note' }, GRADE_NOTE),
    h('h3', {}, '문제별 점수'),
    list,
  );

  const again = h('button', { class: 'btn', type: 'button' }, '다시 풀어보기');
  again.addEventListener('click', () => startGame(currentMode));
  const home = h('button', { class: 'btn ghost', type: 'button' }, '첫 화면으로');
  home.addEventListener('click', () => intro());

  mount(
    h(
      'main',
      { class: 'screen result-screen' },
      logo(),
      hero,
      miss,
      h('div', { class: 'share-box' }, sendBtn, saveBtn, shareMsg, preview, img),
      details,
      h('div', { class: 'end-actions' }, again, home),
    ),
  );
  if (!reduceMotion()) void tween(900, (t) => (avgNum.textContent = fmtScore(avg * t)));
}

function cardData(r: SharedResult, modeShort: string, count: number): CardData {
  const hard = hardestTopic(r.scores);
  return {
    title: GAME_NAME,
    modeLabel: modeShort,
    count,
    rows: SUBJECTS.map((s, i) => ({ name: s.name, color: s.color, avg: r.scores[i] })),
    avg: r.avg,
    grade: gradeOf(r.avg, 100),
    nick: rankTitle(r.avg, 100),
    hardest: hard ? `가장 어려웠던 주제 · ${hard.name} ${fmtScore(hard.avg)}점` : '',
    site: location.host + location.pathname.replace(/\/$/, ''),
  };
}

// ───────── 친구 결과 (?r=) ─────────
function friendResult(r: SharedResult) {
  const mode = modeById(r.mode);
  const nick = rankTitle(r.avg, 100);
  const hard = hardestTopic(r.scores);
  const home = h('button', { class: 'btn ghost', type: 'button' }, '게임 소개 보기');
  home.addEventListener('click', () => {
    history.replaceState(null, '', location.pathname);
    intro();
  });
  mount(
    h(
      'main',
      { class: 'screen friend' },
      logo(),
      h(
        'section',
        { class: 'score-card' },
        h('p', { class: 'kicker' }, `친구 결과${mode ? ` · ${mode.short}` : ''}`),
        h('h1', { class: 'nick' }, `${nick} · ${fmtScore(r.avg)}점`),
        hard ? h('p', { class: 'score-sub' }, `가장 어려웠던 주제 · ${hard.name} ${fmtScore(hard.avg)}점`) : null,
      ),
      h('p', { class: 'cta' }, '너는 몇 점 나올 것 같아?'),
      modeButtons('나도 '),
      topicTable(r.scores, r.avg, '친구의 주제별 결과'),
      h('p', { class: 'grade-note' }, GRADE_NOTE),
      home,
    ),
  );
}

/** 깨진 결과 링크 */
function brokenLink() {
  const go = h('button', { class: 'btn primary big', type: 'button' }, '첫 화면으로');
  go.addEventListener('click', () => {
    history.replaceState(null, '', location.pathname);
    intro();
  });
  mount(
    h(
      'main',
      { class: 'screen notice-screen' },
      logo(),
      h('h1', {}, '결과를 열 수 없어요.'),
      h('p', { class: 'muted' }, '링크가 잘렸거나 바뀐 것 같아요. 직접 풀어보는 건 어때요?'),
      go,
    ),
  );
}

// ───────── 시작 ─────────
async function boot() {
  app.replaceChildren(h('main', { class: 'screen notice-screen' }, logo(), h('p', { class: 'muted', role: 'status' }, '문제 불러오는 중…')));
  try {
    bank = (await loadBank()).questions;
  } catch (e) {
    const retry = h('button', { class: 'btn primary', type: 'button' }, '다시 시도');
    retry.addEventListener('click', () => location.reload());
    mount(
      h(
        'main',
        { class: 'screen notice-screen' },
        logo(),
        h('h1', {}, '문제를 불러오지 못했어요.'),
        h('p', { class: 'muted error' }, String((e as Error).message)),
        retry,
      ),
    );
    return;
  }
  const params = new URLSearchParams(location.search);
  if (params.has('r')) {
    const shared = decodeResult(params.get('r'));
    if (shared) friendResult(shared);
    else brokenLink();
  } else intro();
}
void boot();
