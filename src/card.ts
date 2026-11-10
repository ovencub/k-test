/** 성적통지표 요약 이미지 (1080×1350, 인스타그램 세로 비율). 캔버스로 그려 PNG로 저장·공유 */

export interface CardRow {
  period: number;
  name: string;
  color: string;
  avg: number | null;
  grade: number | null;
}

export interface CardData {
  year: string;
  title: string;
  modeLabel: string;
  count: number;
  rows: CardRow[];
  avg: number;
  grade: number;
  rank: string;
  site: string;
}

const C = {
  bg: '#f7f5ee',
  paper: '#fbfaf6',
  ink: '#15171f',
  ink2: '#4a4f5c',
  ink3: '#8a8f9b',
  line: '#dcd8ce',
  grid: '#e9e5dc',
  pen: '#d42f2f',
};
const SERIF = '"Noto Serif KR", "Nanum Myeongjo", Batang, serif';
const SANS = '"Pretendard Variable", Pretendard, -apple-system, "Malgun Gothic", sans-serif';

const fmt = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

/** 웹폰트(부분 집합 포함)가 캔버스에 쓰이도록 미리 불러온다. 실패해도 대체 글꼴로 그린다 */
async function loadFonts(text: string) {
  if (!document.fonts?.load) return;
  try {
    await Promise.all([
      document.fonts.load(`900 92px ${SERIF}`, text),
      document.fonts.load(`800 38px ${SERIF}`, text),
      document.fonts.load(`700 34px ${SANS}`, text),
      document.fonts.load(`800 40px ${SANS}`, text),
    ]);
  } catch {
    /* 글꼴을 못 불러와도 계속 */
  }
}

function roundRect(x: CanvasRenderingContext2D, l: number, t: number, w: number, h: number, r: number) {
  x.beginPath();
  x.moveTo(l + r, t);
  x.arcTo(l + w, t, l + w, t + h, r);
  x.arcTo(l + w, t + h, l, t + h, r);
  x.arcTo(l, t + h, l, t, r);
  x.arcTo(l, t, l + w, t, r);
  x.closePath();
}

export async function renderCard(d: CardData): Promise<HTMLCanvasElement> {
  const W = 1080;
  const H = 1350;
  const allText = [d.year, d.title, d.modeLabel, d.rank, d.site, '성적통지표영역점수등급최종평균교시미응시문항공식통계채점대한민국얼마나잘아세요나도응시하기0123456789./→·', ...d.rows.map((r) => r.name)].join('');
  await loadFonts(allText);

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  x.textBaseline = 'alphabetic';

  // 바탕과 테두리
  x.fillStyle = C.bg;
  x.fillRect(0, 0, W, H);
  x.fillStyle = C.paper;
  x.fillRect(40, 40, W - 80, H - 80);
  x.strokeStyle = C.ink;
  x.lineWidth = 4;
  x.strokeRect(40, 40, W - 80, H - 80);
  x.lineWidth = 1.5;
  x.strokeRect(52, 52, W - 104, H - 104);

  // 맨 윗줄
  x.fillStyle = C.ink2;
  x.font = `600 28px ${SANS}`;
  x.fillText(`${d.year} ${d.title}`, 90, 122);
  x.font = `800 30px ${SERIF}`;
  const tag = '성적통지표';
  const tw = x.measureText(tag).width;
  x.strokeStyle = C.ink;
  x.lineWidth = 2.5;
  x.strokeRect(W - 90 - tw - 28, 88, tw + 28, 46);
  x.fillStyle = C.ink;
  x.fillText(tag, W - 90 - tw - 14, 122);
  x.lineWidth = 3;
  x.beginPath();
  x.moveTo(90, 156);
  x.lineTo(W - 90, 156);
  x.moveTo(90, 164);
  x.lineTo(W - 90, 164);
  x.stroke();

  // 제목
  x.fillStyle = C.ink;
  x.font = `900 92px ${SERIF}`;
  x.fillText(d.title, 86, 282);
  x.fillStyle = C.ink3;
  x.font = `600 32px ${SANS}`;
  x.fillText(`${d.modeLabel} · ${d.count}문항 · 공식 통계 채점`, 90, 334);

  // 영역별 표
  const top = 380;
  const headH = 54;
  const rowH = 86;
  const left = 90;
  const right = W - 90;
  x.fillStyle = C.ink;
  x.fillRect(left, top, right - left, headH);
  x.fillStyle = C.bg;
  x.font = `700 24px ${SANS}`;
  x.fillText('영역', left + 24, top + 36);
  x.fillText('점수 (100점 만점)', 380, top + 36);
  x.fillText('등급', right - 92, top + 36);

  d.rows.forEach((r, i) => {
    const y = top + headH + i * rowH;
    if (i > 0) {
      x.strokeStyle = C.grid;
      x.lineWidth = 2;
      x.beginPath();
      x.moveTo(left, y);
      x.lineTo(right, y);
      x.stroke();
    }
    x.fillStyle = r.color;
    x.fillRect(left, y, 10, rowH);
    x.font = `700 24px ${SANS}`;
    x.fillText(`${r.period}교시`, left + 30, y + 33);
    x.fillStyle = C.ink;
    x.font = `800 36px ${SERIF}`;
    x.fillText(r.name, left + 30, y + 72);

    if (r.avg === null) {
      x.fillStyle = C.ink3;
      x.font = `600 30px ${SANS}`;
      x.fillText('미응시', 380, y + 54);
      return;
    }
    x.fillStyle = C.ink;
    x.font = `800 40px ${SANS}`;
    const s = fmt(r.avg);
    x.fillText(s, 380, y + 46);
    const sw = x.measureText(s).width;
    x.fillStyle = C.ink3;
    x.font = `600 24px ${SANS}`;
    x.fillText('점', 380 + sw + 6, y + 46);
    // 막대
    x.fillStyle = C.grid;
    roundRect(x, 380, y + 58, 440, 12, 6);
    x.fill();
    x.fillStyle = r.color;
    roundRect(x, 380, y + 58, Math.max(12, (440 * r.avg) / 100), 12, 6);
    x.fill();
    // 등급 동그라미
    if (r.grade !== null) {
      const cx = right - 66;
      const cy = y + rowH / 2;
      x.strokeStyle = C.pen;
      x.lineWidth = 3.5;
      x.beginPath();
      x.arc(cx, cy, 30, 0, Math.PI * 2);
      x.stroke();
      x.fillStyle = C.pen;
      x.font = `900 34px ${SERIF}`;
      x.textAlign = 'center';
      x.fillText(String(r.grade), cx, cy + 12);
      x.textAlign = 'left';
    }
  });
  const tableBottom = top + headH + d.rows.length * rowH;
  x.strokeStyle = C.ink;
  x.lineWidth = 3;
  x.strokeRect(left, top, right - left, tableBottom - top);

  // 최종 평균
  const sy = tableBottom + 64;
  x.fillStyle = C.ink3;
  x.font = `700 30px ${SANS}`;
  x.fillText('최종 평균 점수', 90, sy);
  x.fillStyle = C.ink;
  x.font = `900 150px ${SERIF}`;
  const a = fmt(d.avg);
  x.fillText(a, 82, sy + 140);
  const aw = x.measureText(a).width;
  x.fillStyle = C.ink3;
  x.font = `700 44px ${SANS}`;
  x.fillText('/ 100', 82 + aw + 14, sy + 140);
  x.fillStyle = C.pen;
  x.font = `800 40px ${SANS}`;
  x.fillText(d.rank, 90, sy + 192);

  // 등급 도장
  x.save();
  x.translate(W - 210, sy + 92);
  x.rotate((-10 * Math.PI) / 180);
  x.strokeStyle = C.pen;
  x.lineWidth = 8;
  x.beginPath();
  x.arc(0, 0, 112, 0, Math.PI * 2);
  x.stroke();
  x.lineWidth = 3;
  x.beginPath();
  x.arc(0, 0, 98, 0, Math.PI * 2);
  x.stroke();
  x.fillStyle = C.pen;
  x.textAlign = 'center';
  x.font = `900 112px ${SERIF}`;
  x.fillText(String(d.grade), 0, 30);
  x.font = `800 32px ${SANS}`;
  x.fillText('등급', 0, 74);
  x.restore();

  // 바닥글
  x.fillStyle = C.ink2;
  x.font = `600 27px ${SANS}`;
  x.textAlign = 'center';
  x.fillText(`대한민국, 얼마나 잘 아세요?  나도 응시하기 → ${d.site}`, W / 2, H - 76);
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
