import type { IDBPDatabase } from "idb";

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

function evaluationKey(kanaId: string, value: "good" | "retry", at: string): string {
  return `${kanaId}\u0000${value}\u0000${at}`;
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
    const answeredAt = key.split("\u0000")[2];
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

  async recordEvaluation(kanaId: string, value: "good" | "retry", at: string): Promise<void> {
    const key = evaluationKey(kanaId, value, at);
    const previous = this.progress.get(kanaId);

    if (previous?.evaluationKeys.includes(key)) {
      return;
    }

    this.progress.set(kanaId, {
      kanaId,
      presented: (previous?.presented ?? 0) + 1,
      good: (previous?.good ?? 0) + (value === "good" ? 1 : 0),
      retry: (previous?.retry ?? 0) + (value === "retry" ? 1 : 0),
      lastPracticedAt: previous && previous.lastPracticedAt > at ? previous.lastPracticedAt : at,
      evaluationKeys: [...(previous?.evaluationKeys ?? []), key],
    });
  }

  async saveSession(summary: SessionSummary): Promise<void> {
    this.sessions.set(summary.id, structuredClone(summary));
  }

  async saveInterrupted(session: InterruptedSession): Promise<void> {
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

  async recordEvaluation(kanaId: string, value: "good" | "retry", at: string): Promise<void> {
    const database = await this.database();
    if (!database) {
      return this.fallback.recordEvaluation(kanaId, value, at);
    }

    const transaction = database.transaction("kanaProgress", "readwrite");
    const previous = await transaction.store.get(kanaId);
    const key = evaluationKey(kanaId, value, at);

    if (!previous?.evaluationKeys.includes(key)) {
      await transaction.store.put({
        kanaId,
        presented: (previous?.presented ?? 0) + 1,
        good: (previous?.good ?? 0) + (value === "good" ? 1 : 0),
        retry: (previous?.retry ?? 0) + (value === "retry" ? 1 : 0),
        lastPracticedAt: previous && previous.lastPracticedAt > at ? previous.lastPracticedAt : at,
        evaluationKeys: [...(previous?.evaluationKeys ?? []), key],
      });
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

  async loadInterrupted(): Promise<InterruptedSession | null> {
    const database = await this.database();
    if (!database) {
      return this.fallback.loadInterrupted();
    }
    return (await database.getAll("interrupted"))[0] ?? null;
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
    return buildDashboard(progress.map(publicProgress), sessions);
  }

  async getPresentedOn(date: string): Promise<number> {
    const database = await this.database();
    if (!database) {
      return this.fallback.getPresentedOn(date);
    }
    return countPresentedOn(await database.getAll("kanaProgress"), date);
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
