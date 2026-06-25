// Hybrid classifier — keyword-primary for all axes, ML as fallback for ambiguous cases.
//
// 팔고: keyword+pattern → score≥2이면 사용, score<2이면 ML ZSC fallback (영어 레이블)
// 삼독: keyword → 탐/진 감지, 없으면 치 default + ML 보조
// 사성제: keyword → 도/멸/집 감지, 없으면 고 default + ML override (신뢰도>0.5)
//
// nli-deberta-v3-small: 영어 MNLI 학습 모델. 한국어 직접 입력 시 삼독 진(anger) 과대평가
// 경향 있음. 팔고는 영어 의미 레이블로 ZSC 적용 시 수용 가능한 정확도 확인됨.

import path from 'path';
import type { TruthKey, PoisonKey, TopicKey, SufferingKey, ClassificationResult } from './types';

// ── ML Pipeline singleton ─────────────────────────────────────────────────

type ZSCResult = { labels: string[]; scores: number[] };
type ZSCPipeline = (text: string, labels: string[], opts?: Record<string, unknown>) => Promise<ZSCResult>;

let _pipelinePromise: Promise<ZSCPipeline> | null = null;

function getPipeline(): Promise<ZSCPipeline> {
  if (!_pipelinePromise) {
    _pipelinePromise = (async () => {
      const { pipeline, env } = await import('@xenova/transformers');
      env.cacheDir = path.join(process.cwd(), '.cache', 'transformers');
      env.allowLocalModels = true;
      return pipeline('zero-shot-classification', 'Xenova/nli-deberta-v3-small') as unknown as ZSCPipeline;
    })();
  }
  return _pipelinePromise;
}

// ── ML candidate labels (used only when keywords give no signal) ──────────

const POISON_ML: readonly { key: PoisonKey; label: string }[] = [
  { key: '탐', label: 'craving, desire, jealousy, longing, or clinging to someone or something' },
  { key: '진', label: 'feeling angry, furious, or resentful; anger that keeps rising up or is hard to control' },
  { key: '치', label: 'confusion, ignorance, emptiness, not knowing what to do, or feeling lost' },
] as const;

const TRUTH_ML: readonly { key: TruthKey; label: string }[] = [
  { key: '고', label: 'expressing or venting current pain, sadness, grief, or suffering' },
  { key: '집', label: 'asking why this happened or wanting to understand the root cause' },
  { key: '멸', label: 'wanting to let go, be free, or escape from the suffering' },
  { key: '도', label: 'asking HOW to cope, seeking a method, technique, or way to practice' },
] as const;

// 팔고 ML 레이블 — keyword score < 2일 때 ZSC fallback으로 사용
const SUFFERING_ML: readonly { key: SufferingKey; label: string }[] = [
  { key: '생고',    label: 'questioning why to live, feeling life is meaningless, not knowing the reason for existence, born into suffering' },
  { key: '노고',    label: 'suffering from aging, body declining with age, fear of getting old, physical deterioration, feeling old' },
  { key: '병고',    label: 'physical illness, chronic pain, body hurting, medical condition, not recovering, health problems' },
  { key: '사고',    label: 'fear of death, grief over someone dying, anxiety about mortality, someone close passing away' },
  { key: '애별리고', label: 'loneliness from separation, missing people, longing for connection, isolated from loved ones, alone without anyone' },
  { key: '원증회고', label: 'forced to be with someone you hate, stuck with an unpleasant person, unable to escape a hateful situation or relationship' },
  { key: '구부득고', label: 'unable to get what you want, lacking money, financial hardship, job failure, frustrated goals, not achieving desires' },
  { key: '오온성고', label: 'vague undefined mental suffering without a clear cause, low self-esteem, feeling worthless or empty' },
] as const;

// ── Helper: ZSC output → sorted typed array ───────────────────────────────

function mapResult<K>(
  res: ZSCResult,
  candidates: readonly { key: K; label: string }[],
): { key: K; score: number }[] {
  return res.labels
    .map((label, i) => ({
      key: candidates.find(c => c.label === label)!.key,
      score: res.scores[i],
    }))
    .sort((a, b) => b.score - a.score);
}

// ── 팔고 — keyword-based ──────────────────────────────────────────────────

type KWEntry<K> = { key: K; terms: [string, number][] };

const SUFFERING_KW: KWEntry<SufferingKey>[] = [
  { key: '생고', terms: [
    ['왜 살', 3], ['살아야 할 이유', 3], ['살아야 하는 이유', 3], ['살 이유가', 3],
    ['태어나지 말', 3], ['삶이란', 3], ['삶의 본질', 3],
    ['인생이란', 3], ['행복이란', 3], ['왜 인간은', 3], ['무아란', 3], ['덧없게', 3],
    ['왜 사는지 모르겠', 3],
    ['카르마는', 2], ['집착하면', 2], ['존재의 의미', 2],
    ['살고 싶지 않', 2], ['인생이 무의미', 2], ['존재 자체가', 2], ['행복한 적이 없', 2],
    ['살아있는 게 힘들', 1], ['왜 태어났', 1], ['삶', 1],
  ]},
  { key: '노고', terms: [
    ['노화', 3], ['늙어가', 3], ['나이가 들수록', 3], ['나이가 드는', 3], ['나이가 들어서', 3],
    ['노후가', 3], ['노후', 2], ['허리가 아프', 2], ['관절이', 2], ['체력이 떨어', 2],
    ['흰머리', 2], ['몸이 예전 같지 않', 2],
    ['나이 드', 2],   // '나이 드는', '나이 드니' 등 (공백 없이)
    ['나이가 드', 2], // '나이가 드니까', '나이가 드면서' 등 ('가' 포함 활용형)
    ['갱년기', 3],
    ['노인', 1], ['나이 들', 1],
  ]},
  { key: '병고', terms: [
    ['암 진단', 3], ['암이 발견', 3], ['수술을 받', 3], ['입원해야', 3], ['항암', 3],
    ['암', 2], ['진단을 받', 2], ['만성', 2], ['치료 중', 2], ['아프다는 진단', 2],
    ['완치가 안', 2], ['몸이 아픈데', 2], ['몸이 갑자기', 2],
    ['몸이 아파', 2],   // '몸이 아파요', '몸이 아파서' 등 활용형 포괄
    ['아파요', 1], ['아파서', 1],
    ['두통', 2], ['편두통', 2], ['불면증', 3],
    ['병원', 1], ['통증', 1], ['몸이 안 좋', 1], ['아프다', 1],
  ]},
  { key: '사고', terms: [
    ['돌아가셨', 3], ['돌아가신', 3], ['세상을 떠나', 3], ['사망', 3], ['임종', 3], ['별세', 3],
    ['죽음이 두려', 3], ['죽음이 무서', 3], ['죽을 것 같', 3], ['죽을까봐', 3], ['죽으면', 3],
    ['죽었', 2], ['빈자리', 2], ['장례', 2], ['잃었어요', 2], ['죽음 때문에', 3], ['사람의 죽음', 3],
  ]},
  { key: '애별리고', terms: [
    ['헤어졌', 3], ['헤어진', 3], ['이별했', 3], ['이별이', 3],
    ['그리워요', 2], ['보고 싶', 2], ['잊을 수가', 2], ['연락이 없', 2], ['연락이 안 돼', 2],
    ['외로워', 2], ['외롭', 2], ['외로운', 2], ['쓸쓸', 2], ['고립', 2], ['소외감', 2], ['고독', 2],
    ['아무도 없어', 2], ['아무도 없는', 2], ['멀리 이사', 2], ['친구를 잃', 2], ['정붙이기', 2],
    ['적적해', 2], ['적적한', 2],        // 적적함 표현
    ['말할 사람', 3], ['얘기할 사람', 2], ['들어줄 사람', 2], // 소통 상대 없음
    ['이별', 1], ['남자친구', 1], ['여자친구', 1], ['전남친', 1], ['전여친', 1], ['짝사랑', 1],
    ['반려동물', 1],
  ]},
  { key: '원증회고', terms: [
    ['바람을 피웠', 3], ['바람피웠', 3], ['바람피운', 3], ['불륜', 3], ['외도', 3], ['배신당', 3],
    ['배신', 2], ['믿었는데', 2], ['뒤통수', 2], ['원수', 2],
    ['원망스러', 2], ['다퉤', 2], ['다퉈', 2], ['상처받았', 2], ['적인지 모르', 2],
    ['밉기도', 2], ['싫어하는 것 같', 2],
    ['살기 싫어', 2], ['같이 있기 싫', 2], ['못 견디겠', 2], ['견딜 수 없', 2], ['피하고 싶어', 2],
    ['갑갑해', 2], ['숨막혀', 2], ['왕따', 2], ['억울하게', 2], ['뒤에서 욕', 2],
    ['싫은 사람', 1], ['미운 사람', 1], ['마주쳐', 2],
    ['마음에 안 들', 2], ['분위기가 안 좋', 2], ['분위기가 너무 안', 2],
  ]},
  { key: '구부득고', terms: [
    ['공부가 하기 싫', 3], ['일이 하기 싫', 3], ['시험에 떨어', 3], ['취업이 안', 3], ['합격이 안', 3],
    ['계속 떨어', 2], ['불합격', 2], ['안 받아줘', 2], ['합격을 못', 2],
    ['하기 싫어', 2], ['하기 싫다', 2], ['뜻대로 안', 2], ['노력해도 안', 2], ['원하는 게 안', 2],
    ['실직', 3], ['백수가', 2], ['백수로', 2], ['이루지 못', 2], ['허탈해', 2], ['실패했', 2], ['사업 실패', 2],
    ['집이 없', 3], ['집을 구하', 3], ['전세금', 3], ['월세', 2], ['보증금', 2], ['주거', 2],
    ['생계', 3], ['생활비', 2], ['먹고살', 2], ['먹고 살', 2], ['빚', 2],
    ['돈이 없', 3], ['돈 없어', 3], ['돈이 부족', 3],
    ['가난', 2], ['형편이', 2],
    ['대출', 2], ['월급', 2], ['연봉', 2], ['급여', 2], // 수입/대출 관련
    ['생활이 빠듯', 3], ['생활이 너무 빠듯', 3],         // 빠듯한 생활
    ['공부가', 1], ['시험', 1], ['취업', 1], ['성적', 1],
  ]},
  { key: '오온성고', terms: [
    ['내가 싫', 3], ['나 자신이 싫', 3], ['나를 혐오', 3], ['자기혐오', 3], ['자존감이 없', 3],
    ['나 자신이', 2], // '나 자신이 너무 싫어요' 처럼 수식어가 끼어도 포착
    ['의욕이 없', 2], ['무기력', 2], ['아무것도 하기 싫', 2], ['나는 왜 이', 2],
    ['자신감이 없', 1], ['공허', 1], ['우울', 1],
  ]},
];

// ── 팔고 복합 패턴 (원인+결과 조합 매칭) ─────────────────────────────────
// 단어 단위 키워드가 잡지 못하는 [상황]+[감정] 조합을 정규식으로 포착.

type PatternEntry = { key: SufferingKey; re: RegExp; score: number };

const SUFFERING_PATTERNS: PatternEntry[] = [
  // ─ 애별리고: [장소이탈/타지] + [외로움/그리움] ─
  {
    key: '애별리고',
    re: /(외국|타지|이민|유학|타국|낯선\s*곳|혼자\s*살)[\s\S]{0,40}(외로워|외롭|그리워|보고\s*싶|쓸쓸)/,
    score: 3,
  },
  // ─ 애별리고: [관계] + [멀어짐/사라짐] ─
  {
    key: '애별리고',
    re: /(친구|가족|사람들|다들|주변\s*사람|지인)[\s\S]{0,30}(멀어|가버|떠나버|없어|다\s*없|연락[\s\S]{0,8}(없|끊)|사라)/,
    score: 3,
  },
  // ─ 원증회고: [관계] + [싫음] + [어쩔 수 없음] ─
  {
    key: '원증회고',
    re: /(부모님|엄마|아빠|남편|아내|상사|가족|형제|시댁|처가)[\s\S]{0,40}(살기\s*싫|싫은데|싫어서|힘든데|힘들어서|못\s*견)[\s\S]{0,40}(어쩔\s*수\s*없|피할\s*수\s*없|벗어날\s*수\s*없|견뎌야|살아야)/,
    score: 4,
  },
  // ─ 원증회고: [같이살기] + [싫음] ─
  {
    key: '원증회고',
    re: /(같이\s*살기\s*싫|함께\s*있기\s*싫|계속\s*봐야|마주쳐야|어울려야|견뎌야)/,
    score: 3,
  },
  // ─ 구부득고: [직업/시험] + [실패] ─
  {
    key: '구부득고',
    re: /(취업|회사|직장|합격|자격증|시험|면접|원하는\s*[곳회사])[\s\S]{0,30}(떨어|안\s*돼|못\s*하|실패|안\s*받아|거절)/,
    score: 3,
  },
  // ─ 구부득고: 짝사랑/짝사랑 거절 ─
  {
    key: '구부득고',
    re: /(좋아하는\s*사람|짝사랑|좋아하는\s*[남자여자여성남성])[\s\S]{0,30}(안\s*좋아해|관심\s*없|싫어해|거절|나를\s*안)/,
    score: 3,
  },
  // ─ 원증회고: [상사/직장/가족] 싫어 (단순 표현도 포착) ─
  {
    key: '원증회고',
    re: /(상사가|상사를|상사는|직장상사가|직장이|직장을|회사가|시어머니가|시댁이|남편이|아내가|부모님이)[\s\S]{0,15}(너무\s*싫어|정말\s*싫어|싫어요|싫다|싫어요?|싫어\s*죽겠)/,
    score: 3,
  },
  // ─ 원증회고: [관계 인물] 때문에 [어려움] ─
  {
    key: '원증회고',
    re: /(부모님|엄마|아빠|남편|아내|상사|시어머니|시댁|처가|형제|동생|가족)[\s\S]{0,6}때문에[\s\S]{0,30}(싫|못\s*해|힘들|기 싫|어렵|갑갑|숨막|스트레스)/,
    score: 3,
  },
  // ─ 원증회고: [관계/상황] 싫은데 + [어쩔수없음/눈치] ─
  {
    key: '원증회고',
    re: /(싫은데|싫어서|싫지만)[\s\S]{0,30}(어쩔\s*수\s*없|피할\s*수\s*없|못\s*그만|그만두지\s*못|눈치|봐야|벗어나지\s*못)/,
    score: 3,
  },
  // ─ 원증회고: [상사/직장] 싫은데 못 그만두는 상황 ─
  {
    key: '원증회고',
    re: /(상사가|상사를|직장을|회사가|시댁이|남편이|아내가)[\s\S]{0,15}싫(은데|어서|지만|다고)[\s\S]{0,30}(못\s*그만|어쩔\s*수\s*없|눈치)/,
    score: 3,
  },
  // ─ 원증회고: 왕따/학교 폭력 ─
  {
    key: '원증회고',
    re: /(왕따|학교\s*폭력|괴롭힘)[\s\S]{0,20}(무서워|힘들어|가기|두려)/,
    score: 3,
  },
  // ─ 병고: 몸이 안 좋아진 상황 ─
  {
    key: '병고',
    re: /몸이[\s\S]{0,8}(아픈데|아파서|갑자기\s*안\s*좋아|나빠져서|힘들어서)/,
    score: 3,
  },
  // ─ 병고: [병/통증] 때문에 어려운 상황 ─
  {
    key: '병고',
    re: /(병|통증|만성\s*병|질환|아픔)[\s\S]{0,6}때문에[\s\S]{0,20}(못|힘들|지쳐|어렵)/,
    score: 3,
  },
  // ─ 구부득고: 하고 싶은 것 못 하는 상황 ─
  {
    key: '구부득고',
    re: /(하고\s*싶은\s*걸|하고\s*싶은\s*것|원하는\s*걸|원하는\s*것|공부를|꿈을)[\s\S]{0,20}(못\s*해|못\s*하|안\s*돼|어렵|못\s*했|이루지\s*못)/,
    score: 3,
  },
  // ─ 구부득고: 실직/퇴직 상황 ─
  {
    key: '구부득고',
    re: /(실직|백수가|백수로|퇴직해서\s*할\s*일이\s*없)/,
    score: 3,
  },
  // ─ 구부득고: 주거/생계 불안 ─
  {
    key: '구부득고',
    re: /(집이\s*없|전세금|월세|보증금|주거|생계|먹고\s*살)[\s\S]{0,20}(힘들|막막|어렵|걱정|불안|못\s*해)/,
    score: 4,
  },
  // ─ 애별리고: 가족/친구를 못 만나는 상황 ─
  {
    key: '애별리고',
    re: /(가족을|부모님을|친구를|사람들을)[\s\S]{0,15}(못\s*만|볼\s*수\s*없|만나지\s*못|못\s*봐)/,
    score: 3,
  },
  // ─ 애별리고: 혼자 + [외로움/무서움/아무도 없음] ─
  {
    key: '애별리고',
    re: /혼자\s*(살아서|지내서|있어서|사는데|있는데|이어서)[\s\S]{0,20}(없어|무서|아무도|외로|힘들|쓸쓸)/,
    score: 3,
  },
  // ─ 애별리고: 아무도 없어 ─
  {
    key: '애별리고',
    re: /아무도\s*(없어|없는데|없고|없어서)/,
    score: 2,
  },
  // ─ 노고: 나이가 들어서 몸/삶 변화 ─
  {
    key: '노고',
    re: /나이가\s*(들어서|드는데|들다\s*보니|들수록)[\s\S]{0,20}(몸이|예전|안\s*돼|힘들|아무것도\s*이룬\s*게|이룬\s*게)/,
    score: 3,
  },
  // ─ 노고: 흰머리/늙음 실감 ─
  {
    key: '노고',
    re: /(흰머리|늙어가는\s*게|노화)[\s\S]{0,15}(실감|두려|무서|슬퍼|싫어)/,
    score: 3,
  },
  // ─ 생고: 살아야 하는 이유 없음 ─
  {
    key: '생고',
    re: /(살아야\s*하는\s*이유가|사는\s*이유가|살\s*이유가|왜\s*사는지)[\s\S]{0,15}(없|모르겠)/,
    score: 4,
  },
  // ─ 생고: 행복한 적이 없음 ─
  {
    key: '생고',
    re: /행복한\s*적이\s*(없|없는\s*것\s*같)/,
    score: 3,
  },
  // ─ 생고: 아무런 이유 없이 살기 싫음 ─
  {
    key: '생고',
    re: /(아무런\s*이유\s*없이|이유도\s*없이|그냥\s*막)[\s\S]{0,15}살기\s*싫/,
    score: 4,
  },
  // ─ 생고: 세상에 살아서/세상이 의미 없음 ─
  {
    key: '생고',
    re: /(세상에\s*살아서|세상이)[\s\S]{0,20}(좋은\s*게\s*없|의미가\s*없|좋은\s*것이\s*없)/,
    score: 3,
  },
  // ─ 원증회고: 시댁/처가/부모님집에서 살아서 힘듦 ─
  {
    key: '원증회고',
    re: /(시댁|처가|부모님\s*집|엄마\s*집)[\s\S]{0,6}에서[\s\S]{0,15}(살아서|지내서)[\s\S]{0,20}(힘들|스트레스|갑갑|못\s*견)/,
    score: 3,
  },
  // ─ 원증회고: [가족/부모님]이랑 살아서 스트레스 ─
  {
    key: '원증회고',
    re: /(부모님|가족)[\s\S]{0,6}(집에서|이랑|랑|과)[\s\S]{0,10}(살아서|지내서)[\s\S]{0,20}(스트레스|힘들|갑갑)/,
    score: 3,
  },
  // ─ 원증회고: 억울하게 혼나다 ─
  {
    key: '원증회고',
    re: /(억울하게|부당하게)[\s\S]{0,20}(혼나|혼났|질책|비난)/,
    score: 3,
  },
  // ─ 원증회고: 뒤에서 욕하다 ─
  {
    key: '원증회고',
    re: /뒤에서[\s\S]{0,10}(욕해|욕했|나쁜\s*말)[\s\S]{0,15}(화가|힘들|억울)/,
    score: 3,
  },
  // ─ 원증회고: 부양/돌봄 부담 ─
  {
    key: '원증회고',
    re: /(돌봐야|간호해야|부양해야)[\s\S]{0,15}(부담|힘들|어렵)/,
    score: 2,
  },

  // ── 가족 갈등 패턴 (아버지/어머니/형/언니/오빠 등 기존 패턴에서 누락된 호칭 포함) ──

  // ─ 원증회고: [가족] 사이/관계 안 좋음 ─
  {
    key: '원증회고',
    re: /(아버지|어머니|아빠|엄마|부모님|형|언니|오빠|남동생|여동생|동생|가족|남편|아내)[\s\S]{0,10}(사이가|관계가)[\s\S]{0,10}(안\s*좋|나쁘|불편|멀어|어색)/,
    score: 4,
  },
  // ─ 원증회고: [가족] 싫음/밉/갈등 ─
  {
    key: '원증회고',
    re: /(아버지|어머니|아빠|엄마|부모님|형|언니|오빠|남동생|여동생|동생|가족)[\s\S]{0,15}(싫|밉|미워|갈등)/,
    score: 3,
  },
  // ─ 원증회고: [가족]과 충돌/싸움 ─
  {
    key: '원증회고',
    re: /(아버지|어머니|아빠|엄마|부모님|형|언니|오빠|남동생|여동생|동생|가족)[\s\S]{0,20}(부딪|싸워|싸웠|다퉈|다퉜|충돌)/,
    score: 3,
  },
  // ─ 원증회고: [가족]이 이해를 못 해줌 ─
  {
    key: '원증회고',
    re: /(부모님|아버지|어머니|아빠|엄마|가족|형|언니|오빠)[\s\S]{0,15}(이해를\s*못|이해해\s*주지|몰라줘|알아주지\s*않)/,
    score: 3,
  },
  // ─ 원증회고: [가족] 간섭/잔소리/강요 ─
  {
    key: '원증회고',
    re: /(부모님|아버지|어머니|아빠|엄마|가족)[\s\S]{0,10}(간섭|잔소리|강요|압박|통제)/,
    score: 3,
  },
  // ─ 원증회고: [가족]과 소통 불통/답답 ─
  {
    key: '원증회고',
    re: /(부모님|아버지|어머니|아빠|엄마|가족)[\s\S]{0,10}(대화가\s*안|말이\s*안\s*통|소통이\s*안|답답)/,
    score: 3,
  },
  // ─ 애별리고: 이별 때문에 ─
  {
    key: '애별리고',
    re: /이별[\s\S]{0,5}때문에/,
    score: 3,
  },
  // ─ 애별리고: 타국/이민 + 문화/언어 부적응 ─
  {
    key: '애별리고',
    re: /(이민|타국|외국|낯선\s*나라)[\s\S]{0,20}(문화|언어)[\s\S]{0,10}(맞지\s*않|적응|안\s*통|어렵)/,
    score: 3,
  },
  // ─ 애별리고: 타국에서 정붙이기 어려움 ─
  {
    key: '애별리고',
    re: /(타국|외국|낯선\s*곳|낯선\s*나라)[\s\S]{0,20}정\s*붙이기/,
    score: 3,
  },
  // ─ 애별리고: 친구를/관계를 잃음 (사별 아닌) ─
  {
    key: '애별리고',
    re: /(친구를|관계를)[\s\S]{0,10}(잃었어|잃었다|잃어버렸)/,
    score: 3,
  },
  // ─ 애별리고: 보고 싶은 사람 + 연락 못 함 ─
  {
    key: '애별리고',
    re: /(보고\s*싶은\s*사람|그리운\s*사람)[\s\S]{0,20}(연락을\s*못|볼\s*수\s*없|못\s*봐)/,
    score: 3,
  },
  // ─ 애별리고: 사랑받고 싶은데 관심 없음 ─
  {
    key: '애별리고',
    re: /사랑받고\s*싶(은데|어서|지만)[\s\S]{0,20}(아무도|관심\s*없)/,
    score: 3,
  },
  // ─ 구부득고: 좋아하는 사람 + 다른 사람과 사귐/못 만남 ─
  {
    key: '구부득고',
    re: /(좋아하는\s*사람)[\s\S]{0,20}(다른\s*사람과\s*사귀|못\s*만나요|못\s*만나)/,
    score: 3,
  },
  // ─ 구부득고: 원하는 것 + 손에 안 잡힘 ─
  {
    key: '구부득고',
    re: /원하(는\s*게|는\s*것)[\s\S]{0,20}(안\s*잡혀|잡히지\s*않|닿지\s*않|안\s*돼)/,
    score: 3,
  },
  // ─ 구부득고: 노력/열심히 했는데 실패 ─
  {
    key: '구부득고',
    re: /(노력해서|열심히\s*했는데|열심히\s*해봤는데)[\s\S]{0,20}(또\s*실패|실패했|안\s*됐|안\s*돼)/,
    score: 3,
  },
  // ─ 사고: 부모님 나이/죽음 걱정 ─
  {
    key: '사고',
    re: /(부모님|가족)[\s\S]{0,10}(나이|늙)[\s\S]{0,15}(걱정|두렵|무서|마음이\s*무거)/,
    score: 3,
  },
  // ─ 사고: 사랑하는 사람의 죽음 ─
  {
    key: '사고',
    re: /(사랑하는\s*사람|소중한\s*사람|가족)[\s\S]{0,5}(죽음|돌아가|세상을\s*떠)/,
    score: 4,
  },

  // ─ 구부득고: 수입/급여 부족 ─
  {
    key: '구부득고',
    re: /(월급|연봉|급여|알바비|용돈)[\s\S]{0,10}(적어|낮아|없어|부족|못\s*받|안\s*들어)/,
    score: 3,
  },
  // ─ 구부득고: 돈 때문에 어려움 ─
  {
    key: '구부득고',
    re: /돈[\s\S]{0,5}(때문에|걱정)[\s\S]{0,20}(힘들|스트레스|쌓여|많아|부족|막막)/,
    score: 3,
  },

  // ─ 애별리고: 이사 후 아는 사람 없음 ─
  {
    key: '애별리고',
    re: /이사[\s\S]{0,15}아는\s*사람(이|도)[\s\S]{0,5}없/,
    score: 3,
  },
  // ─ 애별리고: 아는 사람이 없음 (일반) ─
  {
    key: '애별리고',
    re: /아는\s*사람(이|도)[\s\S]{0,5}없/,
    score: 3,
  },

  // ─ 원증회고: 팀장/부장 등 직장 상위 인물 마음에 안 듦 ─
  {
    key: '원증회고',
    re: /(팀장|부장|과장|사장|매니저|임원)[\s\S]{0,15}(마음에\s*안\s*들|마음에\s*들지\s*않|싫어요|싫다|못마땅)/,
    score: 3,
  },
  // ─ 원증회고: 직장/회사/학교 분위기 안 좋음 ─
  {
    key: '원증회고',
    re: /(직장|회사|학교|학원)[\s\S]{0,8}분위기[\s\S]{0,10}(안\s*좋|힘들|스트레스|나빠)/,
    score: 3,
  },
  // ─ 원증회고: 룸메이트/동거인 안 맞음 ─
  {
    key: '원증회고',
    re: /(룸메이트|하우스메이트|같이\s*사는\s*사람|동거인)[\s\S]{0,10}(안\s*맞|힘들|싫어|불편)/,
    score: 3,
  },

  // ─ 병고: 잠을 못 잠 (불면) ─
  {
    key: '병고',
    re: /잠을[\s\S]{0,5}(못\s*자|못\s*잔다|못\s*자서|못\s*자고)/,
    score: 3,
  },

  // ─ 노고: 나이가 드면서 귀찮음/무기력 ─
  {
    key: '노고',
    re: /나이가\s*(드니까|드는데|드면서|드다\s*보니)[\s\S]{0,20}(귀찮|힘들|안\s*돼|싫어|의욕)/,
    score: 3,
  },

  // ─ 오온성고: 나 자신이 싫음 (수식어 포함) ─
  {
    key: '오온성고',
    re: /나\s*자신이[\s\S]{0,10}(싫어|싫다|싫은|미워|혐오)/,
    score: 3,
  },
];

function scorePatterns(text: string): Map<SufferingKey, number> {
  const scores = new Map<SufferingKey, number>();
  for (const { key, re, score } of SUFFERING_PATTERNS) {
    if (re.test(text)) {
      scores.set(key, (scores.get(key) ?? 0) + score);
    }
  }
  return scores;
}

// ── 삼독 — keyword-based, 치 as default ──────────────────────────────────
// ML gives 진 for nearly all Korean text (English NLI model bias).
// Keywords correctly identify 진 (anger) and 탐 (desire); everything else → 치.

const POISON_KW: KWEntry<PoisonKey>[] = [
  { key: '탐', terms: [
    ['좋아해', 3], ['좋아하는', 3], ['사랑해', 3], ['사랑하는', 3], ['사랑', 2],
    ['그리워', 2], ['그립', 2], ['보고 싶어', 2], ['원해요', 2], ['원하다', 2], ['갖고 싶', 2],
    ['욕심', 2], ['집착', 2], ['설레', 2], ['탐나다', 2],
    ['놓지 못', 2], ['붙잡고 싶', 2], ['매달리', 2],
    ['행복해지고 싶', 2], ['행복하고 싶', 2],
    ['부러워', 1], ['질투', 1],
  ]},
  { key: '진', terms: [
    ['화가', 3], ['화났', 3], ['화내', 3], ['열 받아', 3], ['열받아', 3],
    ['짜증나', 3], ['짜증났', 3], ['미치겠다', 3],
    ['분노', 2], ['원망', 2], ['미워', 2], ['배신', 2], ['억울', 2],
    ['다퉤', 2], ['다퉈', 2], ['싸워', 2], ['한심해', 2], ['상처받', 2],
    ['밉기도', 2], ['밉다', 2], ['다 싫어', 2], ['다가 싫어', 2], ['너무 싫어요', 2],
    ['싫다', 1], ['화', 1],
  ]},
  // 치: no keywords — default when neither 탐 nor 진 matches
];

// ── 사성제 — keyword-based, 고 as default ────────────────────────────────
// ML mis-classifies simple expressions ("잠을 못 자요") as 도 or 멸.
// Keywords catch the clear intent-bearing patterns; everything else → 고.

const TRUTH_KW: KWEntry<TruthKey>[] = [
  { key: '도', terms: [
    ['어떻게 하면', 3], ['어떻게 해야', 3], ['어떻게 다스려야', 3], ['어떻게 극복', 3],
    ['어떻게 살아야', 3], ['어떻게 하는지', 3], ['어떤 마음으로', 3], ['임해야', 3],
    ['방법이 있', 2], ['방법이 궁금', 2], ['하는 법이', 2], ['수행 방법', 2],
    ['유지하는 방법', 2], ['다루는 법', 2],
    ['공부하고 싶', 2], ['배우고 싶', 2], ['알고 싶어요', 2],
    ['어떡하죠', 1], ['어떡하면', 1], ['방법', 1],
  ]},
  { key: '멸', terms: [
    ['내려놓고 싶', 3], ['놓아주고 싶', 3], ['벗어나고 싶', 3], ['놓아버리고 싶', 3],
    ['자유로워지고 싶', 3], ['해방되고 싶', 3], ['사라지고 싶', 2],
    ['없어지고 싶', 2], ['모든 걸 포기', 2], ['다 끝내고 싶', 2],
    ['행복해지고 싶', 2], ['떠나고 싶', 2], ['잠들고 싶', 2], ['빠져나가고 싶', 2],
    ['다 내려놓', 1],
  ]},
  { key: '집', terms: [
    ['왜 이럴까', 3], ['왜 이런지', 3], ['왜 나는', 3], ['왜 이렇게', 3],
    ['왜 그랬을까', 3], ['왜 이런 일이', 3], ['왜 인간은', 3],
    ['이란 무엇인가', 3], ['이란 무엇', 3], ['란 무엇인가', 3], ['란 뭔가요', 3],
    ['어떻게 되나요', 3], ['실재하나요', 3], ['의미하나요', 3],
    ['진심을 모르겠', 3], ['좋아하는지 모르겠', 3],
    ['건지 모르겠어요', 2], ['인지 모르겠어요', 2], ['할지 모르겠어요', 2],
    ['이유가', 2], ['원인이', 2], ['이해가 안', 2], ['왜 그럴까', 2],
    ['이란', 1], ['왜', 1],
  ]},
  // 고: default — expressing current suffering
];

// ── Generic keyword scorer ───────────────────────────────────────────────

function scoreKW<K>(text: string, entries: KWEntry<K>[]): { key: K; score: number }[] {
  return entries
    .map(({ key, terms }) => ({
      key,
      score: terms.reduce((n, [w, weight]) => n + (text.includes(w) ? weight : 0), 0),
    }))
    .sort((a, b) => b.score - a.score);
}

// ── 팔고 classifier ───────────────────────────────────────────────────────
// score >= 2: 키워드+패턴 신뢰. score < 2: ML ZSC로 의미 기반 재분류.
// ML score >= 0.35이면 ML 결과 사용, 미달이면 키워드 score >= 1 확인, 둘 다 실패 시 오온성고.

async function classifySuffering(
  text: string,
  clf: ZSCPipeline,
): Promise<{ key: SufferingKey; score: number }[]> {
  const kwScores = scoreKW(text, SUFFERING_KW);
  const patternScores = scorePatterns(text);

  // 키워드 점수 + 패턴 점수 합산
  const combined = new Map<SufferingKey, number>(
    kwScores.map(({ key, score }) => [key, score]),
  );
  for (const [key, score] of patternScores) {
    combined.set(key, (combined.get(key) ?? 0) + score);
  }

  const ranked = (Array.from(combined.entries()) as [SufferingKey, number][])
    .map(([key, score]) => ({ key, score }))
    .sort((a, b) => b.score - a.score);

  // 명확한 키워드+패턴 신호 → 그대로 사용
  if (ranked[0].score >= 2) return ranked;

  // 신호 약함 → ML ZSC로 의미 기반 분류
  const mlRes = await clf(text, SUFFERING_ML.map(c => c.label));
  const mlScores = mapResult<SufferingKey>(mlRes, SUFFERING_ML);
  const mlTop = mlScores[0];

  // ML이 오온성고 외 항목에 충분히 자신 있으면 ML 결과 채택
  if (mlTop.score >= 0.35 && mlTop.key !== '오온성고') {
    // 키워드 약한 신호를 ML 점수에 소폭 반영
    const kwMap = Object.fromEntries(ranked.map(r => [r.key, r.score])) as Record<SufferingKey, number>;
    return mlScores.map(m => ({
      key: m.key,
      score: m.score + (kwMap[m.key] ?? 0) * 0.05,
    })).sort((a, b) => b.score - a.score);
  }

  // ML 신뢰도 낮음 → 키워드 score >= 1이라도 있으면 사용
  if (ranked[0].score >= 1) return ranked;

  // 모두 실패 → 오온성고 기본값
  return [{ key: '오온성고', score: 0 }, ...ranked.slice(1)];
}

// ── 삼독 classifier ───────────────────────────────────────────────────────

async function classifyPoisons(
  text: string,
  clf: ZSCPipeline,
): Promise<{ key: PoisonKey; score: number }[]> {
  const kwScores = scoreKW(text, POISON_KW);
  const topKW = kwScores[0]; // highest among 탐/진

  // If any keyword matched → keyword result, supplement with ML for multi-label
  if (topKW.score > 0) {
    // Still run ML to detect secondary poisons, but keyword wins primary
    const mlRes = await clf(text, POISON_ML.map(c => c.label), { multi_label: true });
    const mlScores = mapResult<PoisonKey>(mlRes, POISON_ML);
    const mlMap   = Object.fromEntries(mlScores.map(p => [p.key, p.score])) as Record<PoisonKey, number>;

    // Keyword winner gets boosted score; others get ML score
    const merged: { key: PoisonKey; score: number }[] = [
      { key: '탐', score: (kwScores.find(k => k.key === '탐')?.score ?? 0) > 0 ? 1.0 : mlMap['탐'] },
      { key: '진', score: (kwScores.find(k => k.key === '진')?.score ?? 0) > 0 ? 1.0 : mlMap['진'] },
      { key: '치', score: topKW.key !== '치' ? mlMap['치'] : 0.9 }, // 치 wins if no other KW
    ];
    return merged.sort((a, b) => b.score - a.score);
  }

  // No keyword match → 치 is primary (confusion/ignorance is the Buddhist default)
  // Use ML for secondary signal but cap its authority
  const mlRes = await clf(text, POISON_ML.map(c => c.label), { multi_label: true });
  const mlScores = mapResult<PoisonKey>(mlRes, POISON_ML);
  const mlMap   = Object.fromEntries(mlScores.map(p => [p.key, p.score])) as Record<PoisonKey, number>;

  // 치 always wins when no keyword. Others can be secondary if ML is confident.
  const noKwResult: { key: PoisonKey; score: number }[] = [
    { key: '치', score: 1.0 },
    { key: '진', score: mlMap['진'] * 0.6 },
    { key: '탐', score: mlMap['탐'] * 0.6 },
  ];
  return noKwResult.sort((a, b) => b.score - a.score);
}

// ── 사성제 classifier ─────────────────────────────────────────────────────

async function classifyTruths(
  text: string,
  clf: ZSCPipeline,
): Promise<{ key: TruthKey; score: number }[]> {
  const kwScores = scoreKW(text, TRUTH_KW);
  const topKW    = kwScores[0]; // highest among 도/멸/집

  if (topKW.score > 0) {
    // Clear keyword signal → keyword wins, no need for ML
    const kwTruthResult: { key: TruthKey; score: number }[] = [
      { key: '고', score: 0.3 },
      { key: '집', score: 0.2 },
      { key: '멸', score: 0.2 },
    ];
    return kwTruthResult
      .filter(x => x.key !== topKW.key)
      .concat([{ key: topKW.key, score: 1.0 }])
      .sort((a, b) => b.score - a.score);
  }

  // No keyword match → 고 default (expressing suffering)
  // Use ML as secondary signal (can override 고 if very confident about 멸/집/도)
  const mlRes = await clf(text, TRUTH_ML.map(c => c.label));
  const ml    = mapResult<TruthKey>(mlRes, TRUTH_ML);
  const mlTop = ml[0];

  // ML can override 고 only if highly confident (>0.5) about a non-고 intent
  if (mlTop.key !== '고' && mlTop.score > 0.5) {
    return ml;
  }

  // Default to 고 (expressing current suffering)
  return [
    { key: '고', score: 1.0 },
    ...ml.filter(t => t.key !== '고'),
  ];
}

// ── 주제 — keyword-based (display only) ──────────────────────────────────

const TOPIC_KW: { key: TopicKey; words: string[] }[] = [
  { key: '연애·이별', words: ['이별','연애','헤어지','남자친구','여자친구','짝사랑','사랑','바람','외도','불륜'] },
  { key: '가족',      words: ['부모','가족','엄마','아빠','아버지','어머니','남편','아내','자식','형제','돌아가셨'] },
  { key: '직장·학업', words: ['직장','회사','취업','공부','시험','학교','상사','업무','직업'] },
  { key: '인간관계',  words: ['친구','인간관계','관계','배신','갈등','무시','따돌림'] },
  { key: '돈·생계',   words: ['돈','빚','생계','가난','재정','실직','파산'] },
  { key: '건강',      words: ['질병','암','수술','건강','병원','진단','치료'] },
  { key: '죽음',      words: ['죽고싶','자살','죽음','사망','임종','돌아가셨'] },
  { key: '수행·명상', words: ['명상','수행','불교','붓다','팔정도','마음챙김'] },
  { key: '삶의 의미', words: ['의미','허무','공허','왜 살','목적'] },
  { key: '기타',      words: [] },
];

function classifyTopic(text: string): { primary: TopicKey; all: { key: TopicKey; score: number }[] } {
  const lower = text.toLowerCase();
  const scores = TOPIC_KW.map(({ key, words }) => ({
    key,
    score: words.reduce((n, w) => n + (lower.includes(w) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score);
  return {
    primary: scores[0].score > 0 ? scores[0].key : '기타',
    all: scores,
  };
}

// ── Main classify function ────────────────────────────────────────────────

export async function classify(question: string): Promise<ClassificationResult> {
  const clf = await getPipeline();

  const [poisons, truths, sufferings] = await Promise.all([
    classifyPoisons(question, clf),
    classifyTruths(question, clf),
    classifySuffering(question, clf),
  ]);

  const topic = classifyTopic(question);

  // 삼독: 최상위 + 같은 그룹의 경우 모두 포함 (multi-label)
  const primaryPoisons: PoisonKey[] = poisons
    .filter((p, i) => i === 0 || p.score > 0.6)
    .map(p => p.key);

  return {
    primaryTopic:     topic.primary,
    topics:           topic.all,
    primarySuffering: sufferings[0].key,
    sufferings,
    primaryPoisons,
    poisons,
    primaryTruth:     truths[0].key,
    truths,
  };
}
