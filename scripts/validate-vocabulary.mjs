import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LEVELS = ["N1", "N2", "N3", "N4", "N5"];
const EXPECTED_COUNTS = {
  N1: 3463,
  N2: 1793,
  N3: 1784,
  N4: 632,
  N5: 662,
};
const RUNTIME_KEYS = ["level", "meaningKo", "pronunciationKo", "reading", "word"];
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const errors = [];

function addError(level, index, message) {
  errors.push(`[${level} entry ${index}] ${message}`);
}

function parseJsonFile(filePath, level, kind) {
  if (!existsSync(filePath)) {
    addError(level, "n/a", `Missing ${kind} file: ${filePath}`);
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    addError(level, "n/a", `Could not parse ${kind} file: ${error.message}`);
    return null;
  }
}

function validateLevel(level) {
  const fileName = `${level.toLowerCase()}.json`;
  const sourcePath = join(projectRoot, "data", "vendor", "openjlpt", "vocab", fileName);
  const runtimePath = join(projectRoot, "public", "data", "jlpt", fileName);
  const source = parseJsonFile(sourcePath, level, "source");

  if (!Array.isArray(source)) {
    if (source !== null) {
      addError(level, "n/a", "Source data must be a JSON array.");
    }
  } else if (source.length !== EXPECTED_COUNTS[level]) {
    addError(level, "n/a", `Source count ${source.length} does not match expected ${EXPECTED_COUNTS[level]}.`);
  }

  const runtime = parseJsonFile(runtimePath, level, "runtime");
  if (!Array.isArray(runtime)) {
    if (runtime !== null) {
      addError(level, "n/a", "Runtime data must be a JSON array.");
    }
    return;
  }

  if (runtime.length !== EXPECTED_COUNTS[level]) {
    addError(level, "n/a", `Runtime count ${runtime.length} does not match expected ${EXPECTED_COUNTS[level]}.`);
  }

  if (Array.isArray(source) && runtime.length !== source.length) {
    addError(level, "n/a", `Runtime count ${runtime.length} does not match source count ${source.length}.`);
  }

  const seenKeys = new Set();
  for (const [index, entry] of runtime.entries()) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      addError(level, index, "Runtime entry must be an object.");
      continue;
    }

    const entryKeys = Object.keys(entry).sort();
    if (entryKeys.length !== RUNTIME_KEYS.length || entryKeys.some((key, keyIndex) => key !== RUNTIME_KEYS[keyIndex])) {
      addError(level, index, `Runtime entry keys must be exactly ${RUNTIME_KEYS.join(", ")}.`);
    }

    for (const field of RUNTIME_KEYS) {
      if (typeof entry[field] !== "string" || entry[field].trim().length === 0) {
        addError(level, index, `${field} must be a non-empty string.`);
      }
    }

    if (entry.level !== level) {
      addError(level, index, `level must equal ${level}.`);
    }

    const duplicateKey = `${entry.level}\u0000${entry.word}\u0000${entry.reading}`;
    if (seenKeys.has(duplicateKey)) {
      addError(level, index, "Duplicate level, word, and reading combination.");
    }
    seenKeys.add(duplicateKey);
  }
}

function selectedLevels(argumentsList) {
  if (argumentsList.length === 0) {
    return LEVELS;
  }

  if (argumentsList.length === 2 && argumentsList[0] === "--level" && LEVELS.includes(argumentsList[1])) {
    return [argumentsList[1]];
  }

  addError("N1", "n/a", "Usage: pnpm validate:vocabulary [--level N1|N2|N3|N4|N5]");
  return [];
}

const levelsToValidate = selectedLevels(process.argv.slice(2));
for (const level of levelsToValidate) {
  validateLevel(level);
}

if (errors.length > 0) {
  throw new Error(`Vocabulary validation failed:\n${errors.join("\n")}`);
}

for (const level of levelsToValidate) {
  console.log(`${level}: ${EXPECTED_COUNTS[level]} entries valid`);
}
