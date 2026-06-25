import { classify } from '@/lib/classify';

const CASES = [
  { q: '돈이 없어요',                 expected: '구부득고' },
  { q: '월세가 너무 비싸요',           expected: '구부득고' },
  { q: '빚이 많아요',                 expected: '구부득고' },
  { q: '집이 없어서 힘들어요',         expected: '구부득고' },
  { q: '외국에서 오래살아서 외로워요', expected: '애별리고' },
  { q: '상사가 너무 싫어요',           expected: '원증회고' },
  { q: '취업이 계속 안 돼요',          expected: '구부득고' },
  { q: '몸이 너무 아파요',            expected: '병고'    },
  { q: '나이 드는 게 무서워요',        expected: '노고'    },
  { q: '삶의 의미를 모르겠어요',       expected: '생고'    },
];

async function main() {
  let correct = 0;
  const rows: string[] = [];

  for (const { q, expected } of CASES) {
    const r = await classify(q);
    const actual = r.primarySuffering;
    const pass = actual === expected;
    if (pass) correct++;
    rows.push(`${pass ? '✅' : '❌'}  ${q.padEnd(22)} → ${actual.padEnd(6)} (기대: ${expected})`);
  }

  console.log('\n── 결과 ─────────────────────────────────────────');
  rows.forEach(r => console.log(r));
  console.log(`\n합계: ${correct}/10 통과`);
}

main().catch(err => { console.error(err); process.exit(1); });
