import type { JlptLevel, VocabularyWord } from "./types";

type VocabularyFetcher = (input: RequestInfo | URL) => Promise<Response>;

const vocabularyCache = new Map<JlptLevel, Promise<VocabularyWord[]>>();

function vocabularyUrl(level: JlptLevel): string {
  return `/data/jlpt/${level.toLowerCase()}.json`;
}

function isVocabularyWord(value: unknown, level: JlptLevel): value is VocabularyWord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const word = value as Record<string, unknown>;
  return typeof word.word === "string"
    && typeof word.reading === "string"
    && typeof word.pronunciationKo === "string"
    && typeof word.meaningKo === "string"
    && word.level === level;
}

async function fetchVocabularyLevel(
  level: JlptLevel,
  fetcher: VocabularyFetcher,
): Promise<VocabularyWord[]> {
  try {
    const response = await fetcher(vocabularyUrl(level));
    if (!response.ok) {
      throw new Error("HTTP request failed");
    }

    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || !payload.every((word) => isVocabularyWord(word, level))) {
      throw new Error("Invalid vocabulary payload");
    }

    return payload;
  } catch {
    throw new Error(`${level} 단어 데이터를 불러오지 못했어요.`);
  }
}

export function loadVocabularyLevel(
  level: JlptLevel,
  fetcher: VocabularyFetcher = window.fetch.bind(window),
): Promise<VocabularyWord[]> {
  const cached = vocabularyCache.get(level);
  if (cached) {
    return cached;
  }

  const request = fetchVocabularyLevel(level, fetcher);
  vocabularyCache.set(level, request);
  void request.catch(() => {
    if (vocabularyCache.get(level) === request) {
      vocabularyCache.delete(level);
    }
  });

  return request;
}

export function clearVocabularyCache(): void {
  vocabularyCache.clear();
}
