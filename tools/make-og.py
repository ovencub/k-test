# public/og.png (1200x630, 공유 미리보기) + public/apple-touch-icon.png (180x180)
# 실행: python tools/make-og.py   (Windows 맑은 고딕 굵게 사용)
from PIL import Image, ImageDraw, ImageFont

BG, INK, INK3, ANCHOR = '#f5f3ee', '#15171f', '#8a8f9b', '#a3a8b4'
GUESS, ACTUAL, CARD, LINE = '#ff6a3d', '#2f5bea', '#ffffff', '#e3e0d8'
FONT = 'C:/Windows/Fonts/malgunbd.ttf'
f = lambda s: ImageFont.truetype(FONT, s)


def dashed_rect(d, box, color, width=5, dash=16, gap=10):
    x0, y0, x1, y1 = box
    for (a, b, horiz, fixed) in ((x0, x1, True, y0), (x0, x1, True, y1), (y0, y1, False, x0), (y0, y1, False, x1)):
        p = a
        while p < b:
            q = min(p + dash, b)
            d.line([(p, fixed), (q, fixed)] if horiz else [(fixed, p), (fixed, q)], fill=color, width=width)
            p = q + gap


def og():
    W, H = 1200, 630
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)

    # 왼쪽: 제목
    d.text((70, 92), '찍신', font=f(168), fill=INK)
    d.text((80, 300), 'ZZIK SIN', font=f(40), fill=GUESS)
    d.text((70, 392), '말싸움 붙는 그 숫자,', font=f(44), fill=INK)
    d.text((70, 452), '감으로 찍고 통계로 확인!', font=f(44), fill=INK)
    d.text((70, 540), '5문제 · 2분 · 모든 문제에 출처', font=f(28), fill=INK3)

    # 오른쪽: 막대 맞추기 카드
    cx0, cy0, cx1, cy1 = 690, 70, 1140, 560
    d.rounded_rectangle([cx0, cy0, cx1, cy1], 36, fill=CARD, outline=LINE, width=3)
    base = 470
    for gy in (190, 250, 310, 370, 430):
        d.line([(730, gy), (1100, gy)], fill='#ebe8e1', width=2)
    d.line([(730, base), (1100, base)], fill=INK3, width=4)
    # 기준 막대
    d.rounded_rectangle([760, 250, 860, base], 8, fill=ANCHOR)
    # 특정 이슈를 대표 이미지로 쓰지 않도록 라벨은 중립적으로
    # 내 답(점선) + 실제(파랑)
    d.rounded_rectangle([950, 340, 1050, base], 8, fill=ACTUAL)
    dashed_rect(d, (950, 160, 1050, base), GUESS)
    d.text((1000, 132), '내 답', font=f(30), fill=GUESS, anchor='mm')
    d.text((1000, 312), '실제', font=f(30), fill=ACTUAL, anchor='mm')
    d.text((810, 505), '기준', font=f(28), fill=INK, anchor='mm')
    d.text((1000, 505), '?', font=f(34), fill=INK, anchor='mm')

    im.save('public/og.png')
    print('saved public/og.png')


def icon():
    S = 180
    im = Image.new('RGB', (S, S), INK)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([34, 84, 64, 146], 5, fill=ANCHOR)
    d.rounded_rectangle([76, 52, 106, 146], 5, fill=ACTUAL)
    dashed_rect(d, (118, 30, 148, 146), GUESS, width=5, dash=12, gap=8)
    im.save('public/apple-touch-icon.png')
    print('saved public/apple-touch-icon.png')


if __name__ == '__main__':
    og()
    icon()
