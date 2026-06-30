# CLAUDE.md — 불경 문답 프로젝트

## 앱 정체성 (개발 전 반드시 숙지)

**"2500년 된 분류 체계로, 지금 내 고통에 이름을 붙이세요."**

이 앱은 AI 챗봇이 아닙니다. ChatGPT/Claude와 다른 점:
- ChatGPT는 공감하지만 분류하지 않음. 이 앱은 **분류**함.
- 매번 다른 답이 아닌 **일관된 구조**(팔고)로 고통을 명명.
- 핵심 기제: Affect Labeling — 감정에 이름 붙이는 행위 자체가 편도체 반응을 줄임.

**포지션**: 불교 심리학 × 정서 진단기. 치료/상담을 주장하지 않고, **인식(awareness)**에 집중.

---

## 개발 원칙 (변경 금지)

1. **로컬 ML 모델 금지 (Vercel 배포 제약)** — multilingual-e5-small 등 임베딩 모델은 번들 50MB 초과·cold start 10초 초과로 Vercel 서버리스에 배포 불가. 키워드+패턴의 일관성이 앱 정체성이자 경쟁 우위이므로 로컬 ML 전환 금지.

   > ⚠️ **정책 구분**: '로컬 ML 모델 금지'와 '외부 LLM API 호출'은 서로 다른 정책이다. 전자는 Vercel Hobby 플랜의 번들 50MB / 콜드스타트 10초 제약 때문에 금지된 것이다. 후자(Anthropic Claude API, OpenAI API 등 외부 호스팅 LLM을 HTTP로 호출하는 것)는 이 제약과 무관하며 원칙적으로 금지 대상이 아니다. 다만 실제 도입 여부는 매 작업마다 별도로 사람의 승인을 받을 것 — 이 문구는 '금지하지 않는다'는 뜻일 뿐 '자동 승인'을 의미하지 않는다.

2. **종교 언어 없음** — 붓다, 세존, 경전명(법구경 등), 팔리어는 UI와 단락에서 사용 금지.
3. **심리학 톤 유지** — 모든 단락(intros.json)은 임상/심리학 언어로. 불교 교리 해설 금지.
4. **접근성 우선** — 로그인 없음, 무료, 즉시 응답 유지.

---

## 핵심 명령어

```bash
npm run dev          # 개발 서버
npm run seed         # data/seed.json → suttas.db + suttas.json
npm run seed:fetch   # SuttaCentral에서 추가 경전 다운로드 후 seed
npm run build        # seed + next build

# 분류 정확도 테스트 (서버 불필요)
PATH="/Users/imingyu/.nvm/versions/node/v24.16.0/bin:$PATH" npx tsx scripts/test10classify.ts
PATH="/Users/imingyu/.nvm/versions/node/v24.16.0/bin:$PATH" npx tsx scripts/test100compound.ts

# 피드백 패턴 후보 추출 (data/feedback.json 필요)
PATH="/Users/imingyu/.nvm/versions/node/v24.16.0/bin:$PATH" npx tsx scripts/extractCandidates.ts
```

---

## 디렉토리 구조

```
buddhist-qa/
├── data/
│   ├── intros.json        ← 팔고×삼독×사성제 44개 조합 심리 단락 (핵심 콘텐츠)
│   ├── seed.json          ← 경전 원본 (레거시, UI 미노출)
│   ├── suttas.json        ← seed 후 생성, Vercel JSON 폴백
│   └── suttas.db          ← seed 후 생성 SQLite (.gitignore)
├── docs/
│   └── roadmap.md         ← 다음 단계 제안서 및 개발 방향
├── lib/
│   ├── types.ts           ← SufferingKey, TruthKey, PoisonKey 등 공유 타입
│   ├── classify.ts        ← 팔고(8)×삼독(3)×사성제(4) 키워드+패턴 분류기
│   ├── normalize.ts       ← 한국어 조사 제거 정규화 (의존성 0, ~3KB)
│   ├── contextOpening.ts  ← 질문 상황 감지 → 단락 첫 문장 동적 생성
│   └── db.ts              ← SQLite 우선, JSON 폴백 (경전 데이터 레이어)
├── scripts/
│   ├── seed.ts               ← DB 구축
│   ├── test10classify.ts     ← 팔고 분류 10개 케이스 검증
│   ├── test100compound.ts    ← 팔고+맥락반영 100개 케이스 배치 테스트
│   └── extractCandidates.ts  ← 피드백 데이터 → 패턴 후보 추출 (검토 전용)
├── app/
│   ├── api/ask/route.ts      ← POST /api/ask
│   ├── api/feedback/route.ts ← POST /api/feedback (Vercel KV / 로컬 파일 fallback)
│   ├── page.tsx              ← 클라이언트 UI ('use client')
│   ├── layout.tsx
│   └── globals.css
└── .claude/agents/
    └── content.md         ← 심리 단락 전문 에이전트 (프로젝트 로컬)
```

---

## 아키텍처

### 데이터 흐름

```
사용자 질문
  → POST /api/ask
  → classify(question)               ← lib/classify.ts
      → 팔고(8) 키워드+패턴 스코어링  ← SUFFERING_KW + SUFFERING_PATTERNS
          score ≥ 1: 결과 사용
          score < 1: needsClarification → 재질문 UX → 재분류
                     재질문 후도 score < 1: 오온성고 확정 제시
      → 삼독(3) 키워드 (없으면 치 기본값)
      → 사성제(4) 키워드 (없으면 고 기본값)
      → { primarySuffering, primaryPoison, primaryTruth }
  → intros.json 조회                 ← key: `{팔고}_{삼독}_{사성제}`
      → { paragraph, closing, header }
  → buildContextualParagraph()       ← lib/contextOpening.ts
      → 질문에서 상황 패턴 감지 → 단락 첫 문장 동적 교체
  → { classification, stages }      → UI 렌더링
```

### 분류 우선순위

**팔고가 1순위.** 삼독·사성제는 intros.json 조합 키 결정에만 사용.

| 축 | 카테고리 수 | 분류 방식 |
|----|------------|---------|
| 팔고 (八苦) | 8 | 키워드+패턴, score < 1 → 재질문 UX → 오온성고 확정 |
| 삼독 (三毒) | 3 | 키워드, 없으면 치(default) |
| 사성제 (四聖諦) | 4 | 키워드, 없으면 고(default) |

### 팔고 키 (SufferingKey)

| 키 | 한자 | 의미 | 심리학 프레임 |
|----|------|------|-------------|
| 생고 | 生苦 | 존재 자체의 무게 | 실존적 불안, 의미치료 |
| 노고 | 老苦 | 늙고 변해가는 두려움 | 신체 자아 이미지 변화, ACT |
| 병고 | 病苦 | 몸과 마음의 아픔 | 통제감 상실, 자기효능감 |
| 사고 | 死苦 | 죽음과 사라짐의 두려움 | death anxiety, 실존주의 |
| 애별리고 | 愛別離苦 | 사랑하는 것과 헤어짐 | 애착 이론, 분리 불안 |
| 원증회고 | 怨憎會苦 | 싫은 것과 함께해야 함 | 통제 불가 혐오 자극, 학습된 무력감 |
| 구부득고 | 求不得苦 | 원해도 얻지 못함 | 미해결 욕구, 좌절-공격 반응 |
| 오온성고 | 五蘊盛苦 | 나라는 존재 자체의 고통 | 메타인지, 감정 세분화 |

### intros.json 구조

```json
{
  "combinations": {
    "구부득고_치_고": {
      "paragraph": "...",    // 심리적 통찰 단락 (3~5문장, 심리학 톤)
      "closing": "...",      // 클로징 문장 (선택)
      "header": "..."        // 팔고 설명 헤더 (선택)
    }
  }
}
```

키 형식: `{팔고}_{삼독}_{사성제}` (예: `애별리고_탐_고`, `원증회고_진_고`)

### DB 전략

| 환경 | 방식 | 파일 |
|------|------|------|
| 로컬 개발 | `better-sqlite3` | `data/suttas.db` |
| Vercel | JSON in-memory | `data/suttas.json` |

경전 데이터(`suttas`)는 현재 UI에서 노출되지 않음. 향후 확장을 위해 유지.

---

## 콘텐츠 원칙

### intros.json 단락 작성 기준

- **구조**: 공감(1문장) → 심리학적 해석(2~3문장) → 통찰/재구성(1문장)
- **톤**: 임상/심리학. "~군요", "~죠", "~이에요" 어조.
- **금지**: 붓다, 경전명, 팔리어, "경전에 따르면", "붓다가 말씀하셨듯이"
- **팔고별 프레임**: 각 팔고마다 적용할 심리학 이론이 정해져 있음 (CLAUDE.md 아키텍처 표 참조)

### contextOpening.ts 패턴 기준

- 30개 상황 패턴으로 질문 맥락 감지 → 단락 첫 문장을 동적으로 교체
- build 함수 반환 문장: 공감, 1~2문장, "~군요" / "~같아요" 어조
- 패턴 추가 시 문법 확인 필수 (캡처 그룹 m[1] 활용 시 어색한 결합 주의)

---

## 코딩 컨벤션

- **언어**: TypeScript strict mode
- **경로 별칭**: `@/lib/...`, `@/app/...` (`tsconfig.json` paths)
- **서버/클라이언트 분리**:
  - `lib/classify.ts`, `lib/contextOpening.ts`, `lib/db.ts` → 서버 전용
  - `lib/types.ts` → 공유 (순수 타입)
  - `app/page.tsx` → `'use client'`, `lib/types.ts`만 import
- **스크립트 실행**: `npx tsx scripts/[파일].ts`
  - top-level await 금지 → `async function main() + main()` 패턴 필수
  - 이유: tsconfig CJS 출력 형식에서 top-level await 미지원
- **주석**: WHY가 자명하지 않을 때만 한 줄

---

## 에이전트 활용 가이드

| 에이전트 | 위치 | 사용 시점 |
|----------|------|-----------|
| planner | `~/.claude/agents/` | 기능 설계, 작업 분해, 로드맵 검토 |
| developer | `~/.claude/agents/` | 코드 구현, 버그 수정 |
| researcher | `~/.claude/agents/` | 기술 트렌드, 경쟁 서비스 조사 |
| qa | `~/.claude/agents/` | 팔고 분류 정확도 검증, API 응답 확인 |
| content | `.claude/agents/` | intros.json 단락 작성·검수, contextOpening 패턴 검토 |

### 전형적인 작업 흐름

**새 팔고 조합 단락 추가:**
```
developer (intros.json 키 구조 파악) → content (단락 작성) → qa (API 응답 검증)
```

**분류 정확도 개선:**
```
qa (오분류 케이스 수집) → developer (classify.ts 키워드/패턴 추가) → qa (재검증)
```

**신규 기능 (고통의 지도 등):**
```
planner (기능 설계) → developer (구현) → qa (기능 테스트)
```

---

## 다음 단계

`docs/roadmap.md` 참조.

우선순위 요약:
1. ~~**오온성고 fallback 개선**~~ — 완료: 재질문 UX + 오온성고 확정 제시 구현
2. ~~**자체 패턴 학습 인프라 1단계**~~ — 완료: normalize.ts(조사 정규화) + scoreKW 통합 + extractCandidates.ts(검토 전용)
   - 2단계(피드백 카테고리 선택 UI): 완료 — "이 분류가 안 맞나요?" → 8개 카테고리 선택 → correctCategory 저장
3. **고통의 지도 MVP** — localStorage 기반 팔고 패턴 기록 + `/history` 페이지
4. **OG 이미지 공유** — "나는 구부득고입니다" 바이럴 기능

---

## Vercel 배포

```bash
vercel deploy        # 배포
npm run build        # 로컬 검증 (seed + next build)
```

`vercel.json`의 `buildCommand`가 자동으로 `npm run seed && next build` 실행.
`data/suttas.json`이 git 커밋되어 SQLite 없이도 동작.

---

## 라이선스 고지

경전 데이터 (UI 미노출, DB 유지):
- SuttaCentral 플랫폼: CC BY 4.0
- Bhikkhu Sujato 번역: CC0 (공공 도메인)
