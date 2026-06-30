// 피드백 데이터에서 팔고 분류 패턴 후보를 추출하는 오프라인 스크립트.
// 실행: PATH="..." npx tsx scripts/extractCandidates.ts
//
// 출력 결과는 검토용이며, 패턴은 반드시 사람이 classify.ts에 직접 추가해야 함.
// 자동 반영 절대 금지.

import fs from 'fs';
import path from 'path';

interface FeedbackEntry {
  timestamp: string;
  question: string;
  primarySuffering: string;
  correctCategory?: string;
  primaryPoison: string;
  primaryTruth: string;
}

const FEEDBACK_PATH = path.join(process.cwd(), 'data', 'feedback.json');

// 동일 카테고리의 샘플 몇 개 이상에서 공통 등장해야 후보로 채택
const MIN_FREQ = 2;

// 어절(공백 구분) 기반 n-gram 추출 (1~3-gram)
function extractNgrams(text: string): string[] {
  const tokens = text.split(/\s+/).filter(t => t.length > 0);
  const ngrams: string[] = [];
  for (let size = 1; size <= Math.min(3, tokens.length); size++) {
    for (let i = 0; i <= tokens.length - size; i++) {
      const ng = tokens.slice(i, i + size).join(' ');
      if (ng.length >= 2) ngrams.push(ng);
    }
  }
  return ngrams;
}

async function main() {
  if (!fs.existsSync(FEEDBACK_PATH)) {
    console.log('피드백 파일 없음:', FEEDBACK_PATH);
    console.log('→ 앱을 사용하면 data/feedback.json에 피드백이 쌓입니다.');
    process.exit(0);
  }

  const entries: FeedbackEntry[] = JSON.parse(fs.readFileSync(FEEDBACK_PATH, 'utf-8'));
  const corrections = entries.filter(
    e => e.correctCategory && e.correctCategory !== e.primarySuffering,
  );

  console.log(`\n피드백 총 ${entries.length}건 | 정정(correctCategory 있음) ${corrections.length}건`);

  if (corrections.length === 0) {
    console.log('정정 피드백이 아직 없습니다. 사용자가 카테고리 수정 피드백을 보내면 여기에 표시됩니다.');
    process.exit(0);
  }

  console.log('='.repeat(64));

  // 카테고리별 그룹핑
  const byCategory = new Map<string, FeedbackEntry[]>();
  for (const entry of corrections) {
    const cat = entry.correctCategory!;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(entry);
  }

  // 카테고리별 보고
  for (const [category, items] of [...byCategory.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n▶ ${category} (${items.length}건 정정)`);
    console.log('-'.repeat(40));

    // 오분류 출처 집계
    const fromCounts = new Map<string, number>();
    for (const item of items) {
      fromCounts.set(item.primarySuffering, (fromCounts.get(item.primarySuffering) ?? 0) + 1);
    }
    const sortedFrom = [...fromCounts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [from, count] of sortedFrom) {
      console.log(`  오분류 원인: ${from} → ${category} (${count}건)`);
    }

    // 공통 n-gram 추출
    const ngramFreq = new Map<string, number>();
    for (const item of items) {
      const seen = new Set<string>();
      for (const ng of extractNgrams(item.question)) {
        if (!seen.has(ng)) {
          seen.add(ng);
          ngramFreq.set(ng, (ngramFreq.get(ng) ?? 0) + 1);
        }
      }
    }

    const threshold = Math.min(MIN_FREQ, Math.ceil(items.length * 0.5));
    const candidates = [...ngramFreq.entries()]
      .filter(([, freq]) => freq >= threshold)
      .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
      .slice(0, 10);

    if (candidates.length > 0) {
      console.log(`\n  패턴 후보 (${threshold}건 이상 등장, 빈도순):`);
      for (const [ng, freq] of candidates) {
        const bar = '█'.repeat(freq);
        console.log(`    "${ng}"  ${bar} (${freq}/${items.length})`);
      }
    } else {
      console.log('\n  공통 패턴 후보 없음 (샘플 부족 또는 다양한 표현)');
    }

    console.log('\n  원문:');
    for (const item of items) {
      console.log(`    [${item.primarySuffering}→${item.correctCategory}] "${item.question}"`);
    }
  }

  console.log('\n' + '='.repeat(64));
  console.log('⚠️  이 보고서는 검토 전용입니다.');
  console.log('   패턴 채택 여부는 사람이 판단해 classify.ts에 직접 추가하세요.');
  console.log('   자동 반영하지 마세요.\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
