import "fake-indexeddb/auto";

import { deleteDB } from "idb";

import { DB_NAME, DB_VERSION } from "./db";
import { createLearningRepository } from "./learning-repository";
import type { PracticeConfig } from "../practice/types";
import type { InterruptedSession, SessionSummary } from "./types";

async function putRaw(storeName: "kanaProgress" | "sessions" | "interrupted", value: unknown) {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const transaction = database.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).put(value);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  database.close();
}

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
  selectedKanaIds: ["hiragana-a", "hiragana-i"],
  queue: [
    { id: "question-1", kanaId: "hiragana-a" },
    { id: "question-2", kanaId: "hiragana-i" },
    { id: "question-3", kanaId: "hiragana-a" },
    { id: "question-4", kanaId: "hiragana-i" },
    { id: "question-5", kanaId: "hiragana-a" },
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

it("counts ordered practice without changing correctness counters", async () => {
  const repository = createLearningRepository({ indexedDB });

  await repository.recordEvaluation(
    "hiragana-a",
    "practice" as never,
    "2026-08-18T00:01:00.000Z",
  );

  await expect(repository.getDashboard()).resolves.toMatchObject({
    totalPresented: 1,
    kana: [{
      kanaId: "hiragana-a",
      presented: 1,
      good: 0,
      retry: 0,
    }],
  });
  await expect(createLearningRepository({ indexedDB }).getDashboard()).resolves.toMatchObject({
    totalPresented: 1,
    kana: [{ presented: 1, good: 0, retry: 0 }],
  });
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
  await expect(repository.getPresentedOn("2026-08-18")).resolves.toBe(1);
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

it("salvages valid progress and session rows while ignoring corrupt stored records", async () => {
  const repository = createLearningRepository({ indexedDB });
  await repository.getDashboard();

  await putRaw("kanaProgress", {
    kanaId: "hiragana-a",
    presented: 1,
    good: 1,
    retry: 0,
    lastPracticedAt: "2026-08-18T03:00:00.000Z",
    evaluationKeys: [
      "hiragana-a\u0000good\u00002026-08-18T03:00:00.000Z",
      "malformed-key",
    ],
  });
  await putRaw("kanaProgress", {
    kanaId: "hiragana-i",
    presented: "many",
    good: 0,
    retry: 0,
    lastPracticedAt: "not-a-date",
    evaluationKeys: [],
  });
  await putRaw("sessions", { ...summary, id: "valid-session" });
  await putRaw("sessions", { id: "corrupt-session", completed: -1 });

  await expect(repository.getDashboard()).resolves.toMatchObject({
    totalPresented: 1,
    completedSessions: 1,
    kana: [{ kanaId: "hiragana-a" }],
  });
  await expect(repository.getPresentedOn("2026-08-18")).resolves.toBe(1);
});

it("discards a malformed interrupted record at the repository boundary", async () => {
  const repository = createLearningRepository({ indexedDB });
  await repository.getDashboard();
  await putRaw("interrupted", {
    ...interrupted,
    selectedKanaIds: undefined,
  });

  await expect(repository.loadInterrupted()).resolves.toBeNull();
  await expect(repository.loadInterrupted()).resolves.toBeNull();
});

it("discards an ordered all-character queue with duplicated kana", async () => {
  const repository = createLearningRepository({ indexedDB });
  await repository.getDashboard();
  await putRaw("interrupted", {
    ...interrupted,
    config: { ...config, count: "all", strategy: "ordered" },
    queue: [
      { id: "question-1", kanaId: "hiragana-a" },
      { id: "question-2", kanaId: "hiragana-a" },
    ],
    currentIndex: 0,
    answers: [],
  });

  await expect(repository.loadInterrupted()).resolves.toBeNull();
});
