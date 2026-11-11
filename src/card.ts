/** 결과 요약 이미지 (1080×1350, 인스타그램 세로 비율). 캔버스로 그려 PNG로 저장·공유 */

export interface CardRow {
  name: string;
  color: string;
  avg: number | null;
}

export interface CardData {
  title: string;
  modeLabel: string;
  count: number;
  rows: CardRow[];
  avg: number;
  grade: number;
  nick: string;
  hardest: string;
  site: string;
}

const C = {
  cream: '#FFF8EA',
  ink: '#191B28',
  ink3: '#6B6F80',
  cobalt: '#2346E8',
  lime: '#D4F45B',
  track: '#EDE4D0',
};
const SANS = '"Pretendard Variable", Pretendard, -apple-system, "Malgun Gothic", sans-serif';

const fmt = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

/** 웹폰트(부분 집합 포함)가 캔버스에 쓰이도록 미리 불러온다. 실패해도 대체 글꼴로 그린다 */
async function loadFonts(text: string) {
  if (!document.fonts?.load) return;
  try {
    await Promise.all([900, 800, 700, 600].map((w) => document.fonts.load(`${w} 40px ${SANS}`, text)));
  } catch {
    /* 글꼴을 못 불러와도 계속 */
  }
}

function roundRect(x: CanvasRenderingContext2D, l: number, t: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  x.beginPath();
  x.moveTo(l + rr, t);
  x.arcTo(l + w, t, l + w, t + h, rr);
  x.arcTo(l + w, t + h, l, t + h, rr);
  x.arcTo(l, t + h, l, t, rr);
  x.arcTo(l, t, l + w, t, rr);
  x.closePath();
}

/** 결과 요약 이미지 1080×1350. 정답은 넣지 않고 점수·별명·주제 결과만 */
export async function renderCard(d: CardData): Promise<HTMLCanvasElement> {
  const W = 1080;
  const H = 1350;
  const allText = [d.title, d.modeLabel, d.nick, d.hardest, d.site, '내 결과점평균 점수100만점너는 몇 나올 것 같아?→0123456789.·', ...d.rows.map((r) => r.name)].join('');
  await loadFonts(allText);

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  x.textBaseline = 'alphabetic';
  x.fillStyle = C.cream;
  x.fillRect(0, 0, W, H);

  // 코발트 점수 카드
  const P = 60;
  x.fillStyle = C.cobalt;
  roundRect(x, P, P, W - 2 * P, 640, 48);
  x.fill();

  x.font = `900 60px ${SANS}`;
  x.fillStyle = C.cream;
  x.fillText('그 정도라고', P + 56, P + 112);
  const lw = x.measureText('그 정도라고').width;
  x.fillStyle = C.lime;
  x.fillText('?', P + 56 + lw + 4, P + 112);

  x.font = `600 30px ${SANS}`;
  x.fillStyle = 'rgba(255,248,234,0.75)';
  x.fillText(`내 결과 · ${d.modeLabel}`, P + 56, P + 176);

  // 별명: 라임 알약
  x.font = `800 46px ${SANS}`;
  const nw = x.measureText(d.nick).width;
  x.fillStyle = C.lime;
  roundRect(x, P + 48, P + 214, nw + 56, 82, 41);
  x.fill();
  x.fillStyle = C.ink;
  x.fillText(d.nick, P + 76, P + 270);

  // 평균 점수
  x.fillStyle = C.cream;
  x.font = `900 230px ${SANS}`;
  const a = fmt(d.avg);
  x.fillText(a, P + 44, P + 520);
  const aw = x.measureText(a).width;
  x.font = `800 72px ${SANS}`;
  x.fillText('점', P + 44 + aw + 12, P + 520);
  x.font = `600 30px ${SANS}`;
  x.fillStyle = 'rgba(255,248,234,0.75)';
  x.fillText('평균 점수 · 100점 만점', P + 56, P + 586);

  // 가장 어려웠던 주제
  let y = P + 640 + 84;
  if (d.hardest) {
    x.fillStyle = C.ink;
    x.font = `800 34px ${SANS}`;
    x.fillText(d.hardest, P + 6, y);
  }

  // 주제별 막대
  y += 40;
  const rowH = 68;
  d.rows.forEach((r, i) => {
    const ry = y + i * rowH;
    x.fillStyle = C.ink;
    x.font = `700 30px ${SANS}`;
    x.fillText(r.name, P + 6, ry + 42);
    const bx = 330;
    const bw = 540;
    x.fillStyle = C.track;
    roundRect(x, bx, ry + 22, bw, 22, 11);
    x.fill();
    x.textAlign = 'right';
    if (r.avg === null) {
      x.fillStyle = C.ink3;
      x.font = `600 28px ${SANS}`;
      x.fillText('–', W - P - 6, ry + 44);
    } else {
      x.fillStyle = r.color;
      roundRect(x, bx, ry + 22, Math.max(22, (bw * r.avg) / 100), 22, 11);
      x.fill();
      x.fillStyle = C.ink;
      x.font = `800 32px ${SANS}`;
      x.fillText(fmt(r.avg), W - P - 6, ry + 44);
    }
    x.textAlign = 'left';
  });

  // 바닥글
  x.fillStyle = C.cobalt;
  x.font = `800 32px ${SANS}`;
  x.textAlign = 'center';
  x.fillText(`너는 몇 점 나올 것 같아?  →  ${d.site}`, W / 2, H - 62);
  x.textAlign = 'left';
  return c;
}

export function canvasBlob(c: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((r) => c.toBlob(r, 'image/png'));
}

/** 휴대폰은 공유 시트(사진 저장 포함), 그 밖은 파일 내려받기 */
export async function saveImage(blob: Blob, filename: string, text: string): Promise<'shared' | 'downloaded' | 'failed'> {
  const file = new File([blob], filename, { type: 'image/png' });
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'failed';
    }
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
