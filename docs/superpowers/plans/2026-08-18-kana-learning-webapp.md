# Kana Learning Webapp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first Next.js webapp where beginners and returning learners can browse the complete modern kana catalog and practice writing with a mouse, touch, or stylus in copy and recall modes.

**Architecture:** Use the Next.js App Router for route-level UI and client components only where pointer input or browser storage is required. Keep the kana catalog, question generation, stroke math, session reducer, and persistence adapters as framework-independent TypeScript modules so they can later be reused in an iPhone client. Store progress in IndexedDB through a small repository interface and keep settings in localStorage.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Pointer Events, SVG stroke guides, `idb`, Vitest, Testing Library, `fake-indexeddb`, Playwright, pnpm.

**Spec:** `docs/superpowers/specs/2026-08-18-kana-learning-webapp-design.md`

## Global Constraints

- Node.js must be 20.9 or newer; the current machine has Node.js 22.16.0.
- Support Safari, Chrome, and Edge current and previous major versions; Next.js itself supports Safari 16.4+, Chrome 111+, and Edge 111+.
- Support mobile layouts from 320 CSS pixels and interactive targets of at least 44×44 CSS pixels.
- Use one Pointer Events input path for mouse, touch, and stylus.
- Keep all learning data on the current device; send no learning or handwriting data to a server.
- Store only session summaries and per-kana counters long-term; discard raw strokes after self-evaluation.
- Historical kana remain outside the catalog.
- Preserve a clean separation between domain modules and React/Next.js UI.
- Attribute third-party stroke assets and include their license text before shipping.

## File Map

- `package.json`, `pnpm-lock.yaml`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`: build and tooling.
- `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`: automated test configuration.
- `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`: global shell and home route.
- `src/app/chart/page.tsx`: kana chart route.
- `src/app/practice/page.tsx`, `src/app/practice/run/page.tsx`, `src/app/practice/result/page.tsx`: practice setup, active session, and results.
- `src/app/records/page.tsx`: local progress route.
- `src/components/app-nav.tsx`, `src/components/page-header.tsx`, `src/components/empty-state.tsx`: shared navigation and page primitives.
- `src/features/kana/types.ts`, `src/features/kana/catalog.ts`, `src/features/kana/catalog.test.ts`: kana domain and complete catalog.
- `src/features/kana/components/kana-chart.tsx`, `kana-detail.tsx`, `stroke-guide.tsx`: kana exploration UI.
- `src/features/practice/types.ts`, `question-generator.ts`, `question-generator.test.ts`: practice settings and deterministic question generation.
- `src/features/practice/session-reducer.ts`, `session-reducer.test.ts`: session state transitions.
- `src/features/practice/strokes.ts`, `strokes.test.ts`, `components/writing-canvas.tsx`: normalized pointer strokes and drawing UI.
- `src/features/practice/components/practice-setup.tsx`, `practice-session.tsx`, `practice-result.tsx`: practice route UI.
- `src/features/progress/types.ts`, `db.ts`, `learning-repository.ts`, `learning-repository.test.ts`: IndexedDB persistence.
- `src/features/progress/components/progress-dashboard.tsx`: records UI.
- `src/lib/settings.ts`, `src/lib/settings.test.ts`: localStorage preferences.
- `public/strokes/hiragana/*.svg`, `public/strokes/katakana/*.svg`, `public/THIRD_PARTY_LICENSES.md`: bundled basic-kana stroke guides and attribution.
- `scripts/validate-kana-catalog.mjs`: catalog and asset coverage validation.
- `e2e/core-flow.spec.ts`: browser-level mobile and desktop flows.

---

### Task 1: Scaffold the Next.js application and test harness

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `eslint.config.mjs`
- Create: `postcss.config.mjs`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `playwright.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/page.tsx`
- Create: `src/app/page.test.tsx`
- Create: `.gitignore`

**Interfaces:**
- Consumes: Next.js App Router conventions.
- Produces: `pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test:e2e` commands used by every later task.

- [ ] **Step 1: Create the dependency manifest and tool configuration**

Use `next`, `react`, and `react-dom` at the versions resolved by `pnpm add next@latest react@latest react-dom@latest`, then add `idb`. Add TypeScript, Tailwind, ESLint, Vitest, Testing Library, jsdom, fake-indexeddb, and Playwright as development dependencies. Define these scripts exactly:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "validate:kana": "node scripts/validate-kana-catalog.mjs"
  }
}
```

- [ ] **Step 2: Write the failing home-page smoke test**

```tsx
import { render, screen } from "@testing-library/react";
import HomePage from "./page";

it("offers chart and practice as the two primary actions", () => {
  render(<HomePage />);
  expect(screen.getByRole("link", { name: "글자표 보기" })).toBeVisible();
  expect(screen.getByRole("link", { name: "쓰기 연습 시작" })).toBeVisible();
});
```

- [ ] **Step 3: Run the test to verify the missing UI fails**

Run: `pnpm test -- src/app/page.test.tsx`

Expected: FAIL because the required links are not rendered.

- [ ] **Step 4: Implement the Korean root layout and minimal home page**

Set `<html lang="ko">`, include viewport metadata, and render the two links to `/chart` and `/practice`. Add global color tokens, focus-visible styles, `touch-action` defaults, and a centered mobile-first content container.

- [ ] **Step 5: Verify the scaffold**

Run: `pnpm test -- src/app/page.test.tsx && pnpm lint && pnpm typecheck && pnpm build`

Expected: the smoke test passes and every command exits with code 0.

- [ ] **Step 6: Commit the scaffold**

```bash
git add package.json pnpm-lock.yaml next.config.ts tsconfig.json eslint.config.mjs postcss.config.mjs vitest.config.ts vitest.setup.ts playwright.config.ts src/app .gitignore
git commit -m "chore: scaffold kana learning webapp"
```

### Task 2: Build and validate the complete kana catalog

**Files:**
- Create: `src/features/kana/types.ts`
- Create: `src/features/kana/catalog.ts`
- Create: `src/features/kana/catalog.test.ts`
- Create: `scripts/validate-kana-catalog.mjs`

**Interfaces:**
- Consumes: none.
- Produces: `KanaUnit`, `KanaScript`, `KanaGroup`, `KANA_CATALOG`, `getKanaById(id)`, and `filterKana(filter)`.

- [ ] **Step 1: Define the catalog types and failing invariants**

```ts
export type KanaScript = "hiragana" | "katakana";
export type KanaGroup = "basic" | "voiced" | "yoon" | "small" | "extended";

export interface KanaUnit {
  id: string;
  display: string;
  glyphs: string[];
  script: KanaScript;
  group: KanaGroup;
  romaji: string;
  readingKo: string;
  strokeAssetKeys: string[];
}
```

Test unique IDs, non-empty readings, one stroke key per glyph, 46 basic units per script, presence of `っ`, `ッ`, `ー`, `きゃ`, `キャ`, `ティ`, `ファ`, and absence of `ゐ`, `ゑ`, `ヰ`, `ヱ`.

- [ ] **Step 2: Run the catalog test to verify it fails**

Run: `pnpm test -- src/features/kana/catalog.test.ts`

Expected: FAIL because `KANA_CATALOG` and helpers do not exist.

- [ ] **Step 3: Implement the catalog from compact row definitions**

Create exact basic rows from these aligned strings:

```ts
const BASIC = [
  ["あいうえお", "アイウエオ", ["a", "i", "u", "e", "o"]],
  ["かきくけこ", "カキクケコ", ["ka", "ki", "ku", "ke", "ko"]],
  ["さしすせそ", "サシスセソ", ["sa", "shi", "su", "se", "so"]],
  ["たちつてと", "タチツテト", ["ta", "chi", "tsu", "te", "to"]],
  ["なにぬねの", "ナニヌネノ", ["na", "ni", "nu", "ne", "no"]],
  ["はひふへほ", "ハヒフヘホ", ["ha", "hi", "fu", "he", "ho"]],
  ["まみむめも", "マミムメモ", ["ma", "mi", "mu", "me", "mo"]],
  ["やゆよ", "ヤユヨ", ["ya", "yu", "yo"]],
  ["らりるれろ", "ラリルレロ", ["ra", "ri", "ru", "re", "ro"]],
  ["わをん", "ワヲン", ["wa", "wo", "n"]]
] as const;
```

Generate voiced rows for K/S/T/H plus semi-voiced H, add `ゔ`/`ヴ`, generate yoon units for K/G/S/J/T/N/H/B/P/M/R initials with `ya/yu/yo`, and add the exact small and extended units listed in PRD section 6. Keep Korean readings in a checked-in `ROMAJI_TO_KOREAN` map so every catalog entry is deterministic.

- [ ] **Step 4: Add a build-time catalog validation script**

The script imports the compiled catalog through `tsx`, prints counts by script/group, and exits non-zero for duplicate IDs, empty fields, or missing stroke asset keys. Add `tsx` as a development dependency for this command.

- [ ] **Step 5: Verify domain coverage**

Run: `pnpm test -- src/features/kana/catalog.test.ts && pnpm validate:kana`

Expected: all invariants pass and the script prints a non-zero count for every declared group.

- [ ] **Step 6: Commit the catalog**

```bash
git add src/features/kana scripts/validate-kana-catalog.mjs package.json pnpm-lock.yaml
git commit -m "feat: add complete modern kana catalog"
```

### Task 3: Add the app shell, home dashboard, and settings

**Files:**
- Create: `src/components/app-nav.tsx`
- Create: `src/components/page-header.tsx`
- Create: `src/lib/settings.ts`
- Create: `src/lib/settings.test.ts`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: browser `localStorage`.
- Produces: `AppSettings`, `loadSettings()`, `saveSettings(settings)`, and four-route application navigation.

- [ ] **Step 1: Write failing settings tests**

Verify defaults `{ guideLines: true, traceGuide: true, overlayOpacity: 0.55 }`, recovery from malformed JSON, and clamping opacity to `0..1`.

- [ ] **Step 2: Run the tests to verify failure**

Run: `pnpm test -- src/lib/settings.test.ts`

Expected: FAIL because settings functions do not exist.

- [ ] **Step 3: Implement versioned settings parsing**

```ts
export interface AppSettings {
  version: 1;
  guideLines: boolean;
  traceGuide: boolean;
  overlayOpacity: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  version: 1,
  guideLines: true,
  traceGuide: true,
  overlayOpacity: 0.55
};
```

Guard every browser API behind `typeof window !== "undefined"`.

- [ ] **Step 4: Implement the shared navigation and home dashboard**

Add `홈`, `글자표`, `연습`, and `기록` destinations. Use a bottom navigation bar below 768px and a top navigation bar above it. Keep the two primary home actions visually dominant and reserve progress cards for Task 8 data wiring.

- [ ] **Step 5: Verify shell behavior**

Run: `pnpm test -- src/lib/settings.test.ts src/app/page.test.tsx && pnpm lint && pnpm typecheck`

Expected: all commands pass.

- [ ] **Step 6: Commit the shell**

```bash
git add src/components src/lib src/app/layout.tsx src/app/page.tsx src/app/globals.css
git commit -m "feat: add mobile-first application shell"
```

### Task 4: Implement the kana chart, detail panel, and static stroke guide

**Files:**
- Create: `src/app/chart/page.tsx`
- Create: `src/features/kana/components/kana-chart.tsx`
- Create: `src/features/kana/components/kana-detail.tsx`
- Create: `src/features/kana/components/stroke-guide.tsx`
- Create: `src/features/kana/components/kana-chart.test.tsx`
- Create: `public/strokes/hiragana/*.svg`
- Create: `public/strokes/katakana/*.svg`
- Create: `public/THIRD_PARTY_LICENSES.md`
- Modify: `scripts/validate-kana-catalog.mjs`

**Interfaces:**
- Consumes: `KANA_CATALOG`, `filterKana(filter)`, and each unit's `strokeAssetKeys`.
- Produces: filterable chart UI and `StrokeGuide({ assetKeys, animated })`.

- [ ] **Step 1: Write failing chart interaction tests**

Render the chart, switch from hiragana to katakana, filter to yoon, open `キャ`, and assert the detail panel shows `kya`, `캬`, and an `이 문자 연습` link carrying `kana=katakana-kya`.

- [ ] **Step 2: Run the chart test to verify failure**

Run: `pnpm test -- src/features/kana/components/kana-chart.test.tsx`

Expected: FAIL because chart components do not exist.

- [ ] **Step 3: Bundle and attribute stroke assets**

Use the basic kana SVGs from `zhengkyl/strokesvg`, which are based on Klee One and licensed under the SIL Open Font License. Preserve the repository's license text and attribution in `public/THIRD_PARTY_LICENSES.md`. Store one file per base glyph; render compound units by placing their component guides side by side. Do not fetch SVGs from a CDN at runtime.

- [ ] **Step 4: Implement the chart and accessible detail dialog**

Use buttons for tabs and filters, a semantic grid/list for kana cells, and a dialog on desktop that becomes a bottom sheet on mobile. Trap focus while open, close on Escape, restore focus to the selected cell, and keep every cell at least 44×44 CSS pixels.

- [ ] **Step 5: Extend asset validation and verify**

Make `pnpm validate:kana` assert that every single-glyph practice item has an existing SVG. Compound units must resolve each `strokeAssetKeys` entry separately.

Run: `pnpm test -- src/features/kana/components/kana-chart.test.tsx && pnpm validate:kana && pnpm lint && pnpm typecheck`

Expected: all commands pass.

- [ ] **Step 6: Commit the chart**

```bash
git add src/app/chart src/features/kana/components public/strokes public/THIRD_PARTY_LICENSES.md scripts/validate-kana-catalog.mjs
git commit -m "feat: add kana chart and stroke guides"
```

### Task 5: Implement practice settings and deterministic question generation

**Files:**
- Create: `src/features/practice/types.ts`
- Create: `src/features/practice/question-generator.ts`
- Create: `src/features/practice/question-generator.test.ts`
- Create: `src/features/practice/components/practice-setup.tsx`
- Create: `src/features/practice/components/practice-setup.test.tsx`
- Create: `src/app/practice/page.tsx`

**Interfaces:**
- Consumes: `KanaUnit[]` and optional `Record<string, KanaProgress>`.
- Produces: `PracticeConfig`, `Question`, `createQuestionQueue(config, catalog, progress, random)`, and a URL-serializable practice setup.

- [ ] **Step 1: Define types and failing generator tests**

```ts
export interface PracticeConfig {
  mode: "copy" | "recall";
  scripts: Array<"hiragana" | "katakana">;
  groups: Array<"basic" | "voiced" | "yoon" | "small" | "extended">;
  count: 5 | 10 | 20 | "unlimited";
  strategy: "uniform" | "least-practiced" | "difficult";
}

export interface Question {
  id: string;
  kanaId: string;
}
```

Test filter fidelity, deterministic shuffling with an injected random function, no duplicate within a catalog cycle, no boundary repeat between cycles, uniform fallback without progress, and weighting for least-practiced/difficult strategies.

- [ ] **Step 2: Run generator tests to verify failure**

Run: `pnpm test -- src/features/practice/question-generator.test.ts`

Expected: FAIL because the generator is missing.

- [ ] **Step 3: Implement the pure question generator**

Use Fisher–Yates for uniform cycles. For weighted strategies, calculate a score per unit, sample without replacement inside each cycle, and accept the random function as `(maxExclusive: number) => number` so tests never depend on `Math.random()`.

- [ ] **Step 4: Write and implement practice setup UI tests**

Verify both modes, three script choices, five group filters, four counts, three strategies, and disabled start when the active filters select zero units. Submit the config to `/practice/run` with the exact shape `mode=copy&scripts=hiragana,katakana&groups=basic,yoon&count=10&strategy=uniform`; encode unlimited count as `count=unlimited`. Reload and sharing must preserve setup without including learning data.

- [ ] **Step 5: Verify setup and generator**

Run: `pnpm test -- src/features/practice && pnpm lint && pnpm typecheck`

Expected: all tests and checks pass.

- [ ] **Step 6: Commit practice setup**

```bash
git add src/features/practice src/app/practice
git commit -m "feat: add practice setup and question generation"
```

### Task 6: Build normalized stroke state and the pointer writing canvas

**Files:**
- Create: `src/features/practice/strokes.ts`
- Create: `src/features/practice/strokes.test.ts`
- Create: `src/features/practice/components/writing-canvas.tsx`
- Create: `src/features/practice/components/writing-canvas.test.tsx`

**Interfaces:**
- Consumes: Pointer Events and settings for guide lines.
- Produces: `Point`, `Stroke`, `normalizePoint`, `denormalizePoint`, and `WritingCanvas({ strokes, onChange, guide })`.

- [ ] **Step 1: Write failing normalized-coordinate tests**

```ts
export interface Point { x: number; y: number; pressure: number; }
export type Stroke = Point[];
```

Test top-left and bottom-right normalization, clamping outside coordinates, preservation after resizing, undo of only the final stroke, and clear of all strokes.

- [ ] **Step 2: Run stroke tests to verify failure**

Run: `pnpm test -- src/features/practice/strokes.test.ts`

Expected: FAIL because stroke utilities do not exist.

- [ ] **Step 3: Implement the pure stroke helpers**

Use normalized `0..1` coordinates and clamp pressure to `0..1`. Keep `undoStroke(strokes)` and `clearStrokes()` immutable.

- [ ] **Step 4: Write failing pointer interaction tests**

Simulate pointer down, two pointer moves, and pointer up; assert one completed stroke. Test pointer capture, undo, clear, and `touch-action: none` on the drawing surface.

- [ ] **Step 5: Implement the responsive canvas**

Use a `<canvas>` for user ink and an SVG layer for guide lines/trace content. Resize with `ResizeObserver` and device-pixel ratio, redraw normalized strokes after resize, use round caps/joins, ignore secondary pointers, and set pointer capture until the active stroke ends.

- [ ] **Step 6: Verify canvas behavior**

Run: `pnpm test -- src/features/practice/strokes.test.ts src/features/practice/components/writing-canvas.test.tsx && pnpm lint && pnpm typecheck`

Expected: all checks pass.

- [ ] **Step 7: Commit the writing canvas**

```bash
git add src/features/practice/strokes.ts src/features/practice/strokes.test.ts src/features/practice/components/writing-canvas.tsx src/features/practice/components/writing-canvas.test.tsx
git commit -m "feat: add touch and mouse writing canvas"
```

### Task 7: Implement the active session, model overlay, self-evaluation, and results

**Files:**
- Create: `src/features/practice/session-reducer.ts`
- Create: `src/features/practice/session-reducer.test.ts`
- Create: `src/features/practice/components/practice-session.tsx`
- Create: `src/features/practice/components/practice-session.test.tsx`
- Create: `src/features/practice/components/practice-result.tsx`
- Create: `src/app/practice/run/page.tsx`
- Create: `src/app/practice/result/page.tsx`

**Interfaces:**
- Consumes: `PracticeConfig`, `Question[]`, `WritingCanvas`, `StrokeGuide`, and settings.
- Produces: `PracticeSessionState`, `practiceSessionReducer`, `Evaluation`, and result navigation state.

- [ ] **Step 1: Define reducer transitions and failing tests**

```ts
export type Evaluation = "good" | "retry";
export type SessionPhase = "writing" | "reviewing" | "complete";
```

Test `START_STROKE`, `UNDO`, `CLEAR`, `REVEAL`, `SET_OVERLAY_OPACITY`, `EVALUATE`, `NEXT`, and `END`. Ensure `EVALUATE` is rejected before reveal, raw strokes are cleared when advancing, and unlimited sessions complete only on `END`.

- [ ] **Step 2: Run reducer tests to verify failure**

Run: `pnpm test -- src/features/practice/session-reducer.test.ts`

Expected: FAIL because reducer functions do not exist.

- [ ] **Step 3: Implement the reducer and serializable session summary**

Keep raw strokes only on the current question. Store results as `{ kanaId, evaluation, answeredAt }`. Expose a `toSessionSummary(state)` helper that excludes strokes.

- [ ] **Step 4: Write failing copy/recall UI tests**

In copy mode, assert the kana and optional trace guide are visible before reveal. In recall mode, assert Korean reading and romaji are visible while the kana is hidden. After `정답 확인`, assert the model overlay, opacity control, `잘 썼어요`, and `다시 연습` appear.

- [ ] **Step 5: Implement active practice and result routes**

Parse and validate search parameters on entry. If invalid, redirect to `/practice` with a Korean validation message. Warn before leaving an active session, permit reveal with no strokes after a confirmation message, and offer `어려웠던 문자만 다시 하기`, `같은 설정으로 다시 하기`, and `홈으로` on results.

- [ ] **Step 6: Verify session behavior**

Run: `pnpm test -- src/features/practice/session-reducer.test.ts src/features/practice/components/practice-session.test.tsx && pnpm lint && pnpm typecheck`

Expected: all tests and checks pass.

- [ ] **Step 7: Commit the session flow**

```bash
git add src/features/practice/session-reducer.ts src/features/practice/session-reducer.test.ts src/features/practice/components/practice-session.tsx src/features/practice/components/practice-session.test.tsx src/features/practice/components/practice-result.tsx src/app/practice/run src/app/practice/result
git commit -m "feat: add writing practice session flow"
```

### Task 8: Persist progress, restore interrupted sessions, and build records

**Files:**
- Create: `src/features/progress/types.ts`
- Create: `src/features/progress/db.ts`
- Create: `src/features/progress/learning-repository.ts`
- Create: `src/features/progress/learning-repository.test.ts`
- Create: `src/features/progress/components/progress-dashboard.tsx`
- Create: `src/features/progress/components/progress-dashboard.test.tsx`
- Create: `src/app/records/page.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/features/practice/components/practice-session.tsx`

**Interfaces:**
- Consumes: serializable session summary and per-answer evaluations.
- Produces: `KanaProgress`, `SessionSummary`, `InterruptedSession`, and `LearningRepository` methods `recordEvaluation`, `saveSession`, `saveInterrupted`, `loadInterrupted`, `clearInterrupted`, `getDashboard`, and `clearAll`.

- [ ] **Step 1: Define persistence models and failing repository tests**

```ts
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
  recordEvaluation(kanaId: string, value: "good" | "retry", at: string): Promise<void>;
  saveSession(summary: SessionSummary): Promise<void>;
  saveInterrupted(session: InterruptedSession): Promise<void>;
  loadInterrupted(): Promise<InterruptedSession | null>;
  clearInterrupted(): Promise<void>;
  getDashboard(): Promise<ProgressDashboard>;
  clearAll(): Promise<void>;
}
```

Use `fake-indexeddb` to test counter updates, session summaries, interrupted-session round trips, schema version 1, and clearing all records.

- [ ] **Step 2: Run repository tests to verify failure**

Run: `pnpm test -- src/features/progress/learning-repository.test.ts`

Expected: FAIL because the repository is missing.

- [ ] **Step 3: Implement the IndexedDB adapter with graceful fallback**

Create stores `kanaProgress`, `sessions`, and `interrupted` with schema version 1. If IndexedDB initialization fails, use an in-memory repository for the current visit and expose `{ persistent: false }` so the UI can display `이 브라우저에서는 기록이 유지되지 않아요.`

- [ ] **Step 4: Wire persistence into practice and home**

Persist each evaluation, save the session on completion, autosave interrupted state after each completed question, and remove it after completion. On `/practice/run`, show `이어하기` and `새로 시작` if compatible interrupted state exists. Show today's count and recent kana on the home route.

- [ ] **Step 5: Implement and test the records dashboard**

Display totals, completed sessions, last practiced date, least-practiced kana, difficult kana sorted by `retry / presented`, and per-kana counters. Require a typed confirmation button sequence before `clearAll()` and state that deletion cannot be recovered.

- [ ] **Step 6: Verify persistence and records**

Run: `pnpm test -- src/features/progress src/app/page.test.tsx && pnpm lint && pnpm typecheck`

Expected: all checks pass.

- [ ] **Step 7: Commit local progress**

```bash
git add src/features/progress src/app/records src/app/page.tsx src/features/practice/components/practice-session.tsx
git commit -m "feat: persist local kana learning progress"
```

### Task 9: Add responsive, accessibility, browser, and production verification

**Files:**
- Create: `e2e/core-flow.spec.ts`
- Create: `e2e/accessibility-keyboard.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `src/app/globals.css`
- Modify: affected components from Tasks 3–8
- Modify: `README.md`

**Interfaces:**
- Consumes: the complete MVP.
- Produces: release-level browser evidence and local setup documentation.

- [ ] **Step 1: Write failing mobile and desktop E2E flows**

Cover these exact flows:

```ts
test("mobile user completes five copy questions", async ({ page }) => {
  await page.goto("/practice");
  await page.getByLabel("따라 쓰기").check();
  await page.getByLabel("문제 수 5개").check();
  await page.getByRole("button", { name: "연습 시작" }).click();
  // Draw with pointer coordinates, reveal, self-evaluate, and repeat five times.
  await expect(page.getByRole("heading", { name: "연습 결과" })).toBeVisible();
});
```

Also cover mixed recall, chart-to-single-kana practice, difficult-only retry, progress after reload, 320px viewport, iPhone viewport, and desktop mouse input.

- [ ] **Step 2: Run E2E to confirm gaps**

Run: `pnpm build && pnpm test:e2e`

Expected: tests expose any missing selectors, focus handling, or responsive defects before polish.

- [ ] **Step 3: Fix responsive and accessibility defects**

Ensure keyboard completion from home through results, visible focus, semantic labels, non-color status indicators, reduced-motion handling, Escape behavior, 44×44 targets, no horizontal overflow at 320px, and no page scroll while drawing on iPhone WebKit.

- [ ] **Step 4: Document local usage and third-party data**

Write setup commands, supported practice modes, local-only storage behavior, browser support, test commands, and the stroke asset attribution path in `README.md`. State that clearing browser data removes progress.

- [ ] **Step 5: Run the full release gate**

Run:

```bash
pnpm validate:kana
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm test:e2e
```

Expected: every command exits with code 0, all catalog invariants pass, and all Playwright projects pass.

- [ ] **Step 6: Inspect the production UI manually**

Open the production build at 320×568, an iPhone viewport, and desktop width. Verify chart scrolling, detail focus restoration, pointer drawing, overlay opacity, interrupted-session recovery, records deletion confirmation, and Korean copy.

- [ ] **Step 7: Commit release verification**

```bash
git add e2e playwright.config.ts src README.md
git commit -m "test: verify kana webapp release flows"
```

## Execution Notes

- The official Next.js installation guide recommends TypeScript, ESLint, Tailwind CSS, App Router, and Turbopack defaults and requires Node.js 20.9 or newer: <https://nextjs.org/docs/app/getting-started/installation>.
- The selected kana stroke source is `zhengkyl/strokesvg`; its README states the assets are based on Klee One under the SIL Open Font License: <https://github.com/zhengkyl/strokesvg>.
- Static base-kana stroke assets cover compound units by composition. A yoon or extended unit displays and animates each component in writing order rather than requiring a separate compound SVG.
- PWA installation, animated timeline controls, import/export, cloud sync, automatic handwriting judgment, and native iPhone packaging remain outside this MVP implementation plan.
