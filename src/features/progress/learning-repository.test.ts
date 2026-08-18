import "fake-indexeddb/auto";

import { deleteDB } from "idb";

import { DB_NAME, DB_VERSION } from "./db";
import { createLearningRepository } from "./learning-repository";
import type { PracticeConfig } from "../practice/types";
import type { InterruptedSession, SessionSummary } from "./types";

const config: PracticeConfig = {
  mode: "copy",
  scripts: ["hiragana"],
  groups: ["basic"],
  count: 5,
  strategy: "uniform",
};

const summary: SessionSummary = {
  id: "session-1",
  startedAt: "2026-08-18T00:00:00.000Z",
  endedAt: "2026-08-18T00:05:00.000Z",
  config,
  completed: 2,
  good: 1,
  retry: 1,
  answers: [
    { kanaId: "hiragana-a", evaluation: "good", answeredAt: "2026-08-18T00:01:00.000Z" },
    { kanaId: "hiragana-i", evaluation: "retry", answeredAt: "2026-08-18T00:02:00.000Z" },
  ],
};

const interrupted: InterruptedSession = {
  id: "session-2",
  startedAt: "2026-08-18T01:00:00.000Z",
  config,
  queue: [
    { id: "question-1", kanaId: "hiragana-a" },
    { id: "question-2", kanaId: "hiragana-i" },
  ],
  currentIndex: 1,
  answers: [
    { kanaId: "hiragana-a", evaluation: "good", answeredAt: "2026-08-18T01:01:00.000Z" },
  ],
};

beforeEach(async () => {
  await deleteDB(DB_NAME);
});

afterEach(async () => {
  await deleteDB(DB_NAME);
});

it("increments kana counters once when the same durable evaluation is replayed", async () => {
  const repository = createLearningRepository({ indexedDB });

  await repository.recordEvaluation("hiragana-a", "good", "2026-08-18T00:01:00.000Z");
  await repository.recordEvaluation("hiragana-a", "good", "2026-08-18T00:01:00.000Z");
  await repository.recordEvaluation("hiragana-a", "retry", "2026-08-18T00:02:00.000Z");

  await expect(repository.getDashboard()).resolves.toMatchObject({
    totalPresented: 2,
    kana: [{
      kanaId: "hiragana-a",
      presented: 2,
      good: 1,
      retry: 1,
      lastPracticedAt: "2026-08-18T00:02:00.000Z",
    }],
    recentKanaIds: ["hiragana-a"],
  });
  await expect(repository.getPresentedOn("2026-08-18")).resolves.toBe(2);
});

it("stores a completed session idempotently and derives dashboard metadata", async () => {
  const repository = createLearningRepository({ indexedDB });
  await repository.recordEvaluation("hiragana-i", "retry", "2026-08-18T00:02:00.000Z");

  await repository.saveSession(summary);
  await repository.saveSession(summary);

  await expect(repository.getDashboard()).resolves.toMatchObject({
    completedSessions: 1,
    lastPracticedAt: "2026-08-18T00:05:00.000Z",
  });
});

it("round-trips only the latest interrupted session", async () => {
  const repository = createLearningRepository({ indexedDB });
  await repository.saveInterrupted({ ...interrupted, id: "older-session" });
  await repository.saveInterrupted(interrupted);

  await expect(repository.loadInterrupted()).resolves.toEqual(interrupted);

  await repository.clearInterrupted();
  await expect(repository.loadInterrupted()).resolves.toBeNull();
  await expect(repository.getPresentedOn("2026-08-18")).resolves.toBe(0);
});

it("atomically replaces a replayed answer checkpoint without incrementing twice", async () => {
  const repository = createLearningRepository({ indexedDB });

  await repository.saveAnswerCheckpoint(interrupted);
  await repository.clearInterrupted();
  await repository.saveAnswerCheckpoint(interrupted);

  await expect(repository.getDashboard()).resolves.toMatchObject({ totalPresented: 1 });
  await expect(repository.loadInterrupted()).resolves.toEqual(interrupted);
});

it("opens schema version 1 with the three required stores", async () => {
  const repository = createLearningRepository({ indexedDB });
  await repository.getDashboard();

  const request = indexedDB.open(DB_NAME);
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  expect(database.version).toBe(DB_VERSION);
  expect(Array.from(database.objectStoreNames)).toEqual(["interrupted", "kanaProgress", "sessions"]);
  database.close();
});

it("clears progress, sessions, and interrupted state together", async () => {
  const repository = createLearningRepository({ indexedDB });
  await repository.recordEvaluation("hiragana-a", "good", "2026-08-18T00:01:00.000Z");
  await repository.saveSession(summary);
  await repository.saveInterrupted(interrupted);

  await repository.clearAll();

  await expect(repository.getDashboard()).resolves.toEqual({
    totalPresented: 0,
    completedSessions: 0,
    lastPracticedAt: null,
    kana: [],
    recentKanaIds: [],
  });
  await expect(repository.loadInterrupted()).resolves.toBeNull();
});

it("continues in memory and reports non-persistent mode when IndexedDB is unavailable", async () => {
  const repository = createLearningRepository({ indexedDB: null });

  await repository.recordEvaluation("hiragana-a", "good", "2026-08-18T00:01:00.000Z");

  expect(repository.persistent).toBe(false);
  await expect(repository.getDashboard()).resolves.toMatchObject({ totalPresented: 1 });
});

it("switches to memory when opening IndexedDB fails", async () => {
  const failingFactory = {
    open() {
      throw new DOMException("blocked", "InvalidStateError");
    },
  } as unknown as IDBFactory;
  const repository = createLearningRepository({ indexedDB: failingFactory });

  await repository.recordEvaluation("hiragana-a", "good", "2026-08-18T00:01:00.000Z");

  expect(repository.persistent).toBe(false);
  await expect(repository.getDashboard()).resolves.toMatchObject({ totalPresented: 1 });
});
