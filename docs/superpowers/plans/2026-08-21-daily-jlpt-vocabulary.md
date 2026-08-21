# Daily JLPT Vocabulary Implementation Plan

> Post-implementation amendment (2026-08-21): the approved default changed to N3/N4/N5 and the daily count changed to six (two per default level). The steps below preserve the original execution record.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bundle translated N1~N5 vocabulary and show five balanced, deterministic daily words with next-day difficulty settings.

**Architecture:** Preserve OpenJLPT vocabulary JSON under `data/vendor`, generate one slim Korean runtime JSON per level under `public/data/jlpt`, and load only active levels in the browser. Pure modules own local-date settings promotion and seeded balanced selection; focused client components own the header modal and home cards.

**Tech Stack:** Next.js 16.3.1, React 19.2.8, TypeScript 5.9, Vitest, Testing Library, Playwright, static JSON, localStorage.

**Spec:** `docs/superpowers/specs/2026-08-21-daily-jlpt-vocabulary-design.md`

## Global Constraints

- No external API, Supabase, server database, account, search, quiz, example-sentence UI, or runtime GitHub request.
- Default active levels are exactly `N1`, `N2`, `N3`; at least one level must remain selected.
- A saved selection becomes active on the next local calendar date, not immediately.
- `toISOString()` must not determine the local daily-word date.
- Five words are deterministic for the same date, active levels, and data; selected levels differ in allocation by at most one word.
- Runtime entries contain only `word`, `reading`, `pronunciationKo`, `meaningKo`, and `level`.
- Existing unrelated working-tree changes must not be reverted or overwritten.
- Follow `AGENTS.md`; before changing Next.js behavior, consult the relevant bundled guide under `node_modules/next/dist/docs/`.

## File Map

- `data/vendor/openjlpt/vocab/*.json`: untouched OpenJLPT source vocabulary.
- `data/vendor/openjlpt/SOURCE.md`: resolved source commit, URLs, counts, and license note.
- `public/data/jlpt/*.json`: translated runtime vocabulary, one file per level.
- `scripts/validate-vocabulary.mjs`: source/runtime count and schema validation.
- `src/features/vocabulary/types.ts`: shared JLPT level and word types/constants.
- `src/features/vocabulary/local-date.ts`: local date key and next-date calculation.
- `src/features/vocabulary/daily-word-selector.ts`: seeded balanced selection.
- `src/features/vocabulary/daily-word-settings.ts`: active/pending settings parsing and promotion.
- `src/features/vocabulary/vocabulary-loader.ts`: level URL mapping, validation, and request cache.
- `src/features/vocabulary/components/daily-words.tsx`: home section states and cards.
- `src/features/vocabulary/components/daily-word-settings-button.tsx`: header icon and modal.
- `src/lib/settings.ts`: versioned integration with existing writing-guide settings.
- `src/components/app-nav.tsx`: place the settings control at the header's right edge.
- `src/app/page.tsx`: insert `DailyWords` between quick start and dashboard.
- `src/app/globals.css`: modal and daily-word responsive styling.
- Focused `*.test.ts(x)` files beside each module/component and `e2e/core-flow.spec.ts` for integrated behavior.

---

### Task 1: Pin OpenJLPT source data and add the validator

**Files:**
- Create: `data/vendor/openjlpt/vocab/n1.json`
- Create: `data/vendor/openjlpt/vocab/n2.json`
- Create: `data/vendor/openjlpt/vocab/n3.json`
- Create: `data/vendor/openjlpt/vocab/n4.json`
- Create: `data/vendor/openjlpt/vocab/n5.json`
- Create: `data/vendor/openjlpt/SOURCE.md`
- Create: `scripts/validate-vocabulary.mjs`
- Modify: `package.json`
- Modify: `public/THIRD_PARTY_LICENSES.md`

**Interfaces:**
- Consumes: OpenJLPT `data/json/vocab/{n1,n2,n3,n4,n5}.json` from one resolved `main` commit.
- Produces: `pnpm validate:vocabulary` and `pnpm validate:vocabulary --level N1` through `N5`.

- [ ] **Step 1: Resolve and record the source revision**

Run `git ls-remote https://github.com/evanclan/OpenJLPT.git refs/heads/main`, use the returned 40-character SHA in all five raw URLs, and write `SOURCE.md` with that exact SHA, the repository URL, CC BY-SA 4.0, NOTICE URL, and expected counts `N1=3463`, `N2=1793`, `N3=1784`, `N4=632`, `N5=662`.

- [ ] **Step 2: Download only the five source JSON files**

Use raw URLs of the form:

```text
https://raw.githubusercontent.com/evanclan/OpenJLPT/<resolved-sha>/data/json/vocab/n1.json
```

Write only the five listed vocabulary files; do not clone or copy the full upstream repository.

- [ ] **Step 3: Add a validator that fails before runtime files exist**

The validator must parse optional `--level N1`, otherwise validate all levels; verify source count, runtime count, exact runtime keys, non-empty string fields, matching level, and uniqueness of `${level}\u0000${word}\u0000${reading}`. It exits nonzero with a level and entry index in each error.

Add this script entry:

```json
"validate:vocabulary": "node scripts/validate-vocabulary.mjs"
```

Run: `pnpm validate:vocabulary --level N1`

Expected: FAIL because `public/data/jlpt/n1.json` does not exist.

- [ ] **Step 4: Record attribution**

Append an OpenJLPT section to `public/THIRD_PARTY_LICENSES.md` containing the resolved SHA, repository link, CC BY-SA 4.0 link, and the upstream NOTICE attribution for JMdict/EDICT, Jonathan Waller's JLPT Resources, and Tatoeba.

- [ ] **Step 5: Verify source files without staging unrelated changes**

Run a Node one-liner that parses each source file and prints the five counts. Expected output contains `N1 3463`, `N2 1793`, `N3 1784`, `N4 632`, `N5 662`.

- [ ] **Step 6: Commit**

```powershell
git add data/vendor/openjlpt scripts/validate-vocabulary.mjs package.json public/THIRD_PARTY_LICENSES.md
git commit -m "chore: add OpenJLPT vocabulary sources"
```

### Task 2: Translate N1 runtime vocabulary

**Files:**
- Create: `public/data/jlpt/n1.json`

**Interfaces:**
- Consumes: `data/vendor/openjlpt/vocab/n1.json` with 3,463 entries.
- Produces: `VocabularyWord[]` for level `N1` with 3,463 entries.

- [ ] **Step 1: Create the N1 runtime projection**

For every source entry, preserve order and write exactly:

```json
{
  "word": "あざ笑う",
  "reading": "あざわらう",
  "pronunciationKo": "아자와라우",
  "meaningKo": "비웃다, 조롱하다",
  "level": "N1"
}
```

When source `reading` is empty, use `word`. Translate representative senses into concise Korean dictionary-form text separated by `, `, and derive a consistent learner-friendly Korean pronunciation from the final reading. Do not add examples, English meanings, status fields, or commentary to JSON.

- [ ] **Step 2: Validate N1**

Run: `pnpm validate:vocabulary --level N1`

Expected: PASS with `N1: 3463 entries valid`.

- [ ] **Step 3: Spot-check ambiguity and pronunciation**

Inspect at least 20 evenly distributed entries including kana-only, katakana, kanji, long vowels, small っ, contracted sounds, and ん. Correct empty, English, duplicated, or obviously context-wrong Korean values.

### Task 3: Translate N2 runtime vocabulary

**Files:**
- Create: `public/data/jlpt/n2.json`

**Interfaces:**
- Consumes: `data/vendor/openjlpt/vocab/n2.json` with 1,793 entries.
- Produces: `VocabularyWord[]` for level `N2` with 1,793 entries.

- [ ] **Step 1: Create the N2 runtime projection**

Preserve source order and emit only this exact shape for every entry:

```json
{
  "word": "日本語",
  "reading": "にほんご",
  "pronunciationKo": "니혼고",
  "meaningKo": "일본어",
  "level": "N2"
}
```

Use `word` when source `reading` is empty. Korean meanings are concise dictionary-form representative senses joined with `, `; pronunciation is learner-friendly Korean based on the final reading. Omit examples and English data.

- [ ] **Step 2: Validate N2**

Run: `pnpm validate:vocabulary --level N2`

Expected: PASS with `N2: 1793 entries valid`.

- [ ] **Step 3: Spot-check 20 distributed N2 entries**

Cover kana-only, katakana, kanji, long vowels, small っ, contracted sounds, and ん. Correct empty, English, duplicated, or obviously context-wrong Korean values.

### Task 4: Translate N3 runtime vocabulary

**Files:**
- Create: `public/data/jlpt/n3.json`

**Interfaces:**
- Consumes: `data/vendor/openjlpt/vocab/n3.json` with 1,784 entries.
- Produces: `VocabularyWord[]` for level `N3` with 1,784 entries.

- [ ] **Step 1: Create the N3 runtime projection**

Preserve source order and emit only:

```json
{
  "word": "生活",
  "reading": "せいかつ",
  "pronunciationKo": "세이카츠",
  "meaningKo": "생활",
  "level": "N3"
}
```

Use `word` when source `reading` is empty. Translate representative senses into concise Korean dictionary-form text joined with `, ` and generate a learner-friendly Korean pronunciation from the final reading. Omit examples and English data.

- [ ] **Step 2: Validate N3**

Run: `pnpm validate:vocabulary --level N3`

Expected: PASS with `N3: 1784 entries valid`.

- [ ] **Step 3: Spot-check 20 distributed N3 entries**

Cover kana-only, katakana, kanji, long vowels, small っ, contracted sounds, and ん. Correct empty, English, duplicated, or obviously context-wrong Korean values.

### Task 5: Translate N4 runtime vocabulary

**Files:**
- Create: `public/data/jlpt/n4.json`

**Interfaces:**
- Consumes: `data/vendor/openjlpt/vocab/n4.json` with 632 entries.
- Produces: `VocabularyWord[]` for level `N4` with 632 entries.

- [ ] **Step 1: Create the N4 runtime projection**

Preserve source order and emit only:

```json
{
  "word": "予定",
  "reading": "よてい",
  "pronunciationKo": "요테이",
  "meaningKo": "예정",
  "level": "N4"
}
```

Use `word` when source `reading` is empty. Translate representative senses into concise Korean dictionary-form text joined with `, ` and generate a learner-friendly Korean pronunciation from the final reading. Omit examples and English data.

- [ ] **Step 2: Validate N4**

Run: `pnpm validate:vocabulary --level N4`

Expected: PASS with `N4: 632 entries valid`.

- [ ] **Step 3: Spot-check 20 distributed N4 entries**

Cover kana-only, katakana, kanji, long vowels, small っ, contracted sounds, and ん. Correct empty, English, duplicated, or obviously context-wrong Korean values.

### Task 6: Translate N5 runtime vocabulary

**Files:**
- Create: `public/data/jlpt/n5.json`

**Interfaces:**
- Consumes: `data/vendor/openjlpt/vocab/n5.json` with 662 entries.
- Produces: `VocabularyWord[]` for level `N5` with 662 entries.

- [ ] **Step 1: Create the N5 runtime projection**

Preserve source order and emit only:

```json
{
  "word": "食べる",
  "reading": "たべる",
  "pronunciationKo": "타베루",
  "meaningKo": "먹다",
  "level": "N5"
}
```

Use `word` when source `reading` is empty. Translate representative senses into concise Korean dictionary-form text joined with `, ` and generate a learner-friendly Korean pronunciation from the final reading. Omit examples and English data.

- [ ] **Step 2: Validate N5**

Run: `pnpm validate:vocabulary --level N5`

Expected: PASS with `N5: 662 entries valid`.

- [ ] **Step 3: Spot-check 20 distributed N5 entries**

Cover kana-only, katakana, kanji, long vowels, small っ, contracted sounds, and ん. Correct empty, English, duplicated, or obviously context-wrong Korean values.

- [ ] **Step 4: Commit all five validated runtime files**

After Tasks 2~6 all pass:

```powershell
pnpm validate:vocabulary
git add public/data/jlpt
git commit -m "feat: add Korean JLPT vocabulary data"
```

Expected validator summary: `8334 entries valid`.

### Task 7: Add vocabulary types, local dates, and balanced daily selection

**Files:**
- Create: `src/features/vocabulary/types.ts`
- Create: `src/features/vocabulary/local-date.ts`
- Create: `src/features/vocabulary/local-date.test.ts`
- Create: `src/features/vocabulary/daily-word-selector.ts`
- Create: `src/features/vocabulary/daily-word-selector.test.ts`

**Interfaces:**
- Produces: `JLPT_LEVELS`, `JlptLevel`, `VocabularyWord`, `localDateKey(date)`, `nextLocalDateKey(date)`, and `getDailyWords(wordsByLevel, dateKey, activeLevels, count)`.

- [ ] **Step 1: Write failing local-date tests**

Cover zero-padded local `YYYY-MM-DD` and next-date behavior across month/year boundaries by constructing local `Date` values. Assert that implementation does not use UTC output.

Run: `pnpm test -- src/features/vocabulary/local-date.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 2: Implement types and local-date helpers**

Define:

```ts
export const JLPT_LEVELS = ["N1", "N2", "N3", "N4", "N5"] as const;
export type JlptLevel = (typeof JLPT_LEVELS)[number];
export interface VocabularyWord {
  word: string;
  reading: string;
  pronunciationKo: string;
  meaningKo: string;
  level: JlptLevel;
}
```

`localDateKey` uses local getters; `nextLocalDateKey` clones the supplied date and calls `setDate(getDate() + 1)`.

- [ ] **Step 3: Write failing selector tests**

Use small fixtures for all five levels and assert identical input gives identical ordered output, input arrays are unchanged, output keys are unique, one level supplies five, three levels allocate `2/2/1`, five levels allocate one each, and the known date fixtures produce different outputs.

Run: `pnpm test -- src/features/vocabulary/daily-word-selector.test.ts`

Expected: FAIL because `getDailyWords` does not exist.

- [ ] **Step 4: Implement deterministic selection**

Use a stable 32-bit string hash and Mulberry32 PRNG. Shuffle a copy of active levels with seed `${dateKey}|levels`, allocate slots round-robin, and independently shuffle copies of each level pool with seed `${dateKey}|${level}|words`. Throw a descriptive error if count is negative, active levels are empty, or a required pool lacks enough unique entries.

- [ ] **Step 5: Run focused tests and commit**

```powershell
pnpm test -- src/features/vocabulary/local-date.test.ts src/features/vocabulary/daily-word-selector.test.ts
git add src/features/vocabulary/types.ts src/features/vocabulary/local-date.ts src/features/vocabulary/local-date.test.ts src/features/vocabulary/daily-word-selector.ts src/features/vocabulary/daily-word-selector.test.ts
git commit -m "feat: add deterministic daily word selection"
```

### Task 8: Extend settings with next-day vocabulary levels

**Files:**
- Create: `src/features/vocabulary/daily-word-settings.ts`
- Create: `src/features/vocabulary/daily-word-settings.test.ts`
- Modify: `src/lib/settings.ts`
- Modify: `src/lib/settings.test.ts`
- Modify: tests constructing `AppSettings` literals under `src/features/practice/components/`

**Interfaces:**
- Consumes: `JlptLevel`, `localDateKey`, `nextLocalDateKey`.
- Produces: version 2 `AppSettings.dailyWords`, `resolveDailyWordSettings(settings, today)`, and `scheduleDailyWordLevels(settings, selected, now)`.

- [ ] **Step 1: Write failing settings tests**

Assert version 1 storage migrates existing guide fields and adds active `N1/N2/N3`; malformed levels fall back; scheduling preserves active levels, sets pending levels and tomorrow; repeated same-day save replaces pending levels; resolving before effective date keeps active; resolving on/after it promotes pending; and empty selection is rejected.

Run: `pnpm test -- src/lib/settings.test.ts src/features/vocabulary/daily-word-settings.test.ts`

Expected: FAIL because daily-word settings are absent.

- [ ] **Step 2: Implement pure scheduling and promotion**

Use this exact state:

```ts
export interface DailyWordLevelSettings {
  activeLevels: JlptLevel[];
  pendingLevels: JlptLevel[] | null;
  effectiveDate: string | null;
}
```

Normalize valid unique levels in `JLPT_LEVELS` order. The default is active `["N1", "N2", "N3"]`, pending `null`, effective date `null`.

- [ ] **Step 3: Migrate AppSettings to version 2**

Preserve `guideLines`, `traceGuide`, and `overlayOpacity`; parse both stored version 1 and version 2. Saving always writes normalized version 2. Update test fixtures that construct `AppSettings` literals with `dailyWords: DEFAULT_DAILY_WORD_SETTINGS`.

- [ ] **Step 4: Run focused and dependent tests, then commit**

```powershell
pnpm test -- src/lib/settings.test.ts src/features/vocabulary/daily-word-settings.test.ts src/features/practice/components/practice-session.test.tsx
git add src/lib/settings.ts src/lib/settings.test.ts src/features/vocabulary/daily-word-settings.ts src/features/vocabulary/daily-word-settings.test.ts src/features/practice/components
git commit -m "feat: schedule daily word level settings"
```

### Task 9: Add level loader and home daily-word cards

**Files:**
- Create: `src/features/vocabulary/vocabulary-loader.ts`
- Create: `src/features/vocabulary/vocabulary-loader.test.ts`
- Create: `src/features/vocabulary/components/daily-words.tsx`
- Create: `src/features/vocabulary/components/daily-words.test.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.test.tsx`

**Interfaces:**
- Consumes: active settings, `getDailyWords`, `/data/jlpt/{n1,n2,n3,n4,n5}.json`.
- Produces: `loadVocabularyLevel(level, fetcher?)`, `clearVocabularyCache()`, and `<DailyWords />`.

- [ ] **Step 1: Write failing loader tests**

Assert URL mapping, one request per cached level, separate requests per level, exact runtime shape acceptance, invalid payload rejection, and cache clearing between tests.

Run: `pnpm test -- src/features/vocabulary/vocabulary-loader.test.ts`

Expected: FAIL because the loader does not exist.

- [ ] **Step 2: Implement the loader**

Map `N1` to `/data/jlpt/n1.json` through `N5` to `/data/jlpt/n5.json`. Cache successful in-flight/result promises by level, remove a rejected promise from cache, and throw `N1 단어 데이터를 불러오지 못했어요.`-style errors for HTTP or schema failure.

- [ ] **Step 3: Write failing DailyWords tests**

Inject a loader and date into the component. Assert loading status, five cards, `reading · pronunciationKo`, Korean meaning, level badge, local display date, only active levels requested, settings promotion, and isolated error/retry behavior.

Run: `pnpm test -- src/features/vocabulary/components/daily-words.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 4: Implement and place DailyWords**

Load settings after client mount, resolve pending settings for the local date, persist promotion if it changed, load only active levels, select five, and render semantic article cards. Insert `<DailyWords />` after the quick-start section and before `<HomeDashboard />`.

- [ ] **Step 5: Run focused home tests and commit**

```powershell
pnpm test -- src/features/vocabulary/vocabulary-loader.test.ts src/features/vocabulary/components/daily-words.test.tsx src/app/page.test.tsx
git add src/features/vocabulary/vocabulary-loader.ts src/features/vocabulary/vocabulary-loader.test.ts src/features/vocabulary/components/daily-words.tsx src/features/vocabulary/components/daily-words.test.tsx src/app/page.tsx src/app/page.test.tsx
git commit -m "feat: show daily JLPT words on home"
```

### Task 10: Add the accessible header difficulty modal

**Files:**
- Create: `src/features/vocabulary/components/daily-word-settings-button.tsx`
- Create: `src/features/vocabulary/components/daily-word-settings-button.test.tsx`
- Modify: `src/components/app-nav.tsx`
- Modify: `src/components/app-nav.test.tsx`

**Interfaces:**
- Consumes: `loadSettings`, `saveSettings`, `scheduleDailyWordLevels`, `JLPT_LEVELS`.
- Produces: a header button named `오늘의 단어 설정` and dialog named `오늘의 단어 난이도`.

- [ ] **Step 1: Write failing modal tests**

Assert the icon button opens the dialog, default N1/N2/N3 checks, pending selection precedence, all-unchecked save disabled with explanation, cancel without write, save schedules tomorrow, Korean saved-status text, Escape close, focus entry/trap/return, and backdrop close.

Run: `pnpm test -- src/features/vocabulary/components/daily-word-settings-button.test.tsx src/components/app-nav.test.tsx`

Expected: FAIL because the settings button is absent.

- [ ] **Step 2: Implement the settings button and dialog**

Use a text-free inline SVG gear with `aria-hidden="true"` inside a button whose `aria-label` is `오늘의 단어 설정`. Render a portal-free dialog with checkboxes `N1` through `N5`, copy `변경한 난이도는 내일부터 적용됩니다`, buttons `취소` and `저장`, and status `내일부터 N2, N4 단어가 표시됩니다.` after a successful save.

- [ ] **Step 3: Integrate at the header's right edge**

Render the settings component after the navigation list inside the header row without changing the four destination links or their active-route semantics.

- [ ] **Step 4: Run focused tests and commit**

```powershell
pnpm test -- src/features/vocabulary/components/daily-word-settings-button.test.tsx src/components/app-nav.test.tsx
git add src/features/vocabulary/components/daily-word-settings-button.tsx src/features/vocabulary/components/daily-word-settings-button.test.tsx src/components/app-nav.tsx src/components/app-nav.test.tsx
git commit -m "feat: add daily word difficulty settings"
```

### Task 11: Style, integrate, and verify the full feature

**Files:**
- Modify: `src/app/globals.css`
- Modify: `e2e/core-flow.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: header modal and `DailyWords` markup from Tasks 9 and 10.
- Produces: responsive production-ready behavior at desktop, 320×568 Chromium, and iPhone WebKit sizes.

- [ ] **Step 1: Add a failing E2E scenario**

Test that home shows five word cards with level badges, the header button opens the difficulty dialog, selecting only N4 and saving reports next-day application, and today's visible five cards do not change.

Run: `pnpm test:e2e -- --grep "daily words"`

Expected: FAIL before final styling/integration is complete.

- [ ] **Step 2: Add focused responsive styles**

Extend existing header CSS without replacing unrelated rules. Give the gear button a 44×44 target, keep desktop navigation and mobile wrapping usable, style the modal overlay/panel/check list/actions, and create a responsive daily-word grid with stable loading/error height. Preserve existing uncommitted CSS changes.

- [ ] **Step 3: Document the bundled dataset and settings**

Add a README section stating that N1~N5 vocabulary is bundled from OpenJLPT, daily words default to N1~N3, and saved difficulty changes apply the next local day.

- [ ] **Step 4: Run the full verification suite**

```powershell
pnpm validate:vocabulary
pnpm validate:kana
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm test:e2e
```

Expected: all commands exit 0.

- [ ] **Step 5: Inspect responsive output**

Capture or inspect home and the open modal at desktop, 320×568 Chromium, and iPhone 13 WebKit. Confirm no horizontal overflow, clipped dialog actions, obscured navigation, or unreadable cards.

- [ ] **Step 6: Commit**

```powershell
git add src/app/globals.css e2e/core-flow.spec.ts README.md
git commit -m "feat: finish daily JLPT vocabulary experience"
```
