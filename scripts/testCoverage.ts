import { classify } from '@/lib/classify';

const cases: [string, string][] = [
  ['요즘 너무 힘들어요',           '?'],
  ['너무 지쳐요',                  '?'],
  ['기분이 안 좋아요',             '?'],
  ['회사 다니기 너무 힘들어요',     '?'],
  ['아무 의욕이 없어요',           '오온성고'],
  ['집에 있기 싫어요',             '?'],
  ['몸 상태가 좋지 않아요',        '?'],
  ['너무 무기력해요',              '오온성고'],
  ['남편이랑 자꾸 다퉈요',         '원증회고'],
  ['엄마가 너무 힘들게 해요',       '?'],
  ['직장 생활이 너무 힘들어요',     '?'],
  ['자꾸 눈물이 나요',             '?'],
  ['아무 생각도 하기 싫어요',       '?'],
  ['친구들이 다 멀어진 것 같아요',  '애별리고'],
  ['정말 살기가 싫어요',            '원증회고'],
  ['몸이 안 좋은데 병원은 못 가고', '?'],
  ['경제적으로 너무 힘들어요',      '구부득고'],
  ['남자친구랑 헤어질 것 같아요',   '애별리고'],
  ['잠을 너무 못 자요',            '병고'],
  ['아무것도 하기 싫어요',          '오온성고'],
];

let defaultCount = 0;
const mismatches: string[] = [];

for (const [q, expected] of cases) {
  const r = classify(q);
  const score = r.sufferings[0].score;
  const isDefault = score === 0;
  if (isDefault) defaultCount++;

  const match = expected === '?' ? '  ' : (r.primarySuffering === expected ? '✅' : '❌');
  const tag = isDefault ? '⚠️ default' : `score:${score}  `;
  console.log(match, tag, r.primarySuffering.padEnd(6), ' ', q);
  if (expected !== '?' && r.primarySuffering !== expected) {
    mismatches.push(`  "${q}" → ${r.primarySuffering} (기대: ${expected})`);
  }
}
console.log(`\n기본값(오온성고) 빠짐: ${defaultCount}/${cases.length}건`);
if (mismatches.length) {
  console.log('오분류:');
  mismatches.forEach(m => console.log(m));
}
