import { ContentPack, checkIntegrity } from './schema/index';
import labs from './majors/ai/labs.json';
import venues from './majors/ai/venues.json';
import journals from './majors/ai/journals.json';
import topics from './majors/ai/topics.json';
import ideaSources from './majors/ai/idea-sources.json';
import events from './majors/ai/events.json';
import careers from './majors/ai/careers.json';
import balance from './majors/ai/balance.json';

export * from './schema/index';

/** 원본 JSON을 zod로 검증해 ContentPack을 만든다. 잘못된 데이터는 즉시 throw. */
export function loadPack(raw: unknown): ContentPack {
  const pack = ContentPack.parse(raw);
  const errors = checkIntegrity(pack);
  if (errors.length) throw new Error(`콘텐츠 무결성 오류:\n${errors.join('\n')}`);
  return pack;
}

export const aiPack: ContentPack = loadPack({
  major: 'ai',
  labs,
  venues,
  journals,
  topics,
  ideaSources,
  events,
  careers,
  balance,
});

export const FIELD_LABELS: Record<string, string> = {
  llm: 'LLM',
  multimodal: '멀티모달',
  diffusion: '생성모델',
  rl: '강화학습',
  vision: '컴퓨터비전',
  graph: '그래프',
  speech: '음성',
  recsys: '추천',
  safety: 'AI 안전',
  efficiency: '효율화',
  federated: '연합학습',
  xai: '설명가능 AI',
  timeseries: '시계열',
  robotics: '로보틱스',
  ai4science: 'AI for Science',
  theory: '이론',
};

export const TOPIC_TYPE_LABELS: Record<string, string> = {
  method: '방법론',
  analysis: '분석·벤치마크',
  dataset: '데이터셋',
  application: '응용',
  theory: '이론',
  survey: '서베이',
};
