import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { tsImport } from "tsx/esm/api";

const { KANA_CATALOG } = await tsImport("../src/features/kana/catalog.ts", import.meta.url);

const scripts = ["hiragana", "katakana"];
const groups = ["basic", "voiced", "yoon", "small", "extended"];
const ids = new Set();
const errors = [];
const strokeAssetKeys = new Set();
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const strokeAssetRoot = join(projectRoot, "public", "strokes");

for (const unit of KANA_CATALOG) {
  if (ids.has(unit.id)) {
    errors.push(`Duplicate id: ${unit.id}`);
  }
  ids.add(unit.id);

  for (const field of ["id", "display", "script", "group", "romaji", "readingKo"]) {
    if (!unit[field]) {
      errors.push(`${unit.id} has an empty ${field}`);
    }
  }

  if (unit.glyphs.length === 0) {
    errors.push(`${unit.id} has no glyphs`);
  }

  if (unit.strokeAssetKeys.length !== unit.glyphs.length) {
    errors.push(`${unit.id} has a stroke-key count that does not match its glyph count`);
  }

  if (unit.strokeAssetKeys.some((key) => !key)) {
    errors.push(`${unit.id} has a missing stroke asset key`);
  }

  for (const key of unit.strokeAssetKeys) {
    strokeAssetKeys.add(key);
    if (!existsSync(join(strokeAssetRoot, `${key}.svg`))) {
      errors.push(`${unit.id} references a missing stroke asset: ${key}`);
    }
  }
}

if (errors.length > 0) {
  throw new Error(`Kana catalog validation failed:\n${errors.join("\n")}`);
}

const count = (script, group) => KANA_CATALOG.filter((unit) => unit.script === script && unit.group === group).length;
const countByGroup = (group) => KANA_CATALOG.filter((unit) => unit.group === group).length;

console.log(`Kana catalog validation passed: ${KANA_CATALOG.length} units`);
for (const script of scripts) {
  console.log(`${script}: ${groups.map((group) => `${group}=${count(script, group)}`).join(", ")}`);
}
console.log(`groups: ${groups.map((group) => `${group}=${countByGroup(group)}`).join(", ")}`);
console.log(`stroke assets=${strokeAssetKeys.size}`);
