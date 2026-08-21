import type { JlptLevel, VocabularyWord } from "./types";

type WordsByLevel = Readonly<Partial<Record<JlptLevel, readonly VocabularyWord[]>>>;

function stringHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], seed: string): T[] {
  const copy = [...items];
  const random = mulberry32(stringHash(seed));

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function uniqueWords(words: readonly VocabularyWord[]): VocabularyWord[] {
  const seenWords = new Set<string>();

  return words.filter((word) => {
    if (seenWords.has(word.word)) {
      return false;
    }

    seenWords.add(word.word);
    return true;
  });
}

export function getDailyWords(
  wordsByLevel: WordsByLevel,
  dateKey: string,
  activeLevels: readonly JlptLevel[],
  count: number,
): VocabularyWord[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error("Daily word count must be a non-negative integer.");
  }

  const uniqueLevels = [...new Set(activeLevels)];
  if (uniqueLevels.length === 0) {
    throw new Error("Daily word selection requires at least one active level.");
  }

  if (count === 0) {
    return [];
  }

  const shuffledLevels = shuffled(uniqueLevels, `${dateKey}|levels`);
  const requiredByLevel = new Map<JlptLevel, number>();

  for (let index = 0; index < count; index += 1) {
    const level = shuffledLevels[index % shuffledLevels.length];
    requiredByLevel.set(level, (requiredByLevel.get(level) ?? 0) + 1);
  }

  const shuffledPools = new Map<JlptLevel, VocabularyWord[]>();
  for (const [level, requiredCount] of requiredByLevel) {
    const pool = uniqueWords(wordsByLevel[level] ?? []);
    if (pool.length < requiredCount) {
      throw new Error(`${level} pool has ${pool.length} word${pool.length === 1 ? "" : "s"}, but needs ${requiredCount}.`);
    }

    shuffledPools.set(level, shuffled(pool, `${dateKey}|${level}|words`));
  }

  const nextPoolIndex = new Map<JlptLevel, number>();
  const selectedWords = new Set<string>();
  const result: VocabularyWord[] = [];

  for (let index = 0; index < count; index += 1) {
    const level = shuffledLevels[index % shuffledLevels.length];
    const pool = shuffledPools.get(level)!;
    let poolIndex = nextPoolIndex.get(level) ?? 0;

    while (poolIndex < pool.length && selectedWords.has(pool[poolIndex].word)) {
      poolIndex += 1;
    }

    if (poolIndex === pool.length) {
      throw new Error(`${level} pool has no remaining unique words for this daily selection.`);
    }

    const word = pool[poolIndex];
    nextPoolIndex.set(level, poolIndex + 1);
    selectedWords.add(word.word);
    result.push(word);
  }

  return result;
}
