import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const FEEDBACK_PATH = path.join(process.cwd(), 'data', 'feedback.json');

interface FeedbackEntry {
  timestamp: string;
  question: string;
  primarySuffering: string;
  primaryPoison: string;
  primaryTruth: string;
}

// KV 환경 변수가 있으면 Vercel KV 사용, 없으면 로컬 파일 fallback
const useKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

export async function POST(req: NextRequest) {
  let question: string;
  let classification: Record<string, unknown>;
  try {
    const body = await req.json();
    question = String(body.question ?? '').trim().slice(0, 500);
    classification = body.classification ?? {};
    if (!question) return NextResponse.json({ error: '질문이 없습니다.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });
  }

  const entry: FeedbackEntry = {
    timestamp: new Date().toISOString(),
    question,
    primarySuffering: String(classification.primarySuffering ?? ''),
    primaryPoison:    String((classification.primaryPoisons as string[])?.[0] ?? ''),
    primaryTruth:     String(classification.primaryTruth ?? ''),
  };

  try {
    if (useKV) {
      // Vercel KV: 'feedback' 리스트에 추가 (kv.lrange('feedback', 0, -1) 로 전체 조회)
      const { kv } = await import('@vercel/kv');
      await kv.lpush('feedback', JSON.stringify(entry));
    } else {
      // 로컬 개발: data/feedback.json에 append
      let entries: FeedbackEntry[] = [];
      if (fs.existsSync(FEEDBACK_PATH)) {
        entries = JSON.parse(fs.readFileSync(FEEDBACK_PATH, 'utf-8'));
      }
      entries.push(entry);
      fs.writeFileSync(FEEDBACK_PATH, JSON.stringify(entries, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('feedback save error:', err);
    // 저장 실패해도 UX를 막지 않음
  }

  return NextResponse.json({ ok: true });
}
