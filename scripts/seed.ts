/**
 * 시드 스크립트: SuttaCentral 데이터를 SQLite DB로 구축합니다.
 *
 * 사용법:
 *   npm run seed           -- data/seed.json으로 DB 구축
 *   npm run seed:fetch     -- SuttaCentral bilara-data에서 추가 경전 다운로드 후 구축
 *
 * 참고: bilara-data는 Sujato 영어 번역(CC0)만 제공합니다.
 *       한국어 전문은 suttacentral.net/{id}/ko 에서 확인 가능합니다.
 */
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

const ROOT     = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH  = path.join(DATA_DIR, 'suttas.db');
const SEED_PATH = path.join(DATA_DIR, 'seed.json');
const JSON_PATH = path.join(DATA_DIR, 'suttas.json');

const FETCH_MODE     = process.argv.includes('--fetch');
// suttas.json이 존재하면 그걸 기준으로 재구축 (seed:fetch로 받은 데이터 보존)
const FROM_JSON_MODE = process.argv.includes('--from-json');

type TruthKey  = '고' | '집' | '멸' | '도';
type PoisonKey = '탐' | '진' | '치';

type SufferingKey = '생고' | '노고' | '병고' | '사고' | '애별리고' | '원증회고' | '구부득고' | '오온성고';
type Passage = { lang: 'en' | 'ko'; text: string; attribution?: string };
type Sutta = {
  id: string; nikaya: string; collection: string;
  title_en: string; title_ko: string; source_ref: string;
  truth_tags: TruthKey[]; poison_tags: PoisonKey[];
  suffering_tags: SufferingKey[];
  url: string; passages: Passage[]; layer?: string;
};

// bilara-data 베이스 URL (Sujato 영어 번역, CC0)
const BILARA_EN = 'https://raw.githubusercontent.com/suttacentral/bilara-data/published/translation/en/sujato';

// ── 추가 경전 목록 (검증된 bilara-data 경로 + 사전 분류) ────────────────────
//    경로 형식: sutta/{nikaya}/{subdirs}/{id}_translation-en-sujato.json
//    SN/AN: 니카야 하위 디렉토리 있음, MN/DN: 없음
const ADDITIONAL_SUTTAS: Record<string, {
  enPath: string;
  title_ko: string; title_en: string;
  nikaya: string; collection: string; source_ref: string;
  truth_tags: TruthKey[]; poison_tags: PoisonKey[]; layer: string;
}> = {
  // ── SN ──────────────────────────────────────────────────────────────────
  'sn1.1': {
    enPath: 'sutta/sn/sn1/sn1.1_translation-en-sujato.json',
    title_ko: '폭류 경', title_en: 'The Flood',
    nikaya: 'sn', collection: 'SN 1.1', source_ref: 'SN 1.1',
    truth_tags: ['멸'], poison_tags: ['탐'], layer: 'empathy',
  },
  'sn12.15': {
    enPath: 'sutta/sn/sn12/sn12.15_translation-en-sujato.json',
    title_ko: '깟짜야나곳따 경', title_en: 'With Kaccāyana',
    nikaya: 'sn', collection: 'SN 12.15', source_ref: 'SN 12.15',
    truth_tags: ['집', '멸'], poison_tags: ['치'], layer: 'insight',
  },
  'sn22.22': {
    enPath: 'sutta/sn/sn22/sn22.22_translation-en-sujato.json',
    title_ko: '짐 경', title_en: 'The Burden',
    nikaya: 'sn', collection: 'SN 22.22', source_ref: 'SN 22.22',
    truth_tags: ['집'], poison_tags: ['탐'], layer: 'insight',
  },
  'sn22.95': {
    enPath: 'sutta/sn/sn22/sn22.95_translation-en-sujato.json',
    title_ko: '포말 경', title_en: 'Foam',
    nikaya: 'sn', collection: 'SN 22.95', source_ref: 'SN 22.95',
    truth_tags: ['집'], poison_tags: ['치'], layer: 'insight',
  },
  'sn35.23': {
    enPath: 'sutta/sn/sn35/sn35.23_translation-en-sujato.json',
    title_ko: '모든 것 경', title_en: 'The All',
    nikaya: 'sn', collection: 'SN 35.23', source_ref: 'SN 35.23',
    truth_tags: ['집'], poison_tags: ['치'], layer: 'insight',
  },
  'sn36.6': {
    enPath: 'sutta/sn/sn36/sn36.6_translation-en-sujato.json',
    title_ko: '살라 경 — 화살', title_en: 'The Arrow',
    nikaya: 'sn', collection: 'SN 36.6', source_ref: 'SN 36.6',
    truth_tags: ['고'], poison_tags: ['진'], layer: 'empathy',
  },
  'sn45.8': {
    enPath: 'sutta/sn/sn45/sn45.8_translation-en-sujato.json',
    title_ko: '팔정도 분별 경', title_en: 'Analysis of the Path',
    nikaya: 'sn', collection: 'SN 45.8', source_ref: 'SN 45.8',
    truth_tags: ['도'], poison_tags: ['치'], layer: 'practice',
  },
  'sn47.2': {
    enPath: 'sutta/sn/sn47/sn47.2_translation-en-sujato.json',
    title_ko: '마음챙기는 자 경', title_en: 'Mindful',
    nikaya: 'sn', collection: 'SN 47.2', source_ref: 'SN 47.2',
    truth_tags: ['도'], poison_tags: ['치'], layer: 'practice',
  },
  // ── MN ──────────────────────────────────────────────────────────────────
  'mn7': {
    enPath: 'sutta/mn/mn7_translation-en-sujato.json',
    title_ko: '베 비유 경', title_en: 'The Simile of the Cloth',
    nikaya: 'mn', collection: 'MN 7', source_ref: 'MN 7',
    truth_tags: ['집'], poison_tags: ['진'], layer: 'insight',
  },
  'mn28': {
    enPath: 'sutta/mn/mn28_translation-en-sujato.json',
    title_ko: '코끼리 발자국 비유 대경', title_en: 'The Great Elephant Footprint Simile',
    nikaya: 'mn', collection: 'MN 28', source_ref: 'MN 28',
    truth_tags: ['집'], poison_tags: ['치'], layer: 'insight',
  },
  'mn36': {
    enPath: 'sutta/mn/mn36_translation-en-sujato.json',
    title_ko: '삿짜까 대경', title_en: 'The Greater Discourse with Saccaka',
    nikaya: 'mn', collection: 'MN 36', source_ref: 'MN 36',
    truth_tags: ['도'], poison_tags: ['치'], layer: 'insight',
  },
  'mn43': {
    enPath: 'sutta/mn/mn43_translation-en-sujato.json',
    title_ko: '교리문답 대경', title_en: 'The Greater Classification',
    nikaya: 'mn', collection: 'MN 43', source_ref: 'MN 43',
    truth_tags: ['집'], poison_tags: ['치'], layer: 'insight',
  },
  'mn44': {
    enPath: 'sutta/mn/mn44_translation-en-sujato.json',
    title_ko: '교리문답 소경', title_en: 'The Shorter Classification',
    nikaya: 'mn', collection: 'MN 44', source_ref: 'MN 44',
    truth_tags: ['집', '멸'], poison_tags: ['치'], layer: 'insight',
  },
  'mn62': {
    enPath: 'sutta/mn/mn62_translation-en-sujato.json',
    title_ko: '라훌라 교계 대경', title_en: 'The Greater Exhortation to Rāhula',
    nikaya: 'mn', collection: 'MN 62', source_ref: 'MN 62',
    truth_tags: ['도'], poison_tags: ['치'], layer: 'practice',
  },
  'mn118': {
    enPath: 'sutta/mn/mn118_translation-en-sujato.json',
    title_ko: '들숨날숨에 대한 마음챙김 경', title_en: 'Breathing Mindfulness',
    nikaya: 'mn', collection: 'MN 118', source_ref: 'MN 118',
    truth_tags: ['도'], poison_tags: ['치'], layer: 'practice',
  },
  'mn119': {
    enPath: 'sutta/mn/mn119_translation-en-sujato.json',
    title_ko: '몸에 대한 마음챙김 경', title_en: 'Mindfulness of the Body',
    nikaya: 'mn', collection: 'MN 119', source_ref: 'MN 119',
    truth_tags: ['도'], poison_tags: ['치'], layer: 'practice',
  },
  // ── AN ──────────────────────────────────────────────────────────────────
  'an3.136': {
    enPath: 'sutta/an/an3/an3.136_translation-en-sujato.json',
    title_ko: '탐욕 경', title_en: 'Greed',
    nikaya: 'an', collection: 'AN 3.136', source_ref: 'AN 3.136',
    truth_tags: ['집'], poison_tags: ['탐'], layer: 'insight',
  },
  'an4.41': {
    enPath: 'sutta/an/an4/an4.41_translation-en-sujato.json',
    title_ko: '삼매 수행 경', title_en: 'Meditation Development',
    nikaya: 'an', collection: 'AN 4.41', source_ref: 'AN 4.41',
    truth_tags: ['도'], poison_tags: ['치'], layer: 'practice',
  },
  'an10.2': {
    enPath: 'sutta/an/an10/an10.2_translation-en-sujato.json',
    title_ko: '의도적 행위 경', title_en: 'Intentional Action',
    nikaya: 'an', collection: 'AN 10.2', source_ref: 'AN 10.2',
    truth_tags: ['도'], poison_tags: ['치'], layer: 'practice',
  },
  // ── DN ──────────────────────────────────────────────────────────────────
  'dn2': {
    enPath: 'sutta/dn/dn2_translation-en-sujato.json',
    title_ko: '사문과 경', title_en: 'The Fruits of the Spiritual Life',
    nikaya: 'dn', collection: 'DN 2', source_ref: 'DN 2',
    truth_tags: ['멸', '도'], poison_tags: ['치'], layer: 'insight',
  },
  'dn22': {
    enPath: 'sutta/dn/dn22_translation-en-sujato.json',
    title_ko: '대념처경', title_en: 'The Great Discourse on Mindfulness',
    nikaya: 'dn', collection: 'DN 22', source_ref: 'DN 22',
    truth_tags: ['도'], poison_tags: ['치'], layer: 'practice',
  },
};

// ── 유틸 ──────────────────────────────────────────────────────────────────────
function segmentsToText(segments: Record<string, string>): string {
  return Object.values(segments)
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n');
}

async function fetchText(baseUrl: string, filePath: string): Promise<string | null> {
  const url = `${baseUrl}/${filePath}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const json = await res.json() as Record<string, string>;
    const text = segmentsToText(json);
    return text.length > 50 ? text : null;
  } catch {
    return null;
  }
}

// ── 추가 경전 다운로드 ────────────────────────────────────────────────────────
async function fetchAdditionalSuttas(existingIds: Set<string>): Promise<{
  suttas: Sutta[]; added: number; skipped: number; failed: number;
}> {
  const results: Sutta[] = [];
  let added = 0, skipped = 0, failed = 0;

  for (const [id, meta] of Object.entries(ADDITIONAL_SUTTAS)) {
    if (existingIds.has(id)) {
      console.log(`  ↷ 건너뜀 (이미 존재): ${id}`);
      skipped++;
      continue;
    }

    process.stdout.write(`  ↓ ${id.padEnd(10)} `);
    const enText = await fetchText(BILARA_EN, meta.enPath);
    if (!enText) {
      console.log('✗ 다운로드 실패');
      failed++;
      continue;
    }
    console.log(`✓  (${enText.length.toLocaleString()} chars)`);

    results.push({
      id,
      nikaya:        meta.nikaya,
      collection:    meta.collection,
      title_en:      meta.title_en,
      title_ko:      meta.title_ko,
      source_ref:    meta.source_ref,
      truth_tags:    meta.truth_tags,
      poison_tags:   meta.poison_tags,
      suffering_tags: [] as SufferingKey[],
      url:           `https://suttacentral.net/${id}/ko`,
      passages: [
        { lang: 'en', text: enText.slice(0, 4000), attribution: 'Bhikkhu Sujato (CC0)' },
      ],
      layer: meta.layer,
    });
    added++;
  }

  return { suttas: results, added, skipped, failed };
}

// ── DB 스키마 / 삽입 ──────────────────────────────────────────────────────────
function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS suttas (
      id             TEXT PRIMARY KEY,
      nikaya         TEXT NOT NULL,
      collection     TEXT NOT NULL,
      title_en       TEXT NOT NULL,
      title_ko       TEXT NOT NULL,
      source_ref     TEXT NOT NULL,
      truth_tags     TEXT NOT NULL,
      poison_tags    TEXT NOT NULL,
      suffering_tags TEXT NOT NULL DEFAULT '[]',
      url            TEXT NOT NULL,
      passages       TEXT NOT NULL,
      layer          TEXT NOT NULL DEFAULT 'insight'
    );
    CREATE INDEX IF NOT EXISTS idx_truth    ON suttas(truth_tags);
    CREATE INDEX IF NOT EXISTS idx_poison   ON suttas(poison_tags);
    CREATE INDEX IF NOT EXISTS idx_suffering ON suttas(suffering_tags);
  `);
}

function insertSuttas(db: Database.Database, suttas: Sutta[]): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO suttas
      (id, nikaya, collection, title_en, title_ko, source_ref,
       truth_tags, poison_tags, suffering_tags, url, passages, layer)
    VALUES
      (@id, @nikaya, @collection, @title_en, @title_ko, @source_ref,
       @truth_tags, @poison_tags, @suffering_tags, @url, @passages, @layer)
  `);
  const insertMany = db.transaction((rows: Sutta[]) => {
    for (const row of rows) {
      stmt.run({
        ...row,
        truth_tags:     JSON.stringify(row.truth_tags),
        poison_tags:    JSON.stringify(row.poison_tags),
        suffering_tags: JSON.stringify(row.suffering_tags ?? []),
        passages:       JSON.stringify(row.passages),
        layer:          row.layer ?? 'insight',
      });
    }
  });
  insertMany(suttas);
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('🌸 불경 DB 구축 시작\n');

  if (!fs.existsSync(SEED_PATH)) {
    console.error(`오류: seed.json 없음: ${SEED_PATH}`);
    process.exit(1);
  }

  // FROM_JSON_MODE: suttas.json이 존재하면 그 데이터를 기준으로 사용 (fetch 데이터 보존)
  const sourceFile = FROM_JSON_MODE && fs.existsSync(JSON_PATH) ? JSON_PATH : SEED_PATH;
  const seedData = JSON.parse(fs.readFileSync(sourceFile, 'utf-8'));
  let suttas: Sutta[] = seedData.suttas;
  const seedCount = suttas.length;
  const sourceLabel = sourceFile === JSON_PATH ? 'suttas.json' : 'seed.json';
  console.log(`  ✓ ${sourceLabel} 로드: ${seedCount}개 경전`);

  const koInSeed = suttas.filter((s) =>
    s.passages.some((p: Passage) => p.lang === 'ko'),
  ).length;
  console.log(`    └ 한국어 구절 포함: ${koInSeed}개\n`);

  let addedCount = 0;

  if (FETCH_MODE) {
    console.log(`  ─── SuttaCentral bilara-data 다운로드 ───`);
    console.log(`      대상: ${Object.keys(ADDITIONAL_SUTTAS).length}개 경전\n`);

    const existingIds = new Set(suttas.map((s) => s.id));
    const { suttas: additional, added, skipped, failed } = await fetchAdditionalSuttas(existingIds);
    addedCount = added;
    suttas = [...suttas, ...additional];

    console.log(`\n  ─────────────────────────────────────────`);
    console.log(`  새로 추가된 경전:    ${added}개  (영어 텍스트)`);
    if (skipped) console.log(`  이미 존재 (건너뜀): ${skipped}개`);
    if (failed)  console.log(`  다운로드 실패:      ${failed}개`);
    console.log(`\n  seed.json 기존:     ${seedCount}개`);
    console.log(`    └ 한국어 포함:     ${koInSeed}개`);
    console.log(`  추가 다운로드:       ${added}개  (영어만)`);
    console.log(`  ─────────────────────────────────────────`);
    console.log(`  최종 총 경전 수:     ${suttas.length}개`);
    console.log(`  ─────────────────────────────────────────\n`);
    console.log(`  ℹ  bilara-data 한국어 경전 텍스트는 미제공입니다.`);
    console.log(`     한국어 원문: https://suttacentral.net/{id}/ko\n`);
  }

  // suttas.json 저장 (Vercel JSON 폴백)
  const jsonOut = {
    version:     seedData.version,
    license:     seedData.license,
    attribution: seedData.attribution,
    generated:   new Date().toISOString(),
    suttas,
  };
  fs.writeFileSync(JSON_PATH, JSON.stringify(jsonOut, null, 2), 'utf-8');
  console.log(`  ✓ data/suttas.json 저장 (${suttas.length}개)`);

  // SQLite DB 구축
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  const db = new Database(DB_PATH);
  createSchema(db);
  insertSuttas(db, suttas);
  db.close();

  const stat = fs.statSync(DB_PATH);
  console.log(`  ✓ data/suttas.db 저장 (${(stat.size / 1024).toFixed(1)} KB)\n`);
  console.log('✅ DB 구축 완료');
}

main().catch((err) => {
  console.error('오류:', err);
  process.exit(1);
});
