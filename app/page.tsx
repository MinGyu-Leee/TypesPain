'use client';

import { useState } from 'react';
import type { QueryResult, SufferingKey } from '@/lib/types';

type AppStage = 'question' | 'loading' | 'result';

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
  const [question, setQuestion] = useState('');
  const [stage, setStage]       = useState<AppStage>('question');
  const [result, setResult]     = useState<QueryResult | null>(null);
  const [error, setError]       = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || stage !== 'question') return;
    setError('');
    setResult(null);
    setStage('loading');

    const t0 = Date.now();
    try {
      const res  = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '서버 오류');

      const wait = Math.max(0, 1500 - (Date.now() - t0));
      await new Promise(r => setTimeout(r, wait));

      setResult(data as QueryResult);
      setStage('result');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
      setStage('question');
    }
  }

  function reset() {
    setStage('question');
    setResult(null);
    setError('');
    setQuestion('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <main className="page">
      <header className="site-header">
        <span className="wheel">☸</span>
        <h1>고통의 이름</h1>
        <p className="subtitle">팔고(八苦) 이론으로 마음의 고통을 진단합니다</p>
      </header>

      {stage === 'question' && (
        <QuestionStage
          question={question} setQuestion={setQuestion}
          error={error} onSubmit={handleSubmit}
        />
      )}

      {stage === 'loading' && <LoadingStage />}

      {stage === 'result' && result && (
        <ResultPage result={result} question={question} onReset={reset} />
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
      <span className="loading-wheel">☸</span>
      <p className="loading-text">당신의 마음을 살피고 있어요...</p>
    </div>
  );
}

/* ── 결과 ─────────────────────────────────────────────────────────────────── */

function ResultPage({ result, question, onReset }: { result: QueryResult; question: string; onReset: () => void }) {
  const [feedbackState, setFeedbackState] = useState<'idle' | 'sending' | 'done'>('idle');

  async function handleFeedback() {
    if (feedbackState !== 'idle') return;
    setFeedbackState('sending');
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, classification: result.classification }),
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
          <p className="card-super">당신의 고통은 오래된 이름이 있어요</p>
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
          ) : (
            <button
              type="button"
              className="feedback-btn"
              onClick={handleFeedback}
              disabled={feedbackState === 'sending'}
            >
              {feedbackState === 'sending' ? '전송 중...' : '이 분류가 안 맞나요?'}
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
