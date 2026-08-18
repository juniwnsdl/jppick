import type { PracticeConfig, Question } from "../practice/types";

export interface KanaProgress {
  kanaId: string;
  presented: number;
  good: number;
  retry: number;
  lastPracticedAt: string;
}

export interface SessionAnswer {
  kanaId: string;
  evaluation: "good" | "retry";
  answeredAt: string;
}

export interface SessionSummary {
  id: string;
  startedAt: string;
  endedAt: string;
  config: PracticeConfig;
  completed: number;
  good: number;
  retry: number;
  answers: SessionAnswer[];
}

export interface InterruptedSession {
  id: string;
  startedAt: string;
  config: PracticeConfig;
  queue: Question[];
  currentIndex: number;
  answers: SessionAnswer[];
}

export interface ProgressDashboard {
  totalPresented: number;
  completedSessions: number;
  lastPracticedAt: string | null;
  kana: KanaProgress[];
  recentKanaIds: string[];
}

export interface LearningRepository {
  readonly persistent: boolean;
  recordEvaluation(kanaId: string, value: "good" | "retry", at: string): Promise<void>;
  saveSession(summary: SessionSummary): Promise<void>;
  saveInterrupted(session: InterruptedSession): Promise<void>;
  saveAnswerCheckpoint(session: InterruptedSession): Promise<void>;
  loadInterrupted(): Promise<InterruptedSession | null>;
  clearInterrupted(): Promise<void>;
  getDashboard(): Promise<ProgressDashboard>;
  getPresentedOn(date: string): Promise<number>;
  clearAll(): Promise<void>;
}
