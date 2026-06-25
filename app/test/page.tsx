'use client';

import { useState, useRef } from 'react';
import type { QueryResult } from '@/lib/types';

const DEFAULT_QUESTIONS = `여자친구랑 헤어짐
남자친구가 바람을 피웠어요
짝사랑이 너무 힘들어요
이별 후 너무 그리워요
전 남자친구가 잊히질 않아요
좋아하는 사람이 있는데 고백을 못 하겠어요
결혼 생활이 너무 힘들어요
이혼을 고민하고 있어요
남편이 나를 무시해요
배우자가 바람을 피웠어요
부부 사이가 너무 멀어졌어요
솔로인 게 너무 외로워요
사랑했는데 배신당했어요
연애를 못 해서 외로워요
사랑하는 사람이 나를 떠났어요
취업이 안 됩니다
시험에 자꾸 떨어져요
직장 상사가 너무 힘들어요
번아웃이 왔어요
직장을 그만두고 싶어요
일이 너무 많아서 지쳐요
승진을 못 해서 속상해요
공부를 해도 성적이 안 올라요
취업 준비가 너무 힘들어요
직장 동료들과 사이가 나빠요
일을 잘 못 하는 것 같아요
사업이 실패했어요
직장에서 해고됐어요
공부가 하기 싫어요
열심히 했는데 안 돼요
부모님이 너무 싫어요
아버지가 돌아가셨어요
어머니가 암 진단을 받으셨어요
부모님이 이혼하셨어요
형제자매와 사이가 나빠요
부모님 기대가 너무 부담돼요
가족이 나를 이해 못 해요
아이 키우는 게 너무 힘들어요
가족이 아파서 간호하는 게 지쳐요
할머니가 돌아가셨어요
친구가 배신했어요
외로워요
친구가 없어요
왕따를 당하고 있어요
뒤에서 욕하는 사람이 있어요
인간관계가 너무 피곤해요
사람들이 나를 싫어하는 것 같아요
주변에 아무도 없는 것 같아요
믿었던 친구한테 상처받았어요
사람들과 어울리는 게 힘들어요
어딜 가도 겉돌아요
나만 빼고 다들 잘 지내는 것 같아요
돈이 없어서 너무 힘들어요
빚이 너무 많아요
가난이 너무 힘들어요
실직을 해서 막막해요
돈 때문에 가족이 싸워요
갑자기 수입이 끊겼어요
노후 걱정이 너무 돼요
돈이 많아도 행복하지 않아요
몸이 아파서 우울해요
우울증인 것 같아요
불안이 너무 심해요
공황장애가 있어요
잠을 못 자요
만성 통증이 있어요
병원에서 나쁜 진단을 받았어요
왜 살아야 할지 모르겠어요
삶의 의미를 모르겠어요
죽음이 두려워요
미래가 너무 불안해요
매일 불안하고 두근거려요
내가 너무 싫어요
존재 자체가 힘들어요
아무것도 하기 싫어요
세상이 너무 불공평해요
내 삶이 잘못된 것 같아요
나는 왜 이렇게 태어났을까요
행복이 뭔지 모르겠어요
화가 너무 자주 나요
화가 나서 미치겠어요
억울해서 잠이 안 와요
질투심이 너무 심해요
남들이 잘 되는 게 배가 아파요
나만 이렇게 힘든 것 같아요
집착을 버리고 싶어요
욕심을 줄이고 싶어요
감정 조절이 안 돼요
화를 참을 수가 없어요
진짜 너무 힘들어
모든 걸 다 놓아버리고 싶어
이게 맞는 건지 모르겠어요
명상을 어떻게 시작해야 하나요
집착에서 벗어나는 방법이 있을까요
마음이 텅 빈 것 같아요
다 포기하고 싶어요
자꾸 눈물이 나요
내 인생이 왜 이럴까요
아무도 나를 이해 못 해요`.trim();

interface Row {
  question:   string;
  suffering:  string;
  poison:     string;
  truth:      string;
  suttaCount: number;
  paragraph:  string;
  closing:    string;
  suttaList:  string;
  comboKey:   string;
  error?:     string;
}

function downloadCSV(rows: Row[]) {
  const header = ['질문', '팔고분류', '삼독분류', '사성제분류', '매칭경전수', '단락전체', '마무리문장', '매칭경전목록'];
  const esc    = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines  = rows.map(r =>
    [r.question, r.suffering, r.poison, r.truth, r.suttaCount, r.paragraph, r.closing, r.suttaList]
      .map(esc).join(',')
  );
  const csv  = '﻿' + [header.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url, download: `bq-test-${new Date().toISOString().slice(0, 10)}.csv`,
  });
  a.click();
  URL.revokeObjectURL(url);
}

const SUFFERING_KO: Record<string, string> = {
  생고: '생고(生苦)', 노고: '노고(老苦)', 병고: '병고(病苦)', 사고: '사고(死苦)',
  애별리고: '애별리고', 원증회고: '원증회고', 구부득고: '구부득고', 오온성고: '오온성고',
};
const POISON_KO:   Record<string, string> = { 탐: '탐(貪)', 진: '진(瞋)', 치: '치(癡)' };
const TRUTH_KO:    Record<string, string> = { 고: '고(苦)', 집: '집(集)', 멸: '멸(滅)', 도: '도(道)' };
const TRUTH_COLOR:  Record<string, string> = { 고: '#7d2300', 집: '#6b4200', 멸: '#1b5e20', 도: '#1a3c6b' };
const POISON_COLOR: Record<string, string> = { 탐: '#880e4f', 진: '#b71c1c', 치: '#4a148c' };
const SUFF_COLOR = '#4e342e';

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 9px', borderRadius: 12,
      background: color, color: '#fff', fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap',
    }}>{label}</span>
  );
}

export default function TestPage() {
  const [rawQuestions, setRawQuestions] = useState(DEFAULT_QUESTIONS);
  const [results,      setResults]      = useState<Row[]>([]);
  const [running,      setRunning]      = useState(false);
  const [progress,     setProgress]     = useState(0);
  const stoppedRef = useRef(false);

  const questions = rawQuestions.split('\n').map(q => q.trim()).filter(Boolean);
  const done      = results.length;
  const total     = questions.length;
  const pct       = total > 0 ? Math.round((done / total) * 100) : 0;
  const hasData   = results.length > 0;

  async function runAll() {
    stoppedRef.current = false;
    setRunning(true);
    setResults([]);
    setProgress(0);

    for (let i = 0; i < questions.length; i++) {
      if (stoppedRef.current) break;
      setProgress(i + 1);
      const q = questions[i];
      try {
        const res  = await fetch('/api/ask', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q }),
        });
        const data: QueryResult = await res.json();
        if (!res.ok) throw new Error((data as { error?: string }).error ?? '오류');
        const { classification, stages, suttas } = data;
        const poison0 = classification.primaryPoisons[0];
        setResults(prev => [...prev, {
          question:   q,
          suffering:  classification.primarySuffering,
          poison:     poison0,
          truth:      classification.primaryTruth,
          suttaCount: suttas.length,
          paragraph:  stages.combination.paragraph,
          closing:    stages.combination.closing,
          suttaList:  suttas.map(s => s.source_ref).join(', '),
          comboKey:   `${classification.primarySuffering}_${poison0}_${classification.primaryTruth}`,
        }]);
      } catch (err) {
        setResults(prev => [...prev, {
          question: q, suffering: '-', poison: '-', truth: '-',
          suttaCount: 0, paragraph: '-', closing: '-', suttaList: '-', comboKey: '-',
          error: err instanceof Error ? err.message : '오류',
        }]);
      }
      if (i < questions.length - 1) await new Promise(r => setTimeout(r, 100));
    }
    setRunning(false);
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px 80px', fontFamily: '"Noto Serif KR", serif', color: '#2d1e10' }}>

      {/* 헤더 */}
      <div style={{ marginBottom: 28 }}>
        <a href="/" style={{ fontSize: 12.5, color: '#7a5c3d', textDecoration: 'none' }}>← 앱으로</a>
        <h1 style={{ fontSize: '1.4rem', color: '#7d2300', marginTop: 8, letterSpacing: '0.04em' }}>분류 테스트 도구</h1>
        <p style={{ fontSize: 12.5, color: '#7a5c3d', marginTop: 3 }}>
          질문 일괄 실행 · 분류 결과 수집 · CSV 다운로드
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 24, alignItems: 'start' }}>

        {/* 왼쪽: 질문 목록 */}
        <div>
          <label style={{ display: 'block', fontSize: 11, letterSpacing: '0.1em', color: '#7a5c3d', marginBottom: 6, textTransform: 'uppercase' }}>
            테스트 질문 ({total}개 · 한 줄에 하나)
          </label>
          <textarea
            value={rawQuestions}
            onChange={e => setRawQuestions(e.target.value)}
            disabled={running}
            rows={30}
            style={{
              width: '100%', padding: '11px 13px',
              border: '1.5px solid #d9c9a8', borderRadius: 8,
              background: '#fff9f0', color: '#2d1e10',
              fontFamily: 'inherit', fontSize: 13,
              resize: 'vertical', lineHeight: 1.65,
            }}
          />
        </div>

        {/* 오른쪽: 컨트롤 + 요약 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* 버튼 */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={runAll} disabled={running || total === 0} style={{
              padding: '10px 28px', background: running ? '#bbb' : '#7d2300',
              color: '#fffaf0', border: 'none', borderRadius: 6,
              fontFamily: 'inherit', fontSize: 13.5, cursor: running ? 'not-allowed' : 'pointer',
              letterSpacing: '0.04em',
            }}>
              {running ? `실행 중… ${done}/${total}` : '▶ 전체 실행'}
            </button>
            {running && (
              <button onClick={() => { stoppedRef.current = true; }} style={{
                padding: '10px 18px', background: '#fff',
                border: '1.5px solid #d9c9a8', borderRadius: 6,
                fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', color: '#7a5c3d',
              }}>중단</button>
            )}
            {hasData && !running && (
              <button onClick={() => downloadCSV(results)} style={{
                padding: '10px 18px', background: '#fff',
                border: '1.5px solid #9a7030', borderRadius: 6,
                fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', color: '#9a7030',
              }}>CSV 다운로드 ↓</button>
            )}
          </div>

          {/* 프로그레스 바 */}
          {(running || (hasData && done > 0)) && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#7a5c3d', marginBottom: 5 }}>
                <span>{done} / {total} 완료</span><span>{pct}%</span>
              </div>
              <div style={{ height: 6, background: '#ecdfc0', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: '#9a7030', borderRadius: 3, transition: 'width 0.25s ease' }} />
              </div>
            </div>
          )}

          {/* 분포 요약 */}
          {hasData && <DistSummary results={results} />}
        </div>
      </div>

      {/* 결과 테이블 */}
      {hasData && (
        <div style={{ marginTop: 36 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 11.5, letterSpacing: '0.1em', color: '#7a5c3d', textTransform: 'uppercase' }}>
              결과 ({done}개)
            </span>
            <button onClick={() => downloadCSV(results)} style={{
              padding: '6px 16px', background: '#fff',
              border: '1.5px solid #9a7030', borderRadius: 5,
              fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', color: '#9a7030',
            }}>CSV 다운로드 ↓</button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #d9c9a8', background: '#fff9f0' }}>
                  {[
                    ['#',       '32px',  'center'],
                    ['질문',    '160px', 'left'],
                    ['팔고',    '96px',  'left'],
                    ['삼독',    '72px',  'left'],
                    ['사성제',  '72px',  'left'],
                    ['경전수',  '52px',  'center'],
                    ['단락전체','320px', 'left'],
                    ['마무리',  '200px', 'left'],
                    ['경전목록','160px', 'left'],
                  ].map(([h, w, a]) => (
                    <th key={h} style={{
                      padding: '9px 10px', textAlign: a as 'left' | 'center', minWidth: w,
                      fontSize: 11, letterSpacing: '0.08em', color: '#7a5c3d',
                      textTransform: 'uppercase', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((row, i) => (
                  <tr key={i} style={{
                    borderBottom: '1px solid #ecdfc0',
                    background: row.error ? '#fdecea' : (i % 2 === 0 ? '#fff9f0' : 'transparent'),
                    verticalAlign: 'top',
                  }}>
                    <td style={{ padding: '9px 10px', color: '#a89880', fontSize: 11.5, textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ padding: '9px 10px', color: '#2d1e10', lineHeight: 1.5 }}>{row.question}</td>
                    <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                      {row.error
                        ? <span style={{ color: '#b71c1c', fontSize: 12 }}>{row.error}</span>
                        : <Tag label={SUFFERING_KO[row.suffering] ?? row.suffering} color={SUFF_COLOR} />}
                    </td>
                    <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                      {!row.error && <Tag label={POISON_KO[row.poison] ?? row.poison} color={POISON_COLOR[row.poison] ?? '#666'} />}
                    </td>
                    <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                      {!row.error && <Tag label={TRUTH_KO[row.truth] ?? row.truth} color={TRUTH_COLOR[row.truth] ?? '#666'} />}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 600 }}>
                      {row.error ? '-' : row.suttaCount}
                    </td>
                    <td style={{ padding: '9px 10px', lineHeight: 1.7, color: '#2d1e10', wordBreak: 'keep-all' }}>
                      {row.paragraph}
                    </td>
                    <td style={{ padding: '9px 10px', lineHeight: 1.65, color: '#7d2300', fontStyle: 'italic', wordBreak: 'keep-all' }}>
                      {row.closing}
                    </td>
                    <td style={{ padding: '9px 10px', fontSize: 12, color: '#7a5c3d', lineHeight: 1.6 }}>
                      {row.suttaList}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 분포 요약 ─────────────────────────────────────────────────────────────── */

function DistSummary({ results }: { results: Row[] }) {
  const valid = results.filter(r => !r.error);
  const n     = valid.length;

  function count(field: keyof Row) {
    const map: Record<string, number> = {};
    valid.forEach(r => { const v = String(r[field]); map[v] = (map[v] ?? 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }

  function Bar({ label, cnt, color }: { label: string; cnt: number; color: string }) {
    const pct = n > 0 ? (cnt / n) * 100 : 0;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ minWidth: 72, fontSize: 12, color: '#4a3520' }}>{label}</span>
        <div style={{ flex: 1, height: 9, background: '#ecdfc0', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4 }} />
        </div>
        <span style={{ fontSize: 11, color: '#7a5c3d', minWidth: 28, textAlign: 'right' }}>{cnt}</span>
      </div>
    );
  }

  return (
    <div style={{ background: '#fff9f0', border: '1.5px solid #ecdfc0', borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <span style={{ fontSize: 11, letterSpacing: '0.1em', color: '#9a7030', textTransform: 'uppercase' }}>분류 분포</span>
      <div>
        <p style={{ fontSize: 11, color: '#9a7030', marginBottom: 6 }}>팔고</p>
        {count('suffering').map(([k, c]) => <Bar key={k} label={SUFFERING_KO[k] ?? k} cnt={c} color={SUFF_COLOR} />)}
      </div>
      <div>
        <p style={{ fontSize: 11, color: '#9a7030', marginBottom: 6 }}>삼독</p>
        {count('poison').map(([k, c]) => <Bar key={k} label={POISON_KO[k] ?? k} cnt={c} color={POISON_COLOR[k] ?? '#666'} />)}
      </div>
      <div>
        <p style={{ fontSize: 11, color: '#9a7030', marginBottom: 6 }}>사성제</p>
        {count('truth').map(([k, c]) => <Bar key={k} label={TRUTH_KO[k] ?? k} cnt={c} color={TRUTH_COLOR[k] ?? '#666'} />)}
      </div>
    </div>
  );
}
