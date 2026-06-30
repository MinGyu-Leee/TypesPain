// 한국어 조사 제거 기반 정규화 유틸리티
// 외부 의존성 없음 — 번들 영향 ~3KB.
//
// 목적: KW 매칭 시 "건강도" → "건강", "가족이랑" → "가족" 처럼 조사를 제거해
//       표면형 변이를 처리한다. 활용형(어미) 변형은 별도로 KW 변형 형태를 추가해 처리.
//
// 한계: 동음이의 처리 없음(예: "도"가 지명 "도(道)"와 조사 "도(也)"를 구분 못함).
//       분류기 도메인(감정/심리 표현)에서 오분류 가능성은 낮아 허용 가능한 trade-off.

// 최장 일치 우선 (길이 내림차순 정렬 필수)
const PARTICLES: readonly string[] = [
  // 4음절+
  '으로부터', '에서부터',
  // 3음절
  '이어서', '이라고', '이라도', '이라는', '이라서', '이라면', '이라야',
  '에게서', '한테서',
  // 2음절
  '에서', '으로', '이랑', '에게', '한테', '부터', '까지', '마다',
  '보다', '이나', '이며', '이고', '이라',
  // 1음절
  '을', '를', '은', '는', '이', '가',
  '도', '의', '에', '로', '와', '과', '랑',
];

const KOREAN_SYLLABLE = /[가-힣]/;

function stripParticle(token: string): string {
  for (const p of PARTICLES) {
    if (token.length > p.length && token.endsWith(p)) {
      const stem = token.slice(0, -p.length);
      // 어간 끝이 한국어 음절이어야 유효한 명사/대명사 어간
      if (KOREAN_SYLLABLE.test(stem[stem.length - 1])) return stem;
    }
  }
  return token;
}

// 입력 텍스트 각 어절에서 조사를 제거한 정규화 텍스트 반환
// scoreKW() 에서 원문과 함께 이중 체크에 사용한다.
export function normalizeForLookup(text: string): string {
  return text
    .split(/\s+/)
    .map(stripParticle)
    .join(' ');
}
