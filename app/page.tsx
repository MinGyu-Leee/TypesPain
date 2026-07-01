'use client';

import { useState } from 'react';
import type { QueryResult, SufferingKey } from '@/lib/types';

type AppStage = 'question' | 'loading' | 'needs-clarification' | 'result';

const SUFFERING_INFO: Record<string, { hanja: string; desc: string }> = {
  생고:    { hanja: '生苦',    desc: '존재 자체의 무게' },
  노고:    { hanja: '老苦',    desc: '늙고 변해가는 것의 두려움' },
  병고:    { hanja: '病苦',    desc: '몸과 마음이 아픈 고통' },
  사고:    { hanja: '死苦',    desc: '죽음과 사라짐의 두려움' },
  애별리고: { hanja: '愛別離苦', desc: '사랑하는 것과 헤어지는 고통' },
  원증회고: { hanja: '怨憎會苦', desc: '싫은 것과 함께해야 하는 고통' },
  구부득고: { hanja: '求不得苦', desc: '원해도 얻지 못하는 고통' },
  오온성고: { hanja: '五蘊盛苦', desc: '나라는 존재 자체의 고통' },
};

/* ── Collapsible ─────────────────────────────────────────────────────────── */

function Disclosure({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="disclosure">
      <button
        type="button"
        className="disc-btn"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span>{label}</span>
        <span className={`disc-chevron${open ? ' open' : ''}`}>▾</span>
      </button>
      {open && <div className="disc-body">{children}</div>}
    </div>
  );
}

/* ── Suffering Donut ─────────────────────────────────────────────────────── */

const SUFFERING_ORDER: SufferingKey[] = [
  '생고', '노고', '병고', '사고', '애별리고', '원증회고', '구부득고', '오온성고',
];

// 팔고 짧은 한자 (도넛 중앙 표시용)
const SUFFERING_HANJA_SHORT: Record<SufferingKey, string> = {
  생고:    '生',
  노고:    '老',
  병고:    '病',
  사고:    '死',
  애별리고: '愛',
  원증회고: '怨',
  구부득고: '求',
  오온성고: '蘊',
};

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(
  cx: number, cy: number,
  outerR: number, innerR: number,
  startDeg: number, endDeg: number,
): string {
  const o1 = polarToCartesian(cx, cy, outerR, startDeg);
  const o2 = polarToCartesian(cx, cy, outerR, endDeg);
  const i1 = polarToCartesian(cx, cy, innerR, endDeg);
  const i2 = polarToCartesian(cx, cy, innerR, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return (
    `M ${o1.x} ${o1.y} A ${outerR} ${outerR} 0 ${large} 1 ${o2.x} ${o2.y} ` +
    `L ${i1.x} ${i1.y} A ${innerR} ${innerR} 0 ${large} 0 ${i2.x} ${i2.y} Z`
  );
}

function SufferingDonut({ active }: { active: SufferingKey }) {
  const cx = 120, cy = 120;
  return (
    <svg className="suf-donut" viewBox="0 0 240 240" aria-hidden="true">
      {SUFFERING_ORDER.map((key, i) => {
        const isActive = key === active;
        const startDeg = i * 45 - 90 + 1.5;
        const endDeg   = startDeg + 42;
        const outerR   = isActive ? 110 : 96;
        const innerR   = isActive ? 62  : 64;
        const fill     = isActive ? '#7d2300' : '#efe4cc';
        return (
          <path
            key={key}
            d={describeArc(cx, cy, outerR, innerR, startDeg, endDeg)}
            fill={fill}
          />
        );
      })}
      {/* 중앙 한자 */}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#7d2300"
        fontSize="18"
        fontWeight="700"
      >
        {SUFFERING_HANJA_SHORT[active]}
      </text>
    </svg>
  );
}

/* ── App root ────────────────────────────────────────────────────────────── */

export default function Home() {
  const [question, setQuestion]               = useState('');
  const [stage, setStage]                     = useState<AppStage>('question');
  const [result, setResult]                   = useState<QueryResult | null>(null);
  const [isConfirmedDefault, setIsConfirmedDefault] = useState(false);
  const [error, setError]                     = useState('');

  async function callAPI(text: string, isClarification: boolean) {
    const t0 = Date.now();
    try {
      const res  = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, isClarification }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '서버 오류');

      const wait = Math.max(0, 1500 - (Date.now() - t0));
      await new Promise(r => setTimeout(r, wait));

      const queryResult = data as QueryResult;
      if (!isClarification && queryResult.needsClarification) {
        setStage('needs-clarification');
      } else {
        setResult(queryResult);
        setIsConfirmedDefault(isClarification && !!queryResult.needsClarification);
        setStage('result');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
      setStage(isClarification ? 'needs-clarification' : 'question');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || stage !== 'question') return;
    setError('');
    setResult(null);
    setIsConfirmedDefault(false);
    setStage('loading');
    await callAPI(question.trim(), false);
  }

  async function handleClarification(clarText: string) {
    setError('');
    setStage('loading');
    // 원문 + 보충 텍스트를 합쳐 키워드 매칭 신호 극대화
    await callAPI(`${question.trim()} ${clarText}`, true);
  }

  function reset() {
    setStage('question');
    setResult(null);
    setError('');
    setQuestion('');
    setIsConfirmedDefault(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <main className="page">
      <header className="site-header">
        <svg className="wheel" width="34" height="6" viewBox="0 0 34 6" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <circle cx="3"  cy="3" r="3" fill="currentColor"/>
          <circle cx="17" cy="3" r="3" fill="currentColor"/>
          <circle cx="31" cy="3" r="3" fill="currentColor"/>
        </svg>
        <h1>마음결</h1>
        <p className="subtitle">감정에 이름을 붙이는 시간</p>
      </header>

      {stage === 'question' && (
        <QuestionStage
          question={question} setQuestion={setQuestion}
          error={error} onSubmit={handleSubmit}
        />
      )}

      {stage === 'loading' && <LoadingStage />}

      {stage === 'needs-clarification' && (
        <ClarificationStage
          originalQuestion={question}
          error={error}
          onSubmit={handleClarification}
          onReset={reset}
        />
      )}

      {stage === 'result' && result && (
        <ResultPage
          result={result}
          question={question}
          isConfirmedDefault={isConfirmedDefault}
          onReset={reset}
        />
      )}
    </main>
  );
}

/* ── 질문 입력 ────────────────────────────────────────────────────────────── */

function QuestionStage({ question, setQuestion, error, onSubmit }: {
  question: string; setQuestion: (v: string) => void;
  error: string; onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form className="ask-form" onSubmit={onSubmit}>
      <textarea
        className="ask-textarea"
        value={question}
        onChange={e => setQuestion(e.target.value)}
        placeholder="지금 마음이 어떠세요?"
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey))
            onSubmit(e as unknown as React.FormEvent);
        }}
      />
      {error && <p className="error-msg">{error}</p>}
      <button className="submit-btn" type="submit" disabled={!question.trim()}>
        말하기
      </button>
    </form>
  );
}

/* ── 로딩 ─────────────────────────────────────────────────────────────────── */

function LoadingStage() {
  return (
    <div className="loading-stage">
      <svg className="loading-wheel" width="46" height="10" viewBox="0 0 46 10" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="5"  cy="5" r="5" fill="currentColor"/>
        <circle cx="23" cy="5" r="5" fill="currentColor"/>
        <circle cx="41" cy="5" r="5" fill="currentColor"/>
      </svg>
      <p className="loading-text">당신의 마음을 살피고 있어요...</p>
    </div>
  );
}

/* ── 재질문 ───────────────────────────────────────────────────────────────── */

// 배고픔·졸림·추위·더위·갈증·피곤처럼 즉각적인 신체 욕구를 표현한 입력 감지
const PRIMARY_NEED_RE = /배고파|배\s*가?\s*고파|졸려|추워|더워|목이?\s*말라|갈증|피곤해/;

function ClarificationStage({
  originalQuestion,
  error,
  onSubmit,
  onReset,
}: {
  originalQuestion: string;
  error: string;
  onSubmit: (text: string) => void;
  onReset: () => void;
}) {
  const [text, setText] = useState('');
  const isPrimaryNeed = PRIMARY_NEED_RE.test(originalQuestion);

  const clarPrompt = isPrimaryNeed
    ? '그 욕구를 채우지 못하게 막는 게 뭔가요?'
    : '어떤 상황인지 조금 더 이야기해 주실 수 있나요?';

  const clarHint = isPrimaryNeed
    ? '예: 돈이 없어서, 몸이 아파서, 집이 없어서, 일이 너무 힘들어서 등'
    : '예: 누군가와의 관계, 건강, 일, 경제적 어려움, 원하는 것을 갖지 못함, 상실 중 어떤 부분이 가장 와닿나요?';

  return (
    <div className="clarif-wrap">
      <div className="clarif-card">
        <p className="clarif-echo">"{originalQuestion}"</p>
        <p className="clarif-prompt">{clarPrompt}</p>
        <p className="clarif-hint">{clarHint}</p>
        <textarea
          className="ask-textarea"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="조금 더 말해주세요..."
          autoFocus
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim())
              onSubmit(text.trim());
          }}
        />
        {error && <p className="error-msg">{error}</p>}
        <button
          className="submit-btn"
          type="button"
          onClick={() => text.trim() && onSubmit(text.trim())}
          disabled={!text.trim()}
        >
          계속하기
        </button>
      </div>
      <button type="button" className="reset-btn" onClick={onReset}>
        ← 처음으로
      </button>
    </div>
  );
}

/* ── 결과 ─────────────────────────────────────────────────────────────────── */

function ResultPage({
  result,
  question,
  isConfirmedDefault,
  onReset,
}: {
  result: QueryResult;
  question: string;
  isConfirmedDefault: boolean;
  onReset: () => void;
}) {
  const [feedbackState, setFeedbackState] = useState<'idle' | 'selecting' | 'sending' | 'done'>('idle');

  async function handleCategorySelect(correctCategory: string) {
    setFeedbackState('sending');
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, classification: result.classification, correctCategory }),
      });
    } finally {
      setFeedbackState('done');
    }
  }

  const { classification, stages } = result;
  const sufKey  = classification.primarySuffering;
  const sufInfo = SUFFERING_INFO[sufKey] ?? { hanja: '', desc: '' };

  return (
    <div className="result-page">
      <div className="result-card">

        {/* 헤더 */}
        <div className="card-top">
          {isConfirmedDefault ? (
            <>
              <p className="card-super">이 감정의 이름은 오온성고(五蘊盛苦)입니다</p>
              <p className="confirmed-desc">
                이유도 모른 채 무겁고 공허한 느낌 — 그것 자체가 인식될 때 비로소 이름이 생깁니다.
              </p>
            </>
          ) : (
            <p className="card-super">당신의 감정에는 오래된 이름이 있어요</p>
          )}
        </div>

        {/* 접기 1: 어떤 괴로움인지 */}
        <Disclosure label="어떤 괴로움인지 보기">
          <div className="suf-reveal">
            <SufferingDonut active={sufKey as SufferingKey} />
            <div className="suf-name-row">
              <span className="suf-name">{sufKey}</span>
              <span className="suf-hanja">{sufInfo.hanja}</span>
            </div>
            <p className="suf-desc">{sufInfo.desc}</p>
            {stages.combination.header && (
              <p className="suf-context">{stages.combination.header}</p>
            )}
          </div>
        </Disclosure>

        <hr className="card-rule" />

        {/* 심리적 통찰 */}
        <div className="insight-section">
          <span className="insight-label">심리적 통찰</span>
          <p className="insight-para">{stages.combination.paragraph}</p>
          {stages.combination.closing && (
            <p className="insight-closing">{stages.combination.closing}</p>
          )}
        </div>

        <div className="feedback-row">
          {feedbackState === 'done' ? (
            <span className="feedback-thanks">피드백 감사해요.</span>
          ) : feedbackState === 'selecting' ? (
            <div className="feedback-selector">
              <p className="feedback-selector-label">어떤 고통에 더 가깝나요?</p>
              <div className="feedback-cats">
                {SUFFERING_ORDER.map(key => (
                  <button
                    key={key}
                    type="button"
                    className="feedback-cat-btn"
                    onClick={() => handleCategorySelect(key)}
                  >
                    <span className="fcat-name">{key}</span>
                    <span className="fcat-desc">{SUFFERING_INFO[key].desc}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="feedback-cancel-btn"
                onClick={() => setFeedbackState('idle')}
              >
                취소
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="feedback-btn"
              onClick={() => setFeedbackState('selecting')}
              disabled={feedbackState === 'sending'}
            >
              이 분류가 안 맞나요?
            </button>
          )}
        </div>

      </div>

      <button type="button" className="reset-btn" onClick={onReset}>
        ← 다시 말하기
      </button>
    </div>
  );
}
