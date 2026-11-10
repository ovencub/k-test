import './style.css';
import { QUESTIONS_PER_GAME, REPO_URL, partialMode, reportUrl } from './config';
import { loadBank } from './data';
import { rankTitle, score, scoreEmoji } from './scoring';
import { loadSeen, pickGame, saveSeen } from './select';
import { share, shareText } from './share';
import type { Played, Question } from './types';
import { h, tween } from './widgets/common';
import { TYPE_LABEL, createWidget } from './widgets';

const app = document.getElementById('app')!;
let bank: Question[] = [];

function mount(...nodes: Node[]) {
  app.replaceChildren(...nodes);
  window.scrollTo({ top: 0 });
}

function logo() {
  return h('div', { class: 'logo' }, h('span', { class: 'logo-ko' }, '찍신'), h('span', { class: 'logo-en' }, 'ZZIK SIN'));
}

// ───────── 시작 화면 ─────────
function intro() {
  const start = h('button', { class: 'btn primary big', type: 'button' }, '시작하기');
  start.addEventListener('click', () => startGame());
  mount(
    h(
      'main',
      { class: 'screen intro' },
      logo(),
      h('p', { class: 'tagline' }, '말싸움 붙는 그 숫자,', h('br'), '감으로 찍고 통계로 확인하세요.'),
      h(
        'ul',
        { class: 'intro-points' },
        h('li', {}, h('strong', {}, '5문제 · 2~3분'), ' — 막대를 올리고, 선을 긋고, 파이를 나눠요'),
        h('li', {}, h('strong', {}, '공식 통계'), ' — 모든 문제에 출처 링크'),
        h('li', {}, h('strong', {}, '이 숫자만으로 말할 수 없는 것'), '까지 함께 보여드려요'),
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

function startGame() {
  let questions = forcedQuestions();
  if (!questions) {
    const seen = loadSeen();
    const picked = pickGame(bank, {
      count: QUESTIONS_PER_GAME,
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
    playQuestion(list[i], i, list.length, (p) => {
      played.push(p);
      next(i + 1);
    });
  };
  next(0);
}

function progress(i: number, n: number) {
  const dots = h('div', { class: 'progress', 'aria-label': `${n}문제 중 ${i + 1}번째` });
  for (let k = 0; k < n; k++) dots.append(h('span', { class: k < i ? 'done' : k === i ? 'cur' : '' }));
  return dots;
}

function playQuestion(q: Question, i: number, n: number, done: (p: Played) => void) {
  const widget = createWidget(q);
  const submit = h('button', { class: 'btn primary', type: 'button' }, '찍기!');
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
      { class: 'screen play' },
      h('header', { class: 'play-head' }, h('div', { class: 'mini-logo' }, '찍신'), progress(i, n)),
      h(
        'div',
        { class: 'q-meta' },
        h('span', { class: 'chip' }, q.category),
        h('span', { class: 'chip ghost' }, TYPE_LABEL[q.type]),
      ),
      h('h1', { class: 'q-title' }, q.title),
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
  const scoreNum = h('span', { class: 'score-num' }, '0');
  const badge = h('div', { class: `score-badge s${sc >= 80 ? 'hi' : sc >= 50 ? 'mid' : 'lo'}` }, scoreNum, h('span', { class: 'score-max' }, '/100'));
  const next = h('button', { class: 'btn primary', type: 'button' }, last ? '결과 보기' : '다음 문제');
  next.addEventListener('click', onNext);

  const showBadge = partialMode() === 'badge' && q.verification === 'partial';
  const verifyLabel = q.verification === 'computed' ? '원자료로 계산' : q.verification === 'partial' ? '일부 수치 재확인 중' : '출처 원문 확인';

  box.replaceChildren(
    h('div', { class: 'result-top' }, badge, comparison),
    block('myth', '흔한 통념', q.myth),
    block('expl', '실제로는', q.explanation),
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
  void tween(700, (t) => {
    scoreNum.textContent = String(Math.round(sc * t));
  });
}

function block(kind: string, title: string, body: string) {
  return h('div', { class: `rblock ${kind}` }, h('h2', {}, title), h('p', {}, body));
}

// ───────── 최종 결과 ─────────
function final(played: Played[]) {
  const total = played.reduce((a, p) => a + p.score, 0);
  const max = played.length * 100;
  const totalNum = h('span', { class: 'final-num' }, '0');
  const shareBtn = h('button', { class: 'btn primary', type: 'button' }, '결과 공유하기');
  const shareMsg = h('p', { class: 'share-msg', role: 'status' });
  const again = h('button', { class: 'btn', type: 'button' }, '한 판 더');
  const text = shareText(played, location.origin + location.pathname);

  shareBtn.addEventListener('click', async () => {
    const r = await share(text);
    shareMsg.textContent = r === 'copied' ? '결과를 복사했어요. 붙여넣어 공유하세요!' : r === 'shared' ? '' : '공유하지 못했어요. 아래 문구를 직접 복사해 주세요.';
    if (r === 'failed') preview.hidden = false;
  });
  again.addEventListener('click', () => startGame());
  const preview = h('pre', { class: 'share-preview', hidden: '' }, text);

  const list = h('ol', { class: 'final-list' });
  for (const p of played) {
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

  mount(
    h(
      'main',
      { class: 'screen final' },
      logo(),
      h('div', { class: 'final-score' }, totalNum, h('span', { class: 'final-max' }, ` / ${max}`)),
      h('p', { class: 'final-rank' }, rankTitle(total, max)),
      h('div', { class: 'final-emoji' }, played.map((p) => scoreEmoji(p.score)).join('')),
      list,
      h('div', { class: 'final-actions' }, shareBtn, again),
      shareMsg,
      preview,
    ),
  );
  void tween(1000, (t) => {
    totalNum.textContent = String(Math.round(total * t));
  });
}

// ───────── 시작 ─────────
async function boot() {
  app.replaceChildren(h('main', { class: 'screen loading' }, logo(), h('p', {}, '문제를 불러오는 중…')));
  try {
    bank = (await loadBank()).questions;
    intro();
  } catch (e) {
    app.replaceChildren(h('main', { class: 'screen loading' }, logo(), h('p', { class: 'error' }, String((e as Error).message))));
  }
}
void boot();
