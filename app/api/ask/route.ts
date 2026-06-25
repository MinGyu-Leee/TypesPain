import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { classify } from '@/lib/classify';
import { querySuttas } from '@/lib/db';
import type { QueryResult, StageIntros } from '@/lib/types';
import { buildContextualParagraph } from '@/lib/contextOpening';

const INTRO_PATH = path.join(process.cwd(), 'data', 'intros.json');

interface IntroData {
  topic_labels:       Record<string, string>;
  topics:             Record<string, { desc: string }>;
  sufferings:         Record<string, { label: string; desc: string }>;
  poisons:            Record<string, { label: string; en: string; hanja: string; desc: string }>;
  truths:             Record<string, { intent: string; desc: string }>;
  combinations:       Record<string, { header: string; paragraph: string; closing: string }>;
  combinations_legacy: Record<string, { paragraph: string; closing: string }>;
}

let _intros: IntroData | null = null;
function getIntros(): IntroData {
  if (!_intros) _intros = JSON.parse(fs.readFileSync(INTRO_PATH, 'utf-8'));
  return _intros!;
}

const CRISIS_RE = /죽고\s?싶|자살|사라지고\s?싶|없어지고\s?싶|모든\s?걸?\s*다?\s*놓|다\s*포기|끝내고\s*싶|살기\s*싫|살고\s*싶지\s*않/;
const CRISIS_PARAGRAPH = '지금 이 마음이 얼마나 무거운지, 충분히 느껴져요. 더는 버티기 힘들다는 신호일 수 있어요. 지금 느끼는 고통은 진짜이고, 이 무게를 혼자 다 짊어지지 않아도 됩니다.';
const CRISIS_CLOSING = '지금 이 마음, 혼자 들고 있지 않아도 돼요.';

export async function POST(req: NextRequest) {
  let question: string;
  try {
    const body = await req.json();
    question = (body.question ?? '').trim();
    if (!question) {
      return NextResponse.json({ error: '질문을 입력해 주세요.' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const classification = await classify(question);
  const suttas = querySuttas(classification.primaryTruth, classification.primaryPoisons[0], classification.primarySuffering);

  const d = getIntros();
  const poison0   = classification.primaryPoisons[0];
  const newKey    = `${classification.primarySuffering}_${poison0}_${classification.primaryTruth}`;
  const legacyKey = `${classification.primaryTruth}_${poison0}`;
  const combo     = d.combinations[newKey] ?? null;
  const legacy    = d.combinations_legacy?.[legacyKey] ?? null;
  const isCrisis  = CRISIS_RE.test(question);

  const stages: StageIntros = {
    suffering: {
      label: d.sufferings[classification.primarySuffering]?.label ?? classification.primarySuffering,
      desc:  d.sufferings[classification.primarySuffering]?.desc  ?? '',
    },
    poison: {
      label: d.poisons[poison0]?.label ?? poison0,
      hanja: d.poisons[poison0]?.hanja ?? '',
      desc:  d.poisons[poison0]?.desc  ?? '',
    },
    truth: {
      intent: d.truths[classification.primaryTruth]?.intent ?? '',
      desc:   d.truths[classification.primaryTruth]?.desc   ?? '',
    },
    combination: {
      topicLabel: d.topic_labels[classification.primaryTopic] ?? classification.primaryTopic,
      header:     combo?.header    ?? '',
      paragraph:  isCrisis
        ? CRISIS_PARAGRAPH
        : buildContextualParagraph(
            question,
            classification.primarySuffering,
            combo?.paragraph ?? legacy?.paragraph ?? '이 고통에는 오래된 이름이 있습니다. 이름이 붙으면 비로소 그 고통을 바라볼 수 있어요.',
          ),
      closing:    isCrisis ? CRISIS_CLOSING   : (combo?.closing   ?? legacy?.closing   ?? '지금 이 순간, 있는 그대로의 자신을 바라보십시오.'),
    },
  };

  const result: QueryResult = { classification, suttas, stages };
  return NextResponse.json(result);
}
