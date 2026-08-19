import type { IDBPDatabase } from "idb";

import { isPracticeConfig } from "../practice/session-reducer";
import type { PracticeConfig, PracticeEvaluation } from "../practice/types";
import {
  openLearningDatabase,
  type KanaLearningDatabase,
  type StoredKanaProgress,
} from "./db";
import type {
  InterruptedSession,
  KanaProgress,
  LearningRepository,
  ProgressDashboard,
  SessionSummary,
} from "./types";

interface LearningRepositoryOptions {
  indexedDB?: IDBFactory | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isSessionAnswer(value: unknown): boolean {
  return isRecord(value)
    && typeof value.kanaId === "string"
    && value.kanaId.length > 0
    && (value.evaluation === "good" || value.evaluation === "retry" || value.evaluation === "practice")
    && isIsoTimestamp(value.answeredAt);
}

function sanitizeStoredProgress(value: unknown): StoredKanaProgress | null {
  if (!isRecord(value)
    || typeof value.kanaId !== "string" || value.kanaId.length === 0
    || !isNonNegativeInteger(value.presented)
    || !isNonNegativeInteger(value.good)
    || !isNonNegativeInteger(value.retry)
    || value.good + value.retry > value.presented
    || !isIsoTimestamp(value.lastPracticedAt)) {
    return null;
  }

  const evaluationKeys = Array.isArray(value.evaluationKeys)
    ? value.evaluationKeys.filter((key): key is string => (
      typeof key === "string" && (() => {
        const segments = key.split("\u0000");
        return isIsoTimestamp(segments[segments.length - 1]);
      })()
    ))
    : [];

  return {
    kanaId: value.kanaId,
    presented: value.presented,
    good: value.good,
    retry: value.retry,
    lastPracticedAt: value.lastPracticedAt,
    evaluationKeys,
  };
}

function sanitizeSessionSummary(value: unknown): SessionSummary | null {
  if (!isRecord(value)
    || typeof value.id !== "string" || value.id.length === 0
    || !isIsoTimestamp(value.startedAt)
    || !isIsoTimestamp(value.endedAt)
    || !isPracticeConfig(value.config)
    || !isNonNegativeInteger(value.completed)
    || !isNonNegativeInteger(value.good)
    || !isNonNegativeInteger(value.retry)
    || !Array.isArray(value.answers)
    || !value.answers.every(isSessionAnswer)
    || value.good + value.retry > value.completed
    || value.answers.length !== value.completed) {
    return null;
  }
  return value as unknown as SessionSummary;
}

function sanitizeInterruptedSession(value: unknown): InterruptedSession | null {
  if (!isRecord(value)
    || typeof value.id !== "string" || value.id.length === 0
    || !isIsoTimestamp(value.startedAt)
    || !isPracticeConfig(value.config)
    || !Array.isArray(value.selectedKanaIds)
    || !Array.isArray(value.queue)
    || !Array.isArray(value.answers)
    || !isNonNegativeInteger(value.currentIndex)) {
    return null;
  }

  const selectedKanaIds = value.selectedKanaIds;
  const queue = value.queue as unknown[];
  const answers = value.answers as unknown[];
  const config = value.config as PracticeConfig;
  const selectedSet = new Set(selectedKanaIds);
  const selectedKanaIdsAreStrings = selectedKanaIds.every((kanaId) => (
    typeof kanaId === "string" && kanaId.length > 0
  ));
  const sortedSelectedKanaIds = selectedKanaIdsAreStrings ? [...selectedKanaIds].sort() : [];
  const selectedShapeIsValid = selectedKanaIdsAreStrings
    && selectedKanaIds.length > 0
    && selectedSet.size === selectedKanaIds.length
    && selectedKanaIds.every((kanaId, index) => (
      kanaId === sortedSelectedKanaIds[index]
    ));
  const questionIds = new Set<string>();
  const queueShapeIsValid = queue.every((question) => {
    if (!isRecord(question)
      || typeof question.id !== "string" || question.id.length === 0
      || typeof question.kanaId !== "string" || !selectedSet.has(question.kanaId)
      || questionIds.has(question.id)) {
      return false;
    }
    questionIds.add(question.id);
    return true;
  });
  const queueLengthIsValid = config.count === "unlimited"
    ? queue.length >= selectedKanaIds.length
      && queue.length % selectedKanaIds.length === 0
    : config.count === "all"
      ? queue.length === selectedKanaIds.length
      : queue.length === config.count;
  const orderedAllQueueIsUnique = config.count !== "all"
    || config.strategy !== "ordered"
    || (queueShapeIsValid && new Set(queue.map((question) => (
      (question as { kanaId: string }).kanaId
    ))).size === selectedKanaIds.length);

  if (!selectedShapeIsValid
    || !queueShapeIsValid
    || !queueLengthIsValid
    || !orderedAllQueueIsUnique
    || !answers.every(isSessionAnswer)
    || value.currentIndex > queue.length
    || answers.length !== value.currentIndex
    || !answers.every((answer, index) => (
      isRecord(answer) && isRecord(queue[index])
      && answer.kanaId === queue[index].kanaId
    ))) {
    return null;
  }

  return value as unknown as InterruptedSession;
}

function evaluationKey(kanaId: string, value: PracticeEvaluation, at: string): string {
  return `${kanaId}\u0000${value}\u0000${at}`;
}

function checkpointEvaluation(session: InterruptedSession) {
  const answerIndex = session.currentIndex - 1;
  const answer = session.answers[answerIndex];
  const question = session.queue[answerIndex];
  if (!answer || !question || answer.kanaId !== question.kanaId) {
    throw new Error("Answer checkpoint does not identify a completed question.");
  }
  return {
    answer,
    key: `checkpoint\u0000${session.id}\u0000${question.id}\u0000${answer.answeredAt}`,
  };
}

function nextProgress(
  previous: StoredKanaProgress | undefined,
  kanaId: string,
  value: PracticeEvaluation,
  at: string,
  key: string,
): StoredKanaProgress | null {
  if (previous?.evaluationKeys.includes(key)) {
    return null;
  }
  return {
    kanaId,
    presented: (previous?.presented ?? 0) + 1,
    good: (previous?.good ?? 0) + (value === "good" ? 1 : 0),
    retry: (previous?.retry ?? 0) + (value === "retry" ? 1 : 0),
    lastPracticedAt: previous && previous.lastPracticedAt > at ? previous.lastPracticedAt : at,
    evaluationKeys: [...(previous?.evaluationKeys ?? []), key],
  };
}

function localDateKey(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function countPresentedOn(progress: StoredKanaProgress[], date: string): number {
  return progress.reduce((total, item) => total + item.evaluationKeys.filter((key) => {
    const segments = key.split("\u0000");
    const answeredAt = segments[segments.length - 1];
    return answeredAt !== undefined && localDateKey(answeredAt) === date;
  }).length, 0);
}

function publicProgress(progress: StoredKanaProgress): KanaProgress {
  const { evaluationKeys: _evaluationKeys, ...value } = progress;
  return value;
}

function buildDashboard(progress: KanaProgress[], sessions: SessionSummary[]): ProgressDashboard {
  const kana = [...progress].sort((left, right) => (
    right.lastPracticedAt.localeCompare(left.lastPracticedAt)
    || left.kanaId.localeCompare(right.kanaId)
  ));
  const lastEvaluationAt = kana[0]?.lastPracticedAt ?? null;
  const lastSessionAt = sessions.reduce<string | null>((latest, session) => (
    latest === null || session.endedAt > latest ? session.endedAt : latest
  ), null);

  const practiceDates = [lastEvaluationAt, lastSessionAt]
    .filter((value): value is string => value !== null)
    .sort();

  return {
    totalPresented: kana.reduce((total, item) => total + item.presented, 0),
    completedSessions: sessions.length,
    lastPracticedAt: practiceDates[practiceDates.length - 1] ?? null,
    kana,
    recentKanaIds: kana.slice(0, 5).map((item) => item.kanaId),
  };
}

class MemoryLearningRepository implements LearningRepository {
  readonly persistent = false;
  private readonly progress = new Map<string, StoredKanaProgress>();
  private readonly sessions = new Map<string, SessionSummary>();
  private interrupted: InterruptedSession | null = null;

  async recordEvaluation(kanaId: string, value: PracticeEvaluation, at: string): Promise<void> {
    const key = evaluationKey(kanaId, value, at);
    const previous = this.progress.get(kanaId);

    const next = nextProgress(previous, kanaId, value, at, key);
    if (next) {
      this.progress.set(kanaId, next);
    }
  }

  async saveSession(summary: SessionSummary): Promise<void> {
    this.sessions.set(summary.id, structuredClone(summary));
  }

  async saveInterrupted(session: InterruptedSession): Promise<void> {
    this.interrupted = structuredClone(session);
  }

  async saveAnswerCheckpoint(session: InterruptedSession): Promise<void> {
    const { answer, key } = checkpointEvaluation(session);
    const next = nextProgress(
      this.progress.get(answer.kanaId),
      answer.kanaId,
      answer.evaluation,
      answer.answeredAt,
      key,
    );
    if (next) {
      this.progress.set(answer.kanaId, next);
    }
    this.interrupted = structuredClone(session);
  }

  async loadInterrupted(): Promise<InterruptedSession | null> {
    return this.interrupted ? structuredClone(this.interrupted) : null;
  }

  async clearInterrupted(): Promise<void> {
    this.interrupted = null;
  }

  async getDashboard(): Promise<ProgressDashboard> {
    return buildDashboard(
      Array.from(this.progress.values(), publicProgress),
      Array.from(this.sessions.values()),
    );
  }

  async getPresentedOn(date: string): Promise<number> {
    return countPresentedOn(Array.from(this.progress.values()), date);
  }

  async clearAll(): Promise<void> {
    this.progress.clear();
    this.sessions.clear();
    this.interrupted = null;
  }
}

class IndexedDbLearningRepository implements LearningRepository {
  private databasePromise: Promise<IDBPDatabase<KanaLearningDatabase>> | null;
  private fallback = new MemoryLearningRepository();

  constructor(factory: IDBFactory | null) {
    this.databasePromise = factory ? openLearningDatabase(factory) : null;
  }

  get persistent(): boolean {
    return this.databasePromise !== null;
  }

  private async database(): Promise<IDBPDatabase<KanaLearningDatabase> | null> {
    if (!this.databasePromise) {
      return null;
    }

    try {
      return await this.databasePromise;
    } catch {
      this.databasePromise = null;
      return null;
    }
  }

  async recordEvaluation(kanaId: string, value: PracticeEvaluation, at: string): Promise<void> {
    const database = await this.database();
    if (!database) {
      return this.fallback.recordEvaluation(kanaId, value, at);
    }

    const transaction = database.transaction("kanaProgress", "readwrite");
    const previous = sanitizeStoredProgress(await transaction.store.get(kanaId)) ?? undefined;
    const key = evaluationKey(kanaId, value, at);

    const next = nextProgress(previous, kanaId, value, at, key);
    if (next) {
      await transaction.store.put(next);
    }
    await transaction.done;
  }

  async saveSession(summary: SessionSummary): Promise<void> {
    const database = await this.database();
    if (!database) {
      return this.fallback.saveSession(summary);
    }
    await database.put("sessions", summary);
  }

  async saveInterrupted(session: InterruptedSession): Promise<void> {
    const database = await this.database();
    if (!database) {
      return this.fallback.saveInterrupted(session);
    }
    const transaction = database.transaction("interrupted", "readwrite");
    await transaction.store.clear();
    await transaction.store.put(session);
    await transaction.done;
  }

  async saveAnswerCheckpoint(session: InterruptedSession): Promise<void> {
    const database = await this.database();
    if (!database) {
      return this.fallback.saveAnswerCheckpoint(session);
    }
    const { answer, key } = checkpointEvaluation(session);
    const transaction = database.transaction(["kanaProgress", "interrupted"], "readwrite");
    const progressStore = transaction.objectStore("kanaProgress");
    const interruptedStore = transaction.objectStore("interrupted");
    const previous = sanitizeStoredProgress(await progressStore.get(answer.kanaId)) ?? undefined;
    const next = nextProgress(previous, answer.kanaId, answer.evaluation, answer.answeredAt, key);
    if (next) {
      await progressStore.put(next);
    }
    await interruptedStore.clear();
    await interruptedStore.put(session);
    await transaction.done;
  }

  async loadInterrupted(): Promise<InterruptedSession | null> {
    const database = await this.database();
    if (!database) {
      return this.fallback.loadInterrupted();
    }
    const stored = (await database.getAll("interrupted"))[0];
    if (stored === undefined) {
      return null;
    }
    const session = sanitizeInterruptedSession(stored);
    if (!session) {
      await database.clear("interrupted");
      return null;
    }
    return session;
  }

  async clearInterrupted(): Promise<void> {
    const database = await this.database();
    if (!database) {
      return this.fallback.clearInterrupted();
    }
    await database.clear("interrupted");
  }

  async getDashboard(): Promise<ProgressDashboard> {
    const database = await this.database();
    if (!database) {
      return this.fallback.getDashboard();
    }
    const [progress, sessions] = await Promise.all([
      database.getAll("kanaProgress"),
      database.getAll("sessions"),
    ]);
    return buildDashboard(
      progress
        .map(sanitizeStoredProgress)
        .filter((item): item is StoredKanaProgress => item !== null)
        .map(publicProgress),
      sessions
        .map(sanitizeSessionSummary)
        .filter((item): item is SessionSummary => item !== null),
    );
  }

  async getPresentedOn(date: string): Promise<number> {
    const database = await this.database();
    if (!database) {
      return this.fallback.getPresentedOn(date);
    }
    const progress = (await database.getAll("kanaProgress"))
      .map(sanitizeStoredProgress)
      .filter((item): item is StoredKanaProgress => item !== null);
    return countPresentedOn(progress, date);
  }

  async clearAll(): Promise<void> {
    const database = await this.database();
    if (!database) {
      return this.fallback.clearAll();
    }
    const transaction = database.transaction(
      ["kanaProgress", "sessions", "interrupted"],
      "readwrite",
    );
    await Promise.all([
      transaction.objectStore("kanaProgress").clear(),
      transaction.objectStore("sessions").clear(),
      transaction.objectStore("interrupted").clear(),
      transaction.done,
    ]);
  }
}

export function createLearningRepository(
  options: LearningRepositoryOptions = {},
): LearningRepository {
  const factory = "indexedDB" in options
    ? options.indexedDB
    : typeof globalThis.indexedDB === "undefined" ? null : globalThis.indexedDB;
  return new IndexedDbLearningRepository(factory ?? null);
}

let singleton: LearningRepository | undefined;

export function getLearningRepository(): LearningRepository {
  singleton ??= createLearningRepository();
  return singleton;
}
