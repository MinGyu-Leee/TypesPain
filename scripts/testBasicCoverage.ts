// 팔고 8개 카테고리 기초 표현 커버리지 테스트
// 실행: PATH="..." npx tsx scripts/testBasicCoverage.ts

import { classify, traceClassify } from '../lib/classify';

const CASES: { q: string; expect: string; label: string }[] = [
  // ── 생고 (5) ──
  { q: '왜 살아야 하는지 모르겠어요',              expect: '생고',   label: '생고-1' },
  { q: '삶의 의미를 모르겠어요',                  expect: '생고',   label: '생고-2' },
  { q: '태어나지 않았으면 했어요',                 expect: '생고',   label: '생고-3' },
  { q: '살고 싶지 않아요',                        expect: '생고',   label: '생고-4' },
  { q: '살아있는 게 너무 힘들어요',                expect: '생고',   label: '생고-5' },

  // ── 노고 (5) ──
  { q: '나이가 들수록 힘드네요',                   expect: '노고',   label: '노고-1' },
  { q: '흰머리가 많이 생겼어요',                   expect: '노고',   label: '노고-2' },
  { q: '체력이 너무 떨어졌어요',                   expect: '노고',   label: '노고-3' },
  { q: '갱년기가 온 것 같아요',                    expect: '노고',   label: '노고-4' },
  { q: '기억력이 나빠진 것 같아요',                expect: '노고',   label: '노고-5' },

  // ── 병고 (10) ──
  { q: '다쳤어요',                               expect: '병고',   label: '병고-1' },
  { q: '다쳐서 너무 아파요',                      expect: '병고',   label: '병고-2' },
  { q: '다친 곳이 낫질 않아요',                   expect: '병고',   label: '병고-3' },
  { q: '수술했어요',                              expect: '병고',   label: '병고-4' },
  { q: '입원했어요',                              expect: '병고',   label: '병고-5' },
  { q: '골절이 됐어요',                           expect: '병고',   label: '병고-6' },
  { q: '독감에 걸렸어요',                         expect: '병고',   label: '병고-7' },
  { q: '두통이 너무 심해요',                      expect: '병고',   label: '병고-8' },
  { q: '암 진단을 받았어요',                      expect: '병고',   label: '병고-9' },
  { q: '불면증이 너무 심해요',                    expect: '병고',   label: '병고-10' },

  // ── 사고 (5) ──
  { q: '할머니가 돌아가셨어요',                   expect: '사고',   label: '사고-1' },
  { q: '죽음이 너무 무서워요',                    expect: '사고',   label: '사고-2' },
  { q: '강아지가 죽었어요',                       expect: '사고',   label: '사고-3' },
  { q: '언젠가 내가 죽는다는 생각이 너무 두려워요', expect: '사고',   label: '사고-4' },
  { q: '사랑하는 사람을 잃었어요',                expect: '사고',   label: '사고-5' },

  // ── 애별리고 (5) ──
  { q: '헤어졌어요',                             expect: '애별리고', label: '애별리고-1' },
  { q: '너무 외로워요',                          expect: '애별리고', label: '애별리고-2' },
  { q: '그 사람이 너무 보고 싶어요',              expect: '애별리고', label: '애별리고-3' },
  { q: '혼자 살아서 외로워요',                    expect: '애별리고', label: '애별리고-4' },
  { q: '친구들이 다 이사 가서 아는 사람이 없어요', expect: '애별리고', label: '애별리고-5' },

  // ── 원증회고 (6) ──
  { q: '상사가 너무 싫어요',                      expect: '원증회고', label: '원증회고-1' },
  { q: '가족이랑 사이가 안 좋아요',               expect: '원증회고', label: '원증회고-2' },
  { q: '회사 다니기가 너무 힘들어요',             expect: '원증회고', label: '원증회고-3' },
  { q: '직장 분위기가 너무 안 좋아요',            expect: '원증회고', label: '원증회고-4' },
  { q: '친구랑 크게 싸웠어요',                    expect: '원증회고', label: '원증회고-5' },
  { q: '룸메이트랑 너무 안 맞아요',               expect: '원증회고', label: '원증회고-6' },

  // ── 구부득고 (6) ──
  { q: '취업이 안 돼요',                          expect: '구부득고', label: '구부득고-1' },
  { q: '돈이 없어요',                            expect: '구부득고', label: '구부득고-2' },
  { q: '시험에 또 떨어졌어요',                    expect: '구부득고', label: '구부득고-3' },
  { q: '원하는 것을 얻지 못해요',                 expect: '구부득고', label: '구부득고-4' },
  { q: '집이 없어서 너무 힘들어요',               expect: '구부득고', label: '구부득고-5' },
  { q: '꿈을 이루지 못할 것 같아요',              expect: '구부득고', label: '구부득고-6' },

  // ── 오온성고 (5) ──
  { q: '아무것도 하기 싫어요',                    expect: '오온성고', label: '오온성고-1' },
  { q: '이유 없이 우울해요',                      expect: '오온성고', label: '오온성고-2' },
  { q: '나 자신이 너무 싫어요',                   expect: '오온성고', label: '오온성고-3' },
  { q: '공허함이 느껴져요',                       expect: '오온성고', label: '오온성고-4' },
  { q: '아무것도 하고 싶지 않아요',               expect: '오온성고', label: '오온성고-5' },
];

function main() {
  let pass = 0, fail = 0;
  const failures: string[] = [];
  const warned: string[] = [];

  for (const { q, expect, label } of CASES) {
    const got   = classify(q).primarySuffering;
    const trace = traceClassify(q);
    const ok    = got === expect;

    if (ok) {
      pass++;
      if (trace.isDefaultSuffering) {
        warned.push(label);
        console.log(`⚠️  ${label.padEnd(12)} [기본값/재질문UX] "${q}"`);
      } else {
        console.log(`✅  ${label.padEnd(12)} "${q}"`);
      }
    } else {
      fail++;
      failures.push(label);
      console.log(`❌  ${label.padEnd(12)} → ${got}  (기대: ${expect})  "${q}"`);
    }
  }

  console.log(`\n합계: ${pass}/${pass + fail} 통과${warned.length ? `  (기본값 경유 ${warned.length}건: ${warned.join(', ')})` : ''}`);
  if (failures.length) console.log(`실패: ${failures.join(', ')}`);
}

main();
