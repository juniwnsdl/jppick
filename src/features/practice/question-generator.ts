import type { KanaUnit } from "../kana/types";
import type {
  KanaProgressById,
  PracticeConfig,
  Question,
  Random,
} from "./types";

function randomIndex(maxExclusive: number, random: Random): number {
  if (maxExclusive <= 1) {
    return 0;
  }

  const value = Math.floor(random(maxExclusive));
  return Math.min(maxExclusive - 1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function uniformCycle(units: KanaUnit[], random: Random): KanaUnit[] {
  const shuffled = [...units];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1, random);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function progressFor(unit: KanaUnit, progress: KanaProgressById | undefined) {
  return progress?.[unit.id] ?? { presented: 0, retry: 0 };
}

function hasHistoricalProgress(units: KanaUnit[], progress: KanaProgressById | undefined): boolean {
  return units.some((unit) => {
    const snapshot = progressFor(unit, progress);
    return snapshot.presented > 0 || snapshot.retry > 0;
  });
}

function scoreUnits(
  units: KanaUnit[],
  strategy: Exclude<PracticeConfig["strategy"], "uniform">,
  progress: KanaProgressById,
): number[] {
  if (strategy === "least-practiced") {
    const greatestPresentationCount = Math.max(...units.map((unit) => progressFor(unit, progress).presented));
    return units.map((unit) => greatestPresentationCount - progressFor(unit, progress).presented + 1);
  }

  return units.map((unit) => {
    const { presented, retry } = progressFor(unit, progress);
    return 1 + (presented > 0 ? retry / presented : retry);
  });
}

function weightedCycle(units: KanaUnit[], scores: number[], random: Random): KanaUnit[] {
  const remaining = units.map((unit, index) => ({ unit, score: scores[index] }));
  const sampled: KanaUnit[] = [];

  while (remaining.length > 0) {
    const totalScore = remaining.reduce((sum, candidate) => sum + candidate.score, 0);
    const target = Math.min(
      Math.max(random(totalScore), 0),
      totalScore - Number.EPSILON,
    );
    let selectedIndex = remaining.length - 1;
    let cumulativeScore = 0;

    for (let index = 0; index < remaining.length; index += 1) {
      cumulativeScore += remaining[index].score;
      if (target < cumulativeScore) {
        selectedIndex = index;
        break;
      }
    }

    sampled.push(remaining[selectedIndex].unit);
    remaining.splice(selectedIndex, 1);
  }

  return sampled;
}

function avoidBoundaryRepeat(cycle: KanaUnit[], previousKanaId: string | undefined): KanaUnit[] {
  if (!previousKanaId || cycle.length < 2 || cycle[0].id !== previousKanaId) {
    return cycle;
  }

  const replacementIndex = cycle.findIndex((unit) => unit.id !== previousKanaId);
  [cycle[0], cycle[replacementIndex]] = [cycle[replacementIndex], cycle[0]];
  return cycle;
}

function selectedUnits(config: PracticeConfig, catalog: KanaUnit[]): KanaUnit[] {
  return catalog.filter((unit) => (
    config.scripts.includes(unit.script) && config.groups.includes(unit.group)
  ));
}

/**
 * Creates a finite question snapshot. An unlimited practice session starts
 * with one complete cycle; its session controller can request another cycle
 * as the learner continues.
 */
export function createQuestionQueue(
  config: PracticeConfig,
  catalog: KanaUnit[],
  progress: KanaProgressById | undefined,
  random: Random,
): Question[] {
  const units = selectedUnits(config, catalog);
  const requestedCount = config.count === "unlimited" ? units.length : config.count;
  const queue: KanaUnit[] = [];
  const useWeightedSampling = config.strategy !== "uniform" && hasHistoricalProgress(units, progress);

  while (queue.length < requestedCount && units.length > 0) {
    const cycle = useWeightedSampling
      ? weightedCycle(units, scoreUnits(units, config.strategy as Exclude<PracticeConfig["strategy"], "uniform">, progress ?? {}), random)
      : uniformCycle(units, random);

    avoidBoundaryRepeat(cycle, queue[queue.length - 1]?.id);
    queue.push(...cycle);
  }

  return queue.slice(0, requestedCount).map((unit, index) => ({
    id: `question-${index + 1}-${unit.id}`,
    kanaId: unit.id,
  }));
}
