export interface SentencePool {
  short: string[];
  long: string[];
}

// 한국어 명언/문장 풀
export const SENTENCES: SentencePool = {
  short: [
    "오늘 걷지 않으면 내일은 뛰어야 한다.",
    "시작이 반이다.",
    "꿈을 꾸는 자만이 그 꿈을 이룰 수 있다.",
    "노력은 결코 배신하지 않는다.",
    "천 리 길도 한 걸음부터 시작된다.",
    "행복은 습관이다. 그것을 몸에 지니라.",
    "가장 어두운 밤도 끝이 나고 해는 떠오른다.",
    "포기하는 순간 핑계를 찾고 노력하는 순간 방법을 찾는다.",
    "어제는 역사이고 내일은 미스터리이며 오늘은 선물이다.",
    "작은 기회로부터 종종 위대한 업적이 시작된다.",
    "배움에는 끝이 없으며 멈추는 순간 후퇴가 시작된다.",
    "실패는 성공으로 가는 디딤돌일 뿐이다.",
  ],
  long: [
    "성공은 매일 반복한 작은 노력들의 합이며 단번에 이루어지는 기적은 어디에도 존재하지 않는다. 오늘 흘린 땀방울이 내일의 나를 만든다.",
    "인생에서 가장 큰 영광은 결코 넘어지지 않는 데 있는 것이 아니라 넘어질 때마다 다시 일어서는 데 있다. 중요한 것은 꺾이지 않는 마음이다.",
    "당신이 할 수 있다고 믿든 할 수 없다고 믿든 믿는 대로 될 것이다. 그러므로 스스로를 향한 의심을 거두고 한 걸음씩 앞으로 나아가라.",
    "위대한 일을 하는 유일한 방법은 자신이 하는 일을 사랑하는 것이다. 아직 그것을 찾지 못했다면 안주하지 말고 계속해서 찾아 나서야 한다.",
    "어떤 일이든 시작하기 전에는 항상 불가능해 보이지만 막상 해내고 나면 그것이 가능했던 일이었음을 비로소 깨닫게 되는 법이다.",
    "행복한 삶을 살기 위해 필요한 것은 거창한 무언가가 아니라 지금 이 순간을 온전히 누리려는 마음가짐과 작은 것에 감사하는 태도이다.",
  ],
};

export type Mode = "short" | "long";

export function pickRandom(mode: Mode, exclude?: string): string {
  const pool = SENTENCES[mode];
  let choice = pool[Math.floor(Math.random() * pool.length)];
  if (exclude && pool.length > 1) {
    let guard = 0;
    while (choice === exclude && guard < 20) {
      choice = pool[Math.floor(Math.random() * pool.length)];
      guard++;
    }
  }
  return choice;
}
