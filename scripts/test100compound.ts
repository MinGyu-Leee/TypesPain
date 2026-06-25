import fs from 'fs';
import path from 'path';
import { classify } from '@/lib/classify';
import { buildContextualParagraph } from '@/lib/contextOpening';
import { querySuttas } from '@/lib/db';

const intros = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'data/intros.json'), 'utf-8')
);

function getFirstSentence(text: string): string {
  const m = text.match(/^([\s\S]+?[.!?。])\s/);
  return m ? m[1] : text;
}

function checkContextReflected(question: string, firstSentence: string): 'O' | 'X' {
  // 조사/어미 제외: 1글자 토큰 버리고, 2글자 이상 실질 형태소 기반으로 체크
  const tokens = question.split(/[\s,!?。.]+/).filter(t => t.length >= 2);
  return tokens.some(t => firstSentence.includes(t)) ? 'O' : 'X';
}

const TEST_CASES = [
  // ─── ~에서/에 살아서/지내서 패턴 (25개) ─────────────────────────────────
  { q: "외국에서 오래 살아서 외로워요", expected: "애별리고" },
  { q: "타지에서 혼자 지내서 너무 힘들어요", expected: "애별리고" },
  { q: "유학 와서 아는 사람이 없어서 쓸쓸해요", expected: "애별리고" },
  { q: "해외에서 살다 보니 고독감이 들어요", expected: "애별리고" },
  { q: "낯선 도시에서 혼자 살아서 외로워요", expected: "애별리고" },
  { q: "이민 와서 친구가 없어서 힘들어요", expected: "애별리고" },
  { q: "부모님 집에서 살아서 매일 스트레스예요", expected: "원증회고" },
  { q: "시댁에서 살아서 너무 힘들어요", expected: "원증회고" },
  { q: "싫은 룸메이트랑 살아서 못 견디겠어요", expected: "원증회고" },
  { q: "병원에서 오래 지내서 지쳐요", expected: "병고" },
  { q: "회사에서 12시간씩 있어서 몸이 힘들어요", expected: "구부득고" },
  { q: "집에만 있어서 무기력해요", expected: "오온성고" },
  { q: "세상에 살아서 좋은 게 없는 것 같아요", expected: "생고" },
  { q: "요양병원에서 지내서 너무 우울해요", expected: "병고" },
  { q: "군대에서 생활해서 가족이 너무 보고 싶어요", expected: "애별리고" },
  { q: "고시원에서 혼자 살아서 외로워요", expected: "애별리고" },
  { q: "기숙사에서 살아서 가족이 그리워요", expected: "애별리고" },
  { q: "타국에서 일하다 보니 정붙이기가 어려워요", expected: "애별리고" },
  { q: "직장 근처에 살아서 상사를 자꾸 마주쳐요", expected: "원증회고" },
  { q: "노인요양원에서 지내다 보니 나이 드는 게 실감나요", expected: "노고" },
  { q: "좁은 집에서 가족들이랑 살아서 갑갑해요", expected: "원증회고" },
  { q: "혼자 사는데 아무도 없어서 무서워요", expected: "애별리고" },
  { q: "지방에서 살다 보니 좋아하는 사람을 못 만나요", expected: "구부득고" },
  { q: "외국에서 일해서 부모님이 많이 보고 싶어요", expected: "애별리고" },
  { q: "낯선 나라에서 살아서 언어도 안 통하고 힘들어요", expected: "애별리고" },

  // ─── ~때문에 패턴 (25개) ──────────────────────────────────────────────────
  { q: "부모님 때문에 하고 싶은 걸 못 해요", expected: "원증회고" },
  { q: "직장 상사 때문에 회사 가기 싫어요", expected: "원증회고" },
  { q: "남편 때문에 집에 있기 싫어요", expected: "원증회고" },
  { q: "시어머니 때문에 결혼 생활이 너무 힘들어요", expected: "원증회고" },
  { q: "돈 때문에 하고 싶은 공부를 못 해요", expected: "구부득고" },
  { q: "성적 때문에 원하는 대학에 못 갔어요", expected: "구부득고" },
  { q: "외모 때문에 자신감이 없어요", expected: "오온성고" },
  { q: "나이 때문에 취업이 안 돼요", expected: "구부득고" },
  { q: "병 때문에 일상생활이 힘들어요", expected: "병고" },
  { q: "만성 통증 때문에 아무것도 못 해요", expected: "병고" },
  { q: "이별 때문에 아무것도 하기 싫어요", expected: "애별리고" },
  { q: "친구의 배신 때문에 관계를 믿지 못하겠어요", expected: "원증회고" },
  { q: "사랑하는 사람의 죽음 때문에 삶이 공허해요", expected: "사고" },
  { q: "우울증 때문에 매일이 너무 힘들어요", expected: "오온성고" },
  { q: "불안 때문에 잠을 못 자요", expected: "오온성고" },
  { q: "아무런 이유 없이 그냥 살기 싫어요", expected: "생고" },
  { q: "코로나 때문에 2년 동안 가족을 못 만났어요", expected: "애별리고" },
  { q: "아버지의 사업 실패 때문에 가족이 힘들어요", expected: "구부득고" },
  { q: "학교 왕따 때문에 학교가기 너무 무서워요", expected: "원증회고" },
  { q: "거짓말 때문에 친구를 잃었어요", expected: "애별리고" },
  { q: "암 진단 때문에 두려움에 떨고 있어요", expected: "병고" },
  { q: "노화 때문에 예전 같지 않아서 슬퍼요", expected: "노고" },
  { q: "오랜 스트레스 때문에 번아웃이 왔어요", expected: "오온성고" },
  { q: "실직 때문에 자존감이 바닥이에요", expected: "구부득고" },
  { q: "가족의 기대 때문에 숨막혀요", expected: "원증회고" },

  // ─── ~해서 패턴 (25개) ────────────────────────────────────────────────────
  { q: "남자친구랑 헤어져서 너무 힘들어요", expected: "애별리고" },
  { q: "친구들이 다 결혼해서 혼자 외로워요", expected: "애별리고" },
  { q: "부모님이 돌아가셔서 빈자리가 너무 커요", expected: "사고" },
  { q: "좋아하는 사람이 다른 사람과 사귀어서 힘들어요", expected: "구부득고" },
  { q: "면접에서 또 떨어져서 자신감이 없어요", expected: "구부득고" },
  { q: "시험에 계속 떨어져서 지쳐버렸어요", expected: "구부득고" },
  { q: "열심히 노력해서 뭔가 해봤는데 또 실패했어요", expected: "구부득고" },
  { q: "친구가 나를 뒤에서 욕해서 너무 화가 나요", expected: "원증회고" },
  { q: "남편이 바람을 피워서 배신감에 힘들어요", expected: "원증회고" },
  { q: "회사에서 억울하게 혼나서 기분이 나빠요", expected: "원증회고" },
  { q: "잘못한 게 없는데 자책이 심해서 힘들어요", expected: "오온성고" },
  { q: "실수를 계속해서 나 자신이 너무 싫어요", expected: "오온성고" },
  { q: "암 진단을 받아서 너무 무서워요", expected: "병고" },
  { q: "수술을 받아야 해서 두렵고 걱정돼요", expected: "병고" },
  { q: "나이가 들어서 몸이 예전 같지 않아요", expected: "노고" },
  { q: "흰머리가 많아져서 늙어가는 게 실감나요", expected: "노고" },
  { q: "왜 사는지 모르겠어서 의욕이 없어요", expected: "생고" },
  { q: "혼자 있는 시간이 많아져서 우울해요", expected: "오온성고" },
  { q: "퇴직해서 할 일이 없으니 허무해요", expected: "구부득고" },
  { q: "이민을 와서 문화도 맞지 않고 힘들어요", expected: "애별리고" },
  { q: "돌봐야 할 부모님이 생겨서 부담돼요", expected: "원증회고" },
  { q: "친한 친구가 멀리 이사 가서 많이 그리워요", expected: "애별리고" },
  { q: "반려동물이 죽어서 너무 슬퍼요", expected: "애별리고" },
  { q: "몸이 갑자기 안 좋아져서 일을 못 하게 됐어요", expected: "병고" },
  { q: "졸업해서 백수가 되니 자존감이 바닥이에요", expected: "구부득고" },

  // ─── ~인데/~는데 패턴 (25개) ──────────────────────────────────────────────
  { q: "친구들이 다 멀리 가버렸는데 너무 외로워요", expected: "애별리고" },
  { q: "사귀던 사람이 있는데 연락이 안 돼요", expected: "애별리고" },
  { q: "보고 싶은 사람이 있는데 연락을 못 해요", expected: "애별리고" },
  { q: "부모님이랑 살기 싫은데 어쩔 수 없어요", expected: "원증회고" },
  { q: "상사가 정말 싫은데 직장을 못 그만둬요", expected: "원증회고" },
  { q: "시댁이 싫은데 남편 눈치가 보여요", expected: "원증회고" },
  { q: "같이 살기 싫은 동생인데 어쩔 수가 없어요", expected: "원증회고" },
  { q: "좋아하는 사람이 있는데 나를 안 좋아해요", expected: "구부득고" },
  { q: "취업하고 싶은데 계속 안 돼요", expected: "구부득고" },
  { q: "원하는 게 있는데 항상 손에 안 잡혀요", expected: "구부득고" },
  { q: "열심히 해야 하는데 아무 의욕이 없어요", expected: "오온성고" },
  { q: "남들은 잘 사는 것 같은데 나만 이러는 것 같아요", expected: "오온성고" },
  { q: "잘하고 싶은데 나 자신이 너무 못마땅해요", expected: "오온성고" },
  { q: "살아야 하는 이유가 없는 것 같은데 어떻게 해야 해요", expected: "생고" },
  { q: "아무리 생각해도 행복한 적이 없는 것 같은데 이상한 건가요", expected: "생고" },
  { q: "죽음이 두려운데 어떻게 받아들여야 해요", expected: "사고" },
  { q: "부모님이 나이가 드셔서 걱정되는데 마음이 무거워요", expected: "사고" },
  { q: "몸이 아픈데 치료받을 용기가 안 나요", expected: "병고" },
  { q: "만성병이 있는데 완치가 안 된다고 해서 막막해요", expected: "병고" },
  { q: "나이가 드는데 아무것도 이룬 게 없는 것 같아요", expected: "노고" },
  { q: "열심히 했는데 결과가 안 나와서 허탈해요", expected: "구부득고" },
  { q: "사랑받고 싶은데 아무도 관심 없는 것 같아요", expected: "애별리고" },
  { q: "믿었는데 배신당해서 더 이상 사람을 못 믿겠어요", expected: "원증회고" },
  { q: "행복해지고 싶은데 어떻게 하면 될지 모르겠어요", expected: "오온성고" },
  { q: "포기하고 싶은데 그러면 안 될 것 같고 혼란스러워요", expected: "구부득고" },
];

async function main() {
  const rows: string[] = ['질문,팔고분류,단락첫문장,맥락반영여부,매칭경전수'];
  let passed = 0;
  const patternStats: Record<string, { total: number; contextO: number }> = {
    '에서살아서': { total: 0, contextO: 0 },
    '때문에':     { total: 0, contextO: 0 },
    '해서':       { total: 0, contextO: 0 },
    '인데':       { total: 0, contextO: 0 },
  };

  for (let i = 0; i < TEST_CASES.length; i++) {
    const { q, expected } = TEST_CASES[i];
    process.stderr.write(`[${i + 1}/100] ${q.slice(0, 22)}...\n`);

    const result = await classify(q);
    const sufKey = result.primarySuffering;
    const poison0 = result.primaryPoisons[0];
    const truthKey = result.primaryTruth;

    const comboKey = `${sufKey}_${poison0}_${truthKey}`;
    const legacyKey = `${truthKey}_${poison0}`;
    const combo = intros.combinations?.[comboKey];
    const legacy = intros.combinations_legacy?.[legacyKey];
    const fixedParagraph =
      combo?.paragraph ?? legacy?.paragraph ??
      '붓다는 이 고통을 직접 겪은 이들의 이야기를 통해 가르쳤습니다.';

    const paragraph = buildContextualParagraph(q, sufKey as any, fixedParagraph);
    const firstSentence = getFirstSentence(paragraph);
    const contextReflected = checkContextReflected(q, firstSentence);

    const suttas = querySuttas(truthKey, poison0, sufKey as any);
    const suttaCount = suttas.length;

    if (sufKey === expected) passed++;

    let patternKey = '인데';
    if (i < 25) patternKey = '에서살아서';
    else if (i < 50) patternKey = '때문에';
    else if (i < 75) patternKey = '해서';
    patternStats[patternKey].total++;
    if (contextReflected === 'O') patternStats[patternKey].contextO++;

    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    rows.push([esc(q), esc(sufKey), esc(firstSentence), contextReflected, String(suttaCount)].join(','));
  }

  const csv = rows.join('\n');
  fs.writeFileSync('/tmp/test100compound.csv', csv, 'utf-8');
  process.stdout.write(csv + '\n');

  const totalO = Object.values(patternStats).reduce((s, p) => s + p.contextO, 0);
  process.stderr.write(`\n팔고 정확도: ${passed}/100\n`);
  process.stderr.write(`맥락반영 O:  ${totalO}/100\n\n`);
  process.stderr.write(`패턴별 맥락반영:\n`);
  process.stderr.write(`  ~에서 살아서: ${patternStats['에서살아서'].contextO}/${patternStats['에서살아서'].total}\n`);
  process.stderr.write(`  ~때문에:      ${patternStats['때문에'].contextO}/${patternStats['때문에'].total}\n`);
  process.stderr.write(`  ~해서:        ${patternStats['해서'].contextO}/${patternStats['해서'].total}\n`);
  process.stderr.write(`  ~인데/는데:   ${patternStats['인데'].contextO}/${patternStats['인데'].total}\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
