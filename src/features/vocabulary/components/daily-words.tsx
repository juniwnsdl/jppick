"use client";

import { useEffect, useState } from "react";

import { loadSettings, saveSettings } from "../../../lib/settings";
import { localDateKey } from "../local-date";
import { getDailyWords } from "../daily-word-selector";
import { resolveDailyWordSettings, type DailyWordLevelSettings } from "../daily-word-settings";
import { type JlptLevel, type VocabularyWord } from "../types";
import { loadVocabularyLevel } from "../vocabulary-loader";

type VocabularyLevelLoader = (level: JlptLevel) => Promise<VocabularyWord[]>;

interface DailyWordsProps {
  date?: Date;
  loader?: VocabularyLevelLoader;
}

const defaultLoader: VocabularyLevelLoader = loadVocabularyLevel;

function sameSettings(left: DailyWordLevelSettings, right: DailyWordLevelSettings): boolean {
  return left.effectiveDate === right.effectiveDate
    && left.pendingLevels?.join("|") === right.pendingLevels?.join("|")
    && left.activeLevels.join("|") === right.activeLevels.join("|");
}

function displayDate(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export function DailyWords({ date = new Date(), loader = defaultLoader }: DailyWordsProps) {
  const dateKey = localDateKey(date);
  const [words, setWords] = useState<VocabularyWord[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    const settings = loadSettings();
    const activeSettings = resolveDailyWordSettings(settings.dailyWords, dateKey);

    if (!sameSettings(settings.dailyWords, activeSettings)) {
      saveSettings({ ...settings, dailyWords: activeSettings });
    }

    setWords(null);
    setLoadError(false);

    void Promise.all(activeSettings.activeLevels.map(async (level) => [
      level,
      await loader(level),
    ] as const)).then(
      (loadedLevels) => {
        if (!current) {
          return;
        }

        const wordsByLevel = Object.fromEntries(loadedLevels) as Partial<Record<JlptLevel, VocabularyWord[]>>;
        setWords(getDailyWords(wordsByLevel, dateKey, activeSettings.activeLevels, 5));
      },
    ).catch(
      () => {
        if (current) {
          setLoadError(true);
        }
      },
    );

    return () => {
      current = false;
    };
  }, [attempt, dateKey, loader]);

  return (
    <section aria-labelledby="daily-words-heading" className="dashboard-section daily-words-section">
      <div className="section-title">
        <div>
          <h2 id="daily-words-heading">오늘의 단어</h2>
          <p>{displayDate(date)}</p>
        </div>
      </div>

      {loadError ? (
        <div className="daily-words-error" role="alert">
          <p>오늘의 단어를 불러오지 못했어요.</p>
          <button onClick={() => setAttempt((value) => value + 1)} type="button">다시 시도</button>
        </div>
      ) : null}

      {!words && !loadError ? <p role="status">오늘의 단어를 불러오는 중이에요.</p> : null}

      {words ? (
        <div className="daily-words-grid">
          {words.map((word) => (
            <article className="daily-word-card" key={`${word.level}-${word.word}-${word.reading}`}>
              <div className="daily-word-card-heading">
                <h3>{word.word}</h3>
                <span className="daily-word-level">{word.level}</span>
              </div>
              <p className="daily-word-reading">{word.reading} · {word.pronunciationKo}</p>
              <p className="daily-word-meaning">{word.meaningKo}</p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
