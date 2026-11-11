# public/og.png (1200x630, 링크 미리보기) + public/apple-touch-icon.png (180x180)
# 실행: python tools/make-og.py   (Windows 맑은 고딕 굵게 사용)
# 작게 줄여도 제목과 한 줄 소개가 읽히도록 큰 글자 두 덩어리만 둔다
from PIL import Image, ImageDraw, ImageFont

CREAM, INK, COBALT, LIME = '#FFF8EA', '#191B28', '#2346E8', '#D4F45B'
GUESS = '#FF6A3D'
FONT = 'C:/Windows/Fonts/malgunbd.ttf'
f = lambda s: ImageFont.truetype(FONT, s)


def og():
    W, H = 1200, 630
    im = Image.new('RGB', (W, H), COBALT)
    d = ImageDraw.Draw(im)

    # 제목: "그 정도라고" + 라임 물음표 칩
    title = '그 정도라고'
    tf = f(150)
    d.text((70, 92), title, font=tf, fill=CREAM)
    tw = d.textlength(title, font=tf)
    qx = 70 + tw + 18
    d.rounded_rectangle([qx, 112, qx + 112, 262], 26, fill=LIME)
    d.text((qx + 56, 190), '?', font=f(140), fill=INK, anchor='mm')

    # 한 줄 소개
    d.text((74, 318), '한국의 진짜 숫자,', font=f(64), fill=CREAM)
    d.text((74, 398), '감으로 맞혀보는 게임.', font=f(64), fill=CREAM)

    # 바닥: 크림 띠 + 내 답/실제 숫자 카드
    d.rectangle([0, 520, W, H], fill=CREAM)
    d.text((74, 575), '12문제 · 약 6분 · 공식 통계로 채점', font=f(34), fill=INK, anchor='lm')
    # 오른쪽 작은 비교 카드
    d.rounded_rectangle([830, 300, 1130, 490], 22, fill=CREAM)
    d.text((860, 345), '내 답', font=f(28), fill=GUESS, anchor='lm')
    d.text((1100, 345), '32%', font=f(44), fill=GUESS, anchor='rm')
    d.line([(860, 395), (1100, 395)], fill='#E8DCC4', width=3)
    d.text((860, 445), '실제', font=f(28), fill=COBALT, anchor='lm')
    d.text((1100, 445), '?', font=f(52), fill=COBALT, anchor='rm')

    im.save('public/og.png')
    print('saved public/og.png')


def icon():
    S = 180
    im = Image.new('RGB', (S, S), COBALT)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([36, 36, 144, 144], 28, fill=LIME)
    d.text((S // 2, S // 2 + 4), '?', font=f(110), fill=INK, anchor='mm')
    im.save('public/apple-touch-icon.png')
    print('saved public/apple-touch-icon.png')


if __name__ == '__main__':
    og()
    icon()
