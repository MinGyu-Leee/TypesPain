export type TruthKey    = '고' | '집' | '멸' | '도';
export type PoisonKey   = '탐' | '진' | '치';
export type LayerKey    = 'empathy' | 'insight' | 'practice';
export type TopicKey    = '연애·이별' | '가족' | '직장·학업' | '인간관계' | '돈·생계' | '건강' | '죽음' | '수행·명상' | '삶의 의미' | '기타';
export type SufferingKey = '생고' | '노고' | '병고' | '사고' | '애별리고' | '원증회고' | '구부득고' | '오온성고';

export const LAYER_META: Record<LayerKey, { label: string; desc: string }> = {
  empathy:  { label: '공감',  desc: '먼저, 당신의 고통을 인정합니다' },
  insight:  { label: '통찰',  desc: '왜 이런 마음이 생겼을까요?' },
  practice: { label: '실천',  desc: '붓다가 권한 방법은' },
};

export const TRUTH_META: Record<TruthKey, { en: string; hanja: string; desc: string }> = {
  고: { en: 'Dukkha',   hanja: '苦', desc: '괴로움의 진리 — 삶 속에 고통이 있다' },
  집: { en: 'Samudaya', hanja: '集', desc: '집(集)의 진리 — 고통에는 원인이 있다' },
  멸: { en: 'Nirodha',  hanja: '滅', desc: '멸(滅)의 진리 — 고통은 사라질 수 있다' },
  도: { en: 'Magga',    hanja: '道', desc: '도(道)의 진리 — 소멸에 이르는 길이 있다' },
};

export const POISON_META: Record<PoisonKey, { en: string; hanja: string; desc: string }> = {
  탐: { en: 'Lobha', hanja: '貪', desc: '탐욕 — 갖고자 하는 집착' },
  진: { en: 'Dosa',  hanja: '瞋', desc: '성냄 — 밀어내는 마음' },
  치: { en: 'Moha',  hanja: '癡', desc: '어리석음 — 있는 그대로 보지 못함' },
};

export const SUFFERING_META: Record<SufferingKey, { label: string; hanja: string }> = {
  생고:    { label: '생고(生苦)',    hanja: '生苦' },
  노고:    { label: '노고(老苦)',    hanja: '老苦' },
  병고:    { label: '병고(病苦)',    hanja: '病苦' },
  사고:    { label: '사고(死苦)',    hanja: '死苦' },
  애별리고: { label: '애별리고(愛別離苦)', hanja: '愛別離苦' },
  원증회고: { label: '원증회고(怨憎會苦)', hanja: '怨憎會苦' },
  구부득고: { label: '구부득고(求不得苦)', hanja: '求不得苦' },
  오온성고: { label: '오온성고(五蘊盛苦)', hanja: '五蘊盛苦' },
};

export interface Passage { lang: 'en' | 'ko'; text: string; attribution?: string; }

export interface Sutta {
  id: string; nikaya: string; collection: string;
  title_en: string; title_ko: string; source_ref: string;
  truth_tags: TruthKey[]; poison_tags: PoisonKey[];
  suffering_tags: SufferingKey[];
  url: string; passages: Passage[];
  layer?: LayerKey;
}

export interface SeedData {
  version: string; license: string; attribution: string; suttas: Sutta[];
}

export interface ClassificationResult {
  primaryTopic: TopicKey;
  topics: { key: TopicKey; score: number }[];
  primarySuffering: SufferingKey;
  sufferings: { key: SufferingKey; score: number }[];
  primaryPoisons: PoisonKey[];
  poisons: { key: PoisonKey; score: number }[];
  primaryTruth: TruthKey;
  truths: { key: TruthKey; score: number }[];
}

export interface StageIntros {
  suffering: { label: string; desc: string };
  poison: { label: string; hanja: string; desc: string };
  truth: { intent: string; desc: string };
  combination: {
    topicLabel: string;   // topic_labels 기반 폴백
    header: string;       // 조합별 구체적 제목 (예: "삶의 방향을 잃은 마음")
    paragraph: string;
    closing: string;
  };
}

export interface QueryResult {
  classification: ClassificationResult;
  suttas: Sutta[];
  stages: StageIntros;
}
