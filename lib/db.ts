import path from 'path';
import fs from 'fs';
import type { Sutta, TruthKey, PoisonKey, SufferingKey, LayerKey } from './types';

const DB_PATH = path.join(process.cwd(), 'data', 'suttas.db');
const JSON_PATH = path.join(process.cwd(), 'data', 'suttas.json');
const SEED_PATH = path.join(process.cwd(), 'data', 'seed.json');

type SuttaRow = {
  id: string;
  nikaya: string;
  collection: string;
  title_en: string;
  title_ko: string;
  source_ref: string;
  truth_tags: string;
  poison_tags: string;
  suffering_tags: string;
  url: string;
  passages: string;
  layer: string;
};

let cachedSuttas: Sutta[] | null = null;

function loadJsonSuttas(): Sutta[] {
  if (cachedSuttas) return cachedSuttas;

  // 우선 순위: suttas.json > seed.json
  const filePath = fs.existsSync(JSON_PATH) ? JSON_PATH : SEED_PATH;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  cachedSuttas = data.suttas as Sutta[];
  return cachedSuttas;
}

function loadSqliteSuttas(truth: TruthKey, poison: PoisonKey, suffering: SufferingKey): Sutta[] | null {
  if (!fs.existsSync(DB_PATH)) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3');
    const db = new Database(DB_PATH, { readonly: true });

    const rows = db
      .prepare(
        `SELECT * FROM suttas
         WHERE (truth_tags LIKE ? OR truth_tags LIKE ? OR truth_tags LIKE ?)
            OR (poison_tags LIKE ? OR poison_tags LIKE ? OR poison_tags LIKE ?)
            OR suffering_tags LIKE ?
         ORDER BY
           (CASE WHEN suffering_tags LIKE ? THEN 6 ELSE 0 END +
            CASE WHEN truth_tags LIKE ? THEN 2 ELSE 0 END +
            CASE WHEN poison_tags LIKE ? THEN 2 ELSE 0 END) DESC
         LIMIT 12`
      )
      .all(
        `%"${truth}"%`, `%'${truth}'%`, `%${truth}%`,
        `%"${poison}"%`, `%'${poison}'%`, `%${poison}%`,
        `%"${suffering}"%`,
        `%"${suffering}"%`,
        `%${truth}%`,
        `%${poison}%`
      ) as SuttaRow[];

    db.close();

    const suttas = rows.map((row) => ({
      id: row.id,
      nikaya: row.nikaya,
      collection: row.collection,
      title_en: row.title_en,
      title_ko: row.title_ko,
      source_ref: row.source_ref,
      truth_tags: JSON.parse(row.truth_tags),
      poison_tags: JSON.parse(row.poison_tags),
      suffering_tags: JSON.parse(row.suffering_tags || '[]'),
      url: row.url,
      passages: JSON.parse(row.passages),
      layer: (row.layer ?? 'insight') as LayerKey,
    }));

    // 다양화: 동일 nikaya 연속 3개 이상이면 다른 nikaya를 앞으로 당김
    return diversifyByNikaya(suttas);
  } catch {
    return null;
  }
}

// 동일 nikaya 연속 3개 이상 방지: 다른 nikaya 항목을 앞으로 당김
function diversifyByNikaya(suttas: Sutta[]): Sutta[] {
  const result: Sutta[] = [];
  const remaining = [...suttas];

  while (remaining.length > 0) {
    const lastTwo = result.slice(-2);
    const sameNikaya = lastTwo.length === 2 && lastTwo[0].nikaya === lastTwo[1].nikaya;

    if (sameNikaya) {
      const blockedNikaya = lastTwo[0].nikaya;
      const diffIdx = remaining.findIndex((s) => s.nikaya !== blockedNikaya);
      if (diffIdx !== -1) {
        result.push(...remaining.splice(diffIdx, 1));
        continue;
      }
    }
    result.push(...remaining.splice(0, 1));
  }

  return result;
}

function rankSuttas(suttas: Sutta[], truth: TruthKey, poison: PoisonKey, suffering: SufferingKey): Sutta[] {
  return [...suttas]
    .map((s) => ({
      sutta: s,
      score:
        ((s.suffering_tags ?? []).includes(suffering) ? 5 : 0) +
        (s.truth_tags.includes(truth) ? 4 : 0) +
        (s.poison_tags.includes(poison) ? 3 : 0) +
        s.truth_tags.length +
        s.poison_tags.length,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((x) => x.sutta);
}

export function querySuttas(truth: TruthKey, poison: PoisonKey, suffering: SufferingKey, limit = 5): Sutta[] {
  // SQLite 시도 (로컬 개발)
  const sqliteResults = loadSqliteSuttas(truth, poison, suffering);
  if (sqliteResults && sqliteResults.length > 0) return sqliteResults.slice(0, limit);

  // JSON 폴백 (Vercel 등)
  const suttas = loadJsonSuttas();
  const ranked = rankSuttas(suttas, truth, poison, suffering);
  return diversifyByNikaya(ranked).slice(0, limit);
}
