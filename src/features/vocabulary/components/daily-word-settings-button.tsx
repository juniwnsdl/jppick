"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { loadSettings, saveSettings, type AppSettings } from "../../../lib/settings";
import { scheduleDailyWordLevels } from "../daily-word-settings";
import { JLPT_LEVELS, type JlptLevel } from "../types";

function selectedLevels(levels: readonly JlptLevel[], level: JlptLevel): JlptLevel[] {
  const selected = new Set(levels);

  if (selected.has(level)) {
    selected.delete(level);
  } else {
    selected.add(level);
  }

  return JLPT_LEVELS.filter((candidate) => selected.has(candidate));
}

export function DailyWordSettingsButton() {
  const titleId = useId();
  const descriptionId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstChoiceRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [draftLevels, setDraftLevels] = useState<JlptLevel[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const opener = buttonRef.current;
    firstChoiceRef.current?.focus();

    return () => {
      if (opener?.isConnected) {
        opener.focus();
      }
    };
  }, [isOpen]);

  function openDialog() {
    const loadedSettings = loadSettings();
    setSettings(loadedSettings);
    setDraftLevels(loadedSettings.dailyWords.pendingLevels ?? loadedSettings.dailyWords.activeLevels);
    setIsOpen(true);
  }

  function closeDialog() {
    setIsOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDialog();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        "input:not([disabled]), button:not([disabled])",
      ) ?? [],
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  function saveDraft() {
    if (!settings || draftLevels.length === 0) {
      return;
    }

    const scheduled = scheduleDailyWordLevels(settings.dailyWords, draftLevels, new Date());
    saveSettings({ ...settings, dailyWords: scheduled });
    setStatus(`내일부터 ${scheduled.pendingLevels?.join(", ") ?? ""} 단어가 표시됩니다.`);
    closeDialog();
  }

  return (
    <div className="daily-word-settings">
      <button
        aria-label="오늘의 단어 설정"
        className="daily-word-settings-trigger"
        onClick={openDialog}
        ref={buttonRef}
        type="button"
      >
        <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" width="20">
          <path d="M12 15.25A3.25 3.25 0 1 0 12 8.75a3.25 3.25 0 0 0 0 6.5Z" />
          <path d="m19.4 15 .1.2 1.2.9-1.8 3.1-1.4-.6-.2.1-1.7 1-.2 1.5h-3.6l-.2-1.5-1.7-1-.2-.1-1.4.6-1.8-3.1 1.2-.9.1-.2v-2l-.1-.2-1.2-.9 1.8-3.1 1.4.6.2-.1 1.7-1 .2-1.5h3.6l.2 1.5 1.7 1 .2.1 1.4-.6 1.8 3.1-1.2.9-.1.2v2Z" strokeLinejoin="round" />
        </svg>
      </button>

      {status ? <p role="status">{status}</p> : null}

      {isOpen ? (
        <div
          className="daily-word-settings-backdrop"
          data-testid="daily-word-settings-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeDialog();
            }
          }}
        >
          <div
            aria-describedby={descriptionId}
            aria-labelledby={titleId}
            aria-modal="true"
            className="daily-word-settings-dialog"
            onKeyDown={handleKeyDown}
            ref={dialogRef}
            role="dialog"
          >
            <h2 id={titleId}>오늘의 단어 난이도</h2>
            <p id={descriptionId}>변경한 난이도는 내일부터 적용됩니다</p>
            <fieldset>
              <legend>표시할 JLPT 난이도</legend>
              {JLPT_LEVELS.map((level, index) => (
                <label key={level}>
                  <input
                    checked={draftLevels.includes(level)}
                    onChange={() => setDraftLevels((current) => selectedLevels(current, level))}
                    ref={index === 0 ? firstChoiceRef : undefined}
                    type="checkbox"
                  />
                  {level}
                </label>
              ))}
            </fieldset>
            {draftLevels.length === 0 ? <p role="alert">최소 한 개의 난이도를 선택해 주세요.</p> : null}
            <div className="daily-word-settings-actions">
              <button onClick={closeDialog} type="button">취소</button>
              <button disabled={draftLevels.length === 0} onClick={saveDraft} type="button">저장</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
