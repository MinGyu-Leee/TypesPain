// 키워드 사전 확장 검증 — 30개 다양한 표현 테스트
import { classify } from '@/lib/classify';

const CASES: { q: string; expected: string; note?: string }[] = [
  // ── 구부득고: 금전/생계 ──────────────────────────────────────────────────
  { q: '돈이 없어요',              expected: '구부득고' },
  { q: '월세가 너무 비싸요',        expected: '구부득고' },
  { q: '빚이 많아요',              expected: '구부득고' },
  { q: '집이 없어서 힘들어요',      expected: '구부득고' },
  { q: '용돈이 없어서 힘들어요',    expected: '구부득고', note: '신규' },
  { q: '대출이 너무 많아요',        expected: '구부득고', note: '신규' },
  { q: '월급이 너무 적어요',        expected: '구부득고', note: '신규' },
  { q: '카드빚이 쌓여서 힘들어요',  expected: '구부득고', note: '신규' },
  { q: '생활이 너무 빠듯해요',      expected: '구부득고', note: '신규' },
  { q: '돈 때문에 스트레스가 너무 쌓여요', expected: '구부득고', note: '신규' },

  // ── 구부득고: 목표 좌절 ──────────────────────────────────────────────────
  { q: '취업이 계속 안 돼요',        expected: '구부득고' },
  { q: '시험에 또 떨어졌어요',       expected: '구부득고', note: '신규' },
  { q: '하고 싶은 게 있는데 돈이 없어요', expected: '구부득고', note: '신규' },

  // ── 애별리고: 외로움/고립 ─────────────────────────────────────────────────
  { q: '외국에서 오래살아서 외로워요', expected: '애별리고' },
  { q: '친구가 한 명도 없어요',      expected: '애별리고', note: '신규' },
  { q: '말할 사람이 없어요',         expected: '애별리고', note: '신규' },
  { q: '너무 적적해요',              expected: '애별리고', note: '신규' },
  { q: '이사를 와서 아는 사람이 없어요', expected: '애별리고', note: '신규' },
  { q: '고독해서 힘들어요',          expected: '애별리고', note: '신규' },

  // ── 원증회고: 관계/상황 혐오 ─────────────────────────────────────────────
  { q: '상사가 너무 싫어요',         expected: '원증회고' },
  { q: '팀장이 너무 마음에 안 들어요', expected: '원증회고', note: '신규' },
  { q: '직장 분위기가 너무 안 좋아요', expected: '원증회고', note: '신규' },
  { q: '룸메이트랑 안 맞아서 힘들어요', expected: '원증회고', note: '신규' },

  // ── 병고: 신체 질환/통증 ─────────────────────────────────────────────────
  { q: '몸이 너무 아파요',           expected: '병고' },
  { q: '두통이 너무 심해요',         expected: '병고', note: '신규' },
  { q: '잠을 못 자서 힘들어요',      expected: '병고', note: '신규' },

  // ── 노고: 노화 ───────────────────────────────────────────────────────────
  { q: '나이 드는 게 무서워요',       expected: '노고' },
  { q: '나이가 드니까 다 귀찮아요',   expected: '노고', note: '신규' },

  // ── 생고/사고/오온성고 ────────────────────────────────────────────────────
  { q: '삶의 의미를 모르겠어요',      expected: '생고' },
  { q: '나 자신이 너무 싫어요',       expected: '오온성고', note: '신규' },
];

async function main() {
  let correct = 0;
  let newCorrect = 0;
  let newTotal = 0;
  const failures: string[] = [];

  for (const { q, expected, note } of CASES) {
    const r = await classify(q);
    const actual = r.primarySuffering;
    const pass = actual === expected;
    const isNew = note === '신규';

    if (pass) correct++;
    if (isNew) {
      newTotal++;
      if (pass) newCorrect++;
    }

    const tag = isNew ? '[신규]' : '      ';
    const icon = pass ? '✅' : '❌';
    if (!pass) failures.push(`  ${q} → ${actual} (기대: ${expected})`);
    process.stdout.write(`${icon} ${tag} ${q.padEnd(24)} → ${actual}\n`);
  }

  console.log(`\n── 결과 ──────────────────────────────`);
  console.log(`전체: ${correct}/${CASES.length} 통과`);
  console.log(`신규: ${newCorrect}/${newTotal} 통과`);

  if (failures.length) {
    console.log(`\n── 실패 항목 ─────────────────────────`);
    failures.forEach(f => console.log(f));
  }
}

main().catch(err => { console.error(err); process.exit(1); });
