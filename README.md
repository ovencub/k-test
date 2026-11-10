# 대한민국 통계고사 (K-test)

대한민국, 얼마나 잘 아세요? 경제·사회·정치·건강·생활·한국지리 여섯 교시로 나뉜 문제를 감으로 "찍고" 공식 통계로 채점받는 웹 게임. (옛 이름: 찍신 ZZIK SIN) 막대를 올리고, 추세선을 긋고, 파이를 나눈 뒤 실제 값과 비교해 보세요. 모든 문제에 출처와 "이 숫자만으로 말할 수 없는 것"을 함께 보여줍니다.

**플레이:** https://ovencub.github.io/k-test/

- 빠른 응시(6교시 × 2문항 = 12문항 · 약 6분) 또는 실전 응시(6교시 × 5문항 = 30문항 · 약 15분) · 문제은행 430문제
- 풀이 중에는 점수를 숨기고, 시험이 끝나면 영역별 점수 → 최종 평균 → 등급 순으로 발표 (등급은 임시 절대평가 기준)
- 성적표 이미지(1080×1350) 저장, 결과 링크(`?r=`) 공유 — 받은 사람은 성적표를 보고 바로 응시
- 문제 형식 7종: 막대 맞추기 / 추세선 그리기 / 도넛·파이 나누기 / 분포도 그리기 / 버블 크기 맞추기 / 숫자 찍기
- 수치·출처가 틀렸다면 결과 화면의 **오류 제보** 링크나 [이슈](https://github.com/ovencub/k-test/issues)로 알려 주세요.

## 개발

Vite · TypeScript · Vitest. 프레임워크 없이 DOM + SVG.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 채점·출제 로직 테스트 (전 문항 정답 시 100점 검사 포함)
npm run build      # dist/ 정적 파일
```

`main` 브랜치에 푸시하면 GitHub Actions가 문제은행 검증 → 테스트 → 빌드 → GitHub Pages 배포를 한다.

설계 의도 `ZZIKSIN_기획문서.md` · 구현 스펙(채점 공식·UI 규칙) `spec.md`.

## 문제 수정

1. `build_questions.py`에서 문제를 고친다 (문제은행의 원본).
2. `python build_questions.py` → 검증 통과 시 `questions.json` 재생성.
3. 두 파일을 함께 커밋한다. 어긋나 있으면 배포가 멈춘다.

## 검수용 URL 옵션

| 옵션 | 예 | 설명 |
|---|---|---|
| `?q=` | `?q=Q001,Q060` | 지정한 문제만 순서대로 출제 |
| `?partial=` | `?partial=hide` | 일부 수치 재확인 중인 문제 노출 방식 `show` / `badge`(기본) / `hide` |

채점 상수는 `src/scoring.ts`의 `TUNING`. 교시(영역) 구성과 등급 기준은 `src/subjects.ts`, 교시당 문항 수는 `src/config.ts`의 `QUESTIONS_PER_SUBJECT`. 공유 미리보기 이미지는 `python tools/make-og.py`로 다시 만든다.
