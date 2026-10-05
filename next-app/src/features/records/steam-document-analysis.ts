import type { SteamSaved } from "./steam-schema";

// Content categories checked against the official notices on 2026-10-05.
// Explanations below are our paraphrases, not quotations or attainment criteria.
export const STEAM_CURRICULUM_SOURCE = "https://i-nuri.go.kr/teacher/board/view.do?board_idx=4332&data_type=normal&manage_idx=137&menu_idx=20";
export const NURI_CURRICULUM_SOURCE = "https://repo.kicce.re.kr/handle/2019.oak/4997";
type Rule = { area: string; category: string; pattern: RegExp; meaning: string; watch: string };
const rules: Rule[] = [
  { area: "자연탐구", category: "생활 속에서 탐구하기", pattern: /반대로|방향|위치|길게|짧게|모양|연결|이어|쌓/, meaning: "놓는 위치·방향·모양이나 이어지는 길을 직접 다루는 행동은 공간과 모양을 탐색하는 경험으로 읽을 수 있습니다.", watch: "어떤 위치·방향·방법을 바꾸었는지, 바꾼 뒤 무엇을 다시 시도했는지 살펴보세요." },
  { area: "자연탐구", category: "생활 속에서 탐구하기", pattern: /자석|안붙|안 붙|굴리|떠 있|가라앉|녹았|녹는/, meaning: "물체가 붙거나 움직이는 조건을 직접 확인한 행동은 물체의 특성과 변화를 탐색하는 경험과 연결할 수 있습니다. 예를 들어 자석의 붙는 방향을 바꿔 본 사실과 자석 원리를 이해했다는 판단은 구분해야 합니다.", watch: "같은 조건에서 다시 시도했는지, 달라진 점을 어떤 말이나 행동으로 표현했는지 더 관찰해 주세요." },
  { area: "자연탐구", category: "생활 속에서 탐구하기", pattern: /크기|비교|세어|세었|구분|분류|반복되는|규칙/, meaning: "양·크기·같고 다름이나 반복되는 모습을 다루는 관찰은 생활 속 수학적 탐색과 연결해 볼 수 있습니다.", watch: "실제로 비교하거나 세거나 구분한 행동을 확인해 주세요. 완성품만으로 수 개념의 성취를 단정하지 않습니다." },
  { area: "자연탐구", category: "생활 속에서 탐구하기", pattern: /도구|집게|숟가락|삽으로|가위로/, meaning: "도구를 잡고 써 본 장면은 일상에서 도구의 쓰임을 탐색하는 경험과 연결해 볼 수 있습니다.", watch: "무엇을 하려고 어떤 도구를 어떻게 사용했는지, 방법을 바꾸었는지 더 관찰해 주세요." },
  { area: "자연탐구", category: "자연과 더불어 살기", pattern: /잎|나뭇|꽃|벌레|곤충|동물|식물|날씨|빗물|비가|햇빛|계절/, meaning: "생명이나 자연의 모습을 접하고 탐색하는 경험과 연결해 볼 수 있습니다.", watch: "무엇을 바라보거나 만졌는지와 실제 반응을 더 기록해 주세요." },
  { area: "의사소통", category: "듣기와 말하기", pattern: /["“「].+?["”」]|말했|말하|물었|물어|이야기했|이야기하|가리켰|가리키|고개를 끄덕|말함/, meaning: "말·몸짓으로 생각이나 요구를 주고받는 경험과 연결해 볼 수 있습니다.", watch: "누구에게 무엇을 표현했는지, 상대의 말에 어떻게 반응했는지 확인해 주세요." },
  { area: "의사소통", category: "읽기와 쓰기에 관심 가지기", pattern: /글자|상징|표지판|끼적|써 보|읽어|읽었/, meaning: "그림·상징·글자에 관심을 두거나 자신의 표현을 남기는 경험과 연결해 볼 수 있습니다.", watch: "어떤 그림·상징에 관심을 두었는지와 실제 표현 방법을 더 살펴보세요." },
  { area: "사회관계", category: "더불어 생활하기", pattern: /같이|함께|친구|또래|도와줄|도와주|나누|주고받|우리반|우리 반/, meaning: "다른 사람과 놀이를 주고받거나 함께하는 경험과 연결해 볼 수 있습니다.", watch: "제안한 말과 상대의 반응을 따로 기록해 주세요. 함께 있었다는 사실만으로 협력 성취를 단정하지 않습니다." },
  { area: "예술경험", category: "창의적으로 표현하기", pattern: /상상|역할|흉내|노래|리듬|춤|그렸|그리|표현|꾸몄/, meaning: "재료·소리·움직임이나 상상놀이로 경험을 표현하는 가능성과 연결해 볼 수 있습니다. 무엇을 표현했는지는 추가 확인이 필요합니다.", watch: "아이가 무엇이라고 이름 붙였는지, 어떤 경험이나 생각을 표현했는지 실제 말과 행동으로 확인해 주세요." },
  { area: "신체운동·건강", category: "신체활동 즐기기", pattern: /손으로|손가락|집었|집어|잡았|잡고|움직|달렸|달리|뛰었|뛰어|걸었|기어|균형/, meaning: "몸이나 손을 움직이며 감각과 움직임을 경험하는 과정과 연결해 볼 수 있습니다.", watch: "움직임을 조절하는 구체적인 행동과 필요한 도움을 살펴보세요. 사진만으로 운동 발달 수준을 판단하지 않습니다." },
];

export function steamDocumentAnalysis(steam: SteamSaved) {
  const infant = ["0세", "1세", "2세"].includes(steam.age);
  const framework = infant ? "2024 개정 표준보육과정" : "2019 개정 누리과정";
  const band = infant ? steam.age === "2세" ? "2세" : "0~1세" : "3~5세";
  // Only teacher-confirmed observations are evidence. AI stories, interpretations,
  // future plans and original (possibly edited-out) notes are deliberately excluded.
  const observations = steam.confirmedObservation.split(/\n+/).map(text => text.trim()).filter(text => text && !/^\[(사진|교사 보충)/.test(text) && !/^사진\s*\d/.test(text) && !/계획|예정|제안|하지 않|하지 않았|보이지 않|없었/.test(text));
  const links = rules.flatMap(rule => {
    const quotes = observations.filter(text => rule.pattern.test(text));
    return quotes.length ? [{ area: rule.area, category: rule.category, evidence: quotes.slice(0, 3), reason: rule.meaning, watch: rule.watch }] : [];
  });
  const groups = steam.analysis.plays?.map(play => ({ photo: play.photo, analysis: play.analysis })) || [{ photo: 0, analysis: steam.analysis }];
  return { framework, band, source: infant ? STEAM_CURRICULUM_SOURCE : NURI_CURRICULUM_SOURCE, links, groups };
}
