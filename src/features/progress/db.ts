import { wrap, type DBSchema, type IDBPDatabase } from "idb";

import type { InterruptedSession, KanaProgress, SessionSummary } from "./types";

export const DB_NAME = "kana-learning";
export const DB_VERSION = 1;

export interface StoredKanaProgress extends KanaProgress {
  evaluationKeys: string[];
}

export interface KanaLearningDatabase extends DBSchema {
  kanaProgress: {
    key: string;
    value: StoredKanaProgress;
  };
  sessions: {
    key: string;
    value: SessionSummary;
  };
  interrupted: {
    key: string;
    value: InterruptedSession;
  };
}

export async function openLearningDatabase(
  factory: IDBFactory,
): Promise<IDBPDatabase<KanaLearningDatabase>> {
  const request = factory.open(DB_NAME, DB_VERSION);
  request.addEventListener("upgradeneeded", () => {
    const database = request.result;
    database.createObjectStore("kanaProgress", { keyPath: "kanaId" });
    database.createObjectStore("sessions", { keyPath: "id" });
    database.createObjectStore("interrupted", { keyPath: "id" });
  });
  const database = await wrap(request) as IDBPDatabase<KanaLearningDatabase>;
  database.addEventListener("versionchange", () => database.close());
  return database;
}
